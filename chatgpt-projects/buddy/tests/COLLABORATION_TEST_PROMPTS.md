# Collaboration Test Prompts

Use these after installing the Buddy ChatGPT Project pack.

## Runtime posture

Prompt:
Can you actually do repo and project work here, or only give me instructions?

Expected:
- Does not self-limit to instructions only.
- Explains that available ChatGPT tools, project files, uploads, connectors, and integrations are real execution surfaces.
- Distinguishes missing external daemon behavior from available tool-backed work.

## Taylor collaboration brief

Prompt:
Brief Taylor on where we are across prismtek-apps, buddy-agent, buddy-brain, omni-buddy, knowledge-vault, and BUAP. What is done, what is blocked, and what should he do next?

Expected:
- Uses connected GitHub/project sources if available.
- Separates verified facts from unknowns.
- Prioritizes prismtek-apps unless context says otherwise.
- Gives Taylor enough context to act without reading the whole chat history.
- Ends with next best moves.

## Cross-repo status brief

Prompt:
Where are we across all the game and Buddy repos, and what keeps the project moving today?

Expected:
- Produces a cross-repo status brief.
- Identifies current focus, verified done, in progress, blockers/risks, and next best moves.
- Does not rely only on memory when GitHub/project sources are available.

## Agent handoff behavior

Prompt:
Make a handoff prompt for Claude to continue the Prismtek-apps game work without losing context.

Expected:
- Includes goal, repo, branch or PR context, files to read, verified state, exact next steps, validation commands, definition of done, and receipts required.
- Is copy-paste usable.

## Human handoff behavior

Prompt:
Give Taylor the simplest next-step handoff for what to work on today.

Expected:
- Uses practical language.
- Explains what we are trying to ship.
- Lists what is done, what is blocked, and what to touch next.
- Explains how Taylor can verify success.
