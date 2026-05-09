因为我没有 tile 的设计，但是我想要有类似 tile 的笔刷工具，方便快速刷地块。也希望有分层的设计，这样我可以区分出远景，背景，碰撞体，动态物体。分析一下这个需求。

---

## 需求拆解

你的场景本质是：**所有东西都是 Entity（包括地块），但需要一个高效的网格画笔来批量铺设，并用分层来组织渲染和逻辑。**

这比传统 Tile Map 简单得多——不需要 `Uint16Array` 批量数据结构，不需要 Tiled 导入器。你需要的是两个东西：

1. **Layer 组件** — 给每个 Entity 打上层标签
2. **Grid Brush 编辑器工具** — 按网格快速刷 Entity

---

## 一、Layer 设计

### Component

```ts
export class Layer {
  /** 层名称 */
  name: string = 'default';
  /** 渲染排序（小的先画，被大的遮盖） */
  zIndex: number = 0;
}
```

### 预定义层

| 层名 | zIndex | 用途 | 渲染 | 碰撞 | 随相机移动 |
|---|---|---|---|---|---|
| `parallax` | -100 | 远景天空、山脉 | ✅ | ❌ | 视差滚动（慢于相机） |
| `background` | 0 | 地面、草地、路面 | ✅ | ❌ | 正常 |
| `decoration` | 10 | 花草、碎石、地面细节 | ✅ | ❌ | 正常 |
| `collision` | 20 | 墙壁、围栏、水域边界 | ✅ 或 仅编辑器可见 | ✅ | 正常 |
| `object` | 30 | 宝箱、NPC、可交互物 | ✅ | 按需 | 正常 |
| `player` | 40 | 玩家、敌人 | ✅ | ✅ | 正常 |
| `foreground` | 50 | 树冠、屋顶（遮挡玩家） | ✅ | ❌ | 正常 |
| `ui` | 100 | 血条、伤害数字 | ✅ | ❌ | 固定屏幕 |

不需要把这些 hardcode 进引擎——`Layer` 组件只存 `name` + `zIndex`，具体有哪些层由项目/编辑器定义。

### 渲染排序逻辑

```ts
// RenderSystem 中
function renderSystem(world: World, dt: number): void {
  const renderList: Array<{ eid: number; z: number; y: number }> = [];

  world.query(Transform, Sprite, Layer).each((t, s, l, eid) => {
    renderList.push({
      eid,
      z: l.zIndex,
      y: t.y,  // 同层内按 Y 排序（顶视角遮挡）
    });
  });

  // 先按 layer zIndex，再按 Y 坐标
  renderList.sort((a, b) => a.z - b.z || a.y - b.y);

  for (const item of renderList) {
    // 提交绘制指令...
  }
}
```

### 碰撞过滤

```ts
function collisionSystem(world: World, dt: number): void {
  // 只查 collision 层的 Entity
  world.query(Transform, Collider, Layer).each((t, c, l, eid) => {
    if (l.name !== 'collision') return;
    // ...碰撞检测
  });
}
```

---

## 二、Grid Brush 编辑器设计

笔刷本质上是：**选中一个 Sprite + 一个 Layer → 点击/拖拽 → 在网格位置批量 spawn Entity**。

### 需要的数据

```ts
/** 编辑器笔刷状态（不是 Component，是编辑器 UI 状态） */
interface BrushState {
  /** 当前选中的图集 */
  atlas: string;
  /** 当前选中的帧 */
  frame: string;
  /** 目标层 */
  layer: string;
  /** 目标层 zIndex */
  zIndex: number;
  /** 网格大小（像素） */
  gridSize: number;
  /** 笔刷模式 */
  mode: 'paint' | 'erase' | 'fill' | 'pick';
  /** 笔刷尺寸（1=单格, 2=2x2, 3=3x3） */
  size: number;
}
```

### 核心操作

**Paint（画）**：
```
鼠标位置 → 对齐网格 → 检查该位置+该层是否已有 Entity
  → 没有 → spawn({ Transform, Sprite, Layer })
  → 已有 → 替换 Sprite（或跳过）
```

**Erase（擦）**：
```
鼠标位置 → 对齐网格 → 找到该位置+该层的 Entity → destroy
```

**Pick（吸色）**：
```
鼠标位置 → 找到该位置最顶层的 Entity → 读取其 Sprite 信息 → 设为当前笔刷
```

**Fill（填充）**：
```
从起点开始 BFS 扩展 → 对每个空格子 spawn Entity → 遇到非空或不同 sprite 停止
```

### 空间查找

所有操作都需要"这个格子上有什么"的快速查找。因为你是全 Entity 模式，需要一个编辑器侧的网格索引：

```ts
/**
 * 编辑器用的空间索引
 * key = "layer|tileX|tileY" → EntityId
 */
class GridIndex {
  private map = new Map<string, number>();

  private key(layer: string, x: number, y: number): string {
    return `${layer}|${x}|${y}`;
  }

  set(layer: string, x: number, y: number, eid: number): void {
    this.map.set(this.key(layer, x, y), eid);
  }

  get(layer: string, x: number, y: number): number | undefined {
    return this.map.get(this.key(layer, x, y));
  }

  delete(layer: string, x: number, y: number): void {
    this.map.delete(this.key(layer, x, y));
  }

  /** 获取某位置所有层的 Entity */
  getAllAt(x: number, y: number): Array<{ layer: string; eid: number }> {
    const results: Array<{ layer: string; eid: number }> = [];
    for (const [k, eid] of this.map) {
      const [layer, tx, ty] = k.split('|');
      if (parseInt(tx) === x && parseInt(ty) === y) {
        results.push({ layer, eid });
      }
    }
    return results;
  }
}
```

