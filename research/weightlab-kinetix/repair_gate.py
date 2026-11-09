#!/usr/bin/env python3
"""Independent structural/evidence gate for the v0.6 bounded-repair trial.

This validates receipts and selection logic, NOT that real physics was executed.
Physical provenance additionally requires authentic GitHub CI runtime logs.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path

from repair_experiment import SCHEMA, DEV, HOLDOUT, manifest, score_candidate

HEX = set('0123456789abcdef')


def fail(msg): raise ValueError(msg)

def sha_check(v):
    return isinstance(v,str) and len(v)==64 and set(v)<=HEX


def load(path):
    if Path(path).stat().st_size > 10_000_000: fail('oversized evidence input')
    return json.loads(Path(path).read_text())


def validate_rows(rows, conditions, n, seed, label):
    if not isinstance(rows,list) or len(rows)!=n*len(conditions):fail(f'{label}: episode count incorrect')
    seen=set()
    for r in rows:
        if not isinstance(r,dict) or r.get('condition') not in conditions:fail(f'{label}: condition invalid')
        key=(r['condition'],r.get('seed'))
        if key in seen:fail(f'{label}: duplicate observation')
        seen.add(key)
        if type(r.get('success')) is not bool or type(r.get('done')) is not bool or not r['done']:
            fail(f'{label}: incomplete or invalid episode')
        if type(r.get('steps')) is not int or not 1 <= r['steps'] <= 256:fail('invalid steps')
        if not isinstance(r.get('reward'),(int,float)) or not math.isfinite(r['reward']):fail('invalid reward')
        if r.get('outcome') not in ('goal','negative_terminal','timeout_or_other'):fail('invalid outcome')
        if (r['outcome']=='goal')!=r['success']:fail('success/outcome mismatch')
    for condition in conditions:
        keys={k[1] for k in seen if k[0]==condition}
        if keys!={seed+i for i in range(n)}:fail(f'{label}: unpaired/incorrect seed namespace')


def validate(diagnostics, development, candidate, holdout):
    if not all(isinstance(x,dict) and x.get('schema')==SCHEMA for x in (diagnostics,development,candidate,holdout)):
        fail('schema mismatch')
    if diagnostics.get('stage')!='diagnostic' or development.get('stage')!='development_search':fail('wrong phase')
    if candidate.get('selection')!='dev_only_no_holdout_evaluations':fail('holdout contamination flag')
    if not sha_check(candidate.get('source_model_sha256')):fail('invalid source hash')
    dev_names=[v[0] for v in DEV]
    if development.get('dev_conditions')!=dev_names or development.get('holdout_conditions_examined') is not False:
        fail('development not properly isolated')
    if diagnostics.get('conditions')!=dev_names or diagnostics.get('level_sha256')!=development.get('level_sha256'):
        fail('diagnostic source mismatch')
    if set(diagnostics.get('runs',{})) != {'baseline','published_patch'}:fail('missing diagnostics')
    for key in ('baseline','published_patch'):
        rows=diagnostics['runs'][key]
        if len(rows)!=3 or set(r.get('condition') for r in rows)!=set(dev_names):fail('diagnostic conditions missing')
        if any(type(r.get('success')) is not bool or not isinstance(r.get('trajectory'),list) or not r['trajectory'] for r in rows):
            fail('diagnostic trace absent')
    specs=manifest(); prop=development.get('proposals')
    if not isinstance(prop,list) or len(prop)!=len(specs):fail('missing candidate trials')
    seen=[]
    for i,(entry,spec) in enumerate(zip(prop,specs)):
        if entry.get('candidate')!=spec:fail('candidate manifest drift')
        if entry.get('source_model_sha256')!=candidate['source_model_sha256'] or not sha_check(entry.get('target_model_sha256')):
            fail('source/target fingerprint mismatch')
        if type(entry.get('changed_parameters')) is not int or entry['changed_parameters']>2 or entry['changed_parameters']<0:
            fail('bad sparse edit count')
        if len(spec['edits'])!=entry['changed_parameters']:fail('parameter count inconsistent')
        rows=entry.get('rows');validate_rows(rows,dev_names,1,development['seed'],f'candidate-{i}')
        score=score_candidate(rows)
        if entry.get('score')!=score:fail('score not reproducible')
        seen.append(entry)
    base_score=seen[0]['score']
    if candidate.get('published_dev_score')!=base_score or candidate.get('dev_seed')!=development.get('seed'):
        fail('published baseline drift')
    better=[p for p in seen[1:] if p['score']>base_score]
    best=min(better,key=lambda p:(-p['score'],p['changed_parameters'],p['candidate']['id'])) if better else None
    if development.get('selected')!=candidate:fail('selection/report mismatch')
    if not best:
        if candidate.get('stage')!='no_improvement' or candidate.get('candidate') is not None or candidate.get('selected_dev_score') is not None:
            fail('false improvement claim')
        if holdout.get('stage')!='holdout_not_executed' or 'rows' in holdout:
            fail('holdout should remain unopened')
        outcome='no_improvement'; robustness='not_evaluated'
    else:
        if (candidate.get('stage')!='candidate_selected' or candidate.get('candidate')!=best['candidate']
            or candidate.get('target_model_sha256')!=best['target_model_sha256']
            or candidate.get('selected_dev_score')!=best['score']):fail('candidate selection manipulated')
        if holdout.get('stage')!='holdout_evaluated' or holdout.get('selected_candidate')!=best['candidate']:
            fail('holdout missing/mismatched')
        if (holdout.get('source_model_sha256')!=candidate['source_model_sha256'] or
            holdout.get('target_model_sha256')!=candidate['target_model_sha256']):fail('holdout model mismatch')
        names=[x[0] for x in HOLDOUT]
        if holdout.get('holdout_conditions')!=names:fail('holdout manifest drift')
        rows=holdout.get('rows',{})
        if set(rows)!=set(('published','candidate')):fail('holdout policy missing')
        for label in ('published','candidate'):
            validate_rows(rows[label],names,4,holdout['holdout_seed'],label)
        summary=[]
        for name in names:
            a=sum(r['success'] for r in rows['published'] if r['condition']==name)
            b=sum(r['success'] for r in rows['candidate'] if r['condition']==name)
            summary.append({'condition':name,'published_wins':a,'candidate_wins':b,'episodes_each':4})
        if holdout.get('summary')!=summary:fail('holdout win count mismatch')
        verdict='pass' if all(s['candidate_wins']>=3 and s['candidate_wins']>s['published_wins'] for s in summary) else 'fail'
        if verdict!=holdout.get('evaluation_verdict'):fail('holdout verdict mismatch')
        outcome='selected';robustness=verdict
    return {'schema':'prismtek-kinetix-bounded-repair-gate-v1',
            'evidence_integrity':'pass','development_candidate_outcome':outcome,
            'holdout_verdict':robustness,
            'tested_candidate_count':len(seen),
            'important_scope':'evidence consistency only; no autonomous promotion or independent physics rerun'}


def main():
    p=argparse.ArgumentParser()
    for name in ('diagnostics','development','candidate','holdout'):
        p.add_argument('--'+name,required=True,type=Path)
    p.add_argument('--output',required=True,type=Path)
    a=p.parse_args()
    inputs=[getattr(a,n) for n in ('diagnostics','development','candidate','holdout')]
    result=validate(*(load(p) for p in inputs))
    digest=hashlib.sha256()
    for path in inputs:
        digest.update(path.name.encode()+b'\0'+path.read_bytes())
    result['input_bundle_sha256']=digest.hexdigest()
    a.output.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n')
    print(json.dumps(result,indent=2))

if __name__=='__main__':main()
