# 多图集关卡设计研究

## 问题场景

一个地牢关卡需要同时使用多个精灵图集：
- 图集A：墙壁和地板（32个图块）
- 图集B：装饰物（花盆、火把等，16个图块）
- 图集C：敌人精灵（8个动画序列）

关键设计问题：
1. Tile 地图数据如何存储对图集的引用？
2. 渲染时如何高效批次处理？
3. 编辑器如何支持多图集操作？

---

## 方案对比

### 方案 1：全局唯一 ID（不推荐）

```typescript
// 每个 frame 分配全局唯一 ID
tile.frameId = "dungeon_walls_frame_5"  // 包含图集名称

// 问题：
// - ID 冗长
// - 需要全局注册表
// - 图集修改后 ID 可能变化
```

**评估：** ❌ 放弃。维护成本高，不适合运行时。

---

### 方案 2：Layer 级图集绑定（推荐）✅

```typescript
interface TileLayer {
  spriteSheet: string      // 图集引用："walls"
  // 数据存储本地索引（0, 1, 2...）
  data: number[]          // 每个 tile 存的是图集内的索引
}

interface Scene {
  spriteSheets: string[]   // ["walls", "decorations", "enemies"]
  layers: TileLayer[]
}
```

**优点：**
- 数据紧凑（存数字比字符串小）
- 图集可独立修改
- 渲染时按图集分组批次
- 实现简单

**缺点：**
- 一个 layer 只能用一个图集

**缓解：** 99% 的场景够用，特殊需求用多个 layer。

---

### 方案 3：Tile 级混合引用（更灵活）

```typescript
interface Tile {
  sheetId: string    // "walls"
  frameIndex: number // 5
}

// 紧凑存储变体
interface TileLayer {
  spriteSheet: string     // 默认图集
  data: number[]          // 默认图集的帧索引
  
  // 偶尔使用的其他图集
  overrides: Array<{
    index: number
    sheetId: string
    frameIndex: number
  }>
}
```

**优点：** 单个 layer 可使用多个图集

**缺点：** 数据复杂，渲染批次碎片化

---

## 推荐的运行时设计

### 场景（关卡）结构

```typescript
// JSON 序列化格式
interface SceneJson {
  id: string
  name: string
  width: number      // 地图宽（tile 单位）
  height: number     // 地图高（tile 单位）
  
  // 引用的所有图集
  spriteSheets: Array<{
    id: string       // "walls"
    path: string     // "assets/walls.mote-sprite.json"
  }>
  
  // 图层
  layers: TileLayerJson[]
}

interface TileLayerJson {
  id: string
  name: string       // "地面层"
  visible: boolean
  opacity: number
  
  // 关键：指定使用哪个图集
  spriteSheet: string // "walls"
  
  // 瓦片数据（一维数组，row-major）
  // 值为图集内的 frame 索引，-1 表示空
  data: number[]
}

// 运行时内存结构
interface SceneRuntime {
  spriteSheets: Map<string, SpriteSheet>
  layers: TileLayerRuntime[]
}

interface TileLayerRuntime {
  spriteSheet: SpriteSheet  // 直接引用
  data: Int16Array
  batches: RenderBatch[]    // GPU 批次数据（预计算）
}
```

---

## 渲染批次优化

### 按图集分组渲染

```typescript
class TileMapRenderer {
  render(scene: SceneRuntime) {
    // 按 spriteSheet 分组，减少纹理切换
    const layersBySheet = groupBy(scene.layers, l => l.spriteSheet.id)
    
    for (const [sheetId, layers] of layersBySheet) {
      const sheet = scene.spriteSheets.get(sheetId)!
      
      // 绑定图集纹理（一次）
      bindTexture(sheet.texture)
      
      for (const layer of layers) {
        if (!layer.visible) continue
        drawInstanced(layer.batches)
      }
    }
  }
}
```

### 预计算批次

```typescript
interface RenderBatch {
  spriteSheet: string
  vertexData: Float32Array  // 预计算的顶点
  indexCount: number
}

// 加载场景时生成
function generateBatches(layer: TileLayer, sheet: SpriteSheet): RenderBatch[] {
  // 遍历 layer.data，生成顶点数据
  // 合并相邻的相同图集 tiles
}
```

---

## 编辑器设计

### UX 流程

```
1. 选择 Layer
2. 该 Layer 绑定一个图集（下拉选择）
3. 笔刷工具显示该图集的所有 frames
4. 点击地图放置（存储 frameIndex）
```

### 代码实现

