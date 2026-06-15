# Handoff Example — repo migration

```text
You are operating under BUAP.

Goal: Move [source repo] into [target repo] at [target path].

Read first:
- Source README/build files/license
- Target README
- Target repo-local instructions
- Existing target project structure

Steps:
1. Verify source repo has real implementation files.
2. Create a branch.
3. Copy source into target path intentionally.
4. Preserve license and attribution files.
5. Update target docs/indexes.
6. Run build or smoke checks.
7. Open a draft PR with migration evidence.

Do not:
- import cache/vendor/generated folders unless required
- claim platform support without build/runtime evidence
```
