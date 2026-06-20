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
Run `buddy.py <subcommand> --help` for details.

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


def _recolor_image(im, hue_shift):
    """Hue-shift an RGBA image while protecting identity pixels.

    Per the proven logic:
      * fully transparent pixels stay transparent;
      * near-gray / white pixels (s < 0.18) are kept -- face, eyes, outline;
      * the warm belly-heart accent (0.02 < h < 0.13 and s > 0.4) is kept;
      * everything else is rotated by hue_shift (a fraction of the wheel, 0..1).
    """
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
            if 0.02 < hh < 0.13 and ss > 0.4:
                dst[x, y] = (r, g, b, a)  # warm belly-heart accent
                continue
            nh = (hh + hue_shift) % 1.0
            nr, ng, nb = colorsys.hsv_to_rgb(nh, ss, vv)
            dst[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return out


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
        variant = _recolor_image(im, shift)
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
