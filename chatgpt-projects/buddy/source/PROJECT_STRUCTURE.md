# Recommended Repo Structure

Place this pack in:

```text
buddy-universal-agent-profile/
└── chatgpt-projects/
    └── buddy/
        ├── README.md
        ├── 00_PROJECT_INSTRUCTIONS_PASTE.md
        ├── knowledge/
        │   ├── BUDDY_OPERATING_MANUAL.md
        │   ├── LIL_BUDDY_WORKER_PROTOCOL.md
        │   ├── SOURCE_OF_TRUTH_AND_REPO_RULES.md
        │   ├── SAFETY_AND_APPROVAL_POLICY.md
        │   ├── RESPONSE_FORMATS.md
        │   ├── REPO_TASK_RUNBOOK.md
        │   ├── BUDDY_MEMORY_AND_RECEIPTS.md
        │   └── ACTIONS_BRIDGE_SPEC.md
        ├── source/
        │   ├── AGENTS.md
        │   ├── buddy-project.manifest.json
        │   └── PROJECT_STRUCTURE.md
        └── tests/
            └── TEST_PROMPTS.md
```

## Sync rule

The ChatGPT Project should be treated as a consumer of these files. Edit the repo copy first, then upload updated files to the project.
