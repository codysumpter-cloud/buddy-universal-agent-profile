# Kinetix physics validation (next gate)

The previous v0.3 reproduction recreated the published **171,664-parameter** actor edit exactly and verified 6,073 weight changes. This v0.4 stage independently executes the **real Kinetix 2D JAX physics** on its `l/h2_car_ramp` level, if the public simulator dependency is installable and compatible.

- Public environment dependency: `kinetix-env==3.0.2` (FLAIROx/Kinetix), JAX CPU, Python 3.11.
- Pin/verify exact canonical level file via Git blob: `f659a2ccbec0c48874e9602894a304fa0722b279` (50,596 bytes).
- Fetch PPO and edited actor source files using the already implemented immutable original experiment pin and original Git blob verification.
- Base actor is rounded to the precision the researchers showed the LLM. Patched actor is their released checkpoint (already verified to equal the 51-edit reconstruction).
- Symbolic flat observation (679), **not** padded flat or pixels. Six motor/thruster actions (4 x 3 logits + 2 x 2 logits), independently sampled with a NumPy RNG per episode or argmax.
- Uses the actual Kinetix `make_kinetix_env` engine, reset to original level and runs up to 256 engine steps. Validates level SHA and runtime observation/action structure before scoring. Scores from actual terminal `GoalR`, never the paper's original JSON report.
- This independent test uses different seeds from the original publication; it will not be compared to original 1024-episode proportions as if they were the same stream.

## Local smoke tests

```sh
python -m unittest discover -v -s research/weightlab-kinetix/test
python research/weightlab-kinetix/physics_rollout.py --episodes 2 --seed 101 --mode sample --output kinetix-physics-evidence.json
```

The `weightlab-kinetix-physics.yml` GitHub Actions workflow executes the same physics command. Passing a file-format test is **not** physics success. A failure (dependency, API mismatch, resource limit) is a blocker to document and fix without misrepresenting it as proof.

## Result status

**Pending GitHub runner execution.** No environment success rate can be claimed until that exact workflow passes.

## Independent promotion gate

GitHub's CPU workflow now runs **64 paired baseline/patched episodes**, requires
at least **95% patched success** and at most **5% baseline success** on those
same fixed-level episode IDs, and rejects malformed/missing/duplicate episode
records. This requirement is declared before the 64-episode run, and failures
are preserved as evidence, not swept into a cherry-picked set.

`physics_gate.py` validates the record and emits a SHA-256-bound report, then
exits nonzero if performance thresholds are missed. These checks are **not**
an authenticated signature and not permission to deploy/modify production
models. The 64 episodes differ by RNG/action samples, **not by level geometry**.
