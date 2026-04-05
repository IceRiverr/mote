#!/usr/bin/env python3
"""
generate-sprites.py - Create placeholder sprite PNG images for Temple Escape.
Generates:
  public/images/temple-tiles.png  (128x128) - 8x8 grid of 16px tiles
  public/images/characters.png    (128x64)  - Player + chaser sprites
  public/images/traps.png         (96x48)   - Trap sprites
  public/images/ui.png            (128x32)  - UI element sprites
"""

import os
from PIL import Image, ImageDraw

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "images")
os.makedirs(OUT, exist_ok=True)

# ─── Helper ────────────────────────────────────────────────────────
def checkerboard(draw, x, y, w, h, c1, c2, size=4):
    """Draw a checkerboard pattern."""
    for dy in range(0, h, size):
        for dx in range(0, w, size):
            c = c1 if (dx // size + dy // size) % 2 == 0 else c2
            draw.rectangle([x + dx, y + dy, x + dx + size - 1, y + dy + size - 1], fill=c)

def noise_rect(draw, x, y, w, h, base_color, variation=20):
    """Draw a rectangle with pixel-level color noise for texture."""
    import random
    r0, g0, b0 = base_color
    for dy in range(h):
        for dx in range(w):
            v = random.randint(-variation, variation)
            r = max(0, min(255, r0 + v))
            g = max(0, min(255, g0 + v))
            b = max(0, min(255, b0 + v))
            draw.point((x + dx, y + dy), fill=(r, g, b, 255))

def draw_diamond(draw, cx, cy, rx, ry, fill):
    """Draw a diamond shape."""
    points = [(cx, cy - ry), (cx + rx, cy), (cx, cy + ry), (cx - rx, cy)]
    draw.polygon(points, fill=fill)

# ═══════════════════════════════════════════════════════════════════
# 1. temple-tiles.png  (128x128, 8x8 grid of 16px tiles)
# ═══════════════════════════════════════════════════════════════════
print("Generating temple-tiles.png ...")
img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

TILE = 16

# Row 0 (y=0): Wall tiles - dark browns/grays with stone texture
wall_colors = [
    (60, 50, 40),   # dark stone
    (70, 58, 45),   # medium stone
    (55, 45, 35),   # darker stone
    (65, 55, 42),   # stone variant
    (50, 42, 35),   # very dark
    (75, 62, 48),   # lighter wall
    (58, 48, 38),   # brown stone
    (62, 52, 40),   # another variant
]
for i, col in enumerate(wall_colors):
    x0, y0 = i * TILE, 0
    noise_rect(d, x0, y0, TILE, TILE, col, variation=12)
    # Add mortar lines
    d.line([(x0, y0 + 7), (x0 + 15, y0 + 7)], fill=(40, 35, 30, 180), width=1)
    if i % 2 == 0:
        d.line([(x0 + 8, y0), (x0 + 8, y0 + 7)], fill=(40, 35, 30, 180), width=1)
    else:
        d.line([(x0 + 4, y0 + 7), (x0 + 4, y0 + 15)], fill=(40, 35, 30, 180), width=1)
        d.line([(x0 + 12, y0 + 7), (x0 + 12, y0 + 15)], fill=(40, 35, 30, 180), width=1)

# Row 1 (y=16): Floor tiles - lighter stones
floor_colors = [
    (130, 115, 95),  # light stone
    (120, 105, 85),  # medium floor
    (140, 125, 100), # bright floor
    (110, 98, 80),   # dim floor
    (125, 110, 90),  # standard floor
    (135, 118, 95),  # variant 1
    (115, 102, 82),  # variant 2
    (128, 112, 92),  # variant 3
]
for i, col in enumerate(floor_colors):
    x0, y0 = i * TILE, TILE
    noise_rect(d, x0, y0, TILE, TILE, col, variation=8)
    # Subtle tile border
    d.rectangle([x0, y0, x0 + 15, y0 + 15], outline=(90, 78, 65, 120))

# Row 2 (y=32): Decorative tiles - pillars, torches, etc.
deco_specs = [
    # (base_color, accent, label)
    ((80, 70, 60), (200, 160, 50), "torch"),     # torch
    ((90, 80, 65), (180, 140, 40), "torch2"),    # torch variant
    ((70, 65, 55), (100, 90, 75), "pillar_top"), # pillar top
    ((70, 65, 55), (95, 85, 70), "pillar_mid"),  # pillar mid
    ((70, 65, 55), (85, 75, 65), "pillar_bot"),  # pillar bottom
    ((45, 80, 45), (30, 60, 30), "moss"),         # moss
    ((100, 85, 70), (80, 65, 50), "crack"),       # cracked
    ((60, 50, 40), (40, 35, 30), "rubble"),       # rubble
]
for i, (base, accent, _) in enumerate(deco_specs):
    x0, y0 = i * TILE, 2 * TILE
    noise_rect(d, x0, y0, TILE, TILE, base, variation=10)
    if "torch" in _:
        # Draw flame
        d.rectangle([x0 + 6, y0 + 8, x0 + 9, y0 + 15], fill=(80, 60, 40))
        d.ellipse([x0 + 4, y0 + 2, x0 + 11, y0 + 9], fill=(255, 160, 30))
        d.ellipse([x0 + 5, y0 + 3, x0 + 10, y0 + 7], fill=(255, 220, 80))
    elif "pillar" in _:
        d.rectangle([x0 + 4, y0, x0 + 11, y0 + 15], fill=accent)
        d.line([(x0 + 4, y0), (x0 + 4, y0 + 15)], fill=(60, 55, 45), width=1)
        d.line([(x0 + 11, y0), (x0 + 11, y0 + 15)], fill=(60, 55, 45), width=1)
    elif _ == "moss":
        for py in range(TILE):
            for px in range(TILE):
                if (px + py) % 3 == 0:
                    d.point((x0 + px, y0 + py), fill=(50, 90 + (px * 7) % 30, 45, 200))
    elif _ == "crack":
        d.line([(x0 + 3, y0 + 2), (x0 + 8, y0 + 7), (x0 + 6, y0 + 13)], fill=(60, 48, 38), width=1)
        d.line([(x0 + 8, y0 + 7), (x0 + 12, y0 + 10)], fill=(60, 48, 38), width=1)
    elif _ == "rubble":
        d.ellipse([x0 + 2, y0 + 8, x0 + 7, y0 + 14], fill=(70, 60, 50))
        d.ellipse([x0 + 8, y0 + 10, x0 + 14, y0 + 15], fill=(65, 55, 45))
        d.ellipse([x0 + 5, y0 + 6, x0 + 10, y0 + 11], fill=(60, 50, 42))

# Row 3 (y=48): Hazard indicators - spikes, lava, pressure plates
hazard_specs = [
    ((180, 180, 190), "spike"),
    ((200, 60, 20), "lava"),
    ((120, 100, 80), "pressure"),
    ((160, 80, 30), "fire_grate"),
    ((90, 75, 65), "pit_edge"),
    ((30, 25, 20), "pit_center"),
    ((140, 120, 90), "arrow_trap"),
    ((100, 90, 70), "trap_disabled"),
]
for i, (col, label) in enumerate(hazard_specs):
    x0, y0 = i * TILE, 3 * TILE
    noise_rect(d, x0, y0, TILE, TILE, col, variation=10)
    if label == "spike":
        for sx in range(3):
            bx = x0 + 2 + sx * 5
            d.polygon([(bx, y0 + 15), (bx + 4, y0 + 15), (bx + 2, y0 + 4)],
                      fill=(210, 210, 220))
    elif label == "lava":
        d.ellipse([x0 + 2, y0 + 4, x0 + 8, y0 + 10], fill=(255, 120, 30, 180))
        d.ellipse([x0 + 7, y0 + 6, x0 + 14, y0 + 12], fill=(255, 80, 20, 180))
    elif label == "pressure":
        d.rectangle([x0 + 2, y0 + 10, x0 + 13, y0 + 14], fill=(100, 85, 70))
        d.rectangle([x0 + 3, y0 + 11, x0 + 12, y0 + 13], fill=(80, 68, 55))
    elif label == "fire_grate":
        for gx in range(0, 16, 4):
            d.line([(x0 + gx, y0), (x0 + gx, y0 + 15)], fill=(100, 50, 20), width=1)
        for gy in range(0, 16, 4):
            d.line([(x0, y0 + gy), (x0 + 15, y0 + gy)], fill=(100, 50, 20), width=1)

# Rows 4-7: Additional tiles (path variations, special tiles)
# Row 4: Path edge tiles
path_colors = [
    (110, 95, 75), (105, 90, 70), (115, 100, 80), (100, 88, 68),
    (120, 105, 85), (108, 94, 74), (112, 98, 78), (102, 90, 70),
]
for i, col in enumerate(path_colors):
    x0, y0 = i * TILE, 4 * TILE
    noise_rect(d, x0, y0, TILE, TILE, col, variation=6)
    # Add edge markings
    if i < 4:
        d.line([(x0, y0), (x0, y0 + 15)], fill=(80, 70, 55, 180), width=2)
    else:
        d.line([(x0 + 14, y0), (x0 + 14, y0 + 15)], fill=(80, 70, 55, 180), width=2)

# Row 5: Special effect tiles
for i in range(8):
    x0, y0 = i * TILE, 5 * TILE
    if i < 2:
        # Water/puddle
        noise_rect(d, x0, y0, TILE, TILE, (40, 60, 90), variation=15)
        d.line([(x0 + 3, y0 + 5), (x0 + 12, y0 + 5)], fill=(60, 90, 130, 150), width=1)
        d.line([(x0 + 5, y0 + 10), (x0 + 14, y0 + 10)], fill=(60, 90, 130, 150), width=1)
    elif i < 4:
        # Grass/vegetation
        noise_rect(d, x0, y0, TILE, TILE, (45, 75, 40), variation=15)
    elif i < 6:
        # Sand
        noise_rect(d, x0, y0, TILE, TILE, (160, 140, 100), variation=10)
    else:
        # Dark void
        noise_rect(d, x0, y0, TILE, TILE, (15, 12, 10), variation=5)

# Rows 6-7: More wall/floor variants
for row in range(6, 8):
    for i in range(8):
        x0, y0 = i * TILE, row * TILE
        base = (55 + i * 5, 45 + i * 4, 35 + i * 3)
        if row == 7:
            base = (90 + i * 5, 78 + i * 4, 62 + i * 3)
        noise_rect(d, x0, y0, TILE, TILE, base, variation=8)
        d.rectangle([x0, y0, x0 + 15, y0 + 15], outline=(40, 35, 30, 80))

img.save(os.path.join(OUT, "temple-tiles.png"))
print(f"  Saved temple-tiles.png ({img.size[0]}x{img.size[1]})")

# ═══════════════════════════════════════════════════════════════════
# 2. characters.png  (128x64) - Player + Chaser sprites
# ═══════════════════════════════════════════════════════════════════
print("Generating characters.png ...")
img = Image.new("RGBA", (128, 64), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

def draw_humanoid(d, x, y, w, h, body_color, head_color, pose="idle", facing="down"):
    """Draw a simple pixel humanoid character."""
    bc = body_color
    hc = head_color
    skin = (220, 180, 140)

    # Head (centered, top portion)
    head_w, head_h = w - 4, min(8, h // 3)
    hx = x + (w - head_w) // 2
    hy = y
    d.rectangle([hx, hy, hx + head_w - 1, hy + head_h - 1], fill=hc)
    # Eyes
    d.point((hx + 2, hy + 3), fill=(255, 255, 255))
    d.point((hx + head_w - 3, hy + 3), fill=(255, 255, 255))
    d.point((hx + 2, hy + 4), fill=(20, 20, 20))
    d.point((hx + head_w - 3, hy + 4), fill=(20, 20, 20))

    # Body
    body_top = hy + head_h
    body_h = h - head_h - 6
    bx = x + 2
    bw = w - 4
    d.rectangle([bx, body_top, bx + bw - 1, body_top + body_h - 1], fill=bc)

    # Legs
    leg_top = body_top + body_h
    leg_h = min(6, h - head_h - body_h)
    if pose == "run1":
        # Left leg forward, right back
        d.rectangle([bx, leg_top, bx + 2, leg_top + leg_h - 1], fill=skin)
        d.rectangle([bx + bw - 3, leg_top, bx + bw - 1, leg_top + leg_h - 2], fill=skin)
    elif pose == "run2":
        # Together
        d.rectangle([bx + 1, leg_top, bx + bw - 2, leg_top + leg_h - 1], fill=skin)
    elif pose == "run3":
        # Right leg forward, left back
        d.rectangle([bx + bw - 3, leg_top, bx + bw - 1, leg_top + leg_h - 1], fill=skin)
        d.rectangle([bx, leg_top, bx + 2, leg_top + leg_h - 2], fill=skin)
    elif pose == "jump":
        # Legs tucked
        d.rectangle([bx, leg_top, bx + 2, leg_top + 2], fill=skin)
        d.rectangle([bx + bw - 3, leg_top, bx + bw - 1, leg_top + 2], fill=skin)
    elif pose == "slide":
        # Crouching - draw body shorter
        d.rectangle([bx, leg_top - 2, bx + bw + 2, leg_top + 2], fill=bc)
    else:
        # Idle - legs straight
        d.rectangle([bx, leg_top, bx + 2, leg_top + leg_h - 1], fill=skin)
        d.rectangle([bx + bw - 3, leg_top, bx + bw - 1, leg_top + leg_h - 1], fill=skin)

    # Arms
    if pose == "jump":
        d.rectangle([bx - 2, body_top, bx - 1, body_top + 4], fill=skin)
        d.rectangle([bx + bw, body_top, bx + bw + 1, body_top + 4], fill=skin)
    elif pose == "slide":
        pass  # No visible arms when sliding
    else:
        arm_offset = 2 if "run" in pose else 0
        d.rectangle([bx - 2, body_top + arm_offset, bx - 1, body_top + body_h - 1], fill=skin)
        d.rectangle([bx + bw, body_top + arm_offset, bx + bw + 1, body_top + body_h - 1], fill=skin)

# Player sprites: 6 frames at 16x24 each
# Row 0 (y=0): player_idle, player_run_1, player_run_2, player_run_3, player_jump, player_slide
player_body = (50, 160, 140)  # teal
player_head = (70, 130, 110)  # darker teal for head

player_poses = [
    ("idle", 0),
    ("run1", 16),
    ("run2", 32),
    ("run3", 48),
    ("jump", 64),
    ("slide", 80),
]
for pose, px in player_poses:
    draw_humanoid(d, px + 2, 0, 12, 24, player_body, player_head, pose=pose)

# Chaser sprites: 4 frames at 20x24 each, starting at y=0, x=96+
# Actually let's put chaser in row 1 (y=24) for cleaner layout
# Chaser at x=0..79, y=32 (row below player, 4 frames of 20x24 = 80px wide)
# Wait, we need to fit in 128x64. Let's use:
#   Row 0 (y=0..23): Player 6 frames x 16px = 96px wide
#   Remaining space at x=96..127, y=0..23: 2 extra player frames (32px)
#   Row 1 (y=24..47): Chaser 4 frames x 20px = 80px wide
#   Row 1 remaining (y=24..47, x=80..127): extra entities

# But the image is 128x64, so we have rows at y=0..23 and y=24..47 and y=48..63

# Chaser sprites in row starting at y=32, x=0
chaser_body = (180, 40, 40)  # red
chaser_head = (140, 30, 30)  # dark red

chaser_poses = [
    ("run1", 0),
    ("run2", 20),
    ("run3", 40),
    ("run2", 60),  # run_4 = same as run_2 (reuse)
]
for pose, px in chaser_poses:
    draw_humanoid(d, px + 2, 32, 16, 24, chaser_body, chaser_head, pose=pose)
    # Add glowing eyes for chaser
    d.point((px + 5, 35), fill=(255, 50, 50))
    d.point((px + 12, 35), fill=(255, 50, 50))

img.save(os.path.join(OUT, "characters.png"))
print(f"  Saved characters.png ({img.size[0]}x{img.size[1]})")

# ═══════════════════════════════════════════════════════════════════
# 3. traps.png  (96x48) - Trap sprites
# ═══════════════════════════════════════════════════════════════════
print("Generating traps.png ...")
img = Image.new("RGBA", (96, 48), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Spike trap (16x16) at (0, 0)
# Silver/gray spikes
for sx in range(3):
    bx = 2 + sx * 5
    d.polygon([(bx, 15), (bx + 4, 15), (bx + 2, 3)], fill=(200, 200, 210))
    d.line([(bx + 1, 15), (bx + 2, 4)], fill=(230, 230, 240), width=1)
d.rectangle([0, 13, 15, 15], fill=(120, 110, 100))

# Spike retracted (16x16) at (16, 0)
d.rectangle([16, 13, 31, 15], fill=(120, 110, 100))
for sx in range(3):
    bx = 18 + sx * 5
    d.rectangle([bx, 12, bx + 4, 13], fill=(180, 180, 190))

# Fire trap frame 1 (16x16) at (32, 0)
d.rectangle([32, 12, 47, 15], fill=(100, 60, 30))
# Flames
d.ellipse([34, 2, 40, 10], fill=(255, 100, 20))
d.ellipse([38, 0, 45, 8], fill=(255, 140, 30))
d.ellipse([36, 4, 42, 12], fill=(255, 200, 50))

# Fire trap frame 2 (16x16) at (48, 0)
d.rectangle([48, 12, 63, 15], fill=(100, 60, 30))
d.ellipse([50, 0, 56, 9], fill=(255, 140, 30))
d.ellipse([54, 2, 61, 10], fill=(255, 100, 20))
d.ellipse([52, 3, 58, 11], fill=(255, 220, 60))

# Collapse floor - normal (16x16) at (64, 0)
noise_rect(d, 64, 0, 16, 16, (140, 120, 90), variation=10)
d.rectangle([64, 0, 79, 15], outline=(110, 95, 70))
# Small cracks
d.line([(68, 3), (72, 8), (70, 13)], fill=(100, 85, 65), width=1)

# Collapse floor - crumbling (16x16) at (80, 0)
noise_rect(d, 80, 0, 16, 16, (130, 110, 80), variation=15)
d.line([(83, 1), (88, 7), (85, 14)], fill=(80, 65, 50), width=2)
d.line([(90, 3), (86, 10), (93, 14)], fill=(80, 65, 50), width=2)
d.rectangle([80, 0, 95, 15], outline=(90, 75, 55))

# Row 2: Stone pillar (16x32 spread across two rows)
# Pillar top (16x16) at (0, 16)
d.rectangle([2, 16, 13, 17], fill=(160, 150, 135))
d.rectangle([3, 18, 12, 31], fill=(140, 130, 115))
d.line([(4, 18), (4, 31)], fill=(120, 110, 95), width=1)
d.line([(11, 18), (11, 31)], fill=(120, 110, 95), width=1)

# Pillar bottom (16x16) at (16, 16)
d.rectangle([19, 16, 28, 29], fill=(140, 130, 115))
d.rectangle([18, 30, 29, 31], fill=(160, 150, 135))
d.line([(20, 16), (20, 29)], fill=(120, 110, 95), width=1)
d.line([(27, 16), (27, 29)], fill=(120, 110, 95), width=1)

# Arrow trap left (16x16) at (32, 16)
d.rectangle([32, 20, 39, 27], fill=(100, 85, 70))
d.polygon([(40, 23), (47, 23), (44, 20), (44, 26)], fill=(180, 175, 170))
d.rectangle([40, 22, 43, 24], fill=(120, 80, 40))

# Arrow trap right (16x16) at (48, 16)
d.rectangle([55, 20, 63, 27], fill=(100, 85, 70))
d.polygon([(48, 23), (54, 23), (51, 20), (51, 26)], fill=(180, 175, 170))
d.rectangle([52, 22, 54, 24], fill=(120, 80, 40))

# Dart (8x8) at (64, 16)
d.polygon([(64, 19), (71, 19), (68, 16), (68, 22)], fill=(200, 195, 190))
d.rectangle([66, 18, 67, 20], fill=(140, 100, 50))

# Swinging blade arc positions (16x16 each) at (80, 16) and (0, 32)
d.line([(88, 16), (88, 24)], fill=(120, 115, 110), width=1)
d.ellipse([83, 24, 93, 31], fill=(190, 190, 200))
d.line([(85, 27), (91, 27)], fill=(220, 220, 230), width=1)

# Row 3: More trap variants
# Poison pool (16x16) at (0, 32)
d.rectangle([0, 32, 15, 47], fill=(30, 70, 30))
d.ellipse([2, 34, 8, 40], fill=(40, 100, 40, 180))
d.ellipse([6, 38, 14, 45], fill=(35, 85, 35, 180))
d.point((5, 36), fill=(80, 180, 80))
d.point((10, 41), fill=(80, 180, 80))

# Falling rocks (16x16) at (16, 32)
d.ellipse([18, 33, 25, 40], fill=(110, 100, 85))
d.ellipse([22, 37, 30, 46], fill=(100, 90, 75))
d.ellipse([17, 40, 22, 46], fill=(95, 85, 70))
# Motion lines
d.line([(20, 32), (20, 34)], fill=(150, 140, 120, 120), width=1)
d.line([(26, 32), (26, 35)], fill=(150, 140, 120, 120), width=1)

# Spinning saw (16x16) at (32, 32)
cx, cy = 40, 40
d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(170, 170, 180))
d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=(130, 130, 140))
# Teeth
for angle_i in range(8):
    import math
    a = angle_i * math.pi / 4
    tx = int(cx + 7 * math.cos(a))
    ty = int(cy + 7 * math.sin(a))
    d.point((tx, ty), fill=(220, 220, 230))

# Empty slots for more traps
for slot_x in [48, 64, 80]:
    # Placeholder - crosshatch pattern
    for py in range(32, 48, 3):
        d.line([(slot_x, py), (slot_x + 15, py)], fill=(80, 70, 60, 60), width=1)

img.save(os.path.join(OUT, "traps.png"))
print(f"  Saved traps.png ({img.size[0]}x{img.size[1]})")

# ═══════════════════════════════════════════════════════════════════
# 4. ui.png  (128x32) - UI element sprites
# ═══════════════════════════════════════════════════════════════════
print("Generating ui.png ...")
img = Image.new("RGBA", (128, 32), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Gem - yellow diamond (16x16) at (0, 0)
draw_diamond(d, 8, 8, 6, 7, (255, 220, 50))
draw_diamond(d, 8, 8, 4, 5, (255, 240, 120))
d.point((6, 5), fill=(255, 255, 200))

# Gem - blue diamond (16x16) at (16, 0)
draw_diamond(d, 24, 8, 6, 7, (50, 120, 255))
draw_diamond(d, 24, 8, 4, 5, (100, 160, 255))
d.point((22, 5), fill=(180, 210, 255))

# Gem - green diamond (16x16) at (32, 0)
draw_diamond(d, 40, 8, 6, 7, (50, 200, 80))
draw_diamond(d, 40, 8, 4, 5, (100, 230, 120))
d.point((38, 5), fill=(180, 255, 200))

# Gem - red diamond (16x16) at (48, 0)
draw_diamond(d, 56, 8, 6, 7, (220, 50, 50))
draw_diamond(d, 56, 8, 4, 5, (255, 100, 100))
d.point((54, 5), fill=(255, 180, 180))

# Heart full (16x16) at (64, 0)
# Simple pixel heart
d.ellipse([66, 2, 72, 8], fill=(220, 40, 40))
d.ellipse([72, 2, 78, 8], fill=(220, 40, 40))
d.polygon([(66, 6), (72, 14), (78, 6)], fill=(220, 40, 40))
d.point((68, 4), fill=(255, 120, 120))

# Heart empty (16x16) at (80, 0)
d.ellipse([82, 2, 88, 8], outline=(220, 40, 40))
d.ellipse([88, 2, 94, 8], outline=(220, 40, 40))
d.polygon([(82, 6), (88, 14), (94, 6)], outline=(220, 40, 40))

# Speed boost icon (16x16) at (96, 0) - blue lightning
d.polygon([(102, 1), (98, 8), (102, 8), (99, 15), (106, 6), (102, 6)], fill=(60, 140, 255))
d.line([(102, 2), (100, 7)], fill=(140, 200, 255), width=1)

# Shield/invincibility icon (16x16) at (112, 0)
d.ellipse([114, 1, 126, 10], fill=(80, 180, 255, 180))
d.polygon([(114, 6), (120, 14), (126, 6)], fill=(80, 180, 255, 180))
d.ellipse([116, 3, 124, 9], fill=(120, 200, 255, 200))

# Row 2: Arrows and indicators
# Arrow left (16x16) at (0, 16)
d.polygon([(2, 24), (10, 18), (10, 30)], fill=(240, 240, 240))

# Arrow right (16x16) at (16, 16)
d.polygon([(30, 24), (22, 18), (22, 30)], fill=(240, 240, 240))

# Arrow up (16x16) at (32, 16)
d.polygon([(40, 18), (34, 26), (46, 26)], fill=(240, 240, 240))

# Arrow down (16x16) at (48, 16)
d.polygon([(56, 30), (50, 22), (62, 22)], fill=(240, 240, 240))

# Combo x2 (16x16) at (64, 16)
# Simple "x2" text representation
d.rectangle([66, 18, 78, 30], fill=(255, 180, 30, 180))
d.line([(68, 20), (70, 28)], fill=(255, 255, 255), width=1)
d.line([(70, 20), (68, 28)], fill=(255, 255, 255), width=1)
d.rectangle([72, 20, 76, 22], fill=(255, 255, 255))
d.rectangle([74, 22, 76, 26], fill=(255, 255, 255))
d.rectangle([72, 26, 76, 28], fill=(255, 255, 255))

# Warning icon (16x16) at (80, 16)
d.polygon([(88, 17), (82, 31), (94, 31)], fill=(255, 200, 0))
d.polygon([(88, 19), (83, 30), (93, 30)], fill=(255, 220, 50))
d.rectangle([87, 22, 89, 27], fill=(40, 40, 40))
d.rectangle([87, 29, 89, 30], fill=(40, 40, 40))

# Coin/score icon (16x16) at (96, 16)
d.ellipse([98, 18, 110, 30], fill=(255, 200, 50))
d.ellipse([100, 20, 108, 28], fill=(255, 220, 80))
d.rectangle([103, 21, 105, 27], fill=(200, 160, 40))

# Distance icon (16x16) at (112, 16)
d.rectangle([114, 20, 126, 28], fill=(100, 180, 100))
d.polygon([(120, 17), (126, 24), (120, 24)], fill=(100, 180, 100))
d.line([(115, 24), (125, 24)], fill=(140, 220, 140), width=1)

img.save(os.path.join(OUT, "ui.png"))
print(f"  Saved ui.png ({img.size[0]}x{img.size[1]})")

print("\nAll placeholder sprites generated successfully!")
