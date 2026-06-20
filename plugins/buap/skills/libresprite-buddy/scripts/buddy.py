#!/usr/bin/env python3
"""libresprite-buddy: hybrid LibreSprite + Pillow buddy-sprite toolkit.

Pillow is the pixel engine. LibreSprite is the editor / preview only.

Why this split (verified constraints, do not regress):
  * LibreSprite headless (`-b`) scripting CANNOT do pixel ops. In batch mode the
    `app` object only exposes launch/open/yield/createDialog/documentation -- no
    activeImage/activeSprite/pixelColor/command. The pixel API exists ONLY in the
    GUI. So all automation here uses Python/Pillow, never LibreSprite CLI scripting.
  * LibreSprite CLI resize (--scale / --shrink-to) is smooth/bilinear only (no
    nearest), which softens sprites. We do not use it for quality resizes.
  * Opening a file for preview DOES work:
        /Applications/LibreSprite.app/Contents/MacOS/libresprite <file>
    The `open` subcommand shells to that (best-effort, optional, GUI only).

Subcommands: resize, clone, recolor, feature-swap, new-buddy, open.
Codex buddy factory: compose-atlas, install-pet, sheet-64, mint.
Run `buddy.py <subcommand> --help` for details.

The factory composes a Codex pet atlas + 64x64 game sheets FROM real Buddy art
(even-sampled + scaled-to-fit), never AI-generated -- AI generation drifts
humanoid; composition preserves the buddy identity exactly.

All input paths are arguments. Nothing here touches the network or the PixelLab
API, and no path is hardcoded to a user's Downloads folder.
"""

import argparse
import colorsys
import os
import shutil
import sys

# ---------------------------------------------------------------------------
# Pillow dependency check (clear failure + install hint, never a silent crash).
# ---------------------------------------------------------------------------
try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:  # pragma: no cover - exercised only when Pillow is absent
    sys.stderr.write(
        "ERROR: Pillow (PIL) is required but not installed.\n"
        "Install it with:  pip3 install --user Pillow\n"
        "Then re-run this command.\n"
    )
    sys.exit(2)


RESIZE_METHODS = ("lanczos-sharp", "lanczos", "nearest", "box")

# Default unsharp-mask parameters tuned for the anti-aliased Buddy art.
_UNSHARP_RADIUS = 1
_UNSHARP_PERCENT = 120
_UNSHARP_THRESHOLD = 0


def _load_rgba(path):
    return Image.open(path).convert("RGBA")


def _resize_image(im, size, method):
    """Resize an RGBA image to (w, h) preserving alpha.

    lanczos-sharp (default): LANCZOS downscale + a light UnsharpMask. Best for
    anti-aliased / true-color source art like the Buddy pack. This is a
    best-effort downscale of AA art, NOT a lossless clean-pixel conversion.
    nearest: best for input that is already clean low-res pixel art.
    """
    w, h = size
    if method == "nearest":
        return im.resize((w, h), Image.NEAREST)
    if method == "box":
        return im.resize((w, h), Image.BOX)
    if method == "lanczos":
        return im.resize((w, h), Image.LANCZOS)
    # lanczos-sharp (default)
    small = im.resize((w, h), Image.LANCZOS)
    return small.filter(
        ImageFilter.UnsharpMask(
            radius=_UNSHARP_RADIUS,
            percent=_UNSHARP_PERCENT,
            threshold=_UNSHARP_THRESHOLD,
        )
    )


HEART_MODES = ("keep", "recolor", "remove")


def _is_heart_pixel(hh, ss):
    """Warm belly-heart accent test: warm hue band + saturated."""
    return 0.02 < hh < 0.13 and ss > 0.4


