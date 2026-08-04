# Omni Buddy Integration

> **Consolidated.** `codysumpter-cloud/omni-buddy` was migrated into the `prismtek-apps`
> monorepo at `services/omni-buddy` (source head `9299607731bd7adfc05687a6f0597b2d5759304f`) and archived read-only.
> Route work to the path, not the archived repository URL.
> Record: `prismtek-apps/docs/migrations/omni-buddy.yaml`. Tracker: `prismtek-apps#359`.

## Purpose

Teach BUAP how to treat `codysumpter-cloud/prismtek-apps` at `services/omni-buddy` as the local device, voice,
vision, model, transport, and Raspberry Pi runtime path.

## Ownership

- **Owner path:** `codysumpter-cloud/prismtek-apps` at `services/omni-buddy`
- **BUAP role:** know what Omni owns, route device/runtime claims to Omni validation,
  and avoid claiming hardware behavior without device receipts.

## Verified source-backed boundary

Omni Buddy is a local/offline-first agent framework for Raspberry Pi-style devices. It
includes local LLM routing, wake word, speech-to-text, text-to-speech, reactive faces,
camera vision, Omni endpoint routing, fallback to local Ollama, transport modes, runtime
profiles, latency profiles, doctor scripts, and validation matrix checks.

## Read-first files

1. `README.md`
2. `docs/VALIDATION_MATRIX.md`
3. `docs/K4_OPERATOR_RUNBOOK.md`
4. `OMNI_INTEGRATION_MAP.md`
5. `docs/BMO_OMNI_UPGRADE_PLAN.md`
6. `docs/COMMS_LAYER_PLAN.md`

## Runtime commands BUAP should know

```bash
./scripts/install_k3_deps.sh
./scripts/bmo_omni_doctor.sh
./scripts/run_validation_matrix.sh
python3 ./scripts/apply_runtime_profile.py dev
python3 ./scripts/apply_runtime_profile.py pi-live
python3 ./scripts/apply_runtime_profile.py field
python3 ./scripts/apply_latency_profile.py snappy
./scripts/bmo_omni_launch.sh
```

Runtime profiles:

- `dev`
- `pi-live`
- `field`

Latency profiles:

- `snappy`
- `balanced`
- `robust`

Transport modes:

- `online`
- `mesh`
- `reticulum_fallback`
- `auto`

## BUAP routing rules

Use Omni Buddy when the task involves:

- wake/listen/think/speak/error state loops;
- Raspberry Pi or local device runtime;
- local LLM/Ollama routing;
- camera vision / Moondream;
- voice/TTS/STT;
- mesh or Reticulum fallback transport;
- runtime and latency profiles;
- device validation matrix.

## Knowledge Vault relationship

Omni Buddy should eventually emit public-safe `system:*`, `task:*`, and `repo:*` records
for device runtime status, validation results, transport posture, and profile changes.
BUAP should not claim those events exist until Omni implements native emitters or an
audited adapter.

## Validation rule

Do not claim Omni hardware behavior is working unless a device/runtime receipt exists.
Local source inspection can verify configuration paths and scripts, but not live device
state.
