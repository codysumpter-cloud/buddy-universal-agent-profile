import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from repair_experiment import SCHEMA,DEV,manifest
from repair_gate import validate,validate_rows

class GateTests(unittest.TestCase):
    def row(self,name,seed,success):
        return {'condition':name,'seed':seed,'success':success,'done':True,'steps':73 if success else 256,
                'reward':1 if success else 0,'outcome':'goal' if success else 'timeout_or_other'}
    def valid(self):
        hash_='a'*64
        specs=manifest();props=[]
        for spec in specs:
            rows=[self.row(c[0],3101,c[0]=='nominal') for c in DEV]
            props.append({'candidate':spec,'source_model_sha256':hash_,'target_model_sha256':hash_,
                          'changed_parameters':len(spec['edits']),'score':0,'rows':rows})
        selected={'schema':SCHEMA,'stage':'no_improvement','source_model_sha256':hash_,
                  'candidate':None,'selected_dev_score':None,'published_dev_score':0,
                  'dev_seed':3101,'selection':'dev_only_no_holdout_evaluations'}
        diagnostic={'schema':SCHEMA,'stage':'diagnostic','level_sha256':hash_,'conditions':[c[0] for c in DEV],
                    'runs':{x:[dict(self.row(c[0],3101,c[0]=='nominal'),trajectory=[{'step':0}]) for c in DEV]
                            for x in ('baseline','published_patch')}}
        development={'schema':SCHEMA,'stage':'development_search','level_sha256':hash_,
                     'dev_conditions':[c[0] for c in DEV],'holdout_conditions_examined':False,
                     'seed':3101,'proposals':props,'selected':selected}
        holdout={'schema':SCHEMA,'stage':'holdout_not_executed','reason':'no development improvement'}
        return diagnostic,development,selected,holdout
    def test_valid_negative_result(self):
        self.assertEqual(validate(*self.valid())['development_candidate_outcome'],'no_improvement')
    def test_no_false_positive(self):
        a,b,c,d=self.valid();b['proposals'][1]['score']=1
        with self.assertRaises(ValueError):validate(a,b,c,d)
    def test_no_holdout_leak(self):
        a,b,c,d=self.valid();b['holdout_conditions_examined']=True
        with self.assertRaises(ValueError):validate(a,b,c,d)
    def test_no_score_changing(self):
        a,b,c,d=self.valid();b['proposals'][1]['rows'][1]['success']=True
        with self.assertRaises(ValueError):validate(a,b,c,d)
    def test_no_tamper_source(self):
        a,b,c,d=self.valid();b['proposals'][2]['source_model_sha256']='b'*64
        with self.assertRaises(ValueError):validate(a,b,c,d)
    def test_no_tamper_selected(self):
        a,b,c,d=self.valid();c['candidate']=manifest()[1]
        with self.assertRaises(ValueError):validate(a,b,c,d)
    def test_no_proposal_omission(self):
        a,b,c,d=self.valid();b['proposals'].pop()
        with self.assertRaises(ValueError):validate(a,b,c,d)
    def test_no_duplicate_episode(self):
        rows=[self.row('nominal',3101,True),self.row('nominal',3101,True)]
        with self.assertRaises(ValueError):validate_rows(rows,['nominal'],2,3101,'duplicate')
    def test_no_outcome_mismatch(self):
        rows=[self.row('nominal',3101,True)];rows[0]['outcome']='timeout_or_other'
        with self.assertRaises(ValueError):validate_rows(rows,['nominal'],1,3101,'mismatch')
    def test_no_false_holdout_rows(self):
        a,b,c,d=self.valid();d['rows']={}
        with self.assertRaises(ValueError):validate(a,b,c,d)

if __name__=='__main__':unittest.main()
