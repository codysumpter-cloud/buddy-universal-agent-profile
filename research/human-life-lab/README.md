# REA Human Life Lab — evidence-led research mission

Status: **equation-level E001 experiment locally verified; upstream CellML simulation and REA MCP investigation not completed**.
Owner: Prismtek / Buddy; research home: `buddy-universal-agent-profile`. Runtime integration target, **only after validation**: the existing Prismtek Engine / WorldSim in `prismtek-site`.
Date: 2026-11-05.

## Goal

Build a *testable, modular computational account of aspects of human life*, not a claim to have reverse-engineered a person, reproduced consciousness, or built a medical digital twin. Begin with a real published physiological model and a repeatable evidence chain, then connect validated layers only when interface variables, assumptions, units, provenance, and error bounds are documented.

## What REA does and does not do

REA (`morluto/rea`, `rea-agents`) is a software / binary / application and runtime reverse-engineering instrument. Its current workflow is **inspect → trace evidence → reproduce behavior → validate**. It is **not** a tool that can directly decompile cells, minds, or human beings.

For this lab REA's authorized targets are *software and simulators*, such as a local OpenCOR installation or an approved computational-biology application. Public scientific data and mechanistic mathematical models come from scientific repositories with data-use/attribution checks. We use a normal parser and simulator for CellML / SBML. REA is complementary, not a substitute for biological experimentation or literature review.

## Existing architecture to reuse, not fork

- **REA Cloud:** `adapters/rea-cloud/`, private owner MCP gateway. Tool availability must be verified in the actual ChatGPT host before a REA job is marked executed. Cloud REA has no guaranteed access to the Mac's files or local physiology simulator.
- **BUAP Mission Control:** use the existing mission/evidence/permission contract; this document does not add a second agent scheduler.
- **BUAP Agent Life:** `packages/buap-agent-life` models evidence-backed *AI-agent* preferences, drives, relationships, developmental state. This is NOT human physiology or proof of AI consciousness.
- **Prismtek Engine:** existing Studio / WorldSim owns the interactive life-world implementation. Do not create another app, iframed editor, game world, or parallel authority. Only feed the Engine a versioned, independently validated simulation interface later.

## Evidence chain

Every investigation produces a versioned result with:
1. **Target** (repository/model accession, exact revision, source and license).
2. **Question** (one narrowly measurable phenomenon and a falsifiable prediction).
3. **Method** (which REA/software/scientific instrument; exact version and commands; no unreviewed runtime effects).
4. **Raw evidence** (reproducible source files, checksums, model parameters, accepted units, transcripts or logs, attributable citations).
5. **Independent replication** (run original environment and replacement on same inputs; numeric comparison, error tolerance chosen before evaluation).
6. **Limits** (population, variables, excluded mechanisms, permissions, privacy and non-clinical purpose).
7. **Result** (`verified`, `failed`, or `unverified`, with exact artifact hashes and tests).

Do not infer model validity from import success, a pretty visualization, REA's tool count, or a passing smoke test.

## Layers and gates

| Layer | Sources and method | Acceptance gate |
| --- | --- | --- |
| Cells & tissue | Human Cell Atlas (HCA) plus verified literature | Defined cell types / provenance / controlled-access boundaries; no extrapolation to all humans |
| Physiology | Curated CellML / SBML (Physiome, BioModels) | Reproduce a published time series with checked units and uncertainty |
| Brain & behavior | Published neural / cognitive models; distinguish hypothesis from measurement | Held-out behavioral predictions vs simple baselines; avoid consciousness claims |
| Life course | Longitudinal research and developmental datasets with consent/access policies | Population limits, reliability, confounds and transparent bias analysis |
| Social and ecological context | Agent-based experiments with documented assumptions | Comparative experiments against reference patterns, not fabricated realism |
| Engine integration | Existing WorldSim and native game entities | Same ID/state, deterministic save/replay, off by default, no effect on one-click human spawn |

## Experiment 001 — circadian biomarker (transcribed equations executed; source-model comparison pending)

**Question:** Can a published dynamical model reproduce the characteristic rise/fall of human plasma melatonin over a day under its documented assumptions?

Target: Brown, Choe, Shanahan & Czeisler (1997), *A mathematical model of diurnal variations in human plasma melatonin levels*; CellML representation published in the Physiome Model Repository. The repository reports that its curated model reproduces the publication in OpenCell with consistent units. This is a **source claim**, not our independent verification.

Procedure:
1. Retrieve the exact published CellML revision and archive its URL, content hash, citation and reuse terms. If the URL cannot be fetched, record `blocked` and do not substitute invented equations.
2. Inspect model inputs/states, circadian gate/onset/offset, time units, initial values, and solver settings. Use REA only if inspection of the *software runtime* is necessary to understand undocumented behavior.
3. Execute the unchanged source model with a CellML-compatible runner; capture time series, solver versions and model settings.
4. Reimplement the exposed equation system in an isolated test harness; compare at matching time points with predeclared numerical tolerances and unit dimensions. Check the source plots against the published reference, if available.
5. Vary documented parameters to map model sensitivity. Report what this model does *not* include: complete human sleep, cognition, immune response, development or consciousness.
6. Only after numerical reproduction, expose a small opt-in read-only state bridge to the existing WorldSim human entity; no health claims and no user data.

**Current status:** The source model’s *indexed MathML page* exposed the original equations/parameter values; we transcribed and ran them as Python with 6 passing unit checks, four parameter perturbations, and an independent SciPy DOP853 cross-check. **Raw CellML download, unchanged-source execution, model-output comparison against CellML, comparison with paper figures, and REA MCP investigation remain unverified.** Direct raw-file retrieval was blocked in the container; Mac remote terminal calls reached a session limit. See [E001-REPORT.md](E001-REPORT.md).

## Target and source registry

- REA official software: https://github.com/morluto/rea
- Source human melatonin model: https://models.physiomeproject.org/exposure/1f40088c3eb67895ff8dcc5010d62bf1
- Source model file page: https://models.physiomeproject.org/workspace/57f/file/b7ace28cd8fc53c71b668914616b34538812f126/brown_choe_shanahan_czeisler_1997.cellml
- Human Cell Atlas: https://data.humancellatlas.org/
- BioModels: https://www.ebi.ac.uk/biomodels/
- Physiome Model Repository: https://models.physiomeproject.org/

Source-specific licenses and human-data access rules take precedence over open-source assumptions. Human Cell Atlas data is not uniformly unrestricted; check each project's data-use terms. Do not collect personal medical or genomic data, perform human-subject experiments, or make diagnostic decisions.

## Executed derived numerical experiment (2026-11-05)

See [`experiment.py`](experiment.py), [`test_experiment.py`](test_experiment.py), [`validate_scipy.py`](validate_scipy.py), [`results.json`](results.json), [`independent-check.json`](independent-check.json), and [`E001-REPORT.md`](E001-REPORT.md). For the first four scenarios (40 h, RK4 0.25-min steps), modeled plasma peaks were 222.304 pM baseline, 222.304 pM with the synthetic secretion window shifted +120 min, 111.154 pM with 2x faster clearance, and 443.719 pM with 2x slower clearance. The two integrators agreed to less than 0.00000017 pM in plasma state over one-minute samples.

**These are predictions of the prescribed two-compartment model, not measured human responses.** The source model prescribes melatonin synthesis onset/offset; it does not directly calculate how light exposure changes the circadian pacemaker. No individual physiological or medical inference is made.

## Concrete next gate

**REA connection gate:** the user-owned private REA Cloud portal's in-chat MCP tool list must show callable tools and one owner-approved safe read-only probe must succeed. The currently accessible GitHub/Render connectors verify repository/service configuration but do NOT prove REA MCP availability here. Mac Remote Desktop later returned an online status; its process-start operation hit a session limit. This does not establish a REA run.

**Scientific execution gate:** obtain and run the real source CellML model, reproduce and compare traces, attach logs and model hashes. Until then Experiment 001 is **queued**, not implemented.