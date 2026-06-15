# Runbook — game platform readiness

## Goal

Determine whether a game is actually playable and packageable for named target platforms.

## Steps

1. Inspect game README, package/build scripts, source entrypoints, assets, and platform configs.
2. Identify target platforms explicitly.
3. Verify controls/input for each target.
4. Verify build or packaging command for each target.
5. Check downloadable artifact/release links.
6. Check runtime assumptions: browser APIs, filesystem, resolution, touch/gamepad/keyboard.
7. Produce a platform matrix.
8. Label each platform: Verified, Partially verified, Unverified, Missing.

## Validation

- Build command output where available.
- Manual smoke test notes where available.
- README/release link evidence.

## Do not

- Claim a platform is supported because it is listed in docs.
- Mix prototype status with release-ready status.
- Import assets without checking style, license, and runtime cost.
