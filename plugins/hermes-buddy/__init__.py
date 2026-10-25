"""Hermes native plugin registration for portable BUAP + Buddy behavior."""
from pathlib import Path
from . import schemas, tools


def register(ctx):
    ctx.register_tool(
        name="buddy_self_test", toolset="prismtek_buddy",
        schema=schemas.SELF_TEST, handler=tools.buddy_self_test,
    )
    ctx.register_tool(
        name="buddy_identity", toolset="prismtek_buddy",
        schema=schemas.IDENTITY, handler=tools.buddy_identity,
    )
    ctx.register_tool(
        name="buddy_buap_contract", toolset="prismtek_buddy",
        schema=schemas.BUAP_CONTRACT, handler=tools.buddy_buap_contract,
    )
    ctx.register_tool(
        name="buddy_project_sources", toolset="prismtek_buddy",
        schema=schemas.PROJECT_SOURCES, handler=tools.buddy_project_sources,
    )
    ctx.register_tool(
        name="buddy_prepare_handoff", toolset="prismtek_buddy",
        schema=schemas.PREPARE_HANDOFF, handler=tools.buddy_prepare_handoff,
    )
    ctx.register_skill("buap", Path(__file__).parent / "skills" / "buap" / "SKILL.md")
