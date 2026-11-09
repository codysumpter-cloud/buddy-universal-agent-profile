import sys
from pathlib import Path
import unittest
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from physics_rollout import actor_logits, action_from_logits, ACTION_HEAD_WIDTHS, KINETIX_LEVEL

class TestPhysicsAdapter(unittest.TestCase):
 def test_action_heads(self):
  self.assertEqual(sum(ACTION_HEAD_WIDTHS),16)
  self.assertEqual(action_from_logits(np.arange(16.,dtype=float),np.random.default_rng(0),'argmax').tolist(),[2,2,2,2,1,1])
 def test_seeded_sample(self):
  x=np.zeros(16);a=action_from_logits(x,np.random.default_rng(42));b=action_from_logits(x,np.random.default_rng(42));np.testing.assert_equal(a,b)
 def test_nonfinite_rejected(self):
  with self.assertRaisesRegex(ValueError,"nonfinite"):
   action_from_logits(np.array([float('nan')]+[0.]*15),np.random.default_rng(1))
 def test_wrong_logit_shape_rejected(self):
  with self.assertRaisesRegex(ValueError,"exactly 16"):
   action_from_logits(np.zeros(15),np.random.default_rng(2))
 def test_bad_obs_rejected(self):
  with self.assertRaisesRegex(ValueError,"observation"):
   actor_logits({},np.zeros(678))
 def test_level_name(self):
  self.assertEqual(KINETIX_LEVEL,'l/h2_car_ramp.json')
if __name__=='__main__': unittest.main()
