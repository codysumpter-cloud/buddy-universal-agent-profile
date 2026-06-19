# Local Bootstrap Acceptance Checklist

Use this checklist when reviewing the local BUAP doctor and bootstrap helpers.

## Doctor

- [x] `node tools/buap-doctor.mjs` performs fast repo, ACP package, tool, and optional environment checks.
- [x] `node tools/buap-doctor.mjs --full` also runs ACP package smoke/build/launch checks.
- [x] Optional missing environment variables warn but do not fail the doctor.
- [x] `BUAP_MODEL_API_KEY` is reported only as `set` or `missing`; the secret value is never printed.
- [x] The doctor exits `0` when required files and tools are present.
- [x] The doctor exits `1` when required checks fail.

## Bootstrap

- [x] `node tools/buap-local-bootstrap.mjs` creates `~/.buap/` when missing.
- [x] The bootstrap creates `~/.buap/personalization.json` only when missing.
- [x] `node tools/buap-local-bootstrap.mjs --force` overwrites the personalization file with defaults.
- [x] The bootstrap prints recommended environment exports.
- [x] The bootstrap prints the ACP launch command.
- [x] The bootstrap does not modify shell profiles automatically.
