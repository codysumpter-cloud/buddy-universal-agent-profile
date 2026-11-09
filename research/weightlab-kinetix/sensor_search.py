#!/usr/bin/env python3
"""Prospective Kinetix weight-space sensor wiring search (no external controller).

Changes only a bounded set of *original model* tensor entries. Development
selects candidates; held-out physics is executed only for an improving model.
The candidates are deterministically assistant-designed, NOT the output of a
separate autonomous LLM inference service.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
import time
import numpy as np

from repair_experiment import (DEV, HOLDOUT, SCHEMA as PREVIOUS_SCHEMA,
                               get_runtime, simulate_one, model_digest,
                               changed_count)
from reproduce import obtain_assets

SCHEMA = "prismtek-kinetix-sensor-weight-search-v1"
# Verified against official Kinetix symbolic_flat: two-body polygon index 5
# occupies flat indices 52..77, green wheel is the first circle at 234..251.
CHANNELS = {
    "body_x": 52, "body_y": 53, "body_vx": 54, "body_vy": 55,
    "green_wheel_x": 234, "green_wheel_y": 235,
}
# Preexisting isolated repair embeddings 6,7,8 carry body x, body vx, wheel x.
# Additional sensor-to-gate wiring is a *real weight edit* to embed.W.
SENSOR_WIRES = (
    (54, 6), (55, 6), (53, 6), # speed/altitude-sensitive back-up turn
    (53, 7), (55, 7), (235, 7), # height/velocity-sensitive phase/clearance
    (53, 8), (55, 8), (235, 8), (54, 8), # dynamic release based on height/velocity
)
BIAS_WIRES = (
    ("actor0.b", 125), ("actor0.b", 126),
    ("actor1.b", 125), ("actor1.b", 126),
    ("actor2.b", 126), ("actor2.b", 127),
)
SENSOR_MAGNITUDES = (-2.0, -1.0, -0.4, 0.4, 1.0, 2.0)
BIAS_MAGNITUDES = (-40.0, -20.0, 20.0, 40.0)  # capped and versioned
# Lock the next test conditions. These were proposed in v0.6 but never opened.
# They are no longer genuinely novel conditions once evaluated; lock before search.
SEALED = tuple(HOLDOUT)
DEV_SEED = 4207
SEALED_SEED = 5101
TOP_N = 12


def manifest() -> list[dict]:
    proposals = [{"id": "published", "edits": []}]
    for row, col in SENSOR_WIRES:
        for delta in SENSOR_MAGNITUDES:
            proposals.append({"id": f"embed-{row}-{col}-{delta:+.1f}",
                              "edits": [{"tensor": "embed.W", "index": [row, col], "delta": delta}]})
    for tensor, index in BIAS_WIRES:
        for delta in BIAS_MAGNITUDES:
            proposals.append({"id": f"{tensor}-{index}-{delta:+.0f}",
                              "edits": [{"tensor": tensor, "index": [index], "delta": delta}]})
    assert len(proposals) == 85 and len(set(x["id"] for x in proposals)) == len(proposals)
    return proposals


def apply_edit(model: dict[str, np.ndarray], proposal: dict) -> dict[str, np.ndarray]:
    if not isinstance(proposal, dict) or set(proposal) != {"id", "edits"}:
        raise ValueError("invalid proposal format")
    if not isinstance(proposal["edits"], list) or len(proposal["edits"]) > 2:
        raise ValueError("too many weight edits")
    allowed = {("embed.W", (i, j)) for i, j in SENSOR_WIRES}
    allowed.update({(tensor, (index,)) for tensor, index in BIAS_WIRES})
    new = dict(model)
    seen = set()
    for edit in proposal["edits"]:
        if not isinstance(edit, dict) or set(edit) != {"tensor", "index", "delta"}:
            raise ValueError("invalid edit schema")
        if not isinstance(edit["tensor"], str) or not isinstance(edit["index"], list) or not all(type(i) is int for i in edit["index"]):
            raise ValueError("invalid edit index")
        key = edit["tensor"], tuple(edit["index"])
        if key not in allowed or key in seen:
            raise ValueError("unauthorized neural edit")
        seen.add(key)
        delta = edit["delta"]
        bound = 2.0 if key[0] == "embed.W" else 40.0
        if type(delta) not in (int, float) or not math.isfinite(delta) or abs(delta) > bound:
            raise ValueError("invalid edit magnitude")
        if key[0] not in model:
            raise ValueError("missing tensor")
        if new[key[0]] is model[key[0]]:
            new[key[0]] = np.array(model[key[0]], dtype=np.float64, copy=True)
        new[key[0]][key[1]] += float(delta)
        if not np.isfinite(new[key[0]][key[1]]):
            raise ValueError("nonfinite target weight")
    return new


def progress_run(runtime, weights, condition, seed: int) -> dict:
    """Real Kinetix state transitions, no environment substitution.

    Reduced, audit-friendly telemetry: goal, terminal, and how far the green
    wheel travels LEFT. Only development metrics can rank candidates.
    """
    raw = simulate_one(runtime, weights, condition, seed, trace=True)
    trajectory = raw.pop("trajectory")
    green_values = [row["green_x"] for row in trajectory]
    progress = max(0.0, min(2.5374996662139893 - min(green_values), 2.5375))
    nearest_red = [row.get("nearest_red_center_distance") for row in trajectory if row.get("nearest_red_center_distance") is not None]
    raw["progress_left"] = round(progress, 8)
    raw["min_red_center_distance"] = round(min(nearest_red), 8) if nearest_red else None
    raw["terminal_green_x"] = round(green_values[-1], 8)
    return raw


def development_grade(rows: list[dict]) -> tuple[int, float]:
    buckets = {c[0]: [row for row in rows if row["condition"] == c[0]] for c in DEV}
    expected = len(buckets["nominal"])
    if not expected or any(len(xs) != expected for xs in buckets.values()):
        raise ValueError("incomplete development condition coverage")
    if any(not x["success"] for x in buckets["nominal"]):
        return (-1, -1.0)
    tough = buckets[DEV[1][0]] + buckets[DEV[2][0]]
    wins = sum(int(row["success"]) for row in tough)
    progress = sum(row["progress_left"] for row in tough) / len(tough)
    # Only wins select a new policy. Progress is a diagnostic ranking signal.
    return (wins, round(progress, 8))


def eval_development(runtime, weights, seeds=(DEV_SEED,)):
    return [progress_run(runtime, weights, cond, seed) for cond in DEV for seed in seeds]


def rank_key(candidate: dict) -> tuple:
    # Negative because Python min() used for descending wins/progress.
    wins, progress = candidate["grade"]
    return (-wins, -progress, candidate["changed_parameters"], candidate["candidate"]["id"])


def run_search(assets: dict[str, Path], output: Path, selected_output: Path) -> dict:
    runtime = get_runtime(assets)
    published = runtime[6]
    originals = manifest()
    reference = model_digest(published)
    results = []
    for proposal in originals:
        candidate = apply_edit(published, proposal)
        rows = eval_development(runtime, candidate)
        grade = development_grade(rows)
        results.append({"candidate": proposal, "target_model_sha256": model_digest(candidate),
                        "changed_parameters": changed_count(published, candidate),
                        "grade": list(grade), "rows": rows})
    base = results[0]
    # The development-only shortlist is frozen before evaluating second seeds.
    shortlist = sorted(results[1:], key=rank_key)[:TOP_N]
    shortlist_results = []
    for entry in [base] + shortlist:
        model = apply_edit(published, entry["candidate"])
        rows = eval_development(runtime, model, seeds=(DEV_SEED+100, DEV_SEED+200))
        shortlist_results.append({"candidate_id": entry["candidate"]["id"],
                                  "rows": rows, "grade": list(development_grade(rows))})
    published_stage2 = shortlist_results[0]["grade"]
    # Strict success improvement required on stage2; no nominal regressions.
    winners = [entry for entry in shortlist_results[1:] if entry["grade"][0] > published_stage2[0]]
    best = min(winners, key=lambda x:(-x["grade"][0],-x["grade"][1],x["candidate_id"])) if winners else None
    chosen = next((entry for entry in results if best and entry["candidate"]["id"] == best["candidate_id"]),None)
    selection = {"schema": SCHEMA, "stage":"selected" if chosen else "no_improvement",
                 "source_model_sha256":reference,
                 "target_model_sha256":chosen["target_model_sha256"] if chosen else None,
                 "candidate":chosen["candidate"] if chosen else None,
                 "first_round_seed":DEV_SEED,"second_round_seeds":[DEV_SEED+100,DEV_SEED+200],
                 "stage2_baseline_wins":published_stage2[0],
                 "stage2_selected_wins":best["grade"][0] if best else None,
                 "reserved_conditions_examined":False,
                 "promotion":"not_approved"}
    report={"schema":SCHEMA,"stage":"development_only","source_model_sha256":reference,
            "level_sha256":runtime[7],"manifest":originals,
            "round1":results,"shortlist_ids":[entry["candidate"]["id"] for entry in shortlist],
            "round2":shortlist_results,"selection":selection,
            "interpretation":"direct neural sensor wiring, assistant-designed; no automatic LLM inference, no model deployment"}
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2,sort_keys=True,allow_nan=False)+"\n")
    selected_output.write_text(json.dumps(selection,indent=2,sort_keys=True,allow_nan=False)+"\n")
    return report


def run_holdout(assets, selected_file: Path, output: Path):
    selected=json.loads(selected_file.read_text())
    if selected.get("schema")!=SCHEMA or selected.get("reserved_conditions_examined") is not False:
        raise ValueError("invalid/unsealed candidate selection")
    runtime=get_runtime(assets)
    published=runtime[6]
    if model_digest(published)!=selected.get("source_model_sha256"):
        raise ValueError("source mismatch")
    if selected.get("stage") == "no_improvement":
        if selected.get("candidate") is not None:
            raise ValueError("unexpected candidate")
        report={"schema":SCHEMA,"stage":"holdout_not_executed","reason":"no strictly better development policy"}
    elif selected.get("stage") == "selected":
        if selected.get("candidate") not in manifest():
            raise ValueError("candidate outside locked manifest")
        revised=apply_edit(published, selected["candidate"])
        if model_digest(revised)!=selected.get("target_model_sha256"):
            raise ValueError("candidate hash mismatch")
        rows={}
        for label, model in (("published",published),("candidate",revised)):
            rows[label]=[progress_run(runtime,model,condition,seed)
                         for condition in SEALED for seed in range(SEALED_SEED,SEALED_SEED+4)]
        summaries=[]
        for condition in SEALED:
            name=condition[0]
            reference=sum(r["success"] for r in rows["published"] if r["condition"]==name)
            wins=sum(r["success"] for r in rows["candidate"] if r["condition"]==name)
            summaries.append({"condition":name,"published_wins":reference,"candidate_wins":wins,"episodes_each":4})
        approval=all(x["candidate_wins"]>=3 and x["candidate_wins"]>x["published_wins"] for x in summaries)
        report={"schema":SCHEMA,"stage":"holdout_evaluated","source_model_sha256":selected["source_model_sha256"],
                "target_model_sha256":selected["target_model_sha256"],"candidate":selected["candidate"],
                "rows":rows,"summary":summaries,"robustness_screen":"pass" if approval else "fail",
                "promotion":"not_approved_requires_new_geometries_and_reviewer_signoff"}
    else: raise ValueError("unexpected stage")
    output.write_text(json.dumps(report,indent=2,sort_keys=True,allow_nan=False)+"\n")
    return report


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--stage",choices=("search","holdout"),required=True)
    p.add_argument("--cache",default=".cache/weightlab-upstream")
    p.add_argument("--output",type=Path,required=True)
    p.add_argument("--selected-file",type=Path,default=Path("kinetix-sensor-selected.json"))
    args=p.parse_args()
    now=time.monotonic()
    assets=obtain_assets(Path(args.cache),allow_download=True)
    if args.stage=="search":
        r=run_search(assets,args.output,args.selected_file)
        summary={"stage":"search","proposals":len(r["round1"]),
                 "shortlist":len(r["shortlist_ids"]),"selected":r["selection"]["candidate"]}
    else:
        r=run_holdout(assets,args.selected_file,args.output)
        summary={"stage":r["stage"],"summary":r.get("summary")}
    summary["wall_seconds"]=round(time.monotonic()-now,2)
    print(json.dumps(summary,indent=2))

if __name__=="__main__": main()
