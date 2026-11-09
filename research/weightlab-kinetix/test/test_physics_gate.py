import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from physics_gate import verify, SHA256_LEVEL


def record(n=64,base=0,patched=63):
 def group(wins):
  return {"episodes":n,"wins":wins,"rows":[{
   "episode":i,"success":i<wins,"done":i<wins,"steps":73 if i<wins else 256,"reward":1.0 if i<wins else 0.,
   "first_action":[2,0,0,0,0,0],"first_motor_probs":[0.0,0.0,1.0]
  } for i in range(n)]}
 return {"schema":"prismtek-kinetix-physics-rollout-v1","physics_executed":True,
 "environment":"kinetix-env","environment_version":"3.0.2","environment_level":"l/h2_car_ramp.json",
 "level_sha256":SHA256_LEVEL,"model_parameters":171664,"action_mode":"sample","seed":101,
 "results":{"baseline":group(base),"patched":group(patched)}}

class GateTests(unittest.TestCase):
 def test_accepted_measured_threshold(self):
  self.assertEqual(verify(record())["verdict"],"pass")
 def test_threshold_failure(self):
  self.assertEqual(verify(record(patched=60))["verdict"],"fail")
 def test_baseline_threshold_failure(self):
  self.assertEqual(verify(record(base=10))["verdict"],"fail")
 def test_not_run_rejected(self):
  x=record();x["physics_executed"]=False
  with self.assertRaisesRegex(ValueError,"physics schema"):
   verify(x)
 def test_level_tampering_rejected(self):
  x=record();x["level_sha256"]="0"*64
  with self.assertRaisesRegex(ValueError,"fingerprint"):
   verify(x)
 def test_duplicate_episodes_rejected(self):
  x=record();x["results"]["patched"]["rows"][1]["episode"]=0
  with self.assertRaisesRegex(ValueError,"duplicate"):
   verify(x)
 def test_false_wins_rejected(self):
  x=record();x["results"]["patched"]["wins"]=64
  with self.assertRaisesRegex(ValueError,"wins"):
   verify(x)
 def test_sample_count_rejected(self):
  with self.assertRaisesRegex(ValueError,"incomplete"):
   verify(record(n=2,patched=2))
 def test_nonnumeric_reward_rejected(self):
  x=record();x["results"]["baseline"]["rows"][0]["reward"]=float('nan')
  with self.assertRaisesRegex(ValueError,"nonfinite"):
   verify(x)
 def test_unpaired_control_rejected(self):
  x=record();x["results"]["patched"]=record(n=65,patched=64)["results"]["patched"]
  with self.assertRaisesRegex(ValueError,"unpaired"):
   verify(x)

if __name__=="__main__":unittest.main()
