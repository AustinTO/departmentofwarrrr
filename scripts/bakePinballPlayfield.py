#!/usr/bin/env python3
"""Bake kit geometry into a skinned playfield PNG.

Theme: Department of War — Appropriations table. Olive-drab felt, brass
trim, stenciled mil-spec labels, a faint roundel under the bumper island.
Hardware stays readable: chrome cabinet rails, molded teal ramps, red sling
rubber, black tunnel scoop, open-ring lane markers.

Usage:
  python3 scripts/bakePinballPlayfield.py
(the script re-exports fresh kit geometry itself — never bake from a stale dump)
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "pinball"
ORIGIN_Y = 280
W, H = 1080, 1600
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def art(pts):
    return [(float(x), float(y) - ORIGIN_Y) for x, y in pts]


def art_xy(x, y):
    return float(x), float(y) - ORIGIN_Y


def offset_poly(pts, dist):
    if len(pts) < 2:
        return pts
    out = []
    for i in range(len(pts)):
        prev = pts[max(0, i - 1)]
        nxt = pts[min(len(pts) - 1, i + 1)]
        dx = nxt[0] - prev[0]
        dy = nxt[1] - prev[1]
        length = math.hypot(dx, dy) or 1
        nx, ny = -dy / length, dx / length
        out.append((pts[i][0] + nx * dist, pts[i][1] + ny * dist))
    return out


def star_pts(cx, cy, r_out, r_in, n=5, rot=-90.0):
    pts = []
    for i in range(n * 2):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(rot + i * 180.0 / n)
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts


def stencil_text(text, size, fill, tracking=6):
    """Render letter-spaced mil-spec stencil text on a transparent strip."""
    try:
        font = ImageFont.truetype(FONT_PATH, size)
    except Exception:
        font = ImageFont.load_default()
    widths = [font.getlength(ch) for ch in text]
    total = sum(widths) + tracking * max(0, len(text) - 1)
    img = Image.new("RGBA", (int(total) + 12, size + 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    x = 6
    for ch, w in zip(text, widths):
        d.text((x, 8), ch, font=font, fill=fill)
        x += w + tracking
    return img


def paste_rotated(base_img, strip, cx, cy, angle_deg):
    rot = strip.rotate(-angle_deg, expand=True, resample=Image.Resampling.BICUBIC)
    base_img.paste(rot, (int(cx - rot.width / 2), int(cy - rot.height / 2)), rot)


def make_lane_marker(size, rim, glow):
    """Open ring — lane trip, NOT a hole the ball falls into."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    c = size // 2
    d.ellipse([10, 10, size - 10, size - 10], outline=(210, 220, 230, 220), width=5)
    d.ellipse([18, 18, size - 18, size - 18], outline=(*rim, 230), width=7)
    d.arc([14, 14, size - 14, size - 14], 200, 320, fill=(255, 255, 255, 180), width=3)
    # small chevron suggesting travel, not a pit
    d.polygon(
        [(c - 10, c + 4), (c, c - 12), (c + 10, c + 4)],
        fill=(*glow, 200),
    )
    return img


def make_tunnel_scoop(size, rim, glow):
    """Real scoop — only tunnels should look like black holes."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    c = size // 2
    d.ellipse([c - size * 0.46, c - size * 0.42, c + size * 0.46, c + size * 0.5], fill=(0, 0, 0, 70))
    d.ellipse([8, 8, size - 8, size - 8], fill=(200, 210, 220, 255))
    d.ellipse([18, 18, size - 18, size - 18], fill=(*rim, 255))
    d.ellipse([34, 34, size - 34, size - 34], fill=(25, 35, 42, 255))
    d.ellipse([48, 48, size - 48, size - 48], fill=(5, 8, 12, 255))
    d.arc([14, 14, size - 14, size - 14], 200, 320, fill=(255, 255, 255, 210), width=4)
    for i in range(10):
        a = math.radians(i * 36 + 10)
        x = c + math.cos(a) * (size * 0.32)
        y = c + math.sin(a) * (size * 0.32)
        d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(*glow, 230))
    return img


def export_kit_table() -> Path:
    """Always refresh kit geometry before baking — never reuse a stale dump."""
    out = ROOT / "tmp" / "kit-table.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = (
        "import { writeFileSync } from 'fs';"
        "import { assembleAppropriationsKit, resetAppropriationsKitCache } from './src/game/pinballKit/recipes/appropriations.ts';"
        "resetAppropriationsKitCache();"
        "const a = assembleAppropriationsKit();"
        f"writeFileSync({json.dumps(str(out))}, JSON.stringify({{objects:a.objects,bumpers:a.bumperMarkers??[]}}));"
    )
    import subprocess

    subprocess.check_call(["npx", "tsx", "-e", cmd], cwd=ROOT)
    return out


def main():
    table_path = export_kit_table()
    data = json.loads(table_path.read_text())
    objects = data["objects"]
    bumpers = data["bumpers"]
    mouths = {
        "enter": make_lane_marker(256, (55, 170, 120), (140, 255, 180)),
        "exit": make_lane_marker(256, (200, 70, 120), (255, 150, 190)),
        "tunnel": make_tunnel_scoop(256, (150, 80, 200), (230, 180, 255)),
    }

    # ---- Base: olive-drab felt with vignette + grain -----------------------
    random.seed(5)
    base = Image.new("RGBA", (W, H), (16, 42, 38, 255))
    px = base.load()
    for y in range(H):
        for x in range(W):
            t = y / H
            dx = (x - W / 2) / (W * 0.5)
            dy = (y - H / 2) / (H * 0.5)
            vig = max(0.5, 1 - 0.32 * (dx * dx + dy * dy))
            n = random.randint(-11, 11)
            r = int((14 + t * 5 + n * 0.3) * vig)
            g = int((50 + t * 17 + n) * vig)
            b = int((38 + t * 8 + n * 0.4) * vig)
            px[x, y] = (max(0, r), max(0, g), max(0, b), 255)

    # ---- Wood + brass cabinet frame ---------------------------------------
    fr = ImageDraw.Draw(base, "RGBA")
    for box, col in [
        ((0, 0, 64, H), (48, 30, 18, 255)),
        ((W - 64, 0, W, H), (48, 30, 18, 255)),
        ((0, 0, W, 48), (40, 26, 16, 255)),
        ((0, H - 48, W, H), (40, 26, 16, 255)),
    ]:
        fr.rectangle(list(box), fill=col)
    fr.rectangle([64, 48, W - 64, H - 48], outline=(180, 150, 90, 160), width=3)

    # ---- Faint roundel under the bumper island -----------------------------
    deco = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(deco, "RGBA")
    rcx, rcy = 540, 470
    dd.ellipse([rcx - 250, rcy - 250, rcx + 250, rcy + 250], outline=(214, 178, 90, 34), width=10)
    dd.ellipse([rcx - 205, rcy - 205, rcx + 205, rcy + 205], outline=(214, 178, 90, 26), width=4)
    dd.polygon(star_pts(rcx, rcy, 165, 66), fill=(214, 178, 90, 20))
    dd.polygon(star_pts(rcx, rcy, 165, 66), outline=(214, 178, 90, 34))
    base = Image.alpha_composite(base, deco)

    # ---- Marquee ------------------------------------------------------------
    ins = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    idr = ImageDraw.Draw(ins, "RGBA")
    idr.rounded_rectangle([88, 58, 992, 205], radius=24, fill=(8, 16, 22, 220))
    idr.rounded_rectangle([110, 78, 970, 185], radius=16, fill=(28, 55, 65, 170))
    idr.rectangle([110, 78, 970, 185], outline=(180, 150, 90, 120), width=2)
    title = stencil_text("APPROPRIATIONS", 34, (255, 214, 110, 235), tracking=10)
    ins.paste(title, (int(540 - title.width / 2), 92), title)
    sub = stencil_text("DEPARTMENT OF WAR - PROCUREMENT DIVISION", 17, (150, 200, 190, 190), tracking=5)
    ins.paste(sub, (int(540 - sub.width / 2), 148), sub)
    for sx in (150, 930):
        idr.polygon(star_pts(sx, 131, 22, 9), fill=(255, 214, 110, 200))
    base = Image.alpha_composite(base, ins)

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")

    def metal_rail(pts, w=20):
        if len(pts) < 2:
            return
        d.line(pts, fill=(0, 0, 0, 110), width=w + 12)
        d.line(pts, fill=(55, 65, 78, 255), width=w + 6)
        d.line(pts, fill=(165, 178, 192, 255), width=w)
        d.line(pts, fill=(235, 245, 255, 230), width=max(3, w // 5))

    def plastic_guide(pts, w=14, face=False):
        """Matte black/red lane guides — not chrome."""
        if len(pts) < 2:
            return
        d.line(pts, fill=(0, 0, 0, 90), width=w + 10)
        d.line(pts, fill=(28, 32, 38, 255), width=w + 4)
        d.line(pts, fill=(48, 52, 60, 255), width=w)
        if face:
            d.line(pts, fill=(170, 55, 48, 230), width=max(5, w // 2))
            d.line(pts, fill=(220, 110, 80, 160), width=max(2, w // 4))

    def is_cabinet_metal(oid: str) -> bool:
        return (
            oid in ("left-rail", "right-rail", "top-rail", "left-bottom-rail", "right-bottom-rail")
            or oid.startswith("shooter")
            or "hood" in oid
        )

    def is_apron_guide(oid: str) -> bool:
        return any(
            key in oid
            for key in ("outlane", "apron", "sling-leg", "sling-face", "return", "inlane")
        )

    def molded_ramp(op, ip):
        outer_wall = offset_poly(op, 6)
        inner_wall = offset_poly(ip, -6)
        body = outer_wall + list(reversed(inner_wall))
        shadow = [(x + 3, y + 5) for x, y in body]
        d.polygon(shadow, fill=(0, 0, 0, 70))
        d.polygon(body, fill=(24, 78, 92, 255))
        floor = op + list(reversed(ip))
        d.polygon(floor, fill=(12, 40, 52, 255))
        mid = [((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) for a, b in zip(op, ip)]
        if len(mid) >= 2:
            d.line(mid, fill=(70, 210, 230, 55), width=10)
            d.line(mid, fill=(200, 255, 255, 40), width=3)
        d.line(op, fill=(8, 20, 28, 255), width=10)
        d.line(ip, fill=(8, 20, 28, 255), width=10)
        d.line(op, fill=(90, 200, 215, 255), width=4)
        d.line(ip, fill=(90, 200, 215, 255), width=4)
        d.line(op, fill=(220, 255, 255, 150), width=1)
        d.line(ip, fill=(220, 255, 255, 150), width=1)

    slides = [o for o in objects if o.get("kind") == "slide" and o.get("points")]
    by: dict[str, list] = {}
    for s in slides:
        by.setdefault(f"{s.get('layer', 'playfield')}:{s.get('linkId') or s['id']}", []).append(s)

    consumed: set[str] = set()
    ramp_labels: list[tuple[list, str]] = []
    for group in by.values():
        outer = next((g for g in group if g["id"].endswith("-outer")), None)
        inner = next((g for g in group if g["id"].endswith("-inner")), None)
        if not outer or not inner:
            continue
        op, ip = art(outer["points"]), art(inner["points"])
        molded_ramp(op, ip)
        link = outer.get("linkId") or outer["id"].replace("-outer", "")
        ramp_labels.append((op, ip, link))
        for g in group:
            consumed.add(g["id"])

    for o in objects:
        if o["id"] in consumed:
            continue
        if o.get("kind") not in ("wall", "slide") or not o.get("points"):
            continue
        pts = art(o["points"])
        length = sum(
            math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) for i in range(1, len(pts))
        )
        if is_apron_guide(o["id"]):
            plastic_guide(pts, 16 if "face" in o["id"] else 14, face="face" in o["id"])
            continue
        if "gate" in o["id"] or length < 95:
            a, b = pts[0], pts[-1]
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
            block = Image.new("RGBA", (max(56, int(length) + 8), 40), (0, 0, 0, 0))
            bd = ImageDraw.Draw(block, "RGBA")
            bd.rounded_rectangle([0, 4, block.width - 1, block.height - 1], radius=8, fill=(0, 0, 0, 60))
            bd.rounded_rectangle([1, 0, block.width - 2, block.height - 6], radius=8, fill=(190, 200, 210, 255))
            bd.rounded_rectangle([6, 6, block.width - 7, block.height - 12], radius=5, fill=(45, 58, 70, 255))
            block = block.rotate(-ang, expand=True, resample=Image.Resampling.BICUBIC)
            layer.paste(block, (int(mx - block.width / 2), int(my - block.height / 2)), block)
            continue
        oid = o["id"]
        if is_cabinet_metal(oid):
            metal_rail(pts, 24 if ("rail" in oid or oid.startswith("shooter")) else 16)
            continue
        # Default leftover walls: thin dark plastic, never chrome.
        plastic_guide(pts, 12, face=False)

    # Fill sling triangles from apex + legs (dark body, red rubber stroked later).
    by_id = {o["id"]: o for o in objects}
    for side in ("left", "right"):
        leg = by_id.get(f"{side}-sling-leg")
        face = by_id.get(f"{side}-sling-face")
        if not leg or not face or not leg.get("points") or not face.get("points"):
            continue
        apex = art_xy(leg["points"][0][0], leg["points"][0][1])
        out_b = art_xy(leg["points"][-1][0], leg["points"][-1][1])
        in_b = art_xy(face["points"][-1][0], face["points"][-1][1])
        tri = [apex, out_b, in_b]
        d.polygon(tri, fill=(0, 0, 0, 55))
        d.polygon(tri, outline=(40, 44, 52, 220), width=2)

    # Sensors: only tunnel mouths look like black scoops. Ramp/shooter are open markers.
    for o in objects:
        if o.get("kind") != "sensor" or not o.get("radius"):
            continue
        x, y = art_xy(o["x"], o["y"])
        r = float(o["radius"])
        is_tunnel = o["id"].startswith("tunnel-")
        key = "tunnel" if is_tunnel else ("exit" if o.get("sensor") == "exit" else "enter")
        size = int(r * (3.5 if is_tunnel else 2.6))
        spr = mouths[key].resize((size, size), Image.Resampling.LANCZOS)
        layer.paste(spr, (int(x - size / 2), int(y - size / 2)), spr)

    # Subtle bumper pads under live chrome sprites — no fake black pits
    for b in bumpers:
        x, y = art_xy(b["x"], b["y"])
        r = float(b["radius"])
        d.ellipse([x - r * 1.35, y - r * 1.35 + 6, x + r * 1.35, y + r * 1.35 + 6], fill=(0, 0, 0, 50))
        d.ellipse([x - r * 1.15, y - r * 1.15, x + r * 1.15, y + r * 1.15], fill=(28, 48, 56, 120))
        d.ellipse([x - r * 1.05, y - r * 1.05, x + r * 1.05, y + r * 1.05], outline=(160, 180, 190, 140), width=3)

    # Thin rubber strip on sling physics boxes — triangle body already drawn above.
    for o in objects:
        if o.get("kind") != "sling":
            continue
        cx, cy = art_xy(o["x"], o["y"])
        ang = float(o.get("angle") or 0)
        s = 1 if "left" in o["id"] else -1
        cos_a, sin_a = math.cos(ang), math.sin(ang)
        rubber = [(-48 * s, 6), (42 * s, -14), (50 * s, 8), (-40 * s, 16)]
        poly = [(cx + lx * cos_a - ly * sin_a, cy + lx * sin_a + ly * cos_a) for lx, ly in rubber]
        d.polygon(poly, fill=(200, 70, 55, 235))
        d.polygon(poly, outline=(255, 160, 120, 180), width=1)

    # Soft center drain only — no giant black flipper wells
    d.ellipse([470, 1488, 610, 1548], fill=(0, 0, 0, 55))

    base = Image.alpha_composite(base, layer.filter(ImageFilter.GaussianBlur(0.45)))
    base = Image.alpha_composite(base, layer)

    # ---- Stenciled decoration layer (above hardware, low alpha) ------------
    deco2 = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # Ramp name stencils along each channel midline.
    for op, ip, link in ramp_labels:
        label = {"left-ramp": "OVERSIGHT BYPASS", "right-ramp": "EMERGENCY FUNDING"}.get(link)
        if not label:
            continue
        n = min(len(op), len(ip))
        i0 = int(n * 0.45)
        i1 = int(n * 0.62)
        mx0, my0 = (op[i0][0] + ip[i0][0]) / 2, (op[i0][1] + ip[i0][1]) / 2
        mx1, my1 = (op[i1][0] + ip[i1][0]) / 2, (op[i1][1] + ip[i1][1]) / 2
        ang = math.degrees(math.atan2(my1 - my0, mx1 - mx0))
        # Keep text upright-ish: flip if it would read upside down.
        if ang > 90 or ang < -90:
            ang += 180
        strip = stencil_text(label, 20, (220, 240, 235, 95), tracking=4)
        paste_rotated(deco2, strip, (mx0 + mx1) / 2, (my0 + my1) / 2, ang)

        # Chevron arrows at the entrance mouth pointing up-channel.
        ex, ey = (op[0][0] + ip[0][0]) / 2, (op[0][1] + ip[0][1]) / 2
        tx, ty = (op[2][0] + ip[2][0]) / 2, (op[2][1] + ip[2][1]) / 2
        ux, uy = tx - ex, ty - ey
        ln = math.hypot(ux, uy) or 1
        ux, uy = ux / ln, uy / ln
        pxn, pyn = -uy, ux
        cd = ImageDraw.Draw(deco2, "RGBA")
        for k in range(2):
            bx = ex + ux * (26 + k * 26)
            byy = ey + uy * (26 + k * 26)
            tip = (bx + ux * 16, byy + uy * 16)
            left = (bx - ux * 8 + pxn * 13, byy - uy * 8 + pyn * 13)
            right = (bx - ux * 8 - pxn * 13, byy - uy * 8 - pyn * 13)
            cd.polygon([tip, left, right], fill=(140, 255, 180, 120))

    # Outlane / inlane stencils.
    for text, lx, ly, ang in [
        ("AUDIT", 118, 1080, -90),
        ("AUDIT", 962, 1080, 90),
        ("KICKBACK", 205, 1060, -90),
        ("KICKBACK", 875, 1060, 90),
    ]:
        strip = stencil_text(text, 18, (255, 220, 130, 80), tracking=5)
        paste_rotated(deco2, strip, lx, ly, ang)

    # Apron stencil.
    apron_strip = stencil_text("DEPARTMENT OF WAR", 30, (255, 214, 110, 110), tracking=8)
    deco2.paste(apron_strip, (int(540 - apron_strip.width / 2), 1180), apron_strip)
    apron_sub = stencil_text("NO BAILOUTS BELOW THIS LINE", 15, (200, 210, 215, 80), tracking=5)
    deco2.paste(apron_sub, (int(540 - apron_sub.width / 2), 1228), apron_sub)

    base = Image.alpha_composite(base, deco2)

    base = ImageEnhance.Contrast(base).enhance(1.12)
    base = ImageEnhance.Color(base).enhance(1.18)

    OUT.mkdir(parents=True, exist_ok=True)
    rgb = base.convert("RGB")
    rgb.save(OUT / "playfield_kit.png", "PNG", optimize=True)
    rgb.save(OUT / "playfield.png", "PNG", optimize=True)

    def tint(rgb_tint, name):
        img = Image.open(OUT / "playfield.png").convert("RGBA")
        Image.alpha_composite(img, Image.new("RGBA", img.size, (*rgb_tint, 40))).convert("RGB").save(
            OUT / name, "PNG", optimize=True
        )

    tint((55, 38, 8), "playfield_audit.png")
    tint((48, 10, 34), "playfield_stadium.png")
    mouths["enter"].save(OUT / "mouth_enter.png")
    mouths["exit"].save(OUT / "mouth_exit.png")
    mouths["tunnel"].save(OUT / "mouth_tunnel.png")
    print("baked", OUT / "playfield_kit.png")


if __name__ == "__main__":
    main()
