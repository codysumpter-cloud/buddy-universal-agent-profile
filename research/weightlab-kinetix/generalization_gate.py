#!/usr/bin/env python3
"""Validate complete perturbation evidence and separately score prospective robustness.

IMPORTANT: complete_evidence=pass does NOT imply controller robustness. Only the
trusted CI job can establish that actual physics ran; JSON alone cannot prove it.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

from generalization import SCHEMA, SCENARIOS, episode_seed, scenario_manifest
from physics_gate import SHA256_LEVEL, ENV_VERSION, LEVEL

MIN_EPISODES = 8
MAX_EPISODES = 64
MIN_NOMINAL_PATCHED_RATE = 0.95
MIN_VARIANT_PATCHED_RATE = 0.80


def _fail(reason):
    raise ValueError(reason)


def verify(report: dict, *, min_episodes: int = MIN_EPISODES) -> dict:
    if not isinstance(report, dict) or report.get("schema") != SCHEMA or report.get("physics_executed") is not True:
        _fail("invalid generalization execution schema")
    if (report.get("environment"), report.get("environment_version")) != ("kinetix-env", ENV_VERSION):
        _fail("unexpected simulator version")
    if (report.get("environment_level"), report.get("level_sha256")) != (LEVEL, SHA256_LEVEL):
        _fail("unexpected level checksum")
    if report.get("model_parameters") != 171664 or report.get("action_mode") != "sample":
        _fail("unexpected actor or action mode")
    seed = report.get("seed")
    if type(seed) is not int or not 0 <= seed <= 2_000_000_000:
        _fail("invalid source seed")
    n = report.get("episodes_per_policy_per_scenario")
    if type(n) is not int or not min_episodes <= n <= MAX_EPISODES:
        _fail("wrong trial count")
    if report.get("scenario_count") != len(SCENARIOS):
        _fail("wrong scenario count")
    rows = report.get("scenarios")
    if not isinstance(rows, list) or len(rows) != len(SCENARIOS):
        _fail("incomplete scenario set")
    # Pin actual simulator dynamics values, not just arbitrary labels.
    manifest = scenario_manifest(0.4, 900.0, [0.0, -9.81])
    summary = []
    performance_pass = True
    for idx, (data, expected) in enumerate(zip(rows, manifest)):
        if not isinstance(data, dict) or set(data) != {"scenario", "results"}:
            _fail("unknown scenario payload")
        actual = data["scenario"]
        if not isinstance(actual, dict) or set(actual) != set(expected):
            _fail("unexpected parameter schema")
        for field, desired in expected.items():
            value = actual.get(field)
            if field == "id":
                if value != desired: _fail("unexpected variation label/order")
            elif field == "gravity":
                if (not isinstance(value, list) or len(value) != 2 or
                    any(type(v) not in (int, float) or not math.isfinite(v) or abs(v-d) > 1e-4 for v, d in zip(value, desired))):
                    _fail("wrong gravity vector")
            elif type(value) not in (int, float) or not math.isfinite(value) or abs(value-desired) > 1e-5:
                _fail("wrong dynamics parameter")
        policies = data["results"]
        if not isinstance(policies, dict) or set(policies) != {"baseline", "patched"}:
            _fail("missing paired policy")
        counts = {}
        for label in ("baseline", "patched"):
            group = policies[label]
            if not isinstance(group, dict) or type(group.get("episodes")) is not int or group["episodes"] != n:
                _fail("unpaired episode count")
            if type(group.get("wins")) is not int or not 0 <= group["wins"] <= n:
                _fail("invalid win count")
            episodes = group.get("rows")
            if not isinstance(episodes, list) or len(episodes) != n:
                _fail("missing episode rows")
            wins = 0
            for i, row in enumerate(episodes):
                if not isinstance(row, dict) or type(row.get("episode")) is not int or row["episode"] != i:
                    _fail("duplicated or skipped episode")
                if type(row.get("episode_seed")) is not int or row["episode_seed"] != episode_seed(seed, idx, i):
                    _fail("unpaired seed")
                if type(row.get("success")) is not bool or type(row.get("done")) is not bool:
                    _fail("invalid outcome")
                if row["success"] and not row["done"]:
                    _fail("premature success")
                if type(row.get("steps")) is not int or not 1 <= row["steps"] <= 256:
                    _fail("invalid physics steps")
                if type(row.get("reward")) not in (int, float) or not math.isfinite(row["reward"]):
                    _fail("invalid physics reward")
                actions = row.get("first_action")
                if (not isinstance(actions, list) or len(actions) != 6 or
                    any(type(a) is not int or not 0 <= a < width for a,width in zip(actions,(3,3,3,3,2,2)))):
                    _fail("invalid first action")
                probs = row.get("first_motor_probs")
                if (not isinstance(probs,list) or len(probs)!=3 or
                    any(type(p) not in (int,float) or not math.isfinite(p) or not 0 <= p <= 1 for p in probs)
                    or abs(sum(probs)-1)>1e-5):
                    _fail("invalid first motor probabilities")
                wins += int(row["success"])
            if wins != group["wins"]: _fail("reported wins differ from rows")
            counts[label] = wins
        base_rate = counts["baseline"] / n
        patched_rate = counts["patched"] / n
        threshold = MIN_NOMINAL_PATCHED_RATE if idx == 0 else MIN_VARIANT_PATCHED_RATE
        accepted = patched_rate >= threshold and patched_rate > base_rate
        performance_pass &= accepted
        summary.append({"id":expected["id"],"baseline_wins":counts["baseline"],
                        "patched_wins":counts["patched"],"episodes":n,"baseline_rate":base_rate,
                        "patched_rate":patched_rate,"threshold":threshold,
                        "robustness_candidate_pass":bool(accepted)})
    fingerprint = hashlib.sha256(json.dumps(report,sort_keys=True,separators=(",", ":")).encode()).hexdigest()
    return {"schema":"prismtek-kinetix-generalization-gate-v1",
            "evidence_completeness":"pass",
            "robustness_candidate":"pass" if performance_pass else "fail",
            "robustness_policy":{"nominal_min":MIN_NOMINAL_PATCHED_RATE,
                                 "each_perturbation_min":MIN_VARIANT_PATCHED_RATE,
                                 "must_outperform_baseline":True},
            "summary":summary,"evidence_sha256":fingerprint,
            "note":"Data-gate pass verifies complete result structure, not model robustness or signed provenance. Scenario outcomes may fail. No automatic promotion."}


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--input",required=True)
    ap.add_argument("--output",default="kinetix-generalization-gate.json")
    ap.add_argument("--require-robust",action="store_true",help="optional hard threshold; not used in exploratory CI")
    args=ap.parse_args()
    report=json.loads(Path(args.input).read_text(encoding="utf-8"))
    result=verify(report)
    Path(args.output).write_text(json.dumps(result,sort_keys=True,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result,sort_keys=True,indent=2))
    if args.require_robust and result["robustness_candidate"]!="pass":
        raise SystemExit(1)

if __name__=="__main__":main()