### 笔刷操作实现

```ts
function brushPaint(
  world: World,
  grid: GridIndex,
  brush: BrushState,
  tileX: number,
  tileY: number,
): void {
  const existing = grid.get(brush.layer, tileX, tileY);

  if (existing !== undefined) {
    // 已有 Entity：更新 Sprite
    const entity = world.ref(existing);
    const sprite = entity.get(Sprite);
    sprite.atlas = brush.atlas;
    sprite.frame = brush.frame;
    return;
  }

  // 新建 Entity
  const entity = world.spawn({
    Transform: {
      x: tileX * brush.gridSize,
      y: tileY * brush.gridSize,
    },
    Sprite: {
      atlas: brush.atlas,
      frame: brush.frame,
    },
    Layer: {
      name: brush.layer,
      zIndex: brush.zIndex,
    },
  });

  grid.set(brush.layer, tileX, tileY, entity.id);
}

function brushErase(
  world: World,
  grid: GridIndex,
  layer: string,
  tileX: number,
  tileY: number,
): void {
  const eid = grid.get(layer, tileX, tileY);
  if (eid === undefined) return;

  world.destroy(eid);
  grid.delete(layer, tileX, tileY);
}
```

---

## 三、编辑器 UI 层面

```
┌─────────────────────────────────────────────────────────┐
│  编辑器                                                  │
│                                                         │
│  ┌─────────────┐  ┌────────────────────────────────┐    │
│  │ Layer Panel  │  │         Canvas (WebGPU)         │    │
│  │             │  │                                  │    │
│  │ 👁 parallax │  │    网格线叠加显示                  │    │
│  │ 👁 background│ │    当前层高亮，其他层半透明         │    │
│  │ 👁 decoration│ │    笔刷预览跟随鼠标               │    │
│  │ 👁 collision │  │                                  │    │
│  │ 👁 object   │  │                                  │    │
│  │ 👁 foreground│ │                                  │    │
│  │             │  └────────────────────────────────┘    │
│  └─────────────┘                                        │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Sprite Palette                                    │   │
│  │ ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐               │   │
│  │ │🟫││🟩││🟦││🪨││🌳││🏠││🚪││💎│ ...           │   │
│  │ └──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘               │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  Brush: [Paint|Erase|Fill|Pick]  Size: [1|2|3]  Grid: 16│
└─────────────────────────────────────────────────────────┘
```

**编辑器交互流程**：

1. Layer Panel 选中目标层（如 `background`）
2. Sprite Palette 选中图块
3. 画布上拖拽绘制 → 每个格子 spawn 一个 Entity
4. 切换到 `collision` 层 → 画碰撞边界
5. 👁 眼睛图标控制层的显示/隐藏
6. 选中非当前层自动半透明，方便对位

---

## 四、序列化（保存/加载）

因为所有地块都是 Entity，保存就是序列化所有 Entity 的 Component 数据：

```json
{
  "entities": [
    {
      "components": {
        "Transform": { "x": 0, "y": 0 },
        "Sprite": { "atlas": "terrain", "frame": "grass_01" },
        "Layer": { "name": "background", "zIndex": 0 }
      }
    },
    {
      "components": {
        "Transform": { "x": 16, "y": 0 },
        "Sprite": { "atlas": "terrain", "frame": "grass_02" },
        "Layer": { "name": "background", "zIndex": 0 }
      }
    }
  ]
}
```

**优势**：和 Prefab 格式完全一致，加载时 `world.spawn(entityData.components)` 逐个恢复。

**劣势**：50×50 地图 = 2500 个 Entity JSON 对象，文件约 200KB。原型阶段可接受，后期可以做压缩优化（RLE 编码、按层批量存储等）。

---

## 总结

| 维度 | 你的方案（全 Entity + 层 + 笔刷） | 传统 TileMap |
|---|---|---|
| 数据模型 | 每个格子一个 Entity | Uint16Array 批量数组 |
| 复杂度 | 低——复用 spawn/query/Prefab | 高——独立的瓦片数据管道 |
| 灵活性 | 极高——任何格子挂任何组件 | 低——瓦片只是 ID，逻辑要特殊处理 |
| 性能 | 百级地图无感，千级够用 | 万级依然流畅 |
| 编辑器成本 | Layer Panel + Grid Brush | 需要完整的 Tile 编辑器 |
| 适合阶段 | **原型 → 小型完整游戏** | 大地图 / 性能敏感场景 |

**结论**：对于原型到小型完整游戏阶段，全 Entity + Layer + Grid Brush 是最务实的选择。你不需要额外引入 TileMap 数据结构，现有的 ECS 管道直接覆盖所有需求。等真正需要 200×200 以上的大地图时，再考虑把特定层优化为批量数据。