# 精灵图格式对比研究

## 我们的格式 (Mote)

```json
{
  "id": "sheet_xxx",
  "name": "tiny-dungeon",
  "image": "tiny-dungeon.png",
  "slicing": {
    "mode": "grid",
    "tileWidth": 16,
    "tileHeight": 16
  },
  "frames": [
    {"id": "frame_0", "x": 0, "y": 0, "w": 16, "h": 16},
    {"id": "frame_1", "x": 16, "y": 0, "w": 16, "h": 16, "collider": [{"type": "full"}]}
  ]
}
```

**特点：**
- 使用数组存储 frames
- 每帧有唯一的 `id`
- `slicing` 描述切片方式（grid/packed/xml/manual）
- `collider` 支持碰撞体数据
- 相对路径引用图片

---

## 1. TexturePacker (行业标准)

### Hash 格式（默认）

```json
{
  "frames": {
    "player_01.png": {
      "frame": {"x": 0, "y": 0, "w": 32, "h": 32},
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": {"x": 0, "y": 0, "w": 32, "h": 32},
      "sourceSize": {"w": 32, "h": 32}
    },
    "player_02.png": {
      "frame": {"x": 32, "y": 0, "w": 32, "h": 32},
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": {"x": 0, "y": 0, "w": 32, "h": 32},
      "sourceSize": {"w": 32, "h": 32}
    }
  },
  "meta": {
    "app": "TexturePacker",
    "version": "1.0",
    "image": "sprites.png",
    "format": "RGBA8888",
    "size": {"w": 128, "h": 128},
    "scale": "1"
  }
}
```

### Array 格式

```json
{
  "frames": [
    {
      "filename": "player_01.png",
      "frame": {"x": 0, "y": 0, "w": 32, "h": 32},
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": {"x": 0, "y": 0, "w": 32, "h": 32},
      "sourceSize": {"w": 32, "h": 32}
    }
  ],
  "meta": {
    "image": "sprites.png",
    "size": {"w": 128, "h": 128}
  }
}
```

**对比我们的格式：**

| 特性 | TexturePacker | Mote |
|------|---------------|------|
| frames 结构 | 对象(hash)或数组 | 数组 |
| 帧标识 | 文件名作为 key | `id` 字段 |
| 图片路径 | `meta.image` | 顶层 `image` |
| 旋转信息 | `rotated` + `frame`尺寸交换 | 可选 `rotated` |
| 修剪信息 | `trimmed` + `spriteSourceSize` | 可选 `trimmed` + `offsetX/Y` |
| 碰撞数据 | ❌ 不支持 | ✅ `collider` |
| 标签 | ❌ 不支持 | ✅ `tags` |

**结论：** 我们的格式是 TexturePacker 的超集，增加了碰撞体和标签

---

## 2. Tiled (瓦片图编辑器)

### Tileset JSON 格式

```json
{
  "columns": 12,
  "image": "tileset.png",
  "imageheight": 128,
  "imagewidth": 192,
  "margin": 0,
  "name": "tileset",
  "spacing": 0,
  "tilecount": 96,
  "tileheight": 16,
  "tilewidth": 16,
  "tiles": [
    {
      "id": 0,
      "properties": [
        {"name": "solid", "type": "bool", "value": true}
      ]
    },
    {
      "id": 1,
      "animation": [
        {"duration": 100, "tileid": 1},
        {"duration": 100, "tileid": 2}
      ]
    }
  ]
}
```

**对比我们的格式：**

| 特性 | Tiled | Mote |
|------|-------|------|
| 切片方式 | 仅网格 (columns + tilecount) | grid/packed/xml/manual |
| 帧标识 | 数字 `id` (从0开始) | 字符串 `id` |
| 位置计算 | 从 id + columns 推导 | 显式 `x`, `y` |
| 碰撞数据 | 通过 properties | 显式 `collider` 形状 |
| 动画 | ✅ 支持 | ❌ 暂不支持 |
| 自定义属性 | ✅ properties 数组 | ✅ `properties` 对象 |

**结论：** Tiled 专为瓦片图设计，我们支持更通用的精灵图（packed 等）

---

## 3. Godot 引擎

### SpriteFrames (tres 格式)

```ini
[gd_resource type="SpriteFrames" load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://sprites.png" id="1"]

[resource]
animations = [{
"frames": [{
  "duration": 1.0,
  "texture": ExtResource("1"),
  "region": Rect2(0, 0, 32, 32)
}, {
  "duration": 1.0,
  "texture": ExtResource("1"),
  "region": Rect2(32, 0, 32, 32)
}],
"loop": true,
"name": &"walk",
"speed": 5.0
}]
```

### AtlasTexture

```ini
[gd_resource type="AtlasTexture" load_steps=2 format=3]

[ext_resource type="Texture2D" uid="uid://xxx" path="res://sheet.png" id="1"]

[resource]
atlas = ExtResource("1")
region = Rect2(0, 0, 32, 32)
```

**对比我们的格式：**

| 特性 | Godot | Mote |
|------|-------|------|
| 格式 | 自定义 .tres (类INI) | JSON |
| 动画组织 | 按 `animations` 分组 | 平面 frames 数组 |
| 资源引用 | `res://` 路径 + UID | 相对路径 |
| 运行时友好 | ✅ 直接加载 | ⚠️ 需要解析 |
| 人类可读 | ⚠️ 一般 | ✅ 好 |

**结论：** Godot 格式偏向引擎内部使用，我们是通用的中间格式

---

## 4. LDtk (现代关卡编辑器)

### Tileset 定义

```json
{
  "identifier": "Dungeon_Tiles",
  "uid": 1,
  "relPath": "../tiles.png",
  "embedAtlas": null,
  "pxWid": 192,
  "pxHei": 128,
  "tileGridSize": 16,
  "spacing": 0,
  "padding": 0,
  "tags": ["wall", "floor"],
  "tagsSourceEnumUid": null,
  "enumTags": [
    {"enumValueId": "Solid", "tileIds": [0, 1, 2]},
    {"enumValueId": "Breakable", "tileIds": [10, 11]}
  ],
  "customData": [
    {"tileId": 0, "data": "{\"hp\": 100}"}
  ]
}
```

**对比我们的格式：**

| 特性 | LDtk | Mote |
|------|------|------|
| 网格切片 | ✅ tileGridSize | ✅ slicing.tileWidth/Height |
| 标签系统 | enumTags (按类型分组) | 每帧独立 tags 数组 |
| 自定义数据 | customData (字符串) | properties (结构化对象) |
| 碰撞 | 通过 enum 暗示 | 显式 collider 形状 |
| 相对路径 | relPath | image |

**结论：** LDtk 偏向关卡设计，我们偏向精灵图元数据

---

## 5. PixiJS / Phaser (游戏框架)

### PixiJS Spritesheet JSON

```json
{
  "frames": {
    "frame_0": {
      "frame": {"x": 0, "y": 0, "w": 32, "h": 32},
      "spriteSourceSize": {"x": 0, "y": 0, "w": 32, "h": 32},
      "sourceSize": {"w": 32, "h": 32}
    }
  },
  "meta": {
    "image": "sheet.png",
    "scale": "1",
    "format": "RGBA8888"
  }
}
```

**对比：** 几乎和 TexturePacker 格式相同

---

## 6. Spine (骨骼动画)

```json
{
  "skeleton": {
    "hash": "xxx",
    "spine": "4.0",
    "images": "./images/"
  },
  "bones": [...],
  "slots": [...],
  "skins": [{
    "name": "default",
    "attachments": {
      "head": {
        "head_01": {"x": 0, "y": 0, "width": 64, "height": 64}
      }
    }
  }]
}
```

**结论：** Spine 是完整的骨骼动画系统，我们只做静态精灵图

---

## 综合对比表

| 工具 | 格式 | frames 结构 | 图片路径 | 碰撞 | 标签 | 动画 |
|------|------|-------------|----------|------|------|------|
| **Mote** | JSON | Array (含 id) | 相对路径 | ✅ 形状 | ✅ 每帧 | ❌ |
| TexturePacker | JSON | Object/Array | `meta.image` | ❌ | ❌ | ❌ |
| Tiled | JSON | 隐式网格 | 顶层 | ⚠️ 属性 | ✅ 属性 | ✅ 帧动画 |
| Godot | .tres | 分组动画 | `res://` | ✅ 资源 | ✅ 节点 | ✅ 状态机 |
| LDtk | JSON | 隐式网格 | `relPath` | ⚠️ enum | ✅ 分组 | ❌ |
| PixiJS | JSON | Object | `meta.image` | ❌ | ❌ | ❌ |

---

## 我们的格式是独创的吗？

### ✅ 独创的部分

1. **slicing 字段** - 描述切片方式（grid/packed/xml/manual）
   - TexturePacker 没有这个概念，它只输出 packed 结果
   - Tiled 只有网格切片

2. **collider 形状数据** - 支持矩形、圆形、多边形、斜坡
   - 其他工具要么不支持，要么只支持简单碰撞盒

3. **每帧独立 tags** - 灵活的标签系统
   - LDtk 是分组标签，我们是每帧独立

### ⚠️ 借鉴的部分

1. **整体结构** - 参考了 TexturePacker
   - `image` + `frames` 的基本结构

2. **坐标字段** - x, y, w, h
   - 行业标准命名

3. **trimmed/rotated** - 参考 TexturePacker
   - 支持 trimmed 精灵和旋转

### 📊 独特性评分

| 方面 | 独创性 | 说明 |
|------|--------|------|
| slicing 概念 | ⭐⭐⭐⭐⭐ | 我们的特色 |
| collider 数据 | ⭐⭐⭐⭐⭐ | 其他工具没有 |
| frames 数组 | ⭐⭐⭐ | 可选，TexturePacker 也支持 |
| 整体结构 | ⭐⭐ | 参考行业标准 |
| 字段命名 | ⭐ | 行业标准 |

---

## 建议

### 与行业标准对齐的地方

1. **考虑支持 TexturePacker 格式导出**
   - 方便与现有引擎集成
   - PixiJS、Phaser 等框架原生支持

2. **支持 Tiled 格式导出**
   - 瓦片图场景下很有用
   - 大量现有工具和素材

### 保持独创的地方

1. **collider 系统** - 这是我们的核心竞争力
2. **slicing 元数据** - 保留原始切片信息很有用
3. **tags 系统** - 比简单的属性更灵活

### 改进建议

```json
// 当前格式（保留）
{
  "slicing": { "mode": "grid", "tileWidth": 16, ... },
  "frames": [...]
}

// 增加兼容模式导出（TexturePacker 风格）
{
  "meta": {
    "app": "Mote",
    "format": "RGBA8888",
    "image": "sheet.png",
    "mote": { "slicing": { "mode": "grid" } }  // 嵌入扩展数据
  },
  "frames": { "frame_0": { "frame": { "x": 0, ... } } }
}
```