```typescript
class TileMapEditor {
  activeLayer: TileLayer
  selectedSpriteSheet: SpriteSheet
  
  setActiveLayer(layer: TileLayer) {
    this.activeLayer = layer
    this.selectedSpriteSheet = getSpriteSheet(layer.spriteSheet)
    
    // 更新笔刷面板，显示该图集的 frames
    brushPanel.showFrames(this.selectedSpriteSheet.frames)
  }
  
  paintTile(x: number, y: number, frameIndex: number) {
    const index = y * this.activeLayer.width + x
    this.activeLayer.data[index] = frameIndex
  }
}
```

---

## 关键设计决策

### 1. 存储粒度选择

| 方案 | 存储 | 优点 | 缺点 |
|------|------|------|------|
| **Layer 级绑定** | 一个 layer 一个图集 | 简单、渲染高效 | 同 layer 不能用多个图集 |
| **Tile 级引用** | 每个 tile 存 sheetId | 灵活 | 数据膨胀、渲染复杂 |

**决策：** 采用 Layer 级绑定。

理由：
- 99% 的场景够用
- 特殊情况（如地面+装饰）用两个 layer 叠加
- 渲染批次最优化

### 2. 瓦片数据格式

```typescript
// 推荐：Int16Array（紧凑高效）
interface TileLayer {
  data: Int16Array
  // -1 = 空
  // 0~32767 = 图集内的 frame 索引
}

// 扩展：flags 单独存储（如需翻转/旋转）
interface TileLayerWithFlags {
  data: Int16Array          // frame 索引
  flags?: Uint8Array        // 翻转、旋转等
}
```

### 3. 图集加载策略

```typescript
// 懒加载：只加载关卡需要的图集
async function loadScene(scenePath: string): Promise<SceneRuntime> {
  const sceneJson: SceneJson = await fetch(scenePath).then(r => r.json())
  
  // 并发加载所有引用的图集
  const sheetPromises = sceneJson.spriteSheets.map(async ref => {
    const json = await fetch(ref.path).then(r => r.json())
    return [ref.id, await loadSpriteSheet(json)] as const
  })
  
  const sheets = await Promise.all(sheetPromises)
  const sheetMap = new Map<string, SpriteSheet>(sheets)
  
  // 构建运行时结构
  return {
    spriteSheets: sheetMap,
    layers: sceneJson.layers.map(l => ({
      ...l,
      spriteSheet: sheetMap.get(l.spriteSheet)!,
      data: new Int16Array(l.data)
    }))
  }
}
```

---

## 完整示例

```json
{
  "id": "dungeon_01",
  "name": "地牢第一层",
  "width": 20,
  "height": 15,
  
  "spriteSheets": [
    { "id": "walls", "path": "assets/walls.mote-sprite.json" },
    { "id": "decor", "path": "assets/decorations.mote-sprite.json" },
    { "id": "enemies", "path": "assets/enemies.mote-sprite.json" }
  ],
  
  "layers": [
    {
      "id": "layer_0",
      "name": "地面",
      "spriteSheet": "walls",
      "visible": true,
      "opacity": 1,
      "data": [0, 0, 0, 1, 1, 1, 0, 0, -1, ...]
    },
    {
      "id": "layer_1",
      "name": "墙壁",
      "spriteSheet": "walls",
      "visible": true,
      "opacity": 1,
      "data": [-1, -1, 10, 10, 10, -1, ...]
    },
    {
      "id": "layer_2",
      "name": "装饰",
      "spriteSheet": "decor",
      "visible": true,
      "opacity": 1,
      "data": [-1, -1, 3, -1, -1, 5, ...]
    }
  ]
}
```

---

## 总结

### 核心设计原则

| 原则 | 说明 |
|------|------|
| **Layer 绑定图集** | 一个 layer 使用一个图集，简化渲染和数据 |
| **数字索引存储** | 用 Int16Array 存 frame 索引，紧凑高效 |
| **引用而非嵌入** | 场景存图集 ID 和路径，不嵌入完整数据 |
| **预计算批次** | 加载时生成渲染批次，运行时直接提交 |

### 架构图

```
Scene (关卡)
├── spriteSheets: Map<id, SpriteSheet>  // 加载的图集
└── layers: TileLayer[]
    ├── spriteSheet: string (引用 id)
    └── data: Int16Array (frame 索引)
```

### 支持的特性

- ✅ 多图集关卡
- ✅ 高效的 Tile 渲染（按图集批次）
- ✅ 灵活的图层系统（显隐、透明度）
- ✅ 增量加载（只加载可见区域的图集）
- ✅ 编辑器友好（Layer 级操作直观）

---

## 相关文档/

- `sprite-format-comparison.md` - 精灵图格式对比
- `sprite-export-path-research.md` - 导出路径设计
