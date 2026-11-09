"""Pure source-contract tests; real physics runs in separate CI steps."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import repair_experiment as R

class RepairExperimentTests(unittest.TestCase):
    def setUp(self):
        self.base={"actor0.b":np.arange(128,dtype=np.float64),"actor0.W":np.arange(12,dtype=np.float64).reshape(3,4)}
    def test_manifest_fixed_unique(self):
        ms=R.manifest();self.assertEqual(len(ms),19)
        self.assertEqual(len(set(m['id'] for m in ms)),19)
        self.assertEqual(ms[0]['id'],'published')
        self.assertEqual(ms[0]['edits'],[])
    def test_changes_only_approved_bias(self):
        for spec in R.manifest():
            out=R.apply_candidate(self.base,spec)
            self.assertEqual(out['actor0.W'].shape,self.base['actor0.W'].shape)
            self.assertTrue(np.array_equal(out['actor0.W'],self.base['actor0.W']))
            diff=np.flatnonzero(out['actor0.b']!=self.base['actor0.b'])
            self.assertTrue(set(diff).issubset(R.ALLOWED_BIAS_INDICES))
            self.assertLessEqual(len(diff),2)
            self.assertEqual(R.changed_count(self.base,out),len(diff))
        self.assertTrue(np.array_equal(self.base['actor0.b'],np.arange(128)))
    def test_reject_unknown_tensor(self):
        with self.assertRaises(ValueError):R.apply_candidate(self.base,{"id":"evil","edits":[{"tensor":"actor_head.b","index":124,"delta":2}]})
    def test_reject_not_exact_edit_schema(self):
        with self.assertRaises(ValueError):R.apply_candidate(self.base,{"id":"e","edits":[{"tensor":"actor0.b","index":124,"delta":2,"note":"danger"}]})
    def test_reject_duplicate_edits(self):
        with self.assertRaises(ValueError):R.apply_candidate(self.base,{"id":"e","edits":[{"tensor":"actor0.b","index":124,"delta":2},{"tensor":"actor0.b","index":124,"delta":3}]})
    def test_reject_bool_index(self):
        with self.assertRaises(ValueError):R.apply_candidate(self.base,{"id":"e","edits":[{"tensor":"actor0.b","index":True,"delta":3}]})
    def test_reject_non_numeric(self):
        for val in (float('nan'),float('inf'),"1.0",True,1024):
            with self.subTest(value=str(val)),self.assertRaises(ValueError):R.apply_candidate(self.base,{"id":"e","edits":[{"tensor":"actor0.b","index":124,"delta":val}]})
    def test_reject_excessive_edits(self):
        with self.assertRaises(ValueError):R.apply_candidate(self.base,{"id":"e","edits":[{"tensor":"actor0.b","index":122,"delta":1}]*3})
    def test_digest_order_independent(self):
        self.assertEqual(R.model_digest(self.base),R.model_digest(dict(reversed(list(self.base.items())))))
        out=R.apply_candidate(self.base,{"id":"x","edits":[{"tensor":"actor0.b","index":124,"delta":2}]})
        self.assertNotEqual(R.model_digest(self.base),R.model_digest(out))
    def test_nominal_fail_deprioritized(self):
        rows=[{"condition":cond[0],"success":cond[0]!='nominal'} for cond in R.DEV]
        self.assertEqual(R.score_candidate(rows),-1)
    def test_existing_failure_no_score(self):
        rows=[{"condition":cond[0],"success":cond[0]=='nominal'} for cond in R.DEV]
        self.assertEqual(R.score_candidate(rows),0)
    def test_robust_candidate_score(self):
        rows=[{"condition":cond[0],"success":True} for cond in R.DEV]
        self.assertEqual(R.score_candidate(rows),2)
    def test_dev_holdout_different(self):
        self.assertFalse(set(s[0] for s in R.DEV)&set(s[0] for s in R.HOLDOUT))
    def test_configuration_scales_actual_physics(self):
        class Params:
            base_friction=0.4
            base_motor_power=900.
            def replace(self,**kwargs):return kwargs
        class Level:
            gravity=np.array([0.,-9.81])
            def replace(self,**kwargs):return kwargs
        p,l=R.configuration(Params(),Level(),("low_friction",0.5,0.7,1.25),np)
        self.assertAlmostEqual(p['base_friction'],0.2)
        self.assertAlmostEqual(p['base_motor_power'],630.)
        self.assertAlmostEqual(l['gravity'][1],-9.81*1.25)
    def test_no_improvement_preserves_holdout(self):
        with tempfile.TemporaryDirectory() as tmp:
            o=Path(tmp)/'result.json';c=Path(tmp)/'candidate.json';
            source=R.model_digest(self.base)
            c.write_text(json.dumps({"schema":R.SCHEMA,"stage":"no_improvement","source_model_sha256":source,"candidate":None}))
            with patch.object(R,'get_runtime',return_value=(None,None,None,None,None,None,self.base,'fake_hash')):
                result=R.run_holdout({},c,o,18001)
            self.assertEqual(result['stage'],'holdout_not_executed')
            self.assertNotIn('rows',result)
    def test_mismatched_source_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            o=Path(tmp)/'result.json';c=Path(tmp)/'candidate.json';
            c.write_text(json.dumps({"schema":R.SCHEMA,"stage":"candidate_selected","source_model_sha256":"0"*64,"candidate":R.manifest()[1]}))
            with patch.object(R,'get_runtime',return_value=(None,None,None,None,None,None,self.base,'fake_hash')):
                with self.assertRaises(ValueError):R.run_holdout({},c,o,18001)
    def test_unlisted_candidate_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            o=Path(tmp)/'result.json';c=Path(tmp)/'candidate.json'
            c.write_text(json.dumps({"schema":R.SCHEMA,"stage":"candidate_selected","source_model_sha256":R.model_digest(self.base),"candidate":{"id":"unlisted","edits":[]},"target_model_sha256":R.model_digest(self.base)}))
            with patch.object(R,'get_runtime',return_value=(None,None,None,None,None,None,self.base,'fake_hash')):
                with self.assertRaises(ValueError):R.run_holdout({},c,o,18001)

if __name__=='__main__':unittest.main()
