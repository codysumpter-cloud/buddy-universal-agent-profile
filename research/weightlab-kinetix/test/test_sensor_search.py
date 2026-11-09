"""Offline tests: real model edits are safe and grade/holdout gates fail closed."""
import copy
import json
import math
import unittest
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import sensor_search as s
import sensor_gate as g


class SensorEditTests(unittest.TestCase):
    def setUp(self):
        self.model={"embed.W":np.zeros((679,128),dtype=np.float64),
                    "actor0.b":np.zeros((128,)),"actor1.b":np.zeros((128,)),
                    "actor2.b":np.zeros((128,))}

    def test_manifest_is_unique_and_versioned(self):
        p=s.manifest()
        self.assertEqual(len(p),85)
        self.assertEqual(len({x['id'] for x in p}),85)
        self.assertEqual(p[0],{"id":"published","edits":[]})
        self.assertEqual(s.CHANNELS, {"body_x":52,"body_y":53,"body_vx":54,"body_vy":55,"green_wheel_x":234,"green_wheel_y":235})

    def test_direct_sensor_edit_is_actual_weight_not_adapter(self):
        p=s.manifest()[1]
        revised=s.apply_edit(self.model,p)
        self.assertEqual(s.changed_count(self.model,revised),1)
        self.assertNotEqual(s.model_digest(self.model),s.model_digest(revised))
        self.assertTrue(np.array_equal(self.model['embed.W'],np.zeros((679,128))))
        self.assertFalse(np.shares_memory(self.model['embed.W'],revised['embed.W']))
        self.assertTrue(np.array_equal(s.apply_edit(revised,{"id":"rollback","edits":[{**p['edits'][0],"delta":-p['edits'][0]['delta']} ]})['embed.W'],self.model['embed.W']))

    def test_all_manifest_entries_apply(self):
        for p in s.manifest():
            revised=s.apply_edit(self.model,p)
            self.assertEqual(s.changed_count(self.model,revised),0 if p['id']=='published' else 1)

    def test_reject_other_motor_output(self):
        with self.assertRaises(ValueError):s.apply_edit(self.model,{"id":"bad","edits":[{"tensor":"actor_head.b","index":[3],"delta":1}]})

    def test_reject_unapproved_sensor_input(self):
        with self.assertRaises(ValueError):s.apply_edit(self.model,{"id":"bad","edits":[{"tensor":"embed.W","index":[90,6],"delta":1}]})

    def test_reject_bool_index(self):
        with self.assertRaises(ValueError):s.apply_edit(self.model,{"id":"bad","edits":[{"tensor":"actor0.b","index":[True],"delta":2}]})

    def test_reject_duplicate_edits(self):
        with self.assertRaises(ValueError):s.apply_edit(self.model,{"id":"bad","edits":[{"tensor":"actor0.b","index":[125],"delta":20},{"tensor":"actor0.b","index":[125],"delta":-20}]})

    def test_reject_more_than_two_edits(self):
        with self.assertRaises(ValueError):s.apply_edit(self.model,{"id":"bad","edits":[{"tensor":"actor0.b","index":[125],"delta":20}]*3})

    def test_reject_nan_inf_and_excessive_magnitude(self):
        for v in (float('nan'),float('inf'),5.0):
            with self.assertRaises(ValueError):s.apply_edit(self.model,{"id":"bad","edits":[{"tensor":"embed.W","index":[54,6],"delta":v}]})
        with self.assertRaises(ValueError):s.apply_edit(self.model,{"id":"bad","edits":[{"tensor":"actor0.b","index":[125],"delta":41}]})

    def test_reject_mutating_unknown_keys_and_shape(self):
        for obj in ({"id":"oops","edits":[],"code":"evil"}, {"id":"oops","edits":"not-list"}):
            with self.assertRaises(ValueError):s.apply_edit(self.model,obj)


def demo_row(cond,seed,won=False,progress=.1):
    return {"condition":cond,"seed":seed,"steps":73 if won else 80,"reward":1.0 if won else -.9,
            "terminal_reward":1.0 if won else -1.0,"success":bool(won),"done":True,
            "outcome":"goal" if won else "negative_terminal", "initial_motor_actions":[2]*8,
            "progress_left":progress,"min_red_center_distance":.8,"terminal_green_x":2.0}


def build_evidence():
    proposals=s.manifest()
    round1=[]
    for i,p in enumerate(proposals):
        # Everybody succeeds nominal but nobody wins the failure conditions.
        rows=[demo_row(c[0],s.DEV_SEED,won=c[0]=='nominal',progress=.1) for c in s.DEV]
        round1.append({"candidate":p,"target_model_sha256":'a'*64 if i==0 else f'{i:064x}',
                       "changed_parameters":0 if i==0 else 1,"grade":list(s.development_grade(rows)),"rows":rows})
    shortlist=sorted(round1[1:],key=s.rank_key)[:s.TOP_N]
    second=[]
    for row in [round1[0]]+shortlist:
        rows=[demo_row(c[0],seed,won=c[0]=='nominal',progress=.1)
              for c in s.DEV for seed in (s.DEV_SEED+100,s.DEV_SEED+200)]
        second.append({"candidate_id":row['candidate']['id'],"rows":rows,"grade":list(s.development_grade(rows))})
    selection={"schema":s.SCHEMA,"stage":"no_improvement","source_model_sha256":'a'*64,
               "target_model_sha256":None,"candidate":None,
               "first_round_seed":s.DEV_SEED,"second_round_seeds":[s.DEV_SEED+100,s.DEV_SEED+200],
               "stage2_baseline_wins":0,"stage2_selected_wins":None,
               "reserved_conditions_examined":False,"promotion":"not_approved"}
    report={"schema":s.SCHEMA,"stage":"development_only","source_model_sha256":'a'*64,
            "level_sha256":'b'*64,"manifest":proposals,"round1":round1,
            "shortlist_ids":[x['candidate']['id'] for x in shortlist],
            "round2":second,"selection":selection}
    holdout={"schema":s.SCHEMA,"stage":"holdout_not_executed","reason":"no strictly better development policy"}
    return report,selection,holdout


class GateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.report,cls.selection,cls.holdout=build_evidence()

    def test_complete_no_improvement_is_pass(self):
        result=g.check(self.report,self.selection,self.holdout)
        self.assertEqual(result['development_outcome'],'no_improvement')
        self.assertEqual(result['sealed_verdict'],'unopened_no_improvement')
        self.assertEqual(result['candidate_count'],85)
        self.assertEqual(result['promotion'],'not_approved')

    def test_forged_candidate_is_blocked(self):
        r,s0,h=copy.deepcopy((self.report,self.selection,self.holdout))
        r['selection']['stage']=s0['stage']='selected'
        with self.assertRaises(ValueError):g.check(r,s0,h)

    def test_holdout_leak_blocked(self):
        r,sel,h=copy.deepcopy((self.report,self.selection,self.holdout))
        h['rows']={}
        with self.assertRaises(ValueError):g.check(r,sel,h)

    def test_missing_manifest_candidate_blocked(self):
        r,sel,h=copy.deepcopy((self.report,self.selection,self.holdout))
        r['round1'].pop()
        with self.assertRaises(ValueError):g.check(r,sel,h)

    def test_score_tampering_blocked(self):
        r,sel,h=copy.deepcopy((self.report,self.selection,self.holdout))
        r['round1'][0]['grade']=[99,1.0]
        with self.assertRaises(ValueError):g.check(r,sel,h)

    def test_seed_duplication_blocked(self):
        r,sel,h=copy.deepcopy((self.report,self.selection,self.holdout))
        r['round2'][0]['rows'][1]['seed']=r['round2'][0]['rows'][0]['seed']
        r['round2'][0]['rows'][1]['condition']=r['round2'][0]['rows'][0]['condition']
        with self.assertRaises(ValueError):g.check(r,sel,h)

    def test_goal_spoofing_blocked(self):
        r,sel,h=copy.deepcopy((self.report,self.selection,self.holdout))
        r['round1'][0]['rows'][0]['success']=True
        r['round1'][0]['rows'][0]['outcome']='negative_terminal'
        with self.assertRaises(ValueError):g.check(r,sel,h)

    def test_selected_candidate_holdout_verified_independently(self):
        r,sel,h=copy.deepcopy((self.report,self.selection,self.holdout))
        target=r["round1"][1]
        for row in target["rows"]:
            if row["condition"]==s.DEV[1][0]:
                row.update(success=True,outcome="goal",reward=1.0,terminal_reward=1.0)
        target["grade"]=list(s.development_grade(target["rows"]))
        shortlist=sorted(r["round1"][1:],key=s.rank_key)[:s.TOP_N]
        r["shortlist_ids"]=[x["candidate"]["id"] for x in shortlist]
        r["round2"]=[]
        for entry in [r["round1"][0]]+shortlist:
            rows=[demo_row(c[0],seed,won=(c[0]=="nominal" or (entry is target and c[0]==s.DEV[1][0])),progress=.1)
                  for c in s.DEV for seed in (s.DEV_SEED+100,s.DEV_SEED+200)]
            r["round2"].append({"candidate_id":entry["candidate"]["id"],"rows":rows,"grade":list(s.development_grade(rows))})
        sel.update(stage="selected",candidate=target["candidate"],target_model_sha256=target["target_model_sha256"],stage2_selected_wins=2)
        r["selection"]=sel
        rows={}
        for label in ("published","candidate"):
            rows[label]=[demo_row(c[0],seed,won=(label=="candidate"),progress=.2)
                         for c in s.SEALED for seed in range(s.SEALED_SEED,s.SEALED_SEED+4)]
        sums=[{"condition":c[0],"published_wins":0,"candidate_wins":4,"episodes_each":4} for c in s.SEALED]
        h={"schema":s.SCHEMA,"stage":"holdout_evaluated","source_model_sha256":sel["source_model_sha256"],
           "target_model_sha256":sel["target_model_sha256"],"candidate":sel["candidate"],"rows":rows,
           "summary":sums,"robustness_screen":"pass","promotion":"not_approved_requires_new_geometries_and_reviewer_signoff"}
        checked=g.check(r,sel,h)
        self.assertEqual(checked["sealed_verdict"],"pass")
        self.assertEqual(checked["promotion"],"not_approved")
        h["summary"][0]["candidate_wins"]=3
        with self.assertRaises(ValueError):g.check(r,sel,h)

    def test_hash_is_stable(self):
        a=g.sha256_obj(self.report)
        b=g.sha256_obj(json.loads(json.dumps(self.report,sort_keys=True)))
        self.assertEqual(a,b)
        self.assertEqual(len(a),64)


if __name__=='__main__':unittest.main()
