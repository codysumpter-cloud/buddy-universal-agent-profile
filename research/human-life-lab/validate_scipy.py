"""Independent numerical integrator cross-check for E001 (requires SciPy).

This does not execute or validate the upstream CellML source; it checks that
our RK4 solver agrees with a distinct adaptive numerical method for the SAME
transcribed equations.
"""
from dataclasses import replace
from math import exp,log
from pathlib import Path
import json
import scipy
from scipy.integrate import solve_ivp
from experiment import Parameters, simulate


def input_function(t,p):
    # Deliberately independent transcription of published piecewise input.
    alpha=log(2)/p.tau_alpha
    lam=log(2)/p.tau_lambda
    if t < p.t_on: return 0.0
    if t < p.t_off:
        return p.A_max * (-__import__('math').expm1(-lam*(t-p.t_on))) / (-__import__('math').expm1(-lam*(p.t_off-p.t_on)))
    return p.A_max * exp(-alpha*(t-p.t_off))


def independent_solution(p, minutes=2400):
    beta_i=log(2)/p.tau_I
    beta_c=log(2)/p.tau_C
    def rhs(t,y):
        h1,h2=y
        return [input_function(t,p)-beta_i*h1,beta_i*h1-beta_c*h2]
    # DOP853 high-order adaptive method; sample at same 1-minute time grid.
    ans=solve_ivp(rhs,[0,minutes],[p.H1_0,p.H2_0],method='DOP853',
                  t_eval=list(range(minutes+1)),max_step=1.0,rtol=1e-11,atol=1e-12)
    if not ans.success: raise RuntimeError(ans.message)
    return ans.y.T


def verify():
    baseline=Parameters()
    scenarios={
       'baseline': baseline,
       'synthesis_delayed_120min': replace(baseline,t_on=baseline.t_on+120,t_off=baseline.t_off+120),
       'faster_clearance_2x': replace(baseline,tau_C=baseline.tau_C/2),
       'slower_clearance_2x': replace(baseline,tau_C=baseline.tau_C*2),
    }
    errors={}
    for name,p in scenarios.items():
        alt=independent_solution(p)
        ours=simulate(p)
        errors[name]={
            'max_abs_pineal_error_pM': max(abs(row[2]-other[0]) for row,other in zip(ours,alt)),
            'max_abs_plasma_error_pM': max(abs(row[3]-other[1]) for row,other in zip(ours,alt)),
        }
        assert errors[name]['max_abs_plasma_error_pM'] < 0.005, (name,errors[name])
    return {
        'check':'RK4 (dt=.25min) vs SciPy DOP853 (maxstep=1min, rtol=1e-11, atol=1e-12)',
        'scipy_version':scipy.__version__,
        'pass':True,
        'error_metrics':errors,
        'original_CellML_run':False,
        'published_figure_comparison':False,
    }


if __name__=='__main__':
    report=verify()
    dest=Path('results/independent-check.json')
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))