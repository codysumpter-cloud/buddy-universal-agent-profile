#!/usr/bin/env python3
"""Prospective physics-parameter robustness probes against actual Kinetix 3.0.2.

Scientific scope: one published car-ramp geometry; alter actual gravity, friction and
motor power via Kinetix state / env params, never modify actor weights or goals.
Failures are preserved; they do not fail CI by themselves.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import time
import numpy as np

from physics_rollout import (
    KINETIX_VERSION, KINETIX_LEVEL, ACTOR_PARAM_COUNT, action_from_logits,
    actor_logits, get_models, verify_runtime_level,
)
from reproduce import obtain_assets

SCHEMA = "prismtek-kinetix-physics-generalization-v1"
# Locked in source before evaluation: each is an actual Kinetix sim parameter.
# These are NOT six different levels or different task geometries.
SCENARIOS = (
    ("nominal",                 1.0, 1.0, 1.0),
    ("traction_50pct",         0.5, 1.0, 1.0),
    ("traction_150pct",        1.5, 1.0, 1.0),
    ("motor_power_70pct",      1.0, 0.7, 1.0),
    ("gravity_75pct",          1.0, 1.0, 0.75),
    ("gravity_125pct",         1.0, 1.0, 1.25),
)


def scenario_manifest(base_friction: float, base_motor_power: float, gravity: np.ndarray) -> list[dict]:
    gravity = np.asarray(gravity, dtype=float)
    if gravity.shape != (2,) or not np.isfinite(gravity).all() or abs(gravity[1]) < 1:
        raise ValueError("unexpected original level gravity")
    if abs(float(base_friction) - 0.4) > 0.0001 or abs(float(base_motor_power) - 900) > 0.001:
        raise ValueError("unexpected original friction or motor power, refusing to label variants")
    result = []
    for name, friction, motor, g in SCENARIOS:
        result.append({
            "id": name,
            "friction_scale": friction,
            "motor_power_scale": motor,
            "gravity_scale": g,
            "base_friction": float(base_friction * friction),
            "base_motor_power": float(base_motor_power * motor),
            "gravity": [float(x * g) for x in gravity],
        })
    return result


def episode_seed(seed: int, scenario_index: int, episode: int) -> int:
    if not (0 <= seed <= 2_000_000_000 and 0 <= scenario_index < len(SCENARIOS) and 0 <= episode < 128):
        raise ValueError("invalid seed namespace")
    return seed + scenario_index * 10000 + episode


def evaluate(assets: dict[str, Path], episodes: int, seed: int) -> dict:
    if not 1 <= episodes <= 64:
        raise ValueError("episodes per scenario must be 1..64")
    import jax
    import jax.numpy as jnp
    import kinetix
    from kinetix.environment import ActionType, ObservationType, make_kinetix_env
    from kinetix.util import load_from_json_file

    version = importlib.metadata.version("kinetix-env")
    if version != KINETIX_VERSION:
        raise RuntimeError(f"unexpected Kinetix runtime: {version}")
    level_path = Path(kinetix.__file__).resolve().parent / "levels" / KINETIX_LEVEL
    level_hash = verify_runtime_level(level_path)
    level, static_params, base_params = load_from_json_file(str(level_path))
    if (static_params.num_motor_bindings, static_params.num_thruster_bindings) != (4, 2):
        raise RuntimeError("unexpected motor/thruster layout")
    if base_params.max_timesteps != 256:
        raise RuntimeError("unexpected episode limit")
    before, after = get_models(assets)
    env = make_kinetix_env(ActionType.MULTI_DISCRETE, ObservationType.SYMBOLIC_FLAT,
        reset_fn=None, env_params=base_params, static_env_params=static_params, auto_reset=False)
    manifest = scenario_manifest(float(base_params.base_friction), float(base_params.base_motor_power), np.asarray(level.gravity))
    scenario_records = []
    for scenario_index, scenario in enumerate(manifest):
        adjusted_params = base_params.replace(
            base_friction=scenario["base_friction"],
            base_motor_power=scenario["base_motor_power"],
        )
        adjusted_level = level.replace(gravity=jnp.asarray(scenario["gravity"], dtype=level.gravity.dtype))
        policies = {}
        for label, weights in (("baseline", before), ("patched", after)):
            rows = []
            for episode in range(episodes):
                episode_key = episode_seed(seed, scenario_index, episode)
                policy_rng = np.random.default_rng(np.random.SeedSequence([seed, scenario_index, episode, 7001]))
                key = jax.random.PRNGKey(episode_key)
                key, reset_rng = jax.random.split(key)
                obs, state = env.reset(reset_rng, adjusted_params, override_reset_state=adjusted_level)
                first_action = None
                first_motor_probs = None
                success = terminal = False
                total_reward = 0.0
                for step in range(256):
                    logits = actor_logits(weights, np.asarray(jax.device_get(obs)))
                    action = action_from_logits(logits, policy_rng, "sample")
                    if step == 0:
                        first_action = action.tolist()
                        vals = np.exp(logits[:3] - np.max(logits[:3]))
                        first_motor_probs = (vals / vals.sum()).tolist()
                    key, step_key = jax.random.split(key)
                    obs, state, reward, terminated, info = env.step(step_key, state, jnp.asarray(action), adjusted_params)
                    total_reward += float(reward)
                    terminal = bool(terminated)
                    success = bool(info.get("GoalR", False))
                    if terminal:
                        break
                rows.append({
                    "episode": episode,
                    "episode_seed": episode_key,
                    "success": bool(success), "done": bool(terminal),
                    "steps": step+1, "reward": float(total_reward),
                    "first_action": first_action, "first_motor_probs": first_motor_probs,
                })
            policies[label] = {"episodes": episodes, "wins": sum(int(x["success"]) for x in rows), "rows": rows}
        scenario_records.append({"scenario": scenario, "results": policies})
    return {
        "schema": SCHEMA,
        "physics_executed": True,
        "environment": "kinetix-env", "environment_version": version,
        "environment_level": KINETIX_LEVEL, "level_sha256": level_hash,
        "model_parameters": ACTOR_PARAM_COUNT,
        "action_mode": "sample", "seed": seed,
        "episodes_per_policy_per_scenario": episodes,
        "scenario_count": len(SCENARIOS),
        "scenarios": scenario_records,
        "scope": "real JAX physics: six fixed-geometry parameter variants, not new levels; no LLM repair",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", default=".cache/weightlab-upstream")
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--episodes", type=int, default=8)
    parser.add_argument("--seed", type=int, default=1901)
    parser.add_argument("--output", default="kinetix-generalization-evidence.json")
    args = parser.parse_args()
    t0 = time.monotonic()
    assets = obtain_assets(Path(args.cache), allow_download=not args.offline)
    report = evaluate(assets, args.episodes, args.seed)
    report["wall_seconds"] = round(time.monotonic()-t0,3)
    Path(args.output).write_text(json.dumps(report, indent=2, sort_keys=True)+"\n", encoding="utf-8")
    print(json.dumps({"schema": report["schema"], "level_sha256":report["level_sha256"],
        "physics_executed":report["physics_executed"], "episodes_each":args.episodes,
        "results": [{"scenario":x["scenario"]["id"],
            "baseline":x["results"]["baseline"]["wins"],
            "patched":x["results"]["patched"]["wins"]} for x in report["scenarios"]],
        "wall_seconds":report["wall_seconds"]},indent=2))

if __name__ == "__main__":
    main()
