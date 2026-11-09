#!/usr/bin/env python3
"""Conservative validation of a trusted GitHub-produced Kinetix physics JSON record.

The record is *data*, not authorization or cryptographic attestation. CI has to
execute physics_rollout.py itself; this gate cannot prove the record's origin.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

SCHEMA = "prismtek-kinetix-physics-rollout-v1"
MIN_EPISODES = 64
MIN_PATCHED_RATE = 0.95
MAX_BASELINE_RATE = 0.05
LEVEL = "l/h2_car_ramp.json"
ENV_VERSION = "3.0.2"
SHA256_LEVEL = "6616869302884dcfa74ec2e8da37b523c13fdc51f4b829eb3ecd7ba5e0ada6b1"


def verify(report: dict, *, min_episodes: int = MIN_EPISODES) -> dict:
    if not isinstance(report, dict) or report.get("schema") != SCHEMA or report.get("physics_executed") is not True:
        raise ValueError("not a trusted physics schema/execution record")
    if report.get("environment") != "kinetix-env" or report.get("environment_version") != ENV_VERSION:
        raise ValueError("wrong Kinetix version")
    if report.get("environment_level") != LEVEL or report.get("level_sha256") != SHA256_LEVEL:
        raise ValueError("wrong Kinetix level fingerprint")
    if report.get("model_parameters") != 171664 or report.get("action_mode") != "sample":
        raise ValueError("wrong actor layout or action mode")
    if type(report.get("seed")) is not int or report["seed"] < 0:
        raise ValueError("missing seed")
    groups = report.get("results", {})
    if not isinstance(groups, dict) or set(groups) != {"baseline", "patched"}:
        raise ValueError("missing control/treatment results")
    summaries = {}
    for label in ("baseline", "patched"):
        group = groups[label]
        if not isinstance(group, dict) or type(group.get("episodes")) is not int:
            raise ValueError(f"{label}: invalid episode count")
        n = group["episodes"]
        rows = group.get("rows")
        if n < min_episodes or n > 1024 or not isinstance(rows, list) or len(rows) != n:
            raise ValueError(f"{label}: incomplete episodes")
        if type(group.get("wins")) is not int:
            raise ValueError(f"{label}: invalid win count")
        wins = 0
        for idx, row in enumerate(rows):
            if not isinstance(row, dict) or row.get("episode") != idx or type(row.get("episode")) is not int:
                raise ValueError(f"{label}: unpaired or duplicate episode ID")
            if type(row.get("success")) is not bool or type(row.get("done")) is not bool:
                raise ValueError(f"{label}: invalid completion bits")
            if row["success"] and not row["done"]:
                raise ValueError(f"{label}: win before terminal goal")
            if type(row.get("steps")) is not int or not 1 <= row["steps"] <= 256:
                raise ValueError(f"{label}: invalid physics step count")
            if not isinstance(row.get("reward"), (int,float)) or not math.isfinite(row["reward"]):
                raise ValueError(f"{label}: nonfinite reward")
            act = row.get("first_action")
            if not isinstance(act, list) or len(act) != 6 or any(type(a) is not int or a < 0 or a >= width for a, width in zip(act, (3,3,3,3,2,2))):
                raise ValueError(f"{label}: invalid action")
            probs = row.get("first_motor_probs")
            if not isinstance(probs, list) or len(probs) != 3 or any(not isinstance(p,(float,int)) or not math.isfinite(p) or not 0 <= p <= 1 for p in probs) or abs(sum(probs)-1) > 1e-5:
                raise ValueError(f"{label}: invalid action probabilities")
            wins += int(row["success"])
        if wins != group["wins"]:
            raise ValueError(f"{label}: wins do not match episodes")
        summaries[label] = {"episodes": n, "wins": wins, "success_rate": wins / n}
    if summaries["patched"]["episodes"] != summaries["baseline"]["episodes"]:
        raise ValueError("unpaired baseline and patched samples")
    success = (summaries["patched"]["success_rate"] >= MIN_PATCHED_RATE and
               summaries["baseline"]["success_rate"] <= MAX_BASELINE_RATE and
               summaries["patched"]["wins"] > summaries["baseline"]["wins"])
    return {"schema": "prismtek-kinetix-physics-gate-v1", "verdict": "pass" if success else "fail",
            "thresholds": {"min_episodes_per_policy": min_episodes, "patched_min_success": MIN_PATCHED_RATE,
                           "baseline_max_success": MAX_BASELINE_RATE},
            "results": summaries,
            "evidence_sha256": hashlib.sha256(json.dumps(report, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
            "note": "Host-run source pipeline; this JSON is not a signed attestation or game deployment."}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--input",required=True)
    parser.add_argument("--output",default="kinetix-physics-gate.json")
    args=parser.parse_args()
    data=json.loads(Path(args.input).read_text(encoding="utf-8"))
    result=verify(data)
    Path(args.output).write_text(json.dumps(result,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    print(json.dumps(result,indent=2))
    if result["verdict"] != "pass":
        raise SystemExit(1)

if __name__ == "__main__": main()
