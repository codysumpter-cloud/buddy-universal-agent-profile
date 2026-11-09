# WeightLab: published Kinetix Experiment 4 — weight-level reproduction

This is an **independent numeric reproduction of the original research team's one-shot neural-network repair** (171,664 parameters). It is not a new model-generated solution, and **does not execute the Kinetix physics environment**.

## Ground truth

Source: Rikiya Takehi, Jayden Teoh, Alex Zhang & Omar Khattab, *Sparks of Weight-Space Programming* (2026), [Experiment 4 original release](https://github.com/RikiyaT/lm_understand-logs/tree/main/exp4_fix_car). Original source pin: `4d09ba6d6a7e891dd8063974dfe81b3d78e3494f`.

The experiment edits 6,073 / 171,664 actor weights via 51 lines of numeric assignments. The research authors report an improvement from **0/256 to 1,024/1,024 successful physics episodes**. Our test **does not repeat those 1,024 environment episodes**: it verifies the shipped edited actor mathematically.

The script:

1. Downloads exactly four _data_ files from the immutable upstream commit (2 NPZ, one Markdown edit block, one eval JSON). Uses file-size and exact Git blob checks before loading. Does **not** clone or execute upstream code.
2. Parses the 51 edit statements as Python AST and allows only constants, tensor slice/index assignment and numeric `+=`/`-=`. Untrusted Python is never `exec`'d.
3. Rounds the original actor to the precision shown to Astra; applies edits in order; compares all 14 tensors with the published `edited_actor.npz` using exact array equality.
4. Independently counts changed parameters per tensor; runs six synthetic forward-pass probes; separately quotes the original author's reported physics result as **source-reported**, not independently measured.
5. Emits machine-readable JSON with source pin, file SHA-256s, exact-match verdict and explicit scope boundaries. CI uploads the verification JSON artifact.

This is a source-integrity and calculation regression to complement `packages/buap-weightlab-bridge`. It does not change any running agent or game, and does not grant model promotion. An independently validated _live physics_ evaluation would be a separate gate.

## Run

```bash
python -m pip install numpy==2.3.4
python -m unittest discover -v -s research/weightlab-kinetix/test
python research/weightlab-kinetix/reproduce.py --output kinetix-reproduction.json
```

Offline reruns: pass `--cache DIR --offline` after obtaining the verified source data. Network access is needed only for the first verified data fetch.

## Licenses

Check upstream original source/license before rehosting. The code herein is a separate implementation; it fetches data from the source without vendoring the original binaries into BUAP. Retain citations to original researchers; do not claim independent reproduction of physics success until independently running the environment.

## Optional independent Kinetix physics gate (v0.4)

See [PHYSICS_README.md](PHYSICS_README.md) and
[physics_rollout.py](physics_rollout.py) for a separate actual-JAX
`l/h2_car_ramp` evaluation. It has its **own** CI workflow and does not
change the numeric-only release's evidence status. A valid physics result
requires the new workflow to execute successfully; it must not be inferred
from the earlier exact-weight replay.

The v0.4 GitHub workflow also applies a separate fail-closed performance gate:
**64 episodes per actor**, patched success **>= 95%**, baseline success **<= 5%**.
Its signed-by-nobody JSON digest is an integrity checksum, not authorization.

## v0.5: prospective physics-parameter generalization

The independent `generalization.py` uses Kinetix's actual `base_friction`, `base_motor_power` and gravity to prospectively evaluate six predeclared conditions with baseline and patched policy controls. The new workflow `weightlab-kinetix-generalization.yml` uploads complete rows plus a **separate** data-completeness and candidate-robustness verdict. It **does not** automatically promote models or claim robustness if a condition fails. See [GENERALIZATION_README.md](GENERALIZATION_README.md) for exact parameters and evaluation scope.
