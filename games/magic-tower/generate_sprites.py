#!/usr/bin/env python3
"""Generate placeholder sprite sheet PNGs for Magic Tower."""
from PIL import Image, ImageDraw
import os

BASE = os.path.join(os.path.dirname(__file__), 'images')
os.makedirs(BASE, exist_ok=True)
S = 16  # sprite size

def px(draw, x, y, color):
    """Draw a single pixel."""
    draw.point((x, y), fill=color)

def rect(draw, x, y, w, h, color):
    """Draw a filled rectangle."""
    draw.rectangle([x, y, x+w-1, y+h-1], fill=color)

def border(draw, x, y, w, h, color, fill=None):
    """Draw a rectangle outline."""
    draw.rectangle([x, y, x+w-1, y+h-1], outline=color, fill=fill)

def sprite_at(draw, col, row):
    """Return top-left coords for grid position."""
    return col * S, row * S

# ========== tower-tiles.png (128x128) ==========
img = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Row 0: floor_stone, floor_dark, wall_gray, wall_dark, door_yellow, door_blue, door_red, door_open
# floor_stone - beige
x, y = sprite_at(d, 0, 0)
rect(d, x, y, S, S, (210, 190, 150))
for i in range(0, S, 4):
    for j in range(0, S, 4):
        px(d, x+i, y+j, (190, 170, 130))

# floor_dark - dark brown
x, y = sprite_at(d, 1, 0)
rect(d, x, y, S, S, (80, 60, 40))
for i in range(0, S, 4):
    for j in range(2, S, 4):
        px(d, x+i, y+j, (60, 45, 30))

