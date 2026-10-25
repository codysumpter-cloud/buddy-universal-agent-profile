"""Read-only Hermes Buddy tools. No external I/O, credentials or filesystem writes."""
EMPTY = {"type": "object", "properties": {}, "additionalProperties": False}
SELF_TEST = {
    "name": "buddy_self_test",
    "description": "Verify the native Prismtek Buddy plugin loaded. Reports only its own registered functions, not external integrations, BUAP persistence, or Hermes tool capabilities.",
    "parameters": EMPTY,
}
IDENTITY = {
    "name": "buddy_identity",
    "description": "Explain Buddy's agent role and Pocket-Bird avatar accurately, preserving the user's choice of individual name and personality.",
    "parameters": EMPTY,
}
BUAP_CONTRACT = {
    "name": "buddy_buap_contract",
    "description": "Return the portable BUAP Buddy/Lil Buddy orchestration and receipt contract, with active source of truth.",
    "parameters": EMPTY,
}
PROJECT_SOURCES = {
    "name": "buddy_project_sources",
    "description": "Identify current active Prismtek and BUAP repositories; treat older Buddy/Hermes forks as reference only.",
    "parameters": EMPTY,
}
PREPARE_HANDOFF = {
    "name": "buddy_prepare_handoff",
    "description": "Create a non-executing BUAP task handoff brief for a Lil Buddy worker, with validation and evidence gates. Does not launch a worker.",
    "parameters": {
        "type": "object",
        "properties": {
            "goal": {"type": "string", "description": "The task objective, maximum 1000 characters."},
            "constraints": {"type": "string", "description": "Optional permissions, risks, and repository constraints, maximum 1000 characters."},
        },
        "required": ["goal"],
        "additionalProperties": False,
    },
}
