#!/usr/bin/env python3
"""Bake kit geometry into a skinned playfield PNG.

Usage:
  npx tsx -e "import {writeFileSync} from 'fs'; import {assembleAppropriationsKit, resetAppropriationsKitCache} from './src/game/pinballKit/recipes/appropriations.ts'; resetAppropriationsKitCache(); const a=assembleAppropriationsKit(); writeFileSync('/tmp/kit-table.json', JSON.stringify({objects:a.objects,bumpers:a.bumperMarkers??[]}));"
  python3 scripts/bakePinballPlayfield.py
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


def main():
    data = json.loads(Path("/tmp/kit-table.json").read_text())
    objects = data["objects"]
    bumpers = data["bumpers"]
    mouths = {
        "enter": make_lane_marker(256, (55, 170, 120), (140, 255, 180)),
        "exit": make_lane_marker(256, (200, 70, 120), (255, 150, 190)),
        "tunnel": make_tunnel_scoop(256, (150, 80, 200), (230, 180, 255)),
    }

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
            r = int((12 + t * 5 + n * 0.3) * vig)
            g = int((52 + t * 18 + n) * vig)
            b = int((40 + t * 8 + n * 0.4) * vig)
            px[x, y] = (max(0, r), max(0, g), max(0, b), 255)

    fr = ImageDraw.Draw(base, "RGBA")
    for box, col in [
        ((0, 0, 64, H), (48, 30, 18, 255)),
        ((W - 64, 0, W, H), (48, 30, 18, 255)),
        ((0, 0, W, 48), (40, 26, 16, 255)),
        ((0, H - 48, W, H), (40, 26, 16, 255)),
    ]:
        fr.rectangle(list(box), fill=col)
    fr.rectangle([64, 48, W - 64, H - 48], outline=(180, 150, 90, 160), width=3)

    ins = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    idr = ImageDraw.Draw(ins, "RGBA")
    idr.rounded_rectangle([88, 58, 992, 205], radius=24, fill=(8, 16, 22, 220))
    idr.rounded_rectangle([110, 78, 970, 185], radius=16, fill=(28, 55, 65, 170))
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32)
    except Exception:
        font = ImageFont.load_default()
    idr.text((540, 118), "APPROPRIATIONS", font=font, fill=(255, 214, 110, 230), anchor="mm")
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
        outer_wall = offset_poly(op, 10)
        inner_wall = offset_poly(ip, -10)
        body = outer_wall + list(reversed(inner_wall))
        shadow = [(x + 3, y + 5) for x, y in body]
        d.polygon(shadow, fill=(0, 0, 0, 70))
        d.polygon(body, fill=(24, 78, 92, 255))
        floor = op + list(reversed(ip))
        d.polygon(floor, fill=(12, 40, 52, 255))
        mid = [((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) for a, b in zip(op, ip)]
        if len(mid) >= 2:
            d.line(mid, fill=(70, 210, 230, 70), width=18)
            d.line(mid, fill=(200, 255, 255, 45), width=5)
        d.line(op, fill=(8, 20, 28, 255), width=14)
        d.line(ip, fill=(8, 20, 28, 255), width=14)
        d.line(op, fill=(90, 200, 215, 255), width=6)
        d.line(ip, fill=(90, 200, 215, 255), width=6)
        d.line(op, fill=(220, 255, 255, 160), width=2)
        d.line(ip, fill=(220, 255, 255, 160), width=2)

    slides = [o for o in objects if o.get("kind") == "slide" and o.get("points")]
    by: dict[str, list] = {}
    for s in slides:
        by.setdefault(f"{s.get('layer', 'playfield')}:{s.get('linkId') or s['id']}", []).append(s)

    consumed: set[str] = set()
    for group in by.values():
        outer = next((g for g in group if g["id"].endswith("-outer")), None)
        inner = next((g for g in group if g["id"].endswith("-inner")), None)
        if not outer or not inner:
            continue
        op, ip = art(outer["points"]), art(inner["points"])
        if outer.get("layer") == "overpass":
            d.line(op, fill=(0, 0, 0, 55), width=9)
            d.line(ip, fill=(0, 0, 0, 55), width=9)

            def dash(pts):
                for i in range(len(pts) - 1):
                    x0, y0 = pts[i]
                    x1, y1 = pts[i + 1]
                    length = math.hypot(x1 - x0, y1 - y0) or 1
                    ux, uy = (x1 - x0) / length, (y1 - y0) / length
                    t = 0.0
                    on = True
                    while t < length:
                        seg = min(16 if on else 10, length - t)
                        if on:
                            p0 = (x0 + ux * t, y0 + uy * t)
                            p1 = (x0 + ux * (t + seg), y0 + uy * (t + seg))
                            d.line([p0, p1], fill=(255, 168, 32, 255), width=7)
                            d.line([p0, p1], fill=(255, 230, 160, 230), width=3)
                        t += seg
                        on = not on

            dash(op)
            dash(ip)
            n = min(len(op), len(ip))
            for i in range(0, n, 2):
                x = (op[i][0] + ip[i][0]) / 2
                y = (op[i][1] + ip[i][1]) / 2
                d.rectangle([x - 4, y + 8, x + 4, y + 34], fill=(150, 160, 170, 255))
                d.ellipse([x - 12, y + 28, x + 12, y + 42], fill=(100, 110, 120, 255))
                d.ellipse([x - 9, y - 2, x + 9, y + 16], fill=(210, 220, 230, 255))
            for g in group:
                consumed.add(g["id"])
            continue
        molded_ramp(op, ip)
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

    # Fill sling triangles from apex + legs (dark body, red rubber on face already stroked).
    by_id = {o["id"]: o for o in objects}
    for side, s in (("left", 1), ("right", -1)):
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
