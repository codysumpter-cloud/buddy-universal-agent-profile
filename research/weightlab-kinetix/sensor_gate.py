#!/usr/bin/env python3
"""Independent fail-closed review of v0.7 sensor-weight search evidence.

Verifies complete candidate ledger, split isolation, scores, selection and holdout.
No tensors are deployed; cryptographic hashes prove byte integrity, not authority.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

from sensor_search import (SCHEMA, DEV, SEALED, DEV_SEED, SEALED_SEED,
                           TOP_N, manifest)


def fail(message):
    raise ValueError("sensor gate: " + message)


def sha256_obj(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def hash_string(value):
    return isinstance(value,str) and len(value)==64 and all(c in "0123456789abcdef" for c in value)


def check_row(row, condition, seed):
    if not isinstance(row, dict) or row.get("condition") != condition or row.get("seed") != seed:
        fail("condition or seed mismatch")
    if type(row.get("success")) is not bool or type(row.get("done")) is not bool:
        fail("invalid boolean outcome")
    if not isinstance(row.get("steps"),int) or not 1<=row["steps"]<=256:
        fail("invalid rollout length")
    if row["success"] and (not row["done"] or row["outcome"]!="goal"):
        fail("inconsistent goal status")
    if row.get("outcome") not in ("goal", "negative_terminal", "timeout_or_other"):
        fail("invalid terminal classification")
    if row["outcome"] == "negative_terminal" and (not row["done"] or row["terminal_reward"] >= -.5):
        fail("fake negative contact")
    for k in ("reward","terminal_reward","progress_left","terminal_green_x"):
        v=row.get(k)
        if type(v) not in (int,float) or not math.isfinite(v):fail("nonfinite or missing metric "+k)
    if not 0<=row["progress_left"]<=2.5375:
        fail("invalid progress")
    d=row.get("min_red_center_distance")
    if d is not None and (type(d) not in (int,float) or not math.isfinite(d) or d<0):
        fail("invalid proximity")
    a=row.get("initial_motor_actions")
    if not isinstance(a,list) or not 1<=len(a)<=8 or not all(type(x) is int and 0<=x<=2 for x in a):
        fail("invalid action trace")


def complete_rows(rows, conditions, seeds):
    if not isinstance(rows,list) or len(rows)!=len(conditions)*len(seeds):
        fail("missing/extra simulations")
    seen=set()
    for row in rows:
        if not isinstance(row,dict):fail("invalid row")
        key=(row.get("condition"),row.get("seed"))
        if key in seen: fail("duplicate episode")
        seen.add(key)
    expected={(c,s) for c in conditions for s in seeds}
    if seen!=expected: fail("incomplete condition/seed coverage")
    for row in rows: check_row(row,row["condition"],row["seed"])


def independent_grade(rows):
    """Recompute results without calling the search-side scoring helper."""
    by_name={name:[] for name, *_ in DEV}
    for row in rows:
        by_name[row["condition"]].append(row)
    if not by_name[DEV[0][0]] or any(len(a)!=len(by_name[DEV[0][0]]) for a in by_name.values()):
        fail("incomplete grade rows")
    if not all(r["success"] for r in by_name[DEV[0][0]]):
        return (-1,-1.0)
    stress=by_name[DEV[1][0]]+by_name[DEV[2][0]]
    return (sum(1 for r in stress if r["success"]),round(sum(r["progress_left"] for r in stress)/len(stress),8))


def independent_rank(entry):
    wins,progress=entry["grade"]
    return (-wins,-progress,entry["changed_parameters"],entry["candidate"]["id"])


def valid_grade(reported, actual):
    if not isinstance(reported,list) or len(reported)!=2: fail("grade malformed")
    if reported[0]!=actual[0] or type(reported[0]) is not int:
        fail("changed win score")
    if type(reported[1]) not in (int,float) or not math.isfinite(reported[1]) or abs(reported[1]-actual[1])>1e-7:
        fail("changed progress score")


def check(data, chosen, holdout):
    if not isinstance(data,dict) or data.get("schema")!=SCHEMA or data.get("stage")!="development_only":
        fail("bad development schema")
    original=manifest()
    if data.get("manifest")!=original:fail("candidate manifest changed")
    entries=data.get("round1")
    if not isinstance(entries,list) or len(entries)!=len(original):fail("incomplete first round")
    if not hash_string(data.get("source_model_sha256")) or not hash_string(data.get("level_sha256")):
        fail("model/level provenance missing")
    for i,(entry,spec) in enumerate(zip(entries,original)):
        if entry.get("candidate")!=spec:fail("proposal order/content mismatch")
        if not hash_string(entry.get("target_model_sha256")):fail("invalid target hash")
        if type(entry.get("changed_parameters")) is not int or not 0<=entry["changed_parameters"]<=2:
            fail("edit count exceeds budget")
        if i==0 and (entry["changed_parameters"]!=0 or entry["target_model_sha256"]!=data["source_model_sha256"]):
            fail("published baseline altered")
        if i>0 and entry["changed_parameters"]!=1:fail("unexpected model edits")
        complete_rows(entry.get("rows"),[x[0] for x in DEV],[DEV_SEED])
        valid_grade(entry.get("grade"),independent_grade(entry["rows"]))
    shortlist=sorted(entries[1:],key=independent_rank)[:TOP_N]
    if data.get("shortlist_ids") != [entry["candidate"]["id"] for entry in shortlist]:
        fail("development shortlist changed")
    second=data.get("round2")
    if not isinstance(second,list) or len(second)!=TOP_N+1:fail("incomplete second round")
    expected_ids=[entries[0]["candidate"]["id"]]+[e["candidate"]["id"] for e in shortlist]
    for row,name in zip(second, expected_ids):
        if row.get("candidate_id")!=name:fail("second-round candidates changed")
        complete_rows(row.get("rows"),[x[0] for x in DEV],[DEV_SEED+100,DEV_SEED+200])
        valid_grade(row.get("grade"),independent_grade(row["rows"]))
    baseline_wins=second[0]["grade"][0]
    winners=[row for row in second[1:] if row["grade"][0]>baseline_wins]
    best=min(winners,key=lambda e:(-e["grade"][0],-e["grade"][1],e["candidate_id"])) if winners else None
    expected_entry=next((e for e in entries if best is not None and e["candidate"]["id"]==best["candidate_id"]),None)
    if not isinstance(chosen,dict) or data.get("selection")!=chosen or chosen.get("schema")!=SCHEMA or chosen.get("source_model_sha256")!=data["source_model_sha256"]:
        fail("candidate receipt mismatch")
    if chosen.get("first_round_seed")!=DEV_SEED or chosen.get("second_round_seeds")!=[DEV_SEED+100,DEV_SEED+200] or chosen.get("reserved_conditions_examined") is not False or chosen.get("promotion")!="not_approved":
        fail("selection provenance/holdout invalid")
    if chosen.get("stage") != ("selected" if best else "no_improvement") or chosen.get("stage2_baseline_wins")!=baseline_wins:
        fail("wrong selection decision")
    if best:
        if chosen.get("candidate")!=expected_entry["candidate"] or chosen.get("target_model_sha256")!=expected_entry["target_model_sha256"] or chosen.get("stage2_selected_wins")!=best["grade"][0]:
            fail("different candidate selected")
    elif chosen.get("candidate") is not None or chosen.get("target_model_sha256") is not None or chosen.get("stage2_selected_wins") is not None:
        fail("candidate fabricated without improvement")
    if not isinstance(holdout,dict) or holdout.get("schema")!=SCHEMA:fail("holdout schema invalid")
    if not best:
        if holdout.get("stage")!="holdout_not_executed" or "rows" in holdout or "summary" in holdout:
            fail("reserved split was opened without a winner")
        verdict="unopened_no_improvement"
    else:
        if holdout.get("stage")!="holdout_evaluated" or holdout.get("candidate")!=chosen["candidate"] or holdout.get("target_model_sha256")!=chosen["target_model_sha256"] or holdout.get("source_model_sha256")!=chosen["source_model_sha256"]:
            fail("holdout target mismatch")
        rows=holdout.get("rows")
        if not isinstance(rows,dict) or set(rows)!={"published","candidate"}:fail("missing holdout policy")
        for rs in rows.values():complete_rows(rs,[c[0] for c in SEALED],list(range(SEALED_SEED,SEALED_SEED+4)))
        summary=[]
        for condition in SEALED:
            n=condition[0]
            ref=sum(x["success"] for x in rows["published"] if x["condition"]==n)
            won=sum(x["success"] for x in rows["candidate"] if x["condition"]==n)
            summary.append({"condition":n,"published_wins":ref,"candidate_wins":won,"episodes_each":4})
        if holdout.get("summary")!=summary:fail("holdout totals changed")
        accepted=all(x["candidate_wins"]>=3 and x["candidate_wins"]>x["published_wins"] for x in summary)
        verdict="pass" if accepted else "fail"
        if holdout.get("robustness_screen")!=verdict or holdout.get("promotion")!="not_approved_requires_new_geometries_and_reviewer_signoff":
            fail("holdout verdict or promotion changed")
    return {"schema":"prismtek-kinetix-sensor-gate-v1","evidence_integrity":"pass",
            "development_outcome":chosen["stage"],"candidate_count":len(entries),
            "shortlist_count":len(shortlist),"sealed_verdict":verdict,
            "development_sha256":sha256_obj(data),"selection_sha256":sha256_obj(chosen),
            "holdout_sha256":sha256_obj(holdout),
            "promotion":"not_approved"}


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--development",type=Path,required=True)
    p.add_argument("--selection",type=Path,required=True)
    p.add_argument("--holdout",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    a=p.parse_args()
    result=check(json.loads(a.development.read_text()),json.loads(a.selection.read_text()),json.loads(a.holdout.read_text()))
    a.output.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    print(json.dumps(result,indent=2))

if __name__=="__main__":main()