# wall_gray - gray brick pattern
x, y = sprite_at(d, 2, 0)
rect(d, x, y, S, S, (140, 140, 140))
for row_i in range(0, S, 4):
    offset = 4 if (row_i // 4) % 2 else 0
    d.line([(x, y+row_i), (x+S-1, y+row_i)], fill=(100, 100, 100))
    for col_i in range(offset, S, 8):
        d.line([(x+col_i, y+row_i), (x+col_i, y+row_i+3)], fill=(100, 100, 100))

# wall_dark - dark gray
x, y = sprite_at(d, 3, 0)
rect(d, x, y, S, S, (80, 80, 90))
for row_i in range(0, S, 4):
    offset = 4 if (row_i // 4) % 2 else 0
    d.line([(x, y+row_i), (x+S-1, y+row_i)], fill=(50, 50, 60))
    for col_i in range(offset, S, 8):
        d.line([(x+col_i, y+row_i), (x+col_i, y+row_i+3)], fill=(50, 50, 60))

# door_yellow - gold door
x, y = sprite_at(d, 4, 0)
rect(d, x, y, S, S, (200, 170, 50))
border(d, x+1, y+1, S-2, S-2, (160, 130, 30))
rect(d, x+3, y+3, S-6, S-6, (220, 190, 70))
px(d, x+10, y+8, (160, 130, 30))  # keyhole

# door_blue - blue door
x, y = sprite_at(d, 5, 0)
rect(d, x, y, S, S, (50, 100, 200))
border(d, x+1, y+1, S-2, S-2, (30, 70, 160))
rect(d, x+3, y+3, S-6, S-6, (70, 120, 220))
px(d, x+10, y+8, (30, 70, 160))

# door_red - red door
x, y = sprite_at(d, 6, 0)
rect(d, x, y, S, S, (200, 50, 50))
border(d, x+1, y+1, S-2, S-2, (160, 30, 30))
rect(d, x+3, y+3, S-6, S-6, (220, 70, 70))
px(d, x+10, y+8, (160, 30, 30))

# door_open - empty/dark
x, y = sprite_at(d, 7, 0)
rect(d, x, y, S, S, (40, 30, 30))

# Row 1: pillar, torch, flag, banner, floor_fancy, floor_moss, wall_crack, wall_vine
# pillar
x, y = sprite_at(d, 0, 1)
rect(d, x, y, S, S, (210, 190, 150))
rect(d, x+5, y+1, 6, 14, (180, 180, 180))
rect(d, x+4, y+0, 8, 2, (200, 200, 200))
rect(d, x+4, y+13, 8, 3, (200, 200, 200))

# torch
x, y = sprite_at(d, 1, 1)
rect(d, x, y, S, S, (40, 30, 30))
rect(d, x+6, y+6, 4, 8, (120, 80, 40))
rect(d, x+5, y+2, 6, 5, (255, 160, 30))
rect(d, x+6, y+1, 4, 3, (255, 220, 50))
px(d, x+7, y+0, (255, 255, 100))

# flag
x, y = sprite_at(d, 2, 1)
rect(d, x, y, S, S, (210, 190, 150))
d.line([(x+4, y+2), (x+4, y+14)], fill=(100, 80, 60))
rect(d, x+5, y+2, 8, 6, (220, 40, 40))

# banner
x, y = sprite_at(d, 3, 1)
rect(d, x, y, S, S, (210, 190, 150))
d.line([(x+3, y+1), (x+12, y+1)], fill=(100, 80, 60))
rect(d, x+4, y+2, 8, 10, (140, 50, 160))
# pointed bottom
for i in range(3):
    d.line([(x+4+i, y+12+i), (x+11-i, y+12+i)], fill=(140, 50, 160))

# floor_fancy - checkered
x, y = sprite_at(d, 4, 1)
for i in range(0, S, 4):
    for j in range(0, S, 4):
        c = (220, 200, 170) if ((i+j)//4) % 2 == 0 else (190, 170, 140)
        rect(d, x+i, y+j, 4, 4, c)

# floor_moss - green-tinted
x, y = sprite_at(d, 5, 1)
rect(d, x, y, S, S, (160, 180, 140))
for i in range(0, S, 3):
    for j in range(1, S, 5):
        px(d, x+i, y+j, (100, 150, 80))

# wall_crack
x, y = sprite_at(d, 6, 1)
rect(d, x, y, S, S, (140, 140, 140))
d.line([(x+3, y+2), (x+7, y+6), (x+5, y+10), (x+9, y+14)], fill=(90, 90, 90))

# wall_vine
x, y = sprite_at(d, 7, 1)
rect(d, x, y, S, S, (140, 140, 140))
d.line([(x+2, y+0), (x+4, y+5), (x+3, y+10), (x+5, y+15)], fill=(50, 130, 50))
px(d, x+3, y+3, (70, 160, 70))
px(d, x+5, y+7, (70, 160, 70))
px(d, x+2, y+11, (70, 160, 70))

# Row 2: stair_up, stair_down, lava, teleport_pad, hidden_wall, trigger_wall, cracked_wall, floor_special
# stair_up
x, y = sprite_at(d, 0, 2)
rect(d, x, y, S, S, (210, 190, 150))
for i in range(4):
    rect(d, x+2, y+12-i*3, 12, 3, (180-i*20, 170-i*20, 140-i*20))
# up arrow
px(d, x+7, y+2, (255, 255, 255))
d.line([(x+6, y+3), (x+8, y+3)], fill=(255, 255, 255))
d.line([(x+5, y+4), (x+9, y+4)], fill=(255, 255, 255))

# stair_down
x, y = sprite_at(d, 1, 2)
rect(d, x, y, S, S, (210, 190, 150))
for i in range(4):
    rect(d, x+2, y+1+i*3, 12, 3, (180-i*20, 170-i*20, 140-i*20))
# down arrow
d.line([(x+5, y+11), (x+9, y+11)], fill=(255, 255, 255))
d.line([(x+6, y+12), (x+8, y+12)], fill=(255, 255, 255))
px(d, x+7, y+13, (255, 255, 255))

# lava
x, y = sprite_at(d, 2, 2)
rect(d, x, y, S, S, (200, 60, 20))
for i in range(0, S, 3):
    for j in range(0, S, 3):
        c = [(255, 100, 30), (255, 160, 50), (220, 80, 20)][(i+j)%3]
        px(d, x+i, y+j, c)
# bright spots
px(d, x+4, y+4, (255, 220, 80))
px(d, x+10, y+8, (255, 220, 80))
px(d, x+7, y+12, (255, 200, 60))

# teleport_pad
x, y = sprite_at(d, 3, 2)
rect(d, x, y, S, S, (40, 20, 60))
for r in range(7, 0, -2):
    c = (100+r*15, 50+r*10, 180+r*8)
    d.ellipse([x+8-r, y+8-r, x+8+r, y+8+r], outline=c)
px(d, x+8, y+8, (220, 180, 255))

# hidden_wall
x, y = sprite_at(d, 4, 2)
rect(d, x, y, S, S, (145, 145, 145))
for row_i in range(0, S, 4):
    offset = 4 if (row_i // 4) % 2 else 0
    d.line([(x, y+row_i), (x+S-1, y+row_i)], fill=(105, 105, 105))

# trigger_wall
x, y = sprite_at(d, 5, 2)
rect(d, x, y, S, S, (140, 140, 140))
# X mark
d.line([(x+4, y+4), (x+11, y+11)], fill=(180, 140, 50))
d.line([(x+11, y+4), (x+4, y+11)], fill=(180, 140, 50))

# cracked_wall
x, y = sprite_at(d, 6, 2)
rect(d, x, y, S, S, (140, 140, 140))
d.line([(x+8, y+1), (x+6, y+5), (x+9, y+8), (x+7, y+12), (x+10, y+15)], fill=(80, 80, 80))
d.line([(x+5, y+6), (x+8, y+9)], fill=(80, 80, 80))

# floor_special - gold-tinted
x, y = sprite_at(d, 7, 2)
rect(d, x, y, S, S, (220, 200, 130))
for i in range(0, S, 4):
    for j in range(0, S, 4):
        px(d, x+i+1, y+j+1, (240, 220, 150))

img.save(os.path.join(BASE, 'tower-tiles.png'))
print("Created tower-tiles.png")


# ========== characters.png (128x64) ==========
img = Image.new('RGBA', (128, 64), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

def draw_humanoid(d, x, y, body_color, head_color=None, eye_color=(255,255,255)):
    """Draw a simple humanoid sprite at (x,y) with 16x16 size."""
    if head_color is None:
        head_color = (240, 200, 160)
    # head
    rect(d, x+5, y+1, 6, 5, head_color)
    # eyes
    px(d, x+6, y+3, eye_color)
    px(d, x+9, y+3, eye_color)
    # body
    rect(d, x+4, y+6, 8, 6, body_color)
    # legs
    rect(d, x+5, y+12, 3, 3, body_color)
    rect(d, x+9, y+12, 3, 3, body_color)

def draw_blob(d, x, y, color, eye_color=(255,255,255)):
    """Draw a blob/slime creature."""
    rect(d, x+3, y+6, 10, 8, color)
    rect(d, x+4, y+4, 8, 2, color)
    rect(d, x+5, y+3, 6, 1, color)
    # bottom rounded
    rect(d, x+2, y+12, 12, 2, color)
    # eyes
    px(d, x+5, y+7, eye_color)
    px(d, x+9, y+7, eye_color)
    # mouth
    px(d, x+7, y+9, (0, 0, 0))

# Row 0: player directions
# player_down - green tunic
x, y = sprite_at(d, 0, 0)
draw_humanoid(d, x, y, (60, 160, 60))
# sword hint
px(d, x+12, y+8, (200, 200, 200))
px(d, x+12, y+7, (200, 200, 200))

# player_up
x, y = sprite_at(d, 1, 0)
rect(d, x+5, y+1, 6, 5, (240, 200, 160))
rect(d, x+4, y+6, 8, 6, (60, 160, 60))
rect(d, x+5, y+12, 3, 3, (60, 160, 60))
rect(d, x+9, y+12, 3, 3, (60, 160, 60))

# player_left
x, y = sprite_at(d, 2, 0)
draw_humanoid(d, x, y, (60, 160, 60))
# only left eye
rect(d, x+6, y+3, 1, 1, (0,0,0,0))
px(d, x+6, y+3, (255, 255, 255))

# player_right
x, y = sprite_at(d, 3, 0)
draw_humanoid(d, x, y, (60, 160, 60))
rect(d, x+9, y+3, 1, 1, (0,0,0,0))
px(d, x+9, y+3, (255, 255, 255))

# Row 1: monsters
monsters_r1 = [
    ("slime_green", lambda d,x,y: draw_blob(d,x,y,(50,200,50))),
    ("slime_red",   lambda d,x,y: draw_blob(d,x,y,(220,50,50))),
]

# slime_green
x, y = sprite_at(d, 0, 1)
draw_blob(d, x, y, (50, 200, 50))

# slime_red
x, y = sprite_at(d, 1, 1)
draw_blob(d, x, y, (220, 50, 50))

# bat - dark purple wings
x, y = sprite_at(d, 2, 1)
rect(d, x+6, y+5, 4, 4, (100, 40, 120))
# wings
rect(d, x+1, y+4, 5, 5, (80, 30, 100))
rect(d, x+10, y+4, 5, 5, (80, 30, 100))
# eyes
px(d, x+7, y+6, (255, 50, 50))
px(d, x+9, y+6, (255, 50, 50))

# skeleton - white bones
x, y = sprite_at(d, 3, 1)
draw_humanoid(d, x, y, (220, 220, 220), head_color=(240, 240, 240), eye_color=(0,0,0))

# skeleton_warrior - gray armored
x, y = sprite_at(d, 4, 1)
draw_humanoid(d, x, y, (160, 160, 170), head_color=(240, 240, 240), eye_color=(255,0,0))
px(d, x+13, y+7, (180, 180, 180))  # sword

# mage - blue robed
x, y = sprite_at(d, 5, 1)
draw_humanoid(d, x, y, (50, 80, 200), head_color=(240, 200, 160))
# hat
rect(d, x+5, y+0, 6, 2, (50, 80, 200))
px(d, x+7, y+0, (255, 255, 100))  # hat tip star

# orc - brown/green
x, y = sprite_at(d, 6, 1)
draw_humanoid(d, x, y, (100, 70, 40), head_color=(100, 140, 80), eye_color=(255,0,0))

# orc_captain - dark brown, bigger
x, y = sprite_at(d, 7, 1)
draw_humanoid(d, x, y, (70, 50, 30), head_color=(80, 120, 60), eye_color=(255,50,0))
# helmet
rect(d, x+5, y+0, 6, 2, (120, 100, 50))

# Row 2: more monsters
# great_mage - purple
x, y = sprite_at(d, 0, 2)
draw_humanoid(d, x, y, (120, 40, 160), head_color=(240, 200, 160))
rect(d, x+5, y+0, 6, 2, (120, 40, 160))
px(d, x+7, y+0, (255, 200, 255))

# dark_knight - dark blue/black
x, y = sprite_at(d, 1, 2)
draw_humanoid(d, x, y, (30, 30, 80), head_color=(50, 50, 80), eye_color=(255, 50, 50))
rect(d, x+5, y+0, 6, 2, (40, 40, 90))

# spirit - white translucent
x, y = sprite_at(d, 2, 2)
rect(d, x+4, y+2, 8, 10, (220, 220, 255, 150))
rect(d, x+5, y+1, 6, 2, (240, 240, 255, 180))
px(d, x+6, y+5, (100, 100, 200))
px(d, x+9, y+5, (100, 100, 200))
# wavy bottom
for i in range(4):
    px(d, x+4+i*2, y+12, (220, 220, 255, 120))

# vampire - dark red
x, y = sprite_at(d, 3, 2)
draw_humanoid(d, x, y, (100, 20, 30), head_color=(200, 180, 170), eye_color=(255, 0, 0))
# cape
rect(d, x+2, y+5, 2, 8, (80, 10, 20))
rect(d, x+12, y+5, 2, 8, (80, 10, 20))

# dragon - red, bigger shape
x, y = sprite_at(d, 4, 2)
rect(d, x+3, y+4, 10, 8, (220, 50, 30))
rect(d, x+5, y+2, 6, 3, (220, 50, 30))
# wings
rect(d, x+0, y+3, 4, 6, (200, 40, 20))
rect(d, x+12, y+3, 4, 6, (200, 40, 20))
# eyes
px(d, x+6, y+4, (255, 255, 0))
px(d, x+9, y+4, (255, 255, 0))
# belly
rect(d, x+5, y+8, 6, 3, (255, 180, 100))

# demon_lord - black/purple
x, y = sprite_at(d, 5, 2)
draw_humanoid(d, x, y, (60, 20, 80), head_color=(80, 40, 100), eye_color=(255, 0, 0))
# horns
px(d, x+4, y+0, (80, 40, 100))
px(d, x+11, y+0, (80, 40, 100))
# cape
rect(d, x+2, y+5, 2, 8, (40, 10, 60))
rect(d, x+12, y+5, 2, 8, (40, 10, 60))

# Row 3: NPCs
# npc_oldman - brown robe
x, y = sprite_at(d, 0, 3)
draw_humanoid(d, x, y, (140, 100, 60), head_color=(240, 200, 160))
# beard
rect(d, x+6, y+5, 4, 2, (200, 200, 200))

# npc_merchant - gold/rich
x, y = sprite_at(d, 1, 3)
draw_humanoid(d, x, y, (200, 160, 50), head_color=(240, 200, 160))
# hat
rect(d, x+5, y+0, 6, 2, (200, 160, 50))

# npc_thief - dark
x, y = sprite_at(d, 2, 3)
draw_humanoid(d, x, y, (50, 50, 60), head_color=(240, 200, 160))
# mask
rect(d, x+5, y+3, 6, 2, (30, 30, 40))
px(d, x+6, y+3, (255, 255, 255))
px(d, x+9, y+3, (255, 255, 255))

# npc_princess - pink
x, y = sprite_at(d, 3, 3)
draw_humanoid(d, x, y, (255, 150, 180), head_color=(240, 210, 180))
# crown
px(d, x+6, y+0, (255, 215, 0))
px(d, x+8, y+0, (255, 215, 0))
px(d, x+7, y+0, (255, 215, 0))

img.save(os.path.join(BASE, 'characters.png'))
print("Created characters.png")


# ========== items.png (128x32) ==========
img = Image.new('RGBA', (128, 32), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

def draw_key(d, x, y, color):
    """Draw a key shape."""
    # ring
    d.ellipse([x+3, y+2, x+8, y+7], outline=color)
    # shaft
    rect(d, x+8, y+4, 5, 2, color)
    # teeth
    px(d, x+11, y+6, color)
    px(d, x+13, y+6, color)

def draw_potion(d, x, y, liquid_color):
    """Draw a potion flask."""
    # neck
    rect(d, x+6, y+2, 4, 3, (200, 200, 200))
    # cork
    rect(d, x+6, y+1, 4, 2, (140, 100, 60))
    # body
    rect(d, x+4, y+5, 8, 8, (200, 200, 220))
    rect(d, x+5, y+6, 6, 6, liquid_color)
    # bottom
    rect(d, x+4, y+13, 8, 2, (200, 200, 220))

def draw_gem(d, x, y, color):
    """Draw a diamond/gem shape."""
    # diamond shape
    for i in range(5):
        d.line([(x+7-i, y+3+i), (x+8+i, y+3+i)], fill=color)
    for i in range(5):
        d.line([(x+3+i, y+8+i), (x+13-i, y+8+i)], fill=color)
    # highlight
    px(d, x+7, y+5, (255, 255, 255, 180))

# Row 0: keys and consumables
draw_key(d, 0, 0, (220, 190, 50))     # key_yellow
draw_key(d, 16, 0, (50, 100, 220))    # key_blue
draw_key(d, 32, 0, (220, 50, 50))     # key_red

x, y = sprite_at(d, 3, 0)
draw_potion(d, x, y, (220, 50, 50))   # potion_red

x, y = sprite_at(d, 4, 0)
draw_potion(d, x, y, (50, 100, 220))  # potion_blue

x, y = sprite_at(d, 5, 0)
draw_gem(d, x, y, (220, 50, 50))      # gem_red

x, y = sprite_at(d, 6, 0)
draw_gem(d, x, y, (50, 100, 220))     # gem_blue

x, y = sprite_at(d, 7, 0)
draw_gem(d, x, y, (50, 200, 80))      # gem_green

# Row 1: equipment and special items
# sword_iron
x, y = sprite_at(d, 0, 1)
d.line([(x+7, y+2), (x+7, y+10)], fill=(180, 180, 190))
d.line([(x+8, y+2), (x+8, y+10)], fill=(160, 160, 170))
rect(d, x+5, y+10, 6, 2, (140, 100, 40))  # guard
rect(d, x+6, y+12, 4, 3, (100, 70, 30))   # handle

# shield_iron
x, y = sprite_at(d, 1, 1)
rect(d, x+3, y+2, 10, 12, (160, 160, 170))
border(d, x+3, y+2, 10, 12, (120, 120, 130))
rect(d, x+6, y+5, 4, 6, (140, 140, 150))
d.line([(x+4, y+14), (x+7, y+15)], fill=(120, 120, 130))
d.line([(x+12, y+14), (x+8, y+15)], fill=(120, 120, 130))

# sword_holy - gold
x, y = sprite_at(d, 2, 1)
d.line([(x+7, y+1), (x+7, y+10)], fill=(255, 220, 80))
d.line([(x+8, y+1), (x+8, y+10)], fill=(240, 200, 60))
rect(d, x+4, y+10, 8, 2, (200, 160, 40))
rect(d, x+6, y+12, 4, 3, (160, 120, 30))
px(d, x+7, y+1, (255, 255, 200))  # glow

# shield_holy - gold
x, y = sprite_at(d, 3, 1)
rect(d, x+3, y+2, 10, 12, (220, 190, 60))
border(d, x+3, y+2, 10, 12, (180, 150, 40))
rect(d, x+6, y+5, 4, 6, (255, 220, 80))
d.line([(x+4, y+14), (x+7, y+15)], fill=(180, 150, 40))
d.line([(x+12, y+14), (x+8, y+15)], fill=(180, 150, 40))

# cross - white
x, y = sprite_at(d, 4, 1)
rect(d, x+6, y+2, 4, 12, (240, 240, 255))
rect(d, x+3, y+5, 10, 4, (240, 240, 255))
# inner glow
px(d, x+7, y+6, (255, 255, 200))
px(d, x+8, y+6, (255, 255, 200))

# monster_book - brown
x, y = sprite_at(d, 5, 1)
rect(d, x+3, y+2, 10, 12, (140, 90, 40))
rect(d, x+4, y+3, 8, 10, (180, 150, 100))
# spine
rect(d, x+3, y+2, 2, 12, (100, 60, 20))
# eye on cover
px(d, x+8, y+7, (220, 50, 50))

# teleporter_item - purple device
x, y = sprite_at(d, 6, 1)
rect(d, x+4, y+4, 8, 8, (120, 60, 160))
border(d, x+4, y+4, 8, 8, (80, 30, 120))
d.ellipse([x+6, y+6, x+10, y+10], fill=(180, 120, 220))
px(d, x+8, y+8, (255, 200, 255))

# star - yellow
x, y = sprite_at(d, 7, 1)
center_x, center_y = x+8, y+8
# simple star shape
px(d, center_x, y+2, (255, 220, 50))
d.line([(x+3, y+6), (x+13, y+6)], fill=(255, 220, 50))
d.line([(x+4, y+7), (x+12, y+7)], fill=(255, 220, 50))
d.line([(x+5, y+8), (x+11, y+8)], fill=(255, 200, 40))
d.line([(x+4, y+9), (x+12, y+9)], fill=(255, 200, 40))
d.line([(x+3, y+10), (x+5, y+10)], fill=(255, 220, 50))
d.line([(x+11, y+10), (x+13, y+10)], fill=(255, 220, 50))
px(d, x+3, y+12, (255, 220, 50))
px(d, x+13, y+12, (255, 220, 50))
d.line([(center_x-1, y+3), (center_x+1, y+3)], fill=(255, 220, 50))
d.line([(center_x-2, y+4), (center_x+2, y+4)], fill=(255, 220, 50))
d.line([(center_x-3, y+5), (center_x+3, y+5)], fill=(255, 220, 50))

img.save(os.path.join(BASE, 'items.png'))
print("Created items.png")


# ========== ui.png (128x64) ==========
img = Image.new('RGBA', (128, 64), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# heart_full - red heart
x, y = sprite_at(d, 0, 0)
d.ellipse([x+2, y+3, x+7, y+8], fill=(220, 40, 40))
d.ellipse([x+8, y+3, x+13, y+8], fill=(220, 40, 40))
for i in range(6):
    d.line([(x+2+i, y+8), (x+7, y+14-i)], fill=(220, 40, 40))
    d.line([(x+13-i, y+8), (x+8, y+14-i)], fill=(220, 40, 40))
rect(d, x+5, y+6, 6, 4, (220, 40, 40))

# heart_empty - outlined
x, y = sprite_at(d, 1, 0)
d.ellipse([x+2, y+3, x+7, y+8], outline=(150, 40, 40))
d.ellipse([x+8, y+3, x+13, y+8], outline=(150, 40, 40))
d.line([(x+2, y+7), (x+7, y+13)], fill=(150, 40, 40))
d.line([(x+13, y+7), (x+8, y+13)], fill=(150, 40, 40))

# sword_icon
x, y = sprite_at(d, 2, 0)
d.line([(x+7, y+2), (x+7, y+11)], fill=(200, 200, 210))
d.line([(x+8, y+2), (x+8, y+11)], fill=(180, 180, 190))
rect(d, x+5, y+11, 6, 1, (160, 120, 40))
rect(d, x+6, y+12, 4, 2, (120, 80, 30))

# shield_icon
x, y = sprite_at(d, 3, 0)
rect(d, x+4, y+3, 8, 8, (80, 130, 200))
border(d, x+4, y+3, 8, 8, (60, 100, 170))
d.line([(x+5, y+11), (x+7, y+13)], fill=(60, 100, 170))
d.line([(x+11, y+11), (x+8, y+13)], fill=(60, 100, 170))

# coin_icon
x, y = sprite_at(d, 4, 0)
d.ellipse([x+3, y+3, x+12, y+12], fill=(240, 200, 50))
d.ellipse([x+4, y+4, x+11, y+11], outline=(200, 160, 30))
px(d, x+7, y+7, (200, 160, 30))

# key_icon
x, y = sprite_at(d, 5, 0)
draw_key(d, x, y, (220, 190, 50))

# Row 1: arrows, cursor, highlight
# arrow_up
x, y = sprite_at(d, 0, 1)
for i in range(6):
    d.line([(x+7-i, y+4+i), (x+8+i, y+4+i)], fill=(220, 220, 220))

# arrow_down
x, y = sprite_at(d, 1, 1)
for i in range(6):
    d.line([(x+7-i, y+11-i), (x+8+i, y+11-i)], fill=(220, 220, 220))

# arrow_left
x, y = sprite_at(d, 2, 1)
for i in range(6):
    d.line([(x+4+i, y+7-i), (x+4+i, y+8+i)], fill=(220, 220, 220))

# arrow_right
x, y = sprite_at(d, 3, 1)
for i in range(6):
    d.line([(x+11-i, y+7-i), (x+11-i, y+8+i)], fill=(220, 220, 220))

# cursor
x, y = sprite_at(d, 4, 1)
border(d, x+2, y+2, 12, 12, (255, 255, 100), fill=None)
border(d, x+3, y+3, 10, 10, (255, 255, 50), fill=None)

# highlight
x, y = sprite_at(d, 5, 1)
rect(d, x+1, y+1, 14, 14, (255, 255, 255, 60))
border(d, x+1, y+1, 14, 14, (255, 255, 255, 120))

img.save(os.path.join(BASE, 'ui.png'))
print("Created ui.png")

print("\nAll 4 sprite sheet images generated successfully!")
