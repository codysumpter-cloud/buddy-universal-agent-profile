#!/usr/bin/env python3
"""Bounded assistant-designed bias search on the verified Kinetix edited actor.

Experimental. Evaluates candidates using dev conditions, then uses a sealed
new-condition evaluation once. This is NOT a separate LLM-generated repair,
not an automated model deployment, and not a proof of generalization.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.metadata
import json
from pathlib import Path
import time

import numpy as np

from physics_rollout import (KINETIX_VERSION, KINETIX_LEVEL, ACTOR_PARAM_COUNT,
                            actor_logits, action_from_logits, get_models,
                            verify_runtime_level)
from reproduce import obtain_assets

SCHEMA = "prismtek-kinetix-bounded-repair-v1"
# These developmental conditions are ALREADY known failure/working scenarios.
DEV = (
    ("nominal", 1.0, 1.0, 1.0),
    ("low_friction_50pct", 0.5, 1.0, 1.0),
    ("high_gravity_125pct", 1.0, 1.0, 1.25),
)
# These physics values were chosen and locked before running any repair search.
# No measurements from them are provided to the selection algorithm.
HOLDOUT = (
    ("low_friction_60pct", 0.6, 1.0, 1.0),
    ("high_gravity_115pct", 1.0, 1.0, 1.15),
    ("combined_friction_80pct_gravity_110pct", 0.8, 1.0, 1.10),
)
# Only bias scalars inside the original authors' isolated control path.
ALLOWED_BIAS_INDICES = frozenset((122, 123, 124, 127))


def manifest() -> list[dict]:
    """Fixed proposals: exactly 19 numeric candidates including the published actor."""
    offsets: list[tuple[str, dict[int, float]]] = [("published", {})]
    for delta in (-64, -48, -36, -24, -12, 12, 24, 36):
        offsets.append((f"turn_threshold_{delta:+d}", {124: delta}))
    for delta in (-40, -20, 20, 40):
        offsets.append((f"handoff_{delta:+d}", {127: delta}))
    for delta in (-40, 40):
        offsets.append((f"early_x_{delta:+d}", {123: delta}))
    for delta in (-40, 40):
        offsets.append((f"late_x_{delta:+d}", {122: delta}))
    offsets.extend((
        ("longer_reverse_later_handoff", {124: -24, 127: -20}),
        ("longer_reverse_earlier_handoff", {124: -24, 127: 20}),
    ))
    result = []
    for name, edits in offsets:
        assert set(edits).issubset(ALLOWED_BIAS_INDICES)
        result.append({"id": name, "edits": [{"tensor": "actor0.b", "index": k, "delta": v} for k, v in sorted(edits.items())]})
    assert len(result) == 19
    return result


def apply_candidate(base: dict[str, np.ndarray], spec: dict) -> dict[str, np.ndarray]:
    if not isinstance(spec, dict) or set(spec) != {"id", "edits"} or not isinstance(spec["edits"], list):
        raise ValueError("invalid candidate")
    if len(spec["edits"]) > 2:
        raise ValueError("candidate exceeds sparse-edit cap")
    candidate = dict(base)
    candidate["actor0.b"] = np.array(base["actor0.b"], copy=True)
    seen = set()
    for edit in spec["edits"]:
        if set(edit) != {"tensor", "index", "delta"}:
            raise ValueError("invalid edit")
        key = edit["index"]
        value = edit["delta"]
        if edit["tensor"] != "actor0.b" or type(key) is not int or key not in ALLOWED_BIAS_INDICES or key in seen:
            raise ValueError("edit outside isolated bias circuit or duplicate")
        if type(value) not in (int, float) or not np.isfinite(value) or abs(value) > 64:
            raise ValueError("unsafe magnitude")
        seen.add(key)
        candidate["actor0.b"][key] += value
    return candidate


def model_digest(model: dict[str, np.ndarray]) -> str:
    h = hashlib.sha256()
    for key in sorted(model):
        a = np.asarray(model[key], dtype="<f8")
        h.update(key.encode("utf-8") + b"\0")
        h.update(json.dumps(a.shape).encode("ascii") + b"\0")
        h.update(a.tobytes())
    return h.hexdigest()


def changed_count(original: dict[str, np.ndarray], other: dict[str, np.ndarray]) -> int:
    if set(original) != set(other):
        raise ValueError("model shape changed")
    return sum(int(np.count_nonzero(original[k] != other[k])) for k in original)


def get_runtime(assets):
    import jax
    import jax.numpy as jnp
    import kinetix
    from kinetix.environment import ActionType, ObservationType, make_kinetix_env
    from kinetix.util import load_from_json_file

    if importlib.metadata.version("kinetix-env") != KINETIX_VERSION:
        raise RuntimeError("unverified Kinetix version")
    level_path = Path(kinetix.__file__).resolve().parent / "levels" / KINETIX_LEVEL
    level_hash = verify_runtime_level(level_path)
    level, static_params, base_params = load_from_json_file(str(level_path))
    if (static_params.num_motor_bindings, static_params.num_thruster_bindings, base_params.max_timesteps) != (4, 2, 256):
        raise RuntimeError("incompatible Kinetix environment")
    before, patched = get_models(assets)
    env = make_kinetix_env(ActionType.MULTI_DISCRETE, ObservationType.SYMBOLIC_FLAT,
                           reset_fn=None, env_params=base_params, static_env_params=static_params,
                           auto_reset=False)
    return (jax, jnp, env, level, base_params, before, patched, level_hash)


def configuration(base_params, level, condition, jnp):
    name, friction, power, gravity = condition
    params = base_params.replace(base_friction=float(base_params.base_friction)*friction,
                                 base_motor_power=float(base_params.base_motor_power)*power)
    new_level = level.replace(gravity=level.gravity * gravity)
    return params, new_level


def simulate_one(runtime, weights, condition, seed: int, *, trace=False) -> dict:
    jax, jnp, env, level, base_params = runtime[:5]
    params, changed_level = configuration(base_params, level, condition, jnp)
    rng = np.random.default_rng(np.random.SeedSequence([seed, 7001]))
    key = jax.random.PRNGKey(seed)
    key, reset_key = jax.random.split(key)
    obs, state = env.reset(reset_key, params, override_reset_state=changed_level)
    success, done, reward_total, actions, trajectory = False, False, 0., [], []
    terminal_reward = 0.
    for step in range(256):
        np_obs = np.asarray(jax.device_get(obs))
        action = action_from_logits(actor_logits(weights, np_obs), rng, "sample")
        if trace and (step % 4 == 0 or step < 8):
            body = jax.device_get(state.polygon)
            circles = jax.device_get(state.circle)
            red_polys = np.flatnonzero(np.asarray(jax.device_get(state.polygon_shape_roles)) == 3)
            red_circles = np.flatnonzero(np.asarray(jax.device_get(state.circle_shape_roles)) == 3)
            points = []
            for i in red_polys: points.append(np.asarray(body.position[i],dtype=float))
            for i in red_circles: points.append(np.asarray(circles.position[i],dtype=float))
            green = np.asarray(circles.position[0],dtype=float)
            nearest_red_center = min((float(np.linalg.norm(green-p)) for p in points), default=None)
            trajectory.append({
                "step": step, "body_x": float(body.position[5,0]), "body_y": float(body.position[5,1]),
                "body_vx": float(body.velocity[5,0]), "body_vy": float(body.velocity[5,1]),
                "green_x": float(green[0]), "green_y": float(green[1]),
                "nearest_red_center_distance": nearest_red_center,
                "first_motor_action": int(action[0]),
            })
        key, step_key = jax.random.split(key)
        obs, state, reward, terminated, info = env.step(step_key, state, jnp.asarray(action), params)
        reward_total += float(reward)
        done, success = bool(terminated), bool(info.get("GoalR", False))
        if step < 8: actions.append(int(action[0]))
        if done:
            terminal_reward = float(reward)
            if trace:
                # Last state captured even if terminal step was between sample frames.
                body = np.asarray(jax.device_get(state.polygon.position), dtype=float)
                green = np.asarray(jax.device_get(state.circle.position), dtype=float)[0]
                trajectory.append({"step":step+1, "terminal":True,"body_x":float(body[5,0]),
                    "body_y":float(body[5,1]),"green_x":float(green[0]),"green_y":float(green[1])})
            break
    outcome = "goal" if success else ("negative_terminal" if done and terminal_reward < -0.5 else "timeout_or_other")
    row = {"condition": condition[0],"seed": seed,"steps":step+1,"reward":round(reward_total,9),
           "terminal_reward":round(float(terminal_reward),9),"success":success,"done":done,
           "outcome":outcome,"initial_motor_actions":actions}
    if trace: row["trajectory"] = trajectory
    return row


def evaluate_candidate(runtime, weights, conditions, seeds, *, trace=False):
    return [simulate_one(runtime, weights, condition, seed, trace=trace)
            for condition in conditions for seed in seeds]


def score_candidate(rows):
    # Any nominal failure invalidates a candidate. Then maximize number of
    # difficult-condition successes; tie-break by fewer edits, then ID.
    buckets = {condition[0]:[row for row in rows if row["condition"]==condition[0]] for condition in DEV}
    if any(not row["success"] for row in buckets["nominal"]):
        return -1
    return sum(int(row["success"]) for name in ("low_friction_50pct","high_gravity_125pct") for row in buckets[name])


def run_diagnostic(assets, output, seed):
    runtime = get_runtime(assets)
    before, patched = runtime[5:7]
    rows={}
    for policy_name, weights in (("baseline", before),("published_patch",patched)):
        rows[policy_name]=evaluate_candidate(runtime,weights,DEV,[seed],trace=True)
    result={"schema":SCHEMA,"stage":"diagnostic","level_sha256":runtime[7],
            "conditions":[x[0] for x in DEV],"runs":rows,
            "limits":"red-center distance is a proximity metric, NOT certified collision geometry"}
    output.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    return result


def run_search(assets, output, candidate_output, seed):
    runtime=get_runtime(assets)
    patched=runtime[6]
    specs=manifest()
    scores=[]
    for spec in specs:
        model=apply_candidate(patched,spec)
        rows=evaluate_candidate(runtime,model,DEV,[seed],trace=False)
        scores.append({"candidate":spec,"source_model_sha256":model_digest(patched),
                       "target_model_sha256":model_digest(model),
                       "changed_parameters":changed_count(patched,model),
                       "score":score_candidate(rows),"rows":rows})
    # The published patch is a baseline. Require strict improvement on dev,
    # preserve nominal, and NEVER choose using holdout results.
    published_score=scores[0]["score"]
    better=[x for x in scores[1:] if x["score"]>published_score]
    best=min(better,key=lambda x:(-x["score"],x["changed_parameters"],x["candidate"]["id"])) if better else None
    candidate={"schema":SCHEMA,"stage":"candidate_selected" if best else "no_improvement",
               "source_model_sha256":model_digest(patched),"candidate":best["candidate"] if best else None,
               "target_model_sha256":best["target_model_sha256"] if best else None,
               "dev_seed":seed,"published_dev_score":published_score,
               "selected_dev_score":best["score"] if best else None,
               "selection":"dev_only_no_holdout_evaluations"}
    candidate_output.write_text(json.dumps(candidate,indent=2,sort_keys=True)+"\n")
    report={"schema":SCHEMA,"stage":"development_search","level_sha256":runtime[7],
           "seed":seed,"dev_conditions":[x[0] for x in DEV],
           "holdout_conditions_examined":False,"proposals":scores,
           "selected":candidate,"scope":"assistant-designed deterministic search, not LLM inference"}
    output.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    return report


def run_holdout(assets,candidate_file,output,seed):
    candidate=json.loads(candidate_file.read_text())
    if candidate.get("schema")!=SCHEMA or candidate.get("stage") not in ("candidate_selected","no_improvement"):
        raise ValueError("candidate record invalid")
    runtime=get_runtime(assets)
    patched=runtime[6]
    if model_digest(patched)!=candidate.get("source_model_sha256"):
        raise ValueError("source model changed after selection")
    if candidate["stage"]=="no_improvement":
        result={"schema":SCHEMA,"stage":"holdout_not_executed","reason":"no development improvement; preserve reserved holdout"}
    else:
        spec=candidate["candidate"]
        if spec not in manifest(): raise ValueError("candidate must belong to predeclared manifest")
        trial=apply_candidate(patched,spec)
        if model_digest(trial)!=candidate["target_model_sha256"]: raise ValueError("candidate tampered")
        rows={}
        for label,weights in (("published",patched),("candidate",trial)):
            rows[label]=evaluate_candidate(runtime,weights,HOLDOUT,[seed+i for i in range(4)])
        by_condition=[{"condition":cond[0],"published_wins":sum(r["success"] for r in rows["published"] if r["condition"]==cond[0]),
                       "candidate_wins":sum(r["success"] for r in rows["candidate"] if r["condition"]==cond[0]),"episodes_each":4} for cond in HOLDOUT]
        verdict = all(s["candidate_wins"]>=3 and s["candidate_wins"]>s["published_wins"] for s in by_condition)
        result={"schema":SCHEMA,"stage":"holdout_evaluated","selected_candidate":spec,
                "source_model_sha256":model_digest(patched),"target_model_sha256":model_digest(trial),
                "changed_parameters":changed_count(patched,trial),"holdout_seed":seed,
                "holdout_conditions":[x[0] for x in HOLDOUT],"rows":rows,"summary":by_condition,
                "evaluation_verdict":"pass" if verdict else "fail",
                "promotion":"not_approved_requires_independent_audit_and_additional_tests"}
    output.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    return result


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--stage",required=True,choices=("diagnostic","search","holdout"))
    p.add_argument("--cache",default=".cache/weightlab-upstream")
    p.add_argument("--seed",type=int,default=3101)
    p.add_argument("--output",required=True,type=Path)
    p.add_argument("--candidate",default="kinetix-repair-candidate.json",type=Path)
    a=p.parse_args()
    t=time.monotonic()
    assets=obtain_assets(Path(a.cache),allow_download=True)
    a.output.parent.mkdir(parents=True,exist_ok=True)
    if a.stage=="diagnostic": x=run_diagnostic(assets,a.output,a.seed)
    elif a.stage=="search": x=run_search(assets,a.output,a.candidate,a.seed)
    else: x=run_holdout(assets,a.candidate,a.output,a.seed+999)
    print(json.dumps({"stage":a.stage,"result":x.get("stage"),"wall_seconds":round(time.monotonic()-t,2),
         "selected":x.get("selected"),"summary":x.get("summary")},indent=2))

if __name__=="__main__":main()
