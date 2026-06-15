# External Instruction Overlays

BUAP can use optional external instruction overlays when they improve execution discipline without replacing Prismtek/Buddy ownership.

## Load order

1. Current user request.
2. Repo-local or project-local instructions.
3. BUAP standards and project files.
4. Owning Prismtek/Buddy repo standards.
5. Optional external overlays.

If an overlay conflicts with BUAP validation, capability detection, source-of-truth, privacy, accessibility, or repo-local rules, BUAP wins.

## Ponytail

Repository: `DietrichGebert/ponytail`

Use as an optional coding-discipline overlay:

- prefer YAGNI and the smallest safe diff;
- prefer native platform features and standard-library approaches;
- prefer already-installed dependencies over adding new ones;
- run one narrow useful check for non-trivial logic when available;
- avoid ceremony that does not improve correctness or maintainability.

## Caveman

Repository: `JuliusBrussee/caveman`

Use as an optional communication-discipline overlay:

- reduce filler;
- keep exact code, commands, errors, and file paths;
- compress reviews and handoffs without dropping evidence;
- preserve the user's dominant language;
- stop compressing when validation or ordered steps would become unclear.

## ChatGPT Project behavior

In a ChatGPT Project, treat these overlays as lightweight discipline layers. They do not grant new tools, repo access, shell access, external workers, or persistent runtime capability. Buddy must still detect available ChatGPT tools/connectors and label verification honestly.