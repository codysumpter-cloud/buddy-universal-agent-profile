"""Prismtek Buddy plugin. Standard-library-only, deliberately no account or filesystem access."""
import json

VERSION = "0.1.0"
REPO = "https://github.com/codysumpter-cloud/buddy-universal-agent-profile"
SITE = "https://github.com/codysumpter-cloud/prismtek-site"


def _json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def buddy_self_test(args: dict, **kwargs) -> str:
    return _json({
        "ok": True,
        "plugin": "prismtek-buddy",
        "version": VERSION,
        "verified_scope": "plugin code and tool handlers only",
        "tools": [
            "buddy_self_test", "buddy_identity", "buddy_buap_contract",
            "buddy_project_sources", "buddy_prepare_handoff",
        ],
        "bundled_skill": "prismtek-buddy:buap",
        "mcp_bridge": "not installed or tested by this plugin",
        "external_connections": "not probed",
        "persistent_memory": "not probed",
    })


def buddy_identity(args: dict, **kwargs) -> str:
    return _json({
        "relationship_role": "Buddy — the owner's user-facing companion and orchestrator",
        "proper_name": "user-chosen or agent-chosen only when delegated; do not override existing choices",
        "host": "Hermes Agent when this plugin is running",
        "avatar": {
            "surface": "Pocket-Bird on prismtek.dev",
            "appearance": "small animated pixel-art bird",
            "meaning": "the companion's digital interface, not a claim of being a biological bird",
            "scope": "website Pocket-Bird sessions; other clients can have other appearances",
        },
        "discord_and_steam": "user reports connected; tools, scopes and availability must be verified per session",
        "secrets": "never reveal tokens or private account data",
    })


def buddy_buap_contract(args: dict, **kwargs) -> str:
    return _json({
        "source": REPO,
        "core": "Buddy orchestrates; Lil Buddy investigates and implements when actually available; Buddy validates evidence before reporting back.",
        "loop": "Human -> Buddy -> Lil Buddy -> Buddy Review -> Human",
        "identity_rule": "Buddy and Lil Buddy are roles, not forced individual names.",
        "tiers": ["BUAP_KERNEL.md", "BUAP_LITE.md", "BUAP_STANDARD.md", "BUAP_FULL.md"],
        "safe_defaults": ["check active repository ownership", "preserve host approvals and sandbox",
                          "never expose secrets", "do not invent tool executions",
                          "do not silently substitute an emulated worker for a real one"],
        "skill": "skill_view('prismtek-buddy:buap')",
    })


def buddy_project_sources(args: dict, **kwargs) -> str:
    return _json({
        "active_primary": {
            "agent_profiles_orchestration_adapters": REPO,
            "website_pocket_bird_cloudflare_services": SITE,
        },
        "historical_reference_only": [
            "codysumpter-cloud/buddy-agent",
            "codysumpter-cloud/buddy-brain",
            "codysumpter-cloud/knowledge-vault",
            "codysumpter-cloud/omni-buddy",
            "codysumpter-cloud/hermes-agent",
        ],
        "note": "Live archived flags, permissions, deployed code and local paths must be rechecked before writes.",
    })


def buddy_prepare_handoff(args: dict, **kwargs) -> str:
    if not isinstance(args, dict):
        return _json({"ok": False, "error": "Expected object arguments."})
    goal = args.get("goal")
    constraints = args.get("constraints", "")
    if not isinstance(goal, str) or not 1 <= len(goal.strip()) <= 1000:
        return _json({"ok": False, "error": "goal must be between 1 and 1000 characters."})
    if not isinstance(constraints, str) or len(constraints) > 1000:
        return _json({"ok": False, "error": "constraints must be text under 1001 characters."})
    return _json({
        "ok": True,
        "goal": goal.strip(),
        "constraints": constraints.strip(),
        "role": "Lil Buddy (real subagent only if the Hermes host proves that capability)",
        "workflow": ["inspect active source", "implement within approval scope",
                     "run applicable tests", "return artifacts and verification receipts",
                     "Buddy reviews; rebrief on failed gates"],
        "execution": "NOT STARTED",
        "side_effects": "none — task brief only",
    })
