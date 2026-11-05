"""REA Human Life Lab experiment 001: equation-level reproduction of Brown et al. (1997).

Source: https://models.physiomeproject.org/workspace/57f/file/b7ace28cd8fc53c71b668914616b34538812f126/brown_choe_shanahan_czeisler_1997.cellml

Manually transcribed *published model equations*, NOT a downloaded CellML file or
an execution of the official CellML simulator.  Time is minutes; H1/H2 pM;
A is pM/min.  This is a single pulse and NOT an entrained circadian clock or
model of environmental-light input.  It has NO medical applicability.
"""
from __future__ import annotations

from dataclasses import dataclass, replace
from math import exp, log, isfinite
from pathlib import Path
import argparse
import csv
import json

SOURCE = "https://models.physiomeproject.org/workspace/57f/file/b7ace28cd8fc53c71b668914616b34538812f126/brown_choe_shanahan_czeisler_1997.cellml"


@dataclass(frozen=True)
class Parameters:
    # CellML original declared variable initial values
    t_on: float = 1316.0
    t_off: float = 1792.0
    A_max: float = 6.51  # pM/min
    tau_I: float = 2.82  # minutes (infusion half-life)
    tau_C: float = 23.67 # minutes (plasma clearance half-life)
    tau_alpha: float = 25.92  # minutes (activity decline half-life)
    tau_lambda: float = 24.04 # minutes (activity rise half-life)
    H1_0: float = 0.05  # pM
    H2_0: float = 1.0   # pM

    def validate(self):
        if any(not isfinite(v) for v in vars(self).values()):
            raise ValueError("nonfinite model parameter")
        if not 0 <= self.t_on < self.t_off:
            raise ValueError("t_on and t_off must be chronological and nonnegative")
        if self.A_max < 0 or self.H1_0 < 0 or self.H2_0 < 0:
            raise ValueError("source and initial concentrations must be nonnegative")
        if min(self.tau_I, self.tau_C, self.tau_alpha, self.tau_lambda) <= 0:
            raise ValueError("half-lives must be positive")
        return self


def synthesis(t: float, p: Parameters) -> float:
    """Piecewise A(t) in CellML component A, exactly as shown in MathML."""
    if t < p.t_on:
        return 0.0
    if t < p.t_off:
        growth = 1 - exp(-log(2) * (t - p.t_on) / p.tau_lambda)
        normalizer = 1 - exp(-log(2) * (p.t_off - p.t_on) / p.tau_lambda)
        return p.A_max * growth / normalizer
    return p.A_max * exp(-log(2) * (t - p.t_off) / p.tau_alpha)


def derivative(t: float, h1: float, h2: float, p: Parameters):
    beta_I, beta_C = log(2) / p.tau_I, log(2) / p.tau_C
    return synthesis(t, p) - beta_I * h1, beta_I * h1 - beta_C * h2


def rk4_step(t: float, h1: float, h2: float, dt: float, p: Parameters):
    k1 = derivative(t, h1, h2, p)
    k2 = derivative(t + dt / 2, h1 + dt*k1[0]/2, h2 + dt*k1[1]/2, p)
    k3 = derivative(t + dt / 2, h1 + dt*k2[0]/2, h2 + dt*k2[1]/2, p)
    k4 = derivative(t + dt, h1 + dt*k3[0], h2 + dt*k3[1], p)
    return (h1 + dt*(k1[0] + 2*k2[0] + 2*k3[0] + k4[0])/6,
            h2 + dt*(k1[1] + 2*k2[1] + 2*k3[1] + k4[1])/6)


def simulate(p: Parameters, minutes: int = 2400, step: float = 0.25):
    p.validate()
    if minutes <= 0 or int(minutes) != minutes or step <= 0 or abs(round(1/step)*(step)-1) > 1e-10:
        raise ValueError("minutes must be positive integer and step an integer divisor of one minute")
    subdivisions = round(1/step)
    h1, h2 = p.H1_0, p.H2_0
    rows = [(0, synthesis(0,p), h1, h2)]
    for minute in range(minutes):
        for j in range(subdivisions):
            t = minute + j / subdivisions
            h1, h2 = rk4_step(t, h1, h2, 1/subdivisions, p)
        rows.append((minute + 1, synthesis(minute+1,p), h1, h2))
    return rows


def measurements(rows):
    # All endpoints on integer minute grid; exact trapezoidal quadrature for recorded samples.
    maxr = max(rows, key=lambda r: r[3])
    return {"peak_plasma_pM": round(maxr[3], 6),
            "peak_at_minute": int(maxr[0]),
            "peak_clock_label": f"day {maxr[0]//1440}, {int((maxr[0]%1440)//60):02d}:{int(maxr[0]%60):02d}",
            "plasma_AUC_pM_minutes": round(sum((a[3]+b[3])/2 for a,b in zip(rows,rows[1:])),4),
            "final_plasma_pM": round(rows[-1][3], 6)}


def run(output: Path):
    output.mkdir(parents=True,exist_ok=True)
    baseline=Parameters()
    scenarios={
       "baseline":baseline,
       "synthesis_delayed_120min":replace(baseline,t_on=baseline.t_on+120,t_off=baseline.t_off+120),
       "faster_clearance_2x":replace(baseline,tau_C=baseline.tau_C/2),
       "slower_clearance_2x":replace(baseline,tau_C=baseline.tau_C*2),
    }
    results={name:simulate(p) for name,p in scenarios.items()}
    with (output/'traces.csv').open('w',newline='') as f:
       writer=csv.writer(f)
       writer.writerow(['scenario','minute','synthesis_pM_per_min','pineal_pM','plasma_pM'])
       for name,rows in results.items():
          writer.writerows((name,*row) for row in rows)
    report={
      'experiment':'REA Human Life Lab E001',
      'provenance':'manually transcribed from source CellML MathML indexed page; original CellML was NOT executed',
      'source':SOURCE,
      'simulation':'single nonperiodic synthesis pulse; not a direct light-exposure response',
      'solver':'fixed-step classical RK4; dt=0.25 minute; samples every 1 minute',
      'duration_min':2400,
      'scenarios':{name:{'parameters':vars(scenarios[name]),**measurements(rows)} for name,rows in results.items()},
      'medical_or_human_validation':'none',
      'model_source_simulator_verified':False,
      'paper_figure_reproduced':False,
    }
    (output/'results.json').write_text(json.dumps(report,indent=2)+'\n')
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        fig,ax=plt.subplots(figsize=(11,5.6))
        for name,rows in results.items():
            ax.plot([row[0]/60 for row in rows],[row[3] for row in rows],label=name.replace('_',' '))
        ax.axvline(baseline.t_on/60,linestyle='--',linewidth=.9,alpha=.45)
        ax.axvline(baseline.t_off/60,linestyle='--',linewidth=.9,alpha=.45)
        ax.set_xlabel('Hours since model time zero (not time since waking)')
        ax.set_ylabel('Simulated plasma melatonin H2 (pM)')
        ax.set_title('Brown et al. (1997) equation-level reproduction — parameter perturbations')
        ax.legend(fontsize=8)
        ax.grid(alpha=.15)
        fig.tight_layout()
        fig.savefig(output/'melatonin_scenarios.png',dpi=170)
        plt.close(fig)
        report['chart']='melatonin_scenarios.png'
        (output/'results.json').write_text(json.dumps(report,indent=2)+'\n')
    except ImportError:
        report['chart']=None
        (output/'results.json').write_text(json.dumps(report,indent=2)+'\n')
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=Path('results'))
    args=parser.parse_args()
    print(json.dumps(run(args.output),indent=2))