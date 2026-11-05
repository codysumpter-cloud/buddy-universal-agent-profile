# REA Human Life Lab — Experiment E001 results

**Status:** Locally verified equation-level reproduction; *upstream CellML runner, paper-figure matching, and REA MCP use remain unverified*.

## Scientific target and provenance

Source: Brown, Choe, Shanahan & Czeisler (1997), *A mathematical model of diurnal variations in human plasma melatonin levels*. The model source page is:

https://models.physiomeproject.org/workspace/57f/file/b7ace28cd8fc53c71b668914616b34538812f126/brown_choe_shanahan_czeisler_1997.cellml

The source's indexed CellML/MathML page provided all model equations and parameter initial values. Because direct download of its raw XML was blocked in the computation environment, the code manually transcribes those displayed equations. **Do not label this an execution of the original CellML file or independent biological validation.**

## Model reproduced

Time in minutes; pineal H1 and plasma H2 in pM; synthesis A(t) in pM/min.

- `dH1/dt = A(t) - beta_I*H1`
- `dH2/dt = beta_I*H1 - beta_C*H2`
- `beta_I = ln(2)/2.82` and `beta_C=ln(2)/23.67`, in min^-1.
- A(t) = 0 before 1316 min, rises exponentially (normalized to 6.51 pM/min) between 1316 and 1792 min, then decays exponentially. Growth/decline half-lives are 24.04 and 25.92 minutes. Initial H1=0.05, H2=1.0 pM.

Source describes a **single prescribed time window** over 3000 minutes, not a self-entrained oscillator. It does not predict responses to specific light doses, actual sleep duration, diagnosis, cognitive states, or the behavior of any particular person.

## Scenarios (40 hours, time step 0.25 minute)

| Experiment | Peak plasma H2 (pM) | Peak at model minute | Area under H2 (pM·min) |
|---|---:|---:|---:|
| baseline | 222.304 | 1792 | 106457.2 |
| synthesis delayed 120min | 222.304 | 1912 | 106457.0 |
| faster clearance 2x | 111.154 | 1792 | 53228.6 |
| slower clearance 2x | 443.719 | 1793 | 212904.7 |

A two-hour shift of the prescribed synthesis window delayed the plasma peak by exactly 120 simulated minutes without meaningfully changing its height. Doubling the clearance rate halved the peak; halving it approximately doubled the peak. Those results reflect a linear two-compartment model, not general-purpose claims about human treatment or light interventions.

## Numerical validation

- `python -m unittest discover -v -p 'test_*.py'` — **6/6 passed** locally.
- `python validate_scipy.py` — **passed**, checking classical RK4 against a separately implemented adaptive DOP853 integrator using SciPy 1.17.0.
- Maximum absolute difference across 4 scenarios (H2) = **1.612e-07 pM**, at one-minute sampling. This establishes numerical agreement of two implementations of the transcribed equations, **not** equivalence to the published CellML run.

## Required next validation gates

1. Obtain the exact raw upstream CellML XML, checksum it, and verify code parity with the source.
2. Run original CellML in a genuine simulator; compare point-by-point against this Python trace with predeclared tolerance.
3. Compare original paper figures if available; document model-parameter uncertainty.
4. Verify REA owner MCP tool connectivity separately; REA is for analysis of the simulator/software implementation, not reverse engineering human biology directly.
5. Connect a strictly optional, nonclinical read-only physiology state to existing Prismtek Studio WorldSim only after validated data contracts.

## Reproduction instructions

```sh
python3 -m unittest discover -v -p 'test_*.py'
python3 experiment.py --output results
# optional: pip install scipy; then:
python3 validate_scipy.py
# optional plotting: pip install matplotlib
```

Python standard library suffices for the core numerical experiment, JSON report and CSV. Matplotlib is only for figures; SciPy is only for the independent cross-check. No human health data was used.

## Artifact integrity

Files are reproducible: regenerate via commands above; SHA-256 values for this local execution are below. Exact byte hashes of generated plots vary with Matplotlib/font versions.

- `experiment.py`: `ab4b3cc167726afa8f399e4ac315c1f30a7fa781eed5567be9670b8d5e09dd5a`
- `test_experiment.py`: `49c887aacbd1d26f7d5661715ab89bb18e295f3bdea0e8e8120fc9aeac3e871f`
- `validate_scipy.py`: `04a6d6e82f0a41fd1170f0d670ce9f8048e565feccdc80c132c47fc8c73704d4`
- `results.json`: `eb6d156fb6cbcae500b0235c72eed447fc508ffbd970f4cde0c46ce623692313`
- `independent-check.json`: `78057be46e905f3c828578e181b6791d2ba13fbacce542b0ddd2a82dccd40df1`
- `traces.csv`: `9b8ee0a3ec773486fb4924be36128eb089b799b864afdbb99a62269812f8f5c9`
- `melatonin_scenarios.png`: `6dc77a6e008a42fff0db56e1918969e2cb776d013f78a1ff9fdc692982bb5c62`