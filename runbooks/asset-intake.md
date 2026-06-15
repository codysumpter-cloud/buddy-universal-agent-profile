# Runbook — asset intake

## Goal

Add assets to a project safely without breaking style, licensing, performance, or runtime organization.

## Steps

1. Inventory asset files, formats, licenses, dimensions, and art styles.
2. Separate shipped runtime assets from reference, prototype, and source assets.
3. Normalize naming and folder structure.
4. Create or update an asset manifest.
5. Wire only selected assets into runtime code.
6. Add validation that referenced assets exist.
7. Document provenance and usage constraints.

## Validation

- Manifest paths resolve.
- Runtime bundle excludes unrelated large archives.
- Visual style matches the target feature.

## Do not

- Import whole asset dumps without selection.
- Mix incompatible art styles without an explicit design decision.
- Remove license/readme files.
