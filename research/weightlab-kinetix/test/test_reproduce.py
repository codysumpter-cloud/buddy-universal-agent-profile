"""Offline checks for trusted edit interpreter and pinned-source integrity."""
import ast
import hashlib
from pathlib import Path
import sys
import unittest
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from reproduce import (verify_git_blob, _constant, _index, parse_edit_block, apply_safe_edits,
                       prompt_precision)


class TestKinetixEditInterpreter(unittest.TestCase):
    def test_git_blob_integrity(self):
        raw = b"safe source"
        digest = hashlib.sha1(b"blob 11\0" + raw).hexdigest()
        verify_git_blob(raw, 11, digest)
        with self.assertRaises(ValueError): verify_git_blob(raw+b".", 11, digest)
        with self.assertRaises(ValueError): verify_git_blob(raw, 11, "0"*40)

    def test_precise_prompt_rounding(self):
        a = np.array([123.456, -56.789])
        np.testing.assert_array_equal(prompt_precision(a), np.array([123., -57.]))
        np.testing.assert_array_equal(prompt_precision(np.zeros(3)), np.zeros(3))

    def test_numeric_slice_and_augmented_assignment(self):
        arr = np.arange(12, dtype=float).reshape(3, 4)
        vals = {"embed.W": arr, "embed.b": np.ones(4)}
        text = 'embed.W[:, 1:3] = 0\nembed.W[2, 1] = 80\nembed.b[0] -= 5'
        apply_safe_edits(vals, ast.parse(text).body)
        self.assertEqual(vals["embed.W"][2, 1], 80)
        self.assertEqual(vals["embed.W"][1, 2], 0)
        self.assertEqual(vals["embed.W"][0, 3], 3)
        self.assertEqual(vals["embed.b"][0], -4)

    def test_reject_code_execution(self):
        variants = [
            'embed.W[0,0] = __import__("os").system("id")',
            'import os',
            'embed.W[0,0] = 1 + 2',
            'embed.W[-1,0] = 2',
            'embed.W[100,0] = 2',
            'embed.W[:] = [1 for i in range(3)]',
            'embed.W[:, 0] = float("nan")',
            'embed.__class__[0] = 1',
        ]
        for text in variants:
            with self.subTest(text=text):
                vals = {"embed.W": np.ones((3, 4)), "embed.b": np.ones(4)}
                with self.assertRaises((ValueError, TypeError, SyntaxError, IndexError)):
                    apply_safe_edits(vals, ast.parse(text).body)

    def test_reject_unexpected_statement_count(self):
        with self.assertRaises(ValueError):
            parse_edit_block('```edits\nembed.b[0] = 1\n```')
        with self.assertRaises(ValueError):
            parse_edit_block('no edits')


if __name__ == '__main__':
    unittest.main()
