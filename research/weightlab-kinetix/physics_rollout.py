#!/usr/bin/env python3
"""Independently execute published PPO actors inside the real Kinetix JAX level.

Research only. Fail closed on unexpected input/action shape, assets, and runtime.
No retraining, source-reported scores, or simulation substitutes.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import sys
import time
import numpy as np

from reproduce import KEY_MAP, obtain_assets, prompt_precision, verify_git_blob

# Provenance pinned to the upstream Kinetix commit whose published l/h2 level was examined.
KINETIX_VERSION = "3.0.2"
KINETIX_LEVEL_BLOB = "f659a2ccbec0c48874e9602894a304fa0722b279"
KINETIX_LEVEL = "l/h2_car_ramp.json"
ACTOR_PARAM_COUNT = 171_664
ACTION_HEAD_WIDTHS = (3, 3, 3, 3, 2, 2)


def get_models(assets: dict[str, Path]) -> tuple[dict[str, np.ndarray], dict[str, np.ndarray]]:
    with np.load(assets["networks/ppo_final_seed0.npz"], allow_pickle=False) as z:
        before = {name: prompt_precision(z[key]) for name, key in KEY_MAP.items()}
    with np.load(assets["networks/edited_actor.npz"], allow_pickle=False) as z:
        after = {name: np.array(z[name], dtype=np.float64) for name in KEY_MAP}
    if sum(a.size for a in before.values()) != ACTOR_PARAM_COUNT or set(before) != set(after):
        raise ValueError("actor layout incompatible with the verified 171,664-param release")
    for name in before:
        if before[name].shape != after[name].shape or not np.isfinite(after[name]).all():
            raise ValueError(f"invalid tensor: {name}")
    return before, after


def actor_logits(weights: dict[str, np.ndarray], observation: np.ndarray) -> np.ndarray:
    obs = np.asarray(observation, dtype=np.float64)
    if obs.shape != (679,) or not np.isfinite(obs).all():
        raise ValueError(f"wrong Kinetix observation shape/values: {obs.shape}")
    hidden = np.maximum(obs @ weights["embed.W"] + weights["embed.b"], 0.0)
    for layer in range(5):
        hidden = np.tanh(hidden @ weights[f"actor{layer}.W"] + weights[f"actor{layer}.b"])
    logits = hidden @ weights["actor_head.W"] + weights["actor_head.b"]
    if logits.shape != (16,) or not np.isfinite(logits).all():
        raise ValueError("invalid actor output")
    return logits


def action_from_logits(logits: np.ndarray, rng: np.random.Generator, mode: str = "sample") -> np.ndarray:
    if mode not in ("sample", "argmax"):
        raise ValueError("unknown action mode")
    if logits.shape != (sum(ACTION_HEAD_WIDTHS),):
        raise ValueError("Kinetix actor must output exactly 16 logits")
    result, start = [], 0
    for width in ACTION_HEAD_WIDTHS:
        group = np.asarray(logits[start:start + width], dtype=np.float64)
        if not np.isfinite(group).all():
            raise ValueError("nonfinite action distribution")
        if mode == "argmax":
            act = int(np.argmax(group))
        else:
            weights = np.exp(group - np.max(group))
            act = int(rng.choice(width, p=weights / weights.sum()))
        result.append(act)
        start += width
    return np.asarray(result, dtype=np.int32)


def verify_runtime_level(level_path: Path) -> str:
    data = level_path.read_bytes()
    verify_git_blob(data, 50596, KINETIX_LEVEL_BLOB)
    return hashlib.sha256(data).hexdigest()


def evaluate(assets: dict[str, Path], episodes: int, action_mode: str, seed: int) -> dict:
    if not 1 <= episodes <= 1024:
        raise ValueError("episodes must be 1..1024")
    # Import the actual game/physics stack ONLY at runtime. This should never be faked.
    import jax
    import jax.numpy as jnp
    from kinetix.environment import make_kinetix_env, ActionType, ObservationType
    from kinetix.util import load_from_json_file
    import kinetix

    version = importlib.metadata.version("kinetix-env")
    if version != KINETIX_VERSION:
        raise RuntimeError(f"Kinetix runtime version drift: {version} != {KINETIX_VERSION}")
    level_path = Path(kinetix.__file__).resolve().parent / "levels" / KINETIX_LEVEL
    level_sha256 = verify_runtime_level(level_path)
    level, static_env_params, env_params = load_from_json_file(str(level_path))
    if static_env_params.num_motor_bindings != 4 or static_env_params.num_thruster_bindings != 2:
        raise RuntimeError("action layout mismatch: expected four motors and two thrusters")
    if env_params.max_timesteps != 256:
        raise RuntimeError(f"episode duration mismatch: {env_params.max_timesteps}")
    before, after = get_models(assets)
    env = make_kinetix_env(ActionType.MULTI_DISCRETE, ObservationType.SYMBOLIC_FLAT,
                           reset_fn=None, env_params=env_params,
                           static_env_params=static_env_params, auto_reset=False)
    records = {}
    for label, weights in (("baseline", before), ("patched", after)):
        rows = []
        for episode in range(episodes):
            policy_rng = np.random.default_rng(np.random.SeedSequence([seed, episode, 7001]))
            key = jax.random.PRNGKey(seed + episode)
            key, reset_rng = jax.random.split(key)
            obs, state = env.reset(reset_rng, env_params, override_reset_state=level)
            first_action = None
            first_probs = None
            won = False
            done = False
            total_reward = 0.
            for step_idx in range(256):
                np_obs = np.asarray(jax.device_get(obs))
                logits = actor_logits(weights, np_obs)
                action = action_from_logits(logits, policy_rng, action_mode)
                if step_idx == 0:
                    first_action = action.tolist()
                    proba = np.exp(logits[:3] - np.max(logits[:3]))
                    first_probs = (proba/proba.sum()).tolist()
                key, step_rng = jax.random.split(key)
                obs, state, reward, term, info = env.step(step_rng, state, jnp.asarray(action), env_params)
                total_reward += float(reward)
                done = bool(term)
                # GoalR denotes actual green-blue completion per Kinetix env.
                won = bool(info.get("GoalR", False))
                if done:
                    break
            rows.append({"episode":episode,"success":bool(won),"done":bool(done),
                         "steps":step_idx+1,"reward":total_reward,"first_action":first_action,
                         "first_motor_probs":first_probs})
        records[label] = {"wins":sum(x["success"] for x in rows),"episodes":episodes,"rows":rows}
    return {"schema":"prismtek-kinetix-physics-rollout-v1", "environment":"kinetix-env",
            "environment_version":version,"environment_level":KINETIX_LEVEL,
            "level_sha256":level_sha256,"physics_executed":True,
            "action_mode":action_mode,"seed":seed,"model_parameters":ACTOR_PARAM_COUNT,
            "results":records,"scope":"actual CPU Kinetix physics, deterministic fixed level; not original research's 1024 seed stream"}


def main() -> None:
    parser=argparse.ArgumentParser()
    parser.add_argument("--cache",default=".cache/weightlab-upstream")
    parser.add_argument("--offline",action="store_true")
    parser.add_argument("--episodes",type=int,default=2)
    parser.add_argument("--mode",choices=("sample","argmax"),default="sample")
    parser.add_argument("--seed",type=int,default=101)
    parser.add_argument("--output",default="kinetix-physics-evidence.json")
    args=parser.parse_args()
    now=time.monotonic()
    assets=obtain_assets(Path(args.cache),allow_download=not args.offline)
    report=evaluate(assets,args.episodes,args.mode,args.seed)
    report["wall_seconds"]=round(time.monotonic()-now,3)
    Path(args.output).write_text(json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    print(json.dumps({k:v if k!="results" else {p:{"wins":d["wins"],"episodes":d["episodes"],"first_action":d["rows"][0]["first_action"]} for p,d in v.items()} for k,v in report.items()}, indent=2))

if __name__ == "__main__": main()
