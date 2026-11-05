"""Structural, numerical convergence and qualitative checks; not biological validity tests."""
import unittest
from dataclasses import replace
from math import isclose
from experiment import Parameters, synthesis, simulate, measurements


class ExperimentTests(unittest.TestCase):
    def test_source_parameters(self):
        p=Parameters()
        self.assertEqual((p.t_on,p.t_off,p.A_max,p.tau_C),(1316,1792,6.51,23.67))

    def test_source_continuity(self):
        p=Parameters()
        self.assertEqual(synthesis(p.t_on,p),0)
        self.assertAlmostEqual(synthesis(p.t_off-1e-7,p),p.A_max,places=6)
        self.assertAlmostEqual(synthesis(p.t_off,p),p.A_max)
        self.assertEqual(synthesis(200,p),0)

    def test_first_order_clearance_half_life(self):
        p=replace(Parameters(),t_on=2500,t_off=2700,A_max=0,H1_0=0,H2_0=1)
        # Direct plasma H2 with no source or H1: H2(23.67) = 1/2.
        r=simulate(p,minutes=24,step=.05)
        self.assertAlmostEqual(r[24][3],2**(-24/23.67),delta=.00001)

    def test_numerical_convergence(self):
        p=Parameters()
        coarse=simulate(p,minutes=2300,step=.5)
        fine=simulate(p,minutes=2300,step=.125)
        self.assertLess(max(abs(a[3]-b[3]) for a,b in zip(coarse,fine)),0.001)

    def test_expected_directional_response(self):
        b=Parameters()
        normal=measurements(simulate(b))
        later=measurements(simulate(replace(b,t_on=b.t_on+120,t_off=b.t_off+120)))
        fast=measurements(simulate(replace(b,tau_C=b.tau_C/2)))
        slow=measurements(simulate(replace(b,tau_C=b.tau_C*2)))
        self.assertAlmostEqual(later['peak_at_minute']-normal['peak_at_minute'],120,delta=1)
        self.assertLess(fast['peak_plasma_pM'],normal['peak_plasma_pM'])
        self.assertGreater(slow['peak_plasma_pM'],normal['peak_plasma_pM'])

    def test_reject_invalid_input(self):
        with self.assertRaises(ValueError):
            simulate(replace(Parameters(),tau_C=-1))
        with self.assertRaises(ValueError):
            simulate(replace(Parameters(),t_off=1))


if __name__ == '__main__':
    unittest.main()