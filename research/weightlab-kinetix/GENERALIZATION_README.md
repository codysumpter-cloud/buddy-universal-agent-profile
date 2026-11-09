# WeightLab v0.5 — prospective Kinetix physics generalization

Research-only, opt-in robustness suite on the **published official `l/h2_car_ramp`** level. Extends the merged v0.4 physics harness without replacing it.

## Changes to actual dynamics

Six profiles are predeclared in `generalization.py`; all use the same geometry, goals and 171,664-parameter actor. Five are actual modified dynamics: `base_friction` 50% / 150%, `base_motor_power` 70%, and the actual simulator state `gravity` vector 75% / 125%. Includes a nominal control. With 8 episodes per policy per profile, CI runs 96 genuine episodes (6×8×2).

The engine is **official `kinetix-env==3.0.2`**, running JAX physics. Source simulator and checkpoint version/fingerprint validation is required. The harness uses distinct seed namespaces per condition and paired baseline/repaired seeds.

## Two independent verdicts

- `evidence_completeness=pass`: the report is complete and internally coherent, with correct scenario parameters, simulator, source level hash, episode IDs and control/treatment counts. This is NOT a claim that the controller generalized.
- `robustness_candidate=pass`: nominal repaired success >=95%, each predeclared modified condition repaired success >=80%, and repaired better than baseline in every condition. This is a prospective screening criterion, **not** an independent test after model optimization.

The workflow **fails if evidence validation fails**, but records controller robustness failures as scientific results, not infrastructure failures. It does not promote patches into BUAP or games. JSON checksums are not signatures; CI must independently execute simulator code.

## Running

```bash
python -m pip install 'kinetix-env==3.0.2' 'numpy==2.3.4'
python -m unittest discover -v -s research/weightlab-kinetix/test
python research/weightlab-kinetix/generalization.py --episodes 8 --seed 1901 --output kinetix-generalization-evidence.json
python research/weightlab-kinetix/generalization_gate.py --input kinetix-generalization-evidence.json --output kinetix-generalization-gate.json
```

This does **not** test unseen levels or new geometry; next steps require distinct levels or controlled scene perturbations and non-reused holdout cases. No model is retrained or LLM-edited here. Commit source files, not downloaded upstream model binaries.
