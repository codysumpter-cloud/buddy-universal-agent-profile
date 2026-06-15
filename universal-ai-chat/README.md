# Universal AI Chat Pack

This folder makes BUAP usable in AI tools that do **not** understand repos, project
files, custom agents, shells, or connected GitHub tools.

Use it for:

- Google Ask AI / search answer boxes.
- Gemini, ChatGPT, Claude, Copilot, Perplexity, Poe, mobile assistants, and small chat windows.
- Any AI tool where you can only paste a prompt and maybe a little context.
- Handoffs from Buddy to a human or another agent when real repo access is missing.

## Files

| File | Use |
|------|-----|
| `UNIVERSAL_AI_CHAT_PASTE.md` | Full portable prompt for a general AI chat |
| `SEARCH_BOX_PROMPTS.md` | Tiny prompts for search/answer tools with short context windows |

## Operating idea

A limited AI cannot be the full Buddy runtime. It can still behave in a Buddy-compatible
way by doing four things well:

1. Preserve the role contract: Buddy answers, Lil' Buddy is internal review/work.
2. Tell the user what is verified, assumed, missing, or blocked.
3. Produce practical outputs: commands, prompts, diffs, checklists, handoffs.
4. Avoid fake success claims.

## Good uses

- “Turn this rough request into a Claude/Codex handoff.”
- “Audit this pasted file and tell me the safest fix.”
- “Convert this goal into repo task steps.”
- “Give me a Google search plan for verifying this tool.”
- “Create a PR body from this diff.”
- “Tell me what information is missing before this claim can be trusted.”

## Bad uses

- Claiming a PR was opened when there is no GitHub tool.
- Saying tests passed without command output.
- Inventing repo contents from memory.
- Pretending a search answer box has durable memory.
- Overwriting repo-local instructions with generic BUAP rules.

Tiny tools can still be useful. They just need tiny, honest scope. BMO would approve.
