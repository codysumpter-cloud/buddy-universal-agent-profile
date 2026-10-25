"""Dependency-free unit smoke checks for the Buddy Hermes tool plugin."""
import importlib.util
import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent


class FakeContext:
    def __init__(self):
        self.tools = {}
        self.skills = {}

    def register_tool(self, *, name, toolset, schema, handler):
        self.tools[name] = (toolset, schema, handler)

    def register_skill(self, name, path):
        self.skills[name] = path


class BuddyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        package = "prismtek_buddy_smoke"
        spec = importlib.util.spec_from_file_location(
            package, ROOT / "__init__.py",
            submodule_search_locations=[str(ROOT)],
        )
        module = importlib.util.module_from_spec(spec)
        sys.modules[package] = module
        spec.loader.exec_module(module)
        cls.module = module

    def test_tools_and_skill(self):
        ctx = FakeContext()
        self.module.register(ctx)
        self.assertEqual(len(ctx.tools), 5)
        self.assertTrue(ctx.skills["buap"].is_file())
        for name, (_, schema, handler) in ctx.tools.items():
            self.assertEqual(schema["name"], name)
            self.assertIsInstance(json.loads(handler({})), dict)

    def test_identity_and_receipts(self):
        ctx = FakeContext()
        self.module.register(ctx)
        identity = json.loads(ctx.tools["buddy_identity"][2]({}))
        self.assertEqual(identity["avatar"]["surface"], "Pocket-Bird on prismtek.dev")
        self.assertIn("proper_name", identity)
        result = json.loads(ctx.tools["buddy_prepare_handoff"][2]({"goal": "fix UI"}))
        self.assertEqual(result["execution"], "NOT STARTED")
        self.assertFalse(json.loads(ctx.tools["buddy_prepare_handoff"][2]({"goal": ""}))["ok"])


if __name__ == "__main__":
    unittest.main()
