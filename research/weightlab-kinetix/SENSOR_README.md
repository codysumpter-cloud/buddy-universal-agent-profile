# WeightLab v0.7 — sensor-conditioned neural weight edits

**Status:** research experiment; no automatic promotion. This intentionally targets the **actual published Kinetix actor** and the physics weaknesses measured in v0.5/v0.6, not a substitute controller.

## Question

Can adding a tiny number of **real input-to-hidden neural weights** make the original 171,664-parameter edited actor respond to more than horizontal position/velocity, improving the existing half-friction and 125%-gravity failures while preserving nominal success?

## What changes

The original paper's isolated repair circuit uses `embed.W[52,6]` (car-body x), `embed.W[54,7]` (body horizontal velocity) and `embed.W[234,8]` (green-wheel x). Kinetix `SYMBOLIC_FLAT` maps the car-body polygon at index 5 to input indices 52..77 and the first wheel at 234 onwards. In particular:

| Raw symbolic-flat input | Physical quantity |
|---|---|
| 52 | Car-body X |
| 53 | Car-body Y |
| 54 | Car-body horizontal velocity |
| 55 | Car-body vertical velocity |
| 234 | Green-wheel X |
| 235 | Green-wheel Y |

**85 predeclared options:** unchanged baseline + 60 single-weight proposals connecting velocity, body height or wheel height into existing embedding units 6–8 (10 possible connections × 6 signed magnitudes) + 24 single-bias proposals affecting the existing downstream release gates. Each proposal modifies **one scalar out of 171,664 parameters**, and all edits are limited to a small hardcoded allowlist. No new runtime branch, override function, training data or replacement neural architecture is used.

The simulator is **official `kinetix-env==3.0.2`**, physical `l/h2_car_ramp` level verified by Git blob SHA and the original upstream actor checkpoints pinned to immutable upstream commit. No downloaded upstream edit scripts are executed.

## Prespecified experiment

- Development conditions: nominal; friction ×0.50; gravity ×1.25 (previously observed failures).
- Stage 1: 85 models × 1 seed × 3 conditions. Rank by actual successful stress episodes, using distance travelled left only as an information-preserving tiebreaker. Disqualify any nominal failure.
- Stage 2: unchanged policy and strongest **12** single-edit candidates, × 2 new seeds × 3 conditions. Only select a candidate with **strictly more Kinetix GoalR successes** under the failing development conditions, with all nominal episodes successful. A mere trajectory/progress improvement does **not** earn a new model.
- Sealed conditions (if selected): friction ×0.60; gravity ×1.15; combined friction ×0.80 / gravity ×1.10. Exactly four paired episodes per condition, one opening, predeclared before stage 1. These are the reserved conditions from v0.6, which remained unopened there; once run they are no longer untouched.
- Sealed screen passes only if at least 3/4 of candidate episodes succeed **and** strictly beat unchanged published policy in each condition.
- **Regardless of outcome** the final promotion flag is `not_approved`; real-world transfer and unseen geometry require more evidence.

The locked manifest, each numeric patch and target SHA, every development episode, selected/nonselected status, optional sealed episodes, and independent evidence gate are archived. The gate recomputes all reported scores, verifies coverage, checks candidate identities, confirms actual holdout isolation, and rejects tampered reports. Its hashes provide integrity only—not cryptographic signatures or authorization.

## Execute

```sh
python -m pip install 'kinetix-env==3.0.2' 'numpy==2.3.4'
python -m unittest discover -v -s research/weightlab-kinetix/test
python research/weightlab-kinetix/sensor_search.py --stage search --output kinetix-sensor-development.json --selected-file kinetix-sensor-selected.json
python research/weightlab-kinetix/sensor_search.py --stage holdout --selected-file kinetix-sensor-selected.json --output kinetix-sensor-holdout.json
python research/weightlab-kinetix/sensor_gate.py --development kinetix-sensor-development.json --selection kinetix-sensor-selected.json --holdout kinetix-sensor-holdout.json --output kinetix-sensor-gate.json
```

## Limitations

This is an **assistant-designed deterministic candidate manifest**, not an autonomous external LLM-generated repair. It operates on one known Kinetix map, not new environments or creatures. Its diagnostics are from actual physics, but stage-1 progress is a development-only ranking cue. The evidence gate cannot cryptographically attest GitHub's entire execution environment. No BUAP agent, Godot game, Flockbay application or production model is modified.
