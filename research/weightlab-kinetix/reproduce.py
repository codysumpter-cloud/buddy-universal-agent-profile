#!/usr/bin/env python3
"""Reproduce *parameter edits*, not a Kinetix environment rollout.

The authors' original data is downloaded at an immutable Git commit, with
Git blob SHA-1 and byte-size checks. The edit block is a deliberately tiny
numeric subset of Python AST. We never execute downloaded source code.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import math
from pathlib import Path
import urllib.request

import numpy as np

SOURCE_COMMIT = "4d09ba6d6a7e891dd8063974dfe81b3d78e3494f"
SOURCE_REPO = "RikiyaT/lm_understand-logs"
ROOT = "exp4_fix_car"
FILES = {
    "networks/ppo_final_seed0.npz": (1026498, "0ed8c549357d5bcb017f083b136d999e7948c1b2"),
    "networks/edited_actor.npz": (263158, "52487c5c622087395f5b22a28e42ff30f83dff26"),
    "runs/oneshot_repair/reply/answer.md": (2748, "cbdc0cd0c78e265ed83e2fef211debcfee74f262"),
    "eval/oneshot_result.json": (4333, "c389009c253759bda83d9be6a71aa4ffe799a00f"),
}

KEY_MAP = {
    "embed.W": "params/Dense_0/kernel",
    "embed.b": "params/Dense_0/bias",
    **{f"actor{i}.{field}": f"params/GeneralActorCriticRNN_0/DenseAndActivation_{i}/Dense_0/{kind}"
       for i in range(5) for field, kind in (("W", "kernel"), ("b", "bias"))},
    "actor_head.W": "params/GeneralActorCriticRNN_0/Dense_0/kernel",
    "actor_head.b": "params/GeneralActorCriticRNN_0/Dense_0/bias",
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def verify_git_blob(data: bytes, expected_length: int, expected_sha1: str) -> None:
    if len(data) != expected_length:
        raise ValueError(f"upstream asset size mismatch ({len(data)} != {expected_length})")
    digest = hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
    if digest != expected_sha1:
        raise ValueError(f"upstream asset Git blob SHA-1 mismatch ({digest})")


def obtain_assets(cache: Path, *, allow_download: bool) -> dict[str, Path]:
    cache.mkdir(parents=True, exist_ok=True)
    paths = {}
    for rel, (size, blob_sha) in FILES.items():
        destination = cache / rel
        if not destination.is_file():
            if not allow_download:
                raise FileNotFoundError(f"offline asset missing: {destination}")
            url = f"https://raw.githubusercontent.com/{SOURCE_REPO}/{SOURCE_COMMIT}/{ROOT}/{rel}"
            with urllib.request.urlopen(url, timeout=45) as response:
                data = response.read(size + 1)
            verify_git_blob(data, size, blob_sha)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
        verify_git_blob(destination.read_bytes(), size, blob_sha)
        paths[rel] = destination
    return paths


def prompt_precision(array: np.ndarray) -> np.ndarray:
    magnitude = float(np.max(np.abs(array)))
    if magnitude == 0:
        return array.astype(np.float64).copy()
    scale = 10.0 ** (math.floor(math.log10(magnitude)) - 2)
    return np.round(array.astype(np.float64) / scale) * scale


def _constant(node):
    """Only finite numeric constants, lists, and unary negative/positive constants."""
    if isinstance(node, ast.Constant) and type(node.value) in (int, float):
        value = node.value
    elif isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        raw = _constant(node.operand)
        if not isinstance(raw, (float, int)):
            raise ValueError("non-scalar unary expression")
        value = raw if isinstance(node.op, ast.UAdd) else -raw
    elif isinstance(node, (ast.List, ast.Tuple)):
        if len(node.elts) > 128:
            raise ValueError("list literal too long")
        return [_constant(item) for item in node.elts]
    else:
        raise ValueError(f"not a numeric literal: {type(node).__name__}")
    if not math.isfinite(value):
        raise ValueError("non-finite numeric literal")
    return value


def _positive_index(node):
    if node is None:
        return None
    value = _constant(node)
    if type(value) is not int or value < 0:
        raise ValueError("only non-negative integer indices are allowed")
    return value


def _index(node):
    if isinstance(node, ast.Tuple):
        return tuple(_index(x) for x in node.elts)
    if isinstance(node, ast.Slice):
        return slice(_positive_index(node.lower), _positive_index(node.upper), _positive_index(node.step))
    return _positive_index(node)


def parse_edit_block(answer_text: str) -> list[ast.stmt]:
    prefix = "```edits\n"
    if answer_text.count(prefix) != 1:
        raise ValueError("expected exactly one edit block")
    block = answer_text.split(prefix, 1)[1].split("```", 1)[0]
    tree = ast.parse(block, mode="exec")
    if len(tree.body) != 51:
        raise ValueError(f"expected 51 numeric edits, got {len(tree.body)}")
    return tree.body


def apply_safe_edits(tensors: dict[str, np.ndarray], statements: list[ast.stmt]) -> None:
    for number, node in enumerate(statements, 1):
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target, op = node.targets[0], None
        elif isinstance(node, ast.AugAssign) and isinstance(node.op, (ast.Add, ast.Sub)):
            target, op = node.target, node.op
        else:
            raise ValueError(f"edit {number} uses unsupported statement")
        if not isinstance(target, ast.Subscript) or not isinstance(target.value, ast.Attribute):
            raise ValueError(f"edit {number} target is not a tensor element/slice")
        attribute = target.value
        if not isinstance(attribute.value, ast.Name) or attribute.attr not in ("W", "b"):
            raise ValueError(f"edit {number} does not target an allowed tensor")
        name = f"{attribute.value.id}.{attribute.attr}"
        if name not in tensors:
            raise ValueError(f"edit {number} references unknown tensor {name}")
        tensor, idx = tensors[name], _index(target.slice)
        if not isinstance(idx, tuple):
            idx = (idx,)
        if len(idx) != tensor.ndim:
            raise ValueError(f"edit {number} wrong tensor rank")
        for axis, ix in enumerate(idx):
            if isinstance(ix, int) and ix >= tensor.shape[axis]:
                raise ValueError(f"edit {number} index out of bounds")
            if isinstance(ix, slice) and ((ix.start is not None and ix.start > tensor.shape[axis])
              or (ix.stop is not None and ix.stop > tensor.shape[axis])):
                raise ValueError(f"edit {number} slice out of bounds")
        value = _constant(node.value)
        if op is None:
            tensor[idx] = value
        elif isinstance(op, ast.Add):
            tensor[idx] += value
        else:
            tensor[idx] -= value


def _forward(tensors: dict[str, np.ndarray], observation: np.ndarray):
    hidden = np.maximum(observation @ tensors["embed.W"] + tensors["embed.b"], 0.0)
    for i in range(5):
        hidden = np.tanh(hidden @ tensors[f"actor{i}.W"] + tensors[f"actor{i}.b"])
    logits = (hidden @ tensors["actor_head.W"] + tensors["actor_head.b"])[:3]
    exp = np.exp(logits - np.max(logits))
    return exp / np.sum(exp)


PROBES = [
    {"name": "start_rest", "body_x": 2.80, "body_vx": 0.0, "green_x": 2.54},
    {"name": "reverse_runup", "body_x": 3.50, "body_vx": 1.2, "green_x": 3.24},
    {"name": "turnaround", "body_x": 4.18, "body_vx": 0.0, "green_x": 3.91},
    {"name": "ramp_approach", "body_x": 2.57, "body_vx": -2.5, "green_x": 2.33},
    {"name": "midair", "body_x": 1.45, "body_vx": -2.0, "green_x": 1.19},
    {"name": "handoff", "body_x": 0.90, "body_vx": -1.2, "green_x": 0.64},
]


def reproduce(paths: dict[str, Path]) -> dict:
    with np.load(paths["networks/ppo_final_seed0.npz"], allow_pickle=False) as archive:
        base = {out: prompt_precision(archive[src]) for out, src in KEY_MAP.items()}
    patched = {k: v.copy() for k, v in base.items()}
    text = paths["runs/oneshot_repair/reply/answer.md"].read_text(encoding="utf-8")
    edits = parse_edit_block(text)
    apply_safe_edits(patched, edits)
    with np.load(paths["networks/edited_actor.npz"], allow_pickle=False) as archive:
        for k, arr in patched.items():
            if k not in archive or not np.array_equal(arr, archive[k]):
                diff = float(np.max(np.abs(arr - archive[k]))) if k in archive else None
                raise AssertionError(f"edited tensor does not match original release: {k}; max diff={diff}")
    changed_by_tensor = {k: int(np.count_nonzero(base[k] != patched[k])) for k in base}
    count = int(sum(x.size for x in base.values()))
    changed = sum(changed_by_tensor.values())
    with paths["eval/oneshot_result.json"].open(encoding="utf-8") as stream:
        paper_report = json.load(stream)
    if count != 171_664 or changed != 6_073:
        raise AssertionError(f"unexpected parameter counts: {changed}/{count}")
    if changed != paper_report["changes"]["changed"] or count != paper_report["changes"]["entries"]:
        raise AssertionError("released report does not match independently recomputed changed count")
    if changed_by_tensor != {k: item["changed"] for k, item in paper_report["changes"]["per_tensor"].items()}:
        raise AssertionError("released per-tensor change counts differ")
    records = []
    for p in PROBES:
        obs = np.zeros(679, dtype=np.float64)
        obs[52], obs[54], obs[234] = p["body_x"], p["body_vx"], p["green_x"]
        before, after = _forward(base, obs), _forward(patched, obs)
        records.append({"name": p["name"], "before_action": int(np.argmax(before)), "after_action": int(np.argmax(after)),
                        "before_probs": [round(float(x), 6) for x in before],
                        "after_probs": [round(float(x), 6) for x in after]})
    result = {
        "schema": "prismtek-weightlab-kinetix-reproduction-v1",
        "source_repo": SOURCE_REPO,
        "source_commit": SOURCE_COMMIT,
        "status": "exact_weight_reproduction_verified",
        "independently_executed": ["download_integrity", "prompt_rounding", "numeric_patch", "tensor_equality", "per_tensor_change_counts", "six_policy_forward_probes"],
        "not_executed": ["full_kinetix_physics_episodes", "new_llm_generated_weight_repair"],
        "edit_statements": len(edits), "actor_parameters": count, "changed_parameters": changed,
        "changed_fraction": changed / count,
        "exact_reference_tensor_match": True,
        "reported_physics_result_only": {"baseline_successes": 0, "baseline_episodes": 256,
            "patched_successes": int(paper_report["test"]["success"] * paper_report["test"]["episodes"]),
            "patched_episodes": int(paper_report["test"]["episodes"])},
        "source_sha256": {rel: sha256(p.read_bytes()) for rel, p in paths.items()},
        "probes": records,
    }
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path("/tmp/prismtek-weightlab-kinetix-cache"))
    parser.add_argument("--output", type=Path, default=Path("kinetix-reproduction.json"))
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    paths = obtain_assets(args.cache, allow_download=not args.offline)
    report = reproduce(paths)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("status", "edit_statements", "actor_parameters", "changed_parameters", "changed_fraction", "exact_reference_tensor_match", "reported_physics_result_only")}, indent=2))
    print(f"Evidence report written to: {args.output}")


if __name__ == "__main__":
    main()