def _recolor_image(im, hue_shift, heart="keep"):
    """Hue-shift an RGBA image while protecting identity pixels.

    Per the proven logic:
      * fully transparent pixels stay transparent;
      * near-gray / white pixels (s < 0.18) are kept -- face, eyes, outline;
      * the warm belly-heart accent (0.02 < h < 0.13 and s > 0.4) is handled by
        `heart`: keep (default, leave as-is), recolor (rotate it with the rest),
        or remove (make it transparent);
      * everything else is rotated by hue_shift (a fraction of the wheel, 0..1).

    The same hue_shift / heart mode is applied identically to every frame so a
    whole animated buddy recolors consistently.
    """
    if heart not in HEART_MODES:
        raise ValueError(f"heart must be one of {HEART_MODES}, got {heart!r}")
    src = im.load()
    out = Image.new("RGBA", im.size)
    dst = out.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            if a == 0:
                dst[x, y] = (0, 0, 0, 0)
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
            if ss < 0.18:
                dst[x, y] = (r, g, b, a)  # face / eyes / outline (near gray)
                continue
            if _is_heart_pixel(hh, ss):
                if heart == "keep":
                    dst[x, y] = (r, g, b, a)  # leave the heart as-is
                    continue
                if heart == "remove":
                    dst[x, y] = (0, 0, 0, 0)  # drop the heart (zeroed RGB)
                    continue
                # heart == "recolor": fall through and rotate it with the body.
            nh = (hh + hue_shift) % 1.0
            nr, ng, nb = colorsys.hsv_to_rgb(nh, ss, vv)
            dst[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return out


def _zero_transparent_rgb(im):
    """Return a copy where every fully-transparent pixel has RGB zeroed.

    The Codex atlas contract requires transparent pixels to carry zeroed RGB.
    """
    src = im.convert("RGBA")
    px = src.load()
    w, h = src.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0 and (r or g or b):
                px[x, y] = (0, 0, 0, 0)
    return src


def _alpha_paste(base, feature, offset):
    """Composite a feature RGBA onto a copy of base at offset, honoring alpha."""
    out = base.copy()
    out.alpha_composite(feature, dest=offset)
    return out


def _ensure_parent(path):
    parent = os.path.dirname(os.path.abspath(path))
    if parent and not os.path.isdir(parent):
        os.makedirs(parent, exist_ok=True)


def _iter_pngs(path):
    """Yield PNG paths: a single file, or every *.png in a directory."""
    if os.path.isdir(path):
        for name in sorted(os.listdir(path)):
            if name.lower().endswith(".png"):
                yield os.path.join(path, name)
    else:
        yield path


# ---------------------------------------------------------------------------
# resize
# ---------------------------------------------------------------------------
def cmd_resize(args):
    size = (args.size, args.size)
    inputs = list(_iter_pngs(args.input))
    if not inputs:
        sys.stderr.write(f"ERROR: no PNG input found at {args.input}\n")
        return 1
    if len(inputs) == 1 and not os.path.isdir(args.input):
        outputs = [args.output]
    else:
        if not os.path.isdir(args.output):
            os.makedirs(args.output, exist_ok=True)
        outputs = [os.path.join(args.output, os.path.basename(p)) for p in inputs]
    for src, out in zip(inputs, outputs):
        im = _load_rgba(src)
        result = _resize_image(im, size, args.method)
        _ensure_parent(out)
        result.save(out)
        print(f"resized {src} -> {out} ({args.size}x{args.size}, {args.method})")
    return 0


# ---------------------------------------------------------------------------
# clone
# ---------------------------------------------------------------------------
def cmd_clone(args):
    src = args.source
    dst = args.dest
    if not os.path.exists(src):
        sys.stderr.write(f"ERROR: clone source does not exist: {src}\n")
        return 1
    if os.path.isdir(src):
        if os.path.exists(dst) and not args.force:
            sys.stderr.write(
                f"ERROR: dest dir exists: {dst} (use --force to overwrite)\n"
            )
            return 1
        if os.path.exists(dst) and args.force:
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
        print(f"cloned dir {src} -> {dst}")
    else:
        _ensure_parent(dst)
        shutil.copy2(src, dst)
        print(f"cloned file {src} -> {dst}")
    return 0


# ---------------------------------------------------------------------------
# recolor
# ---------------------------------------------------------------------------
def cmd_recolor(args):
    im = _load_rgba(args.input)
    os.makedirs(args.outdir, exist_ok=True)
    base = os.path.splitext(os.path.basename(args.input))[0]

    if args.hue is not None:
        shifts = [(args.hue, f"{base}_hue{int(round(args.hue * 360))}")]
    else:
        # N evenly spaced hue rotations around the wheel (skip 0 = identity).
        shifts = []
        for i in range(1, args.count + 1):
            shift = (i / (args.count + 1))
            shifts.append((shift, f"{base}_variant{i}"))

    rc = 0
    for shift, name in shifts:
        variant = _recolor_image(im, shift, heart=args.heart)
        native_out = os.path.join(args.outdir, name + ".png")
        variant.save(native_out)
        print(f"recolor native {native_out} (hue+{shift:.3f})")
        if args.size:
            small = _resize_image(variant, (args.size, args.size), args.method)
            small_out = os.path.join(args.outdir, f"{name}_{args.size}.png")
            small.save(small_out)
            print(f"recolor resized {small_out} ({args.size}x{args.size}, {args.method})")
    return rc


# ---------------------------------------------------------------------------
# feature-swap
# ---------------------------------------------------------------------------
def cmd_feature_swap(args):
    base = _load_rgba(args.base)
    feature = _load_rgba(args.feature)
    out = _alpha_paste(base, feature, (args.x, args.y))
    _ensure_parent(args.output)
    out.save(args.output)
    print(f"feature-swap {args.base} + {args.feature}@({args.x},{args.y}) -> {args.output}")
    if args.size:
        small = _resize_image(out, (args.size, args.size), args.method)
        small_out = os.path.splitext(args.output)[0] + f"_{args.size}.png"
        small.save(small_out)
        print(f"feature-swap resized {small_out} ({args.size}x{args.size}, {args.method})")
    return 0


# ---------------------------------------------------------------------------
# new-buddy
# ---------------------------------------------------------------------------
def _procedural_buddy(size, body_color, eye_color, accent_color, egg):
    """v1 / simple parametric buddy: round (or egg) body, dot eyes, smile,
    antennae, belly accent. Honest: this is a basic primitive generator, not
    hand-authored pixel art."""
    canvas = size * 4  # supersample then downscale for cleaner edges
    im = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = canvas // 2
    body_w = int(canvas * 0.62)
    body_h = int(canvas * (0.72 if egg else 0.62))
    top = int(canvas * (0.22 if egg else 0.26))
    box = [cx - body_w // 2, top, cx + body_w // 2, top + body_h]
    d.ellipse(box, fill=body_color, outline=(40, 40, 40, 255), width=max(2, canvas // 80))
    # antennae
    ant_y = box[1]
    d.line([cx - body_w // 6, ant_y, cx - body_w // 5, ant_y - canvas // 8],
           fill=(40, 40, 40, 255), width=max(2, canvas // 90))
    d.line([cx + body_w // 6, ant_y, cx + body_w // 5, ant_y - canvas // 8],
           fill=(40, 40, 40, 255), width=max(2, canvas // 90))
    r_tip = canvas // 28
    for sx in (cx - body_w // 5, cx + body_w // 5):
        d.ellipse([sx - r_tip, ant_y - canvas // 8 - r_tip, sx + r_tip, ant_y - canvas // 8 + r_tip],
                  fill=accent_color)
    # eyes
    eye_y = box[1] + body_h // 3
    eye_r = canvas // 22
    for ex in (cx - body_w // 6, cx + body_w // 6):
        d.ellipse([ex - eye_r, eye_y - eye_r, ex + eye_r, eye_y + eye_r], fill=eye_color)
    # smile
    sm_w = body_w // 3
    sm_y = box[1] + int(body_h * 0.55)
    d.arc([cx - sm_w, sm_y - sm_w // 2, cx + sm_w, sm_y + sm_w // 2],
          start=20, end=160, fill=eye_color, width=max(2, canvas // 90))
    # belly accent (heart-ish diamond)
    by = box[1] + int(body_h * 0.74)
    bs = canvas // 14
    d.polygon([(cx, by - bs), (cx + bs, by), (cx, by + bs), (cx - bs, by)], fill=accent_color)
    return im.resize((size, size), Image.LANCZOS)


def cmd_new_buddy(args):
    os.makedirs(args.outdir, exist_ok=True)

    if args.procedural:
        body = (90, 160, 230, 255)
        if args.hue is not None:
            r, g, b = colorsys.hsv_to_rgb(args.hue % 1.0, 0.6, 0.9)
            body = (round(r * 255), round(g * 255), round(b * 255), 255)
        im = _procedural_buddy(
            args.size,
            body_color=body,
            eye_color=(40, 40, 40, 255),
            accent_color=(230, 90, 110, 255),
            egg=args.egg,
        )
        out = os.path.join(args.outdir, f"{args.name}.png")
        im.save(out)
        print(f"new-buddy procedural(v1) {out} ({args.size}x{args.size}, egg={args.egg})")
        return 0

    # Pose-reuse path: take a base frame from a Buddy pack and transform it.
    if not args.base:
        sys.stderr.write(
            "ERROR: provide --base <pack-frame.png> for pose reuse, "
            "or pass --procedural for the v1 primitive generator.\n"
        )
        return 1
    if not os.path.isfile(args.base):
        sys.stderr.write(f"ERROR: base frame not found: {args.base}\n")
        return 1

    im = _load_rgba(args.base)
    if args.hue is not None:
        im = _recolor_image(im, args.hue)
    if args.feature:
        if not os.path.isfile(args.feature):
            sys.stderr.write(f"ERROR: feature not found: {args.feature}\n")
            return 1
        feat = _load_rgba(args.feature)
        im = _alpha_paste(im, feat, (args.fx, args.fy))

    native_out = os.path.join(args.outdir, f"{args.name}.png")
    im.save(native_out)
    print(f"new-buddy pose-reuse native {native_out} (base={args.base})")
    small = _resize_image(im, (args.size, args.size), args.method)
    small_out = os.path.join(args.outdir, f"{args.name}_{args.size}.png")
    small.save(small_out)
    print(f"new-buddy pose-reuse resized {small_out} ({args.size}x{args.size}, {args.method})")
    return 0


# ===========================================================================
# Codex buddy factory: compose a real-art Codex pet atlas + 64x64 game sheets.
#
# Compose-not-generate: every cell is composed from Cody's real Buddy animation
# frames (even-sampled + scaled-to-fit), never AI-generated. AI generation
# drifts humanoid; composition preserves the exact buddy identity.
#
# Codex pet atlas contract (reimplemented from the public hatch-pet skill spec,
# NOT copied from any licensed source):
#   * Atlas 1536x1872, 8 cols x 9 rows, cell 192x208, RGBA transparent.
#   * Unused cells (col >= frame_count) fully transparent.
#   * Transparent pixels must have zeroed RGB.
#   * Each USED cell: >= 50 non-transparent px AND not > 95% opaque.
#   * No fully-opaque atlas overall.
#   * Saved as lossless PNG + lossless WebP.
# ===========================================================================
ATLAS_COLS = 8
ATLAS_ROWS = 9
CELL_W = 192
CELL_H = 208
ATLAS_W = ATLAS_COLS * CELL_W  # 1536
ATLAS_H = ATLAS_ROWS * CELL_H  # 1872

# Default state mapping: row -> (codex_state, frame_count, "Anim/dir").
# Proven by Buddy to compose a valid atlas that renders in the Codex Pets tab.
DEFAULT_MAPPING = [
    {"row": 0, "state": "idle", "frames": 6, "source": "idle/south"},
    {"row": 1, "state": "running-right", "frames": 8, "source": "Walk/east"},
    {"row": 2, "state": "running-left", "frames": 8, "source": "Walk/west"},
    {"row": 3, "state": "waving", "frames": 4, "source": "happy/south"},
    {"row": 4, "state": "jumping", "frames": 5, "source": "victory/south"},
    {"row": 5, "state": "failed", "frames": 8, "source": "defeat/south"},
    {"row": 6, "state": "waiting", "frames": 6, "source": "thinking/south"},
    {"row": 7, "state": "running", "frames": 6, "source": "cast/south"},
    {"row": 8, "state": "review", "frames": 6, "source": "charge/south"},
]

# Per-frame durations (ms) from the contract, keyed by codex_state.
STATE_DURATIONS = {
    "idle": [280, 110, 110, 140, 140, 320],
    "running-right": [120, 120, 120, 120, 120, 120, 120, 220],
    "running-left": [120, 120, 120, 120, 120, 120, 120, 220],
    "waving": [140, 140, 140, 280],
    "jumping": [140, 140, 140, 140, 280],
    "failed": [140, 140, 140, 140, 140, 140, 140, 240],
    "waiting": [150, 150, 150, 150, 150, 260],
    "running": [120, 120, 120, 120, 120, 220],
    "review": [150, 150, 150, 150, 150, 280],
}


def _frame_duration(state, idx, frame_count):
    durs = STATE_DURATIONS.get(state)
    if durs and idx < len(durs):
        return durs[idx]
    return 200  # safe default if a custom mapping has no duration table


def _even_sample(items, n):
    """Pick n items evenly across a sorted list (first..last inclusive)."""
    if n <= 0:
        return []
    if len(items) == 0:
        return []
    if len(items) == 1 or n == 1:
        return [items[0]] * n
    return [items[round(i * (len(items) - 1) / (n - 1))] for i in range(n)]


def _list_frames(pack_dir, source):
    """Return sorted PNG frame paths for an 'Anim/dir' source in a pack."""
    sub = os.path.join(pack_dir, "animations", source)
    if not os.path.isdir(sub):
        raise FileNotFoundError(f"animation source not found: {sub}")
    frames = [
        os.path.join(sub, name)
        for name in sorted(os.listdir(sub))
        if name.lower().endswith(".png")
    ]
    if not frames:
        raise FileNotFoundError(f"no PNG frames in {sub}")
    return frames


def _fit_into_cell(im, cell_w, cell_h, fill):
    """Scale im to FIT (cell_w*fill, cell_h*fill) preserving aspect (LANCZOS)."""
    target_w = max(1, int(cell_w * fill))
    target_h = max(1, int(cell_h * fill))
    w, h = im.size
    scale = min(target_w / w, target_h / h)
    new_w = max(1, round(w * scale))
    new_h = max(1, round(h * scale))
    return im.resize((new_w, new_h), Image.LANCZOS)


def _load_mapping(path):
    import json

    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise ValueError("mapping JSON must be a list of row objects")
    by_row = {row["row"]: dict(row) for row in DEFAULT_MAPPING}
    for entry in data:
        row = entry["row"]
        base = by_row.get(row, {"row": row})
        base.update(entry)
        by_row[row] = base
    return [by_row[r] for r in sorted(by_row)]


def _compose_atlas_image(pack_dir, mapping, hue, heart, fill):
    """Build the 1536x1872 RGBA atlas image from real pack frames."""
    atlas = Image.new("RGBA", (ATLAS_W, ATLAS_H), (0, 0, 0, 0))
    used_cells = []
    for entry in mapping:
        row = entry["row"]
        n = int(entry["frames"])
        source = entry["source"]
        frames = _list_frames(pack_dir, source)
        sampled = _even_sample(frames, n)
        for col in range(n):
            im = _load_rgba(sampled[col])
            if hue is not None:
                im = _recolor_image(im, hue, heart=heart)
            scaled = _fit_into_cell(im, CELL_W, CELL_H, fill)
            cell_x = col * CELL_W
            cell_y = row * CELL_H
            paste_x = cell_x + (CELL_W - scaled.width) // 2
            paste_y = cell_y + (CELL_H - scaled.height) // 2
            atlas.alpha_composite(scaled, dest=(paste_x, paste_y))
            used_cells.append((row, col))
    atlas = _zero_transparent_rgb(atlas)
    return atlas, used_cells


def _validate_atlas(atlas, mapping):
    """Run the Codex atlas invariants. Returns a dict report with ok bool."""
    errors = []
    if atlas.size != (ATLAS_W, ATLAS_H):
        # Dims are wrong: report and stop before per-pixel iteration (which would
        # index out of range on an undersized image).
        return {
            "ok": False,
            "dims": list(atlas.size),
            "expected_dims": [ATLAS_W, ATLAS_H],
            "used_cells_checked": 0,
            "transparent_px_nonzero_rgb": 0,
            "fully_opaque": None,
            "errors": [f"dims {list(atlas.size)} != [{ATLAS_W}, {ATLAS_H}]"],
        }
    px = atlas.load()
    frame_counts = {entry["row"]: int(entry["frames"]) for entry in mapping}
    any_transparent = False
    all_opaque = True
    bad_rgb = 0
    used_cell_checks = 0
    for row in range(ATLAS_ROWS):
        fc = frame_counts.get(row, 0)
        for col in range(ATLAS_COLS):
            cx0, cy0 = col * CELL_W, row * CELL_H
            non_transparent = 0
            opaque = 0
            total = 0
            for y in range(cy0, cy0 + CELL_H):
                for x in range(cx0, cx0 + CELL_W):
                    r, g, b, a = px[x, y]
                    total += 1
                    if a == 0:
                        any_transparent = True
                        if r or g or b:
                            bad_rgb += 1
                    else:
                        all_opaque = False
                        non_transparent += 1
                        if a >= 255:
                            opaque += 1
            used = col < fc
            if used:
                used_cell_checks += 1
                if non_transparent < 50:
                    errors.append(
                        f"used cell ({row},{col}) only {non_transparent} non-transparent px (<50)"
                    )
                if non_transparent > 0 and (opaque / non_transparent) > 0.95:
                    errors.append(
                        f"used cell ({row},{col}) is >95% opaque "
                        f"({opaque}/{non_transparent}) -> likely non-transparent bg"
                    )
            else:
                if non_transparent != 0:
                    errors.append(
                        f"unused cell ({row},{col}) has {non_transparent} non-transparent px"
                    )
    if all_opaque:
        errors.append("atlas is fully opaque (no transparency)")
    if bad_rgb:
        errors.append(f"{bad_rgb} transparent px have non-zero RGB")
    return {
        "ok": len(errors) == 0,
        "dims": list(atlas.size),
        "expected_dims": [ATLAS_W, ATLAS_H],
        "used_cells_checked": used_cell_checks,
        "transparent_px_nonzero_rgb": bad_rgb,
        "fully_opaque": all_opaque,
        "errors": errors,
    }


def _save_webp_lossless(im, path):
    im.save(path, format="WEBP", lossless=True, quality=100, method=6, exact=True)


def _contact_sheet(atlas, scale=4):
    """Scaled-down grid for visual QA (NEAREST so cells stay legible)."""
    w = ATLAS_W // scale
    h = ATLAS_H // scale
    return atlas.resize((w, h), Image.NEAREST)


def cmd_compose_atlas(args):
    import json

    pack_dir = args.pack
    if not os.path.isdir(os.path.join(pack_dir, "animations")):
        sys.stderr.write(f"ERROR: pack has no animations/ dir: {pack_dir}\n")
        return 1
    mapping = _load_mapping(args.mapping) if args.mapping else [dict(m) for m in DEFAULT_MAPPING]
    if args.heart not in HEART_MODES:
        sys.stderr.write(f"ERROR: --heart must be one of {HEART_MODES}\n")
        return 1
    os.makedirs(args.out, exist_ok=True)

    atlas, _used = _compose_atlas_image(pack_dir, mapping, args.hue, args.heart, args.fill)

    png_path = os.path.join(args.out, "spritesheet.png")
    webp_path = os.path.join(args.out, "spritesheet.webp")
    atlas.save(png_path)
    _save_webp_lossless(atlas, webp_path)

    report = _validate_atlas(atlas, mapping)
    report["png"] = png_path
    report["webp"] = webp_path
    report["hue"] = args.hue
    report["heart"] = args.heart
    report["fill"] = args.fill
    val_path = os.path.join(args.out, "validation.json")
    with open(val_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)

    contact = _contact_sheet(atlas)
    contact_path = os.path.join(args.out, "contact-sheet.png")
    contact.save(contact_path)

    print(f"compose-atlas png   {png_path} ({ATLAS_W}x{ATLAS_H})")
    print(f"compose-atlas webp  {webp_path} (lossless)")
    print(f"compose-atlas valid {val_path} ok={report['ok']}")
    print(f"compose-atlas sheet {contact_path}")
    if not report["ok"]:
        sys.stderr.write("ERROR: atlas failed validation:\n")
        for e in report["errors"]:
            sys.stderr.write(f"  - {e}\n")
        return 1
    return 0


def cmd_install_pet(args):
    import json

    atlas = args.atlas
    if not os.path.isfile(atlas):
        sys.stderr.write(f"ERROR: atlas webp not found: {atlas}\n")
        return 1
    codex_home = args.codex_home or os.environ.get("CODEX_HOME") or os.path.join(
        os.path.expanduser("~"), ".codex"
    )
    pet_dir = os.path.join(codex_home, "pets", args.id)
    if os.path.isdir(pet_dir) and not args.force:
        sys.stderr.write(
            f"ERROR: pet id already exists: {pet_dir} (use --force to overwrite)\n"
        )
        return 1
    os.makedirs(pet_dir, exist_ok=True)
    dest_sheet = os.path.join(pet_dir, "spritesheet.webp")
    shutil.copy2(atlas, dest_sheet)
    pet_json = {
        "id": args.id,
        "displayName": args.name,
        "description": args.desc,
        "spritesheetPath": "spritesheet.webp",
    }
    pet_json_path = os.path.join(pet_dir, "pet.json")
    with open(pet_json_path, "w", encoding="utf-8") as fh:
        json.dump(pet_json, fh, indent=2)
    print(f"install-pet pet.json {pet_json_path}")
    print(f"install-pet sheet    {dest_sheet}")
    print(f"install-pet dir      {pet_dir}")
    return 0


def cmd_sheet_64(args):
    """64x64-per-frame game sheets + a packed sheet + a JSON frame map."""
    import json

    pack_dir = args.pack
    if not os.path.isdir(os.path.join(pack_dir, "animations")):
        sys.stderr.write(f"ERROR: pack has no animations/ dir: {pack_dir}\n")
        return 1
    mapping = [dict(m) for m in DEFAULT_MAPPING]
    if args.state != "all":
        mapping = [m for m in mapping if m["state"] == args.state]
        if not mapping:
            sys.stderr.write(f"ERROR: unknown state: {args.state}\n")
            return 1
    os.makedirs(args.out, exist_ok=True)
    frames_dir = os.path.join(args.out, "frames")
    os.makedirs(frames_dir, exist_ok=True)

    method = args.method
    max_cols = max(int(m["frames"]) for m in mapping)
    rows = len(mapping)
    sheet = Image.new("RGBA", (max_cols * 64, rows * 64), (0, 0, 0, 0))
    frame_map = []
    for ri, entry in enumerate(mapping):
        state = entry["state"]
        n = int(entry["frames"])
        frames = _list_frames(pack_dir, entry["source"])
        sampled = _even_sample(frames, n)
        for col in range(n):
            im = _load_rgba(sampled[col])
            if args.hue is not None:
                im = _recolor_image(im, args.hue, heart=args.heart)
            small = _resize_image(im, (64, 64), method)
            small = _zero_transparent_rgb(small)
            fname = f"{state}_{col:02d}.png"
            small.save(os.path.join(frames_dir, fname))
            x, y = col * 64, ri * 64
            sheet.alpha_composite(small, dest=(x, y))
            frame_map.append({
                "state": state,
                "frame": col,
                "x": x,
                "y": y,
                "w": 64,
                "h": 64,
                "duration": _frame_duration(state, col, n),
            })
    sheet = _zero_transparent_rgb(sheet)
    sheet_path = os.path.join(args.out, "spritesheet-64.png")
    sheet.save(sheet_path)
    map_path = os.path.join(args.out, "frames-64.json")
    with open(map_path, "w", encoding="utf-8") as fh:
        json.dump({
            "frameWidth": 64,
            "frameHeight": 64,
            "sheet": "spritesheet-64.png",
            "sheetWidth": sheet.width,
            "sheetHeight": sheet.height,
            "frames": frame_map,
        }, fh, indent=2)
    print(f"sheet-64 frames dir {frames_dir} ({len(frame_map)} frames)")
    print(f"sheet-64 sheet      {sheet_path} ({sheet.width}x{sheet.height})")
    print(f"sheet-64 map        {map_path}")
    return 0


def cmd_mint(args):
    """One-shot: recolored Codex atlas + pet.json + 64x64 game sheet."""
    import json

    pack_dir = args.pack
    if not os.path.isdir(os.path.join(pack_dir, "animations")):
        sys.stderr.write(f"ERROR: pack has no animations/ dir: {pack_dir}\n")
        return 1
    if args.heart not in HEART_MODES:
        sys.stderr.write(f"ERROR: --heart must be one of {HEART_MODES}\n")
        return 1
    os.makedirs(args.out, exist_ok=True)
    mapping = [dict(m) for m in DEFAULT_MAPPING]

    # 1. Codex atlas (compose, validate, save png+webp).
    atlas, _used = _compose_atlas_image(pack_dir, mapping, args.hue, args.heart, args.fill)
    png_path = os.path.join(args.out, "spritesheet.png")
    webp_path = os.path.join(args.out, "spritesheet.webp")
    atlas.save(png_path)
    _save_webp_lossless(atlas, webp_path)
    report = _validate_atlas(atlas, mapping)
    with open(os.path.join(args.out, "validation.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    contact = _contact_sheet(atlas)
    contact.save(os.path.join(args.out, "contact-sheet.png"))
    print(f"mint atlas png  {png_path} ({ATLAS_W}x{ATLAS_H}) ok={report['ok']}")
    print(f"mint atlas webp {webp_path}")
    if not report["ok"]:
        sys.stderr.write("ERROR: minted atlas failed validation:\n")
        for e in report["errors"]:
            sys.stderr.write(f"  - {e}\n")
        return 1

    # 2. pet.json (staged in the out dir; install only with --install).
    pet_json = {
        "id": args.id,
        "displayName": args.name,
        "description": args.desc,
        "spritesheetPath": "spritesheet.webp",
    }
    pet_json_path = os.path.join(args.out, "pet.json")
    with open(pet_json_path, "w", encoding="utf-8") as fh:
        json.dump(pet_json, fh, indent=2)
    print(f"mint pet.json   {pet_json_path}")

    # 3. 64x64 game sheet (reuse the sheet-64 logic via a shim args object).
    sheet_out = os.path.join(args.out, "game-64")
    sheet_args = argparse.Namespace(
        pack=pack_dir, state="all", out=sheet_out,
        method=args.method, hue=args.hue, heart=args.heart,
    )
    rc = cmd_sheet_64(sheet_args)
    if rc != 0:
        return rc

    # 4. optional install.
    if args.install:
        install_args = argparse.Namespace(
            atlas=webp_path, id=args.id, name=args.name,
            desc=args.desc, codex_home=args.codex_home, force=args.force,
        )
        rc = cmd_install_pet(install_args)
        if rc != 0:
            return rc
    else:
        print("mint install    skipped (pass --install to copy into CODEX_HOME/pets)")
    return 0


# ---------------------------------------------------------------------------
# open (LibreSprite preview, optional/GUI, best-effort)
# ---------------------------------------------------------------------------
def cmd_open(args):
    libresprite = args.libresprite or "/Applications/LibreSprite.app/Contents/MacOS/libresprite"
    if not os.path.isfile(libresprite):
        sys.stderr.write(
            f"ERROR: LibreSprite executable not found: {libresprite}\n"
            "Pass --libresprite <path> or install LibreSprite. "
            "(Preview is optional and GUI-only.)\n"
        )
        return 1
    if not os.path.isfile(args.file):
        sys.stderr.write(f"ERROR: file not found: {args.file}\n")
        return 1
    print(f"opening {args.file} in LibreSprite (GUI preview, best-effort)")
    os.execv(libresprite, [libresprite, args.file])


# ---------------------------------------------------------------------------
# argument parsing
# ---------------------------------------------------------------------------
def build_parser():
    p = argparse.ArgumentParser(
        prog="buddy.py",
        description="Hybrid LibreSprite + Pillow buddy-sprite toolkit. "
        "Pillow is the pixel engine; LibreSprite is preview-only.",
    )
    sub = p.add_subparsers(dest="command", required=True)

    # resize
    r = sub.add_parser("resize", help="crisp-resize a PNG (or dir of PNGs) to NxN")
    r.add_argument("input", help="input PNG file or directory of PNGs")
    r.add_argument("output", help="output PNG (file input) or output dir (dir input)")
    r.add_argument("--size", type=int, default=64, help="square output size (default 64)")
    r.add_argument("--method", choices=RESIZE_METHODS, default="lanczos-sharp",
                   help="resize method (default lanczos-sharp; nearest for clean pixel art)")
    r.set_defaults(func=cmd_resize)

    # clone
    c = sub.add_parser("clone", help="copy a template file or a whole pose/animation dir")
    c.add_argument("source", help="source file or directory")
    c.add_argument("dest", help="destination path")
    c.add_argument("--force", action="store_true", help="overwrite an existing dest dir")
    c.set_defaults(func=cmd_clone)

    # recolor
    rc = sub.add_parser("recolor", help="generate hue-shifted variants (face/eyes/belly preserved)")
    rc.add_argument("input", help="input buddy PNG")
    rc.add_argument("outdir", help="output directory")
    rc.add_argument("--count", type=int, default=3, help="number of evenly-spaced variants (default 3)")
    rc.add_argument("--hue", type=float, default=None,
                    help="single hue shift 0..1 (overrides --count)")
    rc.add_argument("--size", type=int, default=64,
                    help="also emit a resized copy at this size (0 to skip)")
    rc.add_argument("--method", choices=RESIZE_METHODS, default="lanczos-sharp")
    rc.add_argument("--heart", choices=HEART_MODES, default="keep",
                    help="belly-heart handling: keep (default), recolor, or remove")
    rc.set_defaults(func=cmd_recolor)

    # feature-swap
    fs = sub.add_parser("feature-swap", help="alpha-paste a feature PNG onto a base buddy")
    fs.add_argument("base", help="base buddy PNG")
    fs.add_argument("feature", help="feature layer PNG (user-supplied: antennae/eyes/belly icon)")
    fs.add_argument("output", help="output PNG")
    fs.add_argument("--x", type=int, default=0, help="feature paste x offset")
    fs.add_argument("--y", type=int, default=0, help="feature paste y offset")
    fs.add_argument("--size", type=int, default=0, help="also emit a resized copy (0 to skip)")
    fs.add_argument("--method", choices=RESIZE_METHODS, default="lanczos-sharp")
    fs.set_defaults(func=cmd_feature_swap)

    # new-buddy
    nb = sub.add_parser("new-buddy", help="new-shape buddy: pose reuse + recolor/feature, or v1 procedural")
    nb.add_argument("--name", default="new_buddy", help="output base name")
    nb.add_argument("--outdir", required=True, help="output directory")
    nb.add_argument("--base", default=None,
                    help="base pose/rotation/animation frame PNG from a Buddy pack (pose-reuse path)")
    nb.add_argument("--hue", type=float, default=None, help="hue shift 0..1 to recolor")
    nb.add_argument("--feature", default=None, help="optional feature PNG to alpha-paste")
    nb.add_argument("--fx", type=int, default=0, help="feature x offset")
    nb.add_argument("--fy", type=int, default=0, help="feature y offset")
    nb.add_argument("--size", type=int, default=64, help="resized output size (default 64)")
    nb.add_argument("--method", choices=RESIZE_METHODS, default="lanczos-sharp")
    nb.add_argument("--procedural", action="store_true",
                    help="v1 SIMPLE primitive generator (round/egg body, dot eyes, smile, "
                         "antennae, belly accent). Honest: basic, not hand-drawn pixel art.")
    nb.add_argument("--egg", action="store_true", help="procedural: egg body instead of round")
    nb.set_defaults(func=cmd_new_buddy)

    # compose-atlas (Codex pet atlas from real Buddy art)
    ca = sub.add_parser(
        "compose-atlas",
        help="compose a 1536x1872 Codex pet atlas from real Buddy frames (compose-not-generate)",
    )
    ca.add_argument("--pack", required=True, help="Buddy pack dir (contains animations/)")
    ca.add_argument("--out", required=True, help="output dir for spritesheet.png/.webp + validation")
    ca.add_argument("--mapping", default=None,
                    help="optional JSON to override any row's source Anim/dir, state, or frames")
    ca.add_argument("--hue", type=float, default=None, help="hue shift 0..1 to recolor a sibling")
    ca.add_argument("--heart", choices=HEART_MODES, default="keep",
                    help="belly-heart handling on recolor: keep (default), recolor, remove")
    ca.add_argument("--fill", type=float, default=0.92,
                    help="fraction of the cell the buddy fills (default 0.92)")
    ca.set_defaults(func=cmd_compose_atlas)

    # install-pet (write CODEX_HOME/pets/<id>/)
    ip = sub.add_parser("install-pet", help="install a composed atlas as a Codex pet")
    ip.add_argument("--atlas", required=True, help="path to spritesheet.webp")
    ip.add_argument("--id", required=True, help="pet id (directory name)")
    ip.add_argument("--name", required=True, help="display name")
    ip.add_argument("--desc", required=True, help="description")
    ip.add_argument("--codex-home", default=None,
                    help="override CODEX_HOME (default $CODEX_HOME or ~/.codex)")
    ip.add_argument("--force", action="store_true", help="overwrite an existing pet id")
    ip.set_defaults(func=cmd_install_pet)

    # sheet-64 (game-ready 64x64 sheets + frame map)
    s64 = sub.add_parser("sheet-64", help="64x64 game sprite sheet + JSON frame map from real frames")
    s64.add_argument("--pack", required=True, help="Buddy pack dir (contains animations/)")
    s64.add_argument("--out", required=True, help="output dir")
    s64.add_argument("--state", default="all",
                     help="'all' or a single codex state (idle, running-right, ...)")
    s64.add_argument("--method", choices=RESIZE_METHODS, default="lanczos-sharp",
                     help="resize method for 64x64 frames (default lanczos-sharp)")
    s64.add_argument("--hue", type=float, default=None, help="optional hue shift 0..1")
    s64.add_argument("--heart", choices=HEART_MODES, default="keep",
                     help="belly-heart handling on recolor: keep (default), recolor, remove")
    s64.set_defaults(func=cmd_sheet_64)

    # mint (one-shot atlas + pet.json + 64 sheet, optional install)
    mt = sub.add_parser("mint", help="one-shot: recolored Codex atlas + pet.json + 64x64 game sheet")
    mt.add_argument("--pack", required=True, help="Buddy pack dir (contains animations/)")
    mt.add_argument("--id", required=True, help="pet id")
    mt.add_argument("--name", required=True, help="display name")
    mt.add_argument("--desc", default="", help="description")
    mt.add_argument("--out", required=True, help="output dir")
    mt.add_argument("--hue", type=float, default=None, help="hue shift 0..1 for a sibling buddy")
    mt.add_argument("--heart", choices=HEART_MODES, default="keep",
                    help="belly-heart handling: keep (default), recolor, remove")
    mt.add_argument("--fill", type=float, default=0.92, help="cell fill factor (default 0.92)")
    mt.add_argument("--method", choices=RESIZE_METHODS, default="lanczos-sharp",
                    help="resize method for the 64x64 sheet (default lanczos-sharp)")
    mt.add_argument("--install", action="store_true",
                    help="also copy into CODEX_HOME/pets/<id>/ (off by default)")
    mt.add_argument("--codex-home", default=None, help="override CODEX_HOME for --install")
    mt.add_argument("--force", action="store_true", help="--install: overwrite existing pet id")
    mt.set_defaults(func=cmd_mint)

    # open
    op = sub.add_parser("open", help="preview a file in LibreSprite (optional, GUI-only, best-effort)")
    op.add_argument("file", help="image file to open")
    op.add_argument("--libresprite", default=None,
                    help="path to LibreSprite executable "
                         "(default /Applications/LibreSprite.app/Contents/MacOS/libresprite)")
    op.set_defaults(func=cmd_open)

    return p


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
