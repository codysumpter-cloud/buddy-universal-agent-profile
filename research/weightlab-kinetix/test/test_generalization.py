import copy
import sys
from pathlib import Path
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from generalization import SCENARIOS, SCHEMA, episode_seed, scenario_manifest
from generalization_gate import verify
from physics_gate import SHA256_LEVEL


def sample(n=8):
    manifest=scenario_manifest(0.4,900,[0,-9.81])
    variants=[]
    for idx,sc in enumerate(manifest):
        groups={}
        for name,wins in (("baseline",0),("patched",n)):
            rows=[]
            for i in range(n):
                rows.append({"episode":i,"episode_seed":episode_seed(1901,idx,i),"success":i<wins,
                             "done":i<wins,"steps":73 if i<wins else 256,
                             "reward":1.3 if i<wins else 0.2,
                             "first_action":[2,0,0,0,0,0],"first_motor_probs":[0,0,1]})
            groups[name]={"episodes":n,"wins":wins,"rows":rows}
        variants.append({"scenario":sc,"results":groups})
    return {"schema":SCHEMA,"physics_executed":True,"environment":"kinetix-env",
            "environment_version":"3.0.2","environment_level":"l/h2_car_ramp.json",
            "level_sha256":SHA256_LEVEL,"model_parameters":171664,"action_mode":"sample",
            "seed":1901,"episodes_per_policy_per_scenario":n,"scenario_count":len(SCENARIOS),
            "scenarios":variants}


class GeneralizationTests(unittest.TestCase):
    def test_locked_manifest(self):
        self.assertEqual(len(SCENARIOS),6)
        self.assertEqual(SCENARIOS[0][0],"nominal")
        self.assertEqual(scenario_manifest(0.4,900,[0,-9.81])[1]["base_friction"],0.2)
    def test_reproducible_paired_seeds(self):
        self.assertEqual(episode_seed(1901,2,3),21904)
        self.assertNotEqual(episode_seed(1901,2,3),episode_seed(1901,3,3))
    def test_complete_is_distinct_from_robust(self):
        self.assertEqual(verify(sample())["robustness_candidate"],"pass")
        failed=sample()
        case=failed["scenarios"][1]["results"]["patched"]
        for row in case["rows"]:
            row["success"]=False;row["done"]=False;row["steps"]=256
        case["wins"]=0
        gate=verify(failed)
        self.assertEqual(gate["evidence_completeness"],"pass")
        self.assertEqual(gate["robustness_candidate"],"fail")
    def test_no_execution_rejected(self):
        data=sample();data["physics_executed"]=False
        with self.assertRaisesRegex(ValueError,"execution"):
            verify(data)
    def test_small_sample_rejected(self):
        with self.assertRaisesRegex(ValueError,"trial count"):
            verify(sample(2))
    def test_changed_friction_rejected(self):
        data=sample();data["scenarios"][1]["scenario"]["base_friction"]=0.4
        with self.assertRaisesRegex(ValueError,"parameter"):
            verify(data)
    def test_changed_gravity_rejected(self):
        data=sample();data["scenarios"][4]["scenario"]["gravity"][1]=-9.81
        with self.assertRaisesRegex(ValueError,"gravity"):
            verify(data)
    def test_missing_scenario_rejected(self):
        data=sample();data["scenarios"].pop()
        with self.assertRaisesRegex(ValueError,"scenario set"):
            verify(data)
    def test_changed_level_rejected(self):
        data=sample();data["level_sha256"]="0"*64
        with self.assertRaisesRegex(ValueError,"checksum"):
            verify(data)
    def test_bad_seed_rejected(self):
        data=sample();data["scenarios"][2]["results"]["patched"][3 if False else "rows"][4]["episode_seed"]+=1
        with self.assertRaisesRegex(ValueError,"seed"):
            verify(data)
    def test_duplicates_rejected(self):
        data=sample();data["scenarios"][1]["results"]["patched"]["rows"][1]["episode"]=0
        with self.assertRaisesRegex(ValueError,"skipped episode"):
            verify(data)
    def test_fake_wins_rejected(self):
        data=sample();data["scenarios"][2]["results"]["patched"]["wins"]=7
        with self.assertRaisesRegex(ValueError,"reported wins"):
            verify(data)
    def test_invalid_action_rejected(self):
        data=sample();data["scenarios"][2]["results"]["patched"]["rows"][0]["first_action"]=[4,0,0,0,0,0]
        with self.assertRaisesRegex(ValueError,"action"):
            verify(data)
    def test_bad_probabilities_rejected(self):
        data=sample();data["scenarios"][2]["results"]["patched"]["rows"][0]["first_motor_probs"]=[1,1,1]
        with self.assertRaisesRegex(ValueError,"probabilities"):
            verify(data)
    def test_false_outcome_rejected(self):
        data=sample();data["scenarios"][0]["results"]["patched"]["rows"][0]["done"]=False
        with self.assertRaisesRegex(ValueError,"premature"):
            verify(data)
    def test_nonfinite_rejected(self):
        data=sample();data["scenarios"][0]["results"]["patched"]["rows"][0]["reward"]=float('nan')
        with self.assertRaisesRegex(ValueError,"reward"):
            verify(data)
    def test_unexpected_gravity_layout(self):
        with self.assertRaisesRegex(ValueError,"gravity"):
            scenario_manifest(0.4,900,[0,0])
    def test_original_runtime_params_checked(self):
        with self.assertRaisesRegex(ValueError,"friction"):
            scenario_manifest(0.5,900,[0,-9.81])

if __name__=='__main__':unittest.main()
