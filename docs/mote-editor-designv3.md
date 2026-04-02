blender 编辑器，ui界面设计是什么风格呢，以及交互体验，我特别喜欢

Blender 的 UI 设计确实很有特色，在专业 DCC 软件中独树一帜。我帮你梳理一下它的设计风格和交互体验的核心特点。

## UI 视觉风格

### 整体基调
- **深色扁平化设计**：默认采用深灰色主题，低对比度、低饱和度，长时间使用不易视觉疲劳
- **完全自绘 UI**：不使用任何操作系统原生控件，整个界面由自研的 **immediate-mode GUI** 框架绘制（基于 OpenGL/GPU 加速），保证了跨平台视觉一致性
- **像素级紧凑排布**：信息密度极高，每一个像素都在"干活"，几乎没有装饰性留白
- **无圆角、无阴影、无毛玻璃**：和 macOS / Windows 的现代设计语言截然不同，追求的是"工具感"和"工程感"

### 色彩与图标体系
- 采用 **单色线性图标**，风格统一，辨识度高
- 状态反馈通过 **微妙的高亮色变化** 传达（选中态、悬停态、激活态），而非大面积色块
- 关键操作元素用蓝色/橙色等亮色做点睛提示

## 交互设计哲学

### 1. 非重叠、瓦片式窗口系统（Non-overlapping Layout）
这是 Blender 最核心的 UI 理念之一：
- 所有编辑器区域 **平铺排列，互不遮挡**
- 用户可以通过拖拽边界自由分割/合并区域
- 没有浮动窗口（极少数例外如偏好设置），避免了窗口管理的心智负担
- 每个区域可以独立切换为任意编辑器类型（3D Viewport、Timeline、Properties、Outliner 等）

### 2. 键盘驱动（Keyboard-centric）
- 核心操作高度依赖 **单键快捷键**：`G`（Grab 移动）、`R`（Rotate 旋转）、`S`（Scale 缩放）、`X/Y/Z`（轴向约束）
- **模态输入**：按下快捷键后进入操作模式，鼠标移动即为参数调节，左键确认 / 右键取消
- 可以直接键入精确数值，如 `R → 45 → Enter` 表示旋转 45°
- 这种"**动词 → 修饰符 → 名词**"的操作语法极其高效

### 3. 上下文敏感（Context-sensitive）
- 右键菜单、属性面板、工具栏内容根据当前编辑器类型和选中对象 **动态变化**
- Header 栏（顶部/底部）显示当前模式和编辑器专属工具
- 属性面板（Properties Editor）根据选中对象的类型自动切换标签页

### 4. 操作面板（Redo Panel / F9）
- 每个操作执行后，左下角弹出 **即时参数面板**，可以事后微调操作参数
- 这是一种"先做再调"的非破坏性工作流

### 5. Pie Menu（饼状菜单）
- 按住快捷键弹出的 **放射状菜单**，利用方向手势选择，比线性菜单更快
- 比如 `Z` 键呼出着色模式切换，`Tab` 呼出模式切换

## 架构层面的设计亮点

| 特性 | 说明 |
|------|------|
| **Immediate Mode GUI** | UI 每帧重绘，状态不缓存在控件中，逻辑简洁 |
| **Operator System** | 所有操作封装为 Operator，统一了撤销/重做/录制宏的机制 |
| **RNA/DNA 属性系统** | 所有数据通过统一的属性路径访问，UI 控件自动绑定数据 |
| **自定义 Workspace** | 预设不同任务的布局方案（建模、动画、渲染等），一键切换 |

## 为什么用起来"爽"

Blender 的交互体验之所以让人上瘾，核心在于：

1. **极低的操作摩擦**：快捷键 → 鼠标移动 → 确认，三步完成大多数操作，手不需要离开键盘中心区域
2. **可预测性强**：操作语法统一（动词+轴+数值），学会模式后几乎不需要查菜单
3. **信息密度高但不混乱**：得益于上下文敏感和非重叠布局，屏幕空间利用率极高
4. **流畅的视觉反馈**：GPU 加速的 UI 绘制 + 实时预览，操作响应几乎无延迟

---

考虑到你在做 WebGPU + TypeScript 的 2D 游戏引擎（微尘），如果想借鉴 Blender 的 UI 设计思路，有几个方向特别值得参考：

- **Immediate Mode GUI 模式**：非常适合 WebGPU 渲染管线，UI 和场景共享同一渲染上下文，避免 DOM 开销
- **瓦片式布局系统**：比浮动窗口更适合编辑器类工具
- **Operator + Undo Stack 架构**：从一开始就把操作抽象为命令对象，后期扩展（宏录制、协作编辑）会非常方便
- **快捷键驱动的模态交互**：对高频用户体验提升巨大

有兴趣深入聊聊其中某个方面的实现细节吗？



===

非重叠、瓦片式窗口系统（Non-overlapping Layout）


好，咱们深入拆解 Blender 的瓦片式窗口系统，这套东西从设计理念到实现细节都非常值得研究。

---

## 核心概念模型

Blender 的窗口管理本质上是一棵 **二叉空间分割树（BSP Tree）**：

```
┌──────────────────────────────────────────┐
│                 Window                    │
│  ┌─────────────────┬────────────────────┐ │
│  │                 │    Outliner         │ │
│  │   3D Viewport   ├────────────────────┤ │
│  │                 │    Properties      │ │
│  ├─────────────────┴────────────────────┤ │
│  │            Timeline                  │ │
│  └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

对应的树结构：

```
          Root (V-split)
         /              \
   H-split              Timeline
   /       \
Viewport   V-split
           /      \
      Outliner  Properties
```

每个 **叶节点** 就是一个可用的编辑器区域（Area），**非叶节点** 只存储分割方向和分割比例。

---

## 六大核心机制

### 1. Area（区域）—— 最小编辑单元

每个 Area 是一个完全独立的矩形区域，包含：

| 组成部分 | 职责 |
|---------|------|
| **Header** | 顶部/底部窄条，放编辑器类型选择器 + 模式切换 + 工具按钮 |
| **Main Region** | 主内容区，编辑器的核心渲染区域 |
| **Sidebar (N-panel)** | 可选的右侧属性面板，按 `N` 切换显隐 |
| **Tool Shelf (T-panel)** | 可选的左侧工具栏，按 `T` 切换显隐 |
| **Footer** | 状态栏/信息提示 |

关键设计：**每个 Area 可以独立切换为任意编辑器类型**，在 Header 左上角的下拉菜单中选择即可。这意味着编辑器类型和空间位置是完全解耦的。

### 2. 分割（Split）—— 创建新区域

操作方式：将鼠标悬停在两个区域的 **交界边缘**，光标变为十字箭头，然后向内拖拽：

```
拖拽前:                    拖拽后 (水平分割):
┌──────────────┐          ┌──────────────┐
│              │          │    Area A    │
│    Area A    │    →     ├──────────────┤
│              │          │    Area B    │
└──────────────┘          └──────────────┘
```

内部逻辑：
1. 当前叶节点变为非叶节点
2. 生成两个子叶节点，各继承一部分矩形空间
3. 分割比例由鼠标位置决定

### 3. 合并（Join）—— 消除区域

操作方式：从一个区域的 **角落** 向相邻区域拖拽，箭头方向指示"吞噬"方向：

```
拖拽方向: A → B
┌───────┬───────┐          ┌───────────────┐
│       │       │          │               │
│   A   │   B   │    →     │       A       │
│       │       │          │               │
└───────┴───────┘          └───────────────┘
```

约束：**只能合并共享完整边的相邻区域**。如果两个区域的共享边不完整（有错位），合并操作不被允许。这是 BSP 树结构的天然约束。

### 4. 边界拖拽（Resize）—— 动态调比例

拖拽任意两个区域之间的边界线，可以实时调整分割比例。需要注意的是：

- 边界线是 **共享的**，拖动一条边会同时影响该边两侧的所有区域
- 这就像一个 **约束系统**：水平边关联同一行的所有分割点

```
拖拽中间竖线:
┌────┬──────────┐       ┌────────┬──────┐
│    │    B     │       │        │  B   │
│ A  ├──────────┤  →    │   A    ├──────┤
│    │    C     │       │        │  C   │
└────┴──────────┘       └────────┴──────┘
          ↑ A/B 和 A/C 的竖线同步移动
```

### 5. 交换（Swap Areas）

`Ctrl + 鼠标拖拽` 可以交换两个区域的编辑器内容，空间位置不变、内容互换。

### 6. 全屏临时展开（Toggle Fullscreen）

`Ctrl + Space` 将当前区域临时扩展到占满整个窗口，再按一次恢复。**不破坏布局树结构**，只是渲染时暂时跳过其他节点。

---

## 数据结构设计（简化版）

如果要自己实现，核心数据结构大致如下：

```typescript
// 分割方向
type SplitDirection = 'horizontal' | 'vertical';

// 编辑器区域（叶节点）
interface AreaNode {
  type: 'area';
  editorType: string;       // 'viewport_3d' | 'timeline' | 'properties' | ...
  editorState: any;         // 编辑器内部状态
}

// 分割节点（非叶节点）
interface SplitNode {
  type: 'split';
  direction: SplitDirection;
  ratio: number;            // 0.0 ~ 1.0，第一个子节点占比
  children: [LayoutNode, LayoutNode];  // 恰好两个子节点
}

type LayoutNode = AreaNode | SplitNode;

// 整个窗口的布局
interface WindowLayout {
  root: LayoutNode;
  width: number;
  height: number;
}
```

**从树计算每个 Area 的实际像素矩形**，只需递归遍历：

```typescript
function computeRects(node: LayoutNode, rect: Rect): void {
  if (node.type === 'area') {
    node.computedRect = rect; // 叶节点直接拿到矩形
    return;
  }
  
  const [first, second] = node.children;
  
  if (node.direction === 'vertical') {
    const splitX = rect.x + rect.width * node.ratio;
    computeRects(first,  { x: rect.x, y: rect.y, width: splitX - rect.x, height: rect.height });
    computeRects(second, { x: splitX, y: rect.y, width: rect.x + rect.width - splitX, height: rect.height });
  } else {
    const splitY = rect.y + rect.height * node.ratio;
    computeRects(first,  { x: rect.x, y: rect.y, width: rect.width, height: splitY - rect.y });
    computeRects(second, { x: rect.x, y: splitY, width: rect.width, height: rect.y + rect.height - splitY });
  }
}
```

---

## 事件路由机制

瓦片式布局需要自己做 **事件分发**，因为没有 OS 原生窗口来帮你路由：

```
鼠标事件进入
    │
    ▼
根据鼠标坐标，在 BSP 树中找到命中的 Area
    │
    ├── 命中 Header → 分发给 Header 控件
    ├── 命中边界线（±3px 容差）→ 触发 Resize 模式
    ├── 命中角落（8x8px 热区）→ 触发 Split/Join 模式
    └── 命中 Main Region → 分发给当前编辑器的事件处理器
```

一个重要细节：**键盘事件只发送给鼠标悬停所在的 Area**（而不是"焦点"Area）。这是 Blender 的一个独特设计 —— 不需要先点击激活，鼠标在哪里，快捷键就在哪里生效。

---

## 和其他方案的对比

| 特性 | Blender 瓦片式 | 传统浮动窗口 (Photoshop) | Dock 系统 (VS Code) |
|------|---------------|------------------------|---------------------|
| 空间利用率 | **极高**，无遮挡浪费 | 低，窗口重叠 | 高，但 Tab 隐藏内容 |
| 窗口管理成本 | **零**，自动铺满 | 高，手动排列 | 中，需要拖拽 Dock |
| 灵活性 | 任意二叉分割 | 完全自由 | 预设 Dock 位置 |
| 实现复杂度 | 中等（BSP 树） | 低（OS 原生） | 高（Dock 算法） |
| 多显示器 | 原生支持多窗口 | 天然支持 | 受限 |
| 缺点 | 非整齐对齐时无法合并 | 遮挡、找窗口麻烦 | Tab 过多时难以导航 |

---

## 在 WebGPU 引擎中实现的建议

针对你的微尘引擎（WebGPU + TypeScript），如果要做编辑器，建议：

1. **BSP 树 + Rect 计算** 放在纯 TypeScript 层，和渲染无关
2. **每个 Area 分配独立的 viewport/scissor rect**，在 WebGPU render pass 中通过 `setViewport()` / `setScissorRect()` 隔离渲染区域
3. **边界线和角落热区的 hit-test** 用简单的矩形碰撞就够了，不需要 GPU picking
4. **序列化整棵 BSP 树为 JSON**，就可以实现 Workspace 的保存/加载/预设切换
5. **拖拽分割的视觉反馈**用一个半透明 overlay 层来绘制预览线，在 GPU 侧只需一个额外的全屏 quad pass

最关键的一点：**先把布局系统和编辑器系统做成两个独立模块**。布局系统只管矩形分配和事件路由，编辑器系统只关心"给我一个矩形，我在里面画东西"。这样后续扩展编辑器类型的成本非常低。

想继续聊事件系统的细节，还是 Workspace 序列化方案？


===

对于第一版来说，我不计划使用webgpu，而是直接用浏览器提供的功能，然后使用preact和vite

务实的选择！用 Preact + Vite + 浏览器原生能力（CSS + DOM 事件）来做瓦片式布局，第一版完全够用，而且开发效率高很多。来，我们把整个方案从架构到实现捋清楚。

---

## 技术选型思路

| 层面 | 方案 | 理由 |
|------|------|------|
| 布局计算 | 纯 TypeScript BSP 树 | 和 UI 框架解耦，可复用 |
| 区域渲染 | CSS `position: absolute` + 像素定位 | 比 CSS Grid 更精确控制，贴合 BSP 树输出 |
| 拖拽交互 | 原生 `pointer` 事件 | 比 mouse 事件更通用，天然支持触控 |
| 编辑器面板 | Preact 组件 | 每个 Area 挂载独立组件实例 |
| 状态管理 | Preact Signals | 轻量响应式，适合频繁的 resize 更新 |
| 构建 | Vite | 秒级 HMR，Preact 插件生态成熟 |

---

## 项目结构

```
src/
├── layout/
│   ├── types.ts            # BSP 树类型定义
│   ├── tree.ts             # 树操作（split/join/resize/swap）
│   ├── rect.ts             # 矩形计算
│   └── serialize.ts        # JSON 序列化/反序列化
├── components/
│   ├── LayoutRoot.tsx       # 根容器，监听 resize
│   ├── AreaView.tsx         # 单个 Area 的渲染壳
│   ├── SplitHandle.tsx      # 拖拽分割线
│   ├── CornerWidget.tsx     # 角落热区（split/join 触发器）
│   └── EditorSwitcher.tsx   # 编辑器类型下拉切换
├── editors/
│   ├── registry.ts          # 编辑器注册表
│   ├── ViewportEditor.tsx   # 示例：2D 视口编辑器
│   ├── TimelineEditor.tsx   # 示例：时间线
│   └── PropertiesEditor.tsx # 示例：属性面板
├── hooks/
│   ├── useDrag.ts           # 通用拖拽 hook
│   └── useLayout.ts         # 布局 context + 操作方法
├── store/
│   └── layout.ts            # Signal-based 布局状态
├── App.tsx
└── main.tsx
```

---

## 核心实现

### 1. BSP 树类型定义

```typescript
// layout/types.ts
export type SplitDirection = 'horizontal' | 'vertical';

export interface AreaNode {
  id: string;
  type: 'area';
  editorType: string;
}

export interface SplitNode {
  id: string;
  type: 'split';
  direction: SplitDirection;
  ratio: number;              // 0.0 ~ 1.0
  children: [LayoutNode, LayoutNode];
}

export type LayoutNode = AreaNode | SplitNode;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 计算结果：每个 Area ID → 对应的像素矩形
export type RectMap = Map<string, Rect>;
```

### 2. 矩形计算（纯函数，无副作用）

```typescript
// layout/rect.ts
import type { LayoutNode, Rect, RectMap } from './types';

const HANDLE_SIZE = 4; // 分割线占用的像素

export function computeRects(
  node: LayoutNode, 
  rect: Rect, 
  out: RectMap = new Map()
): RectMap {
  if (node.type === 'area') {
    out.set(node.id, rect);
    return out;
  }

  const { direction, ratio, children } = node;
  const half = HANDLE_SIZE / 2;

  if (direction === 'vertical') {
    const splitX = rect.x + rect.width * ratio;
    computeRects(children[0], {
      x: rect.x,
      y: rect.y,
      width: splitX - half - rect.x,
      height: rect.height,
    }, out);
    computeRects(children[1], {
      x: splitX + half,
      y: rect.y,
      width: rect.x + rect.width - splitX - half,
      height: rect.height,
    }, out);
  } else {
    const splitY = rect.y + rect.height * ratio;
    computeRects(children[0], {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: splitY - half - rect.y,
    }, out);
    computeRects(children[1], {
      x: rect.x,
      y: splitY + half,
      width: rect.width,
      height: rect.y + rect.height - splitY - half,
    }, out);
  }

  return out;
}
```

### 3. 树操作

```typescript
// layout/tree.ts
import type { LayoutNode, AreaNode, SplitNode, SplitDirection } from './types';

let _uid = 0;
const uid = () => `area_${++_uid}`;

/** 分割一个 Area 为两个 */
export function splitArea(
  root: LayoutNode,
  targetId: string,
  direction: SplitDirection,
  ratio = 0.5
): LayoutNode {
  return mapNode(root, (node) => {
    if (node.type !== 'area' || node.id !== targetId) return node;
    
    const newArea: AreaNode = {
      id: uid(),
      type: 'area',
      editorType: node.editorType, // 新区域继承同类型
    };

    const split: SplitNode = {
      id: `split_${++_uid}`,
      type: 'split',
      direction,
      ratio,
      children: [{ ...node }, newArea],
    };

    return split;
  });
}

/** 合并：移除一个 Area，其兄弟节点提升 */
export function joinArea(
  root: LayoutNode,
  removeId: string
): LayoutNode {
  return mapNode(root, (node) => {
    if (node.type !== 'split') return node;
    
    const [a, b] = node.children;
    if (a.type === 'area' && a.id === removeId) return b;
    if (b.type === 'area' && b.id === removeId) return a;
    return node;
  });
}

/** 调整分割比例 */
export function resizeSplit(
  root: LayoutNode,
  splitId: string,
  newRatio: number
): LayoutNode {
  return mapNode(root, (node) => {
    if (node.id !== splitId || node.type !== 'split') return node;
    return { ...node, ratio: Math.max(0.1, Math.min(0.9, newRatio)) };
  });
}

/** 交换两个 Area 的编辑器内容 */
export function swapAreas(
  root: LayoutNode,
  idA: string,
  idB: string
): LayoutNode {
  const nodeA = findArea(root, idA);
  const nodeB = findArea(root, idB);
  if (!nodeA || !nodeB) return root;

  const typeA = nodeA.editorType;
  let result = mapNode(root, (n) => {
    if (n.type === 'area' && n.id === idA) return { ...n, editorType: nodeB.editorType };
    if (n.type === 'area' && n.id === idB) return { ...n, editorType: typeA };
    return n;
  });
  return result;
}

// ---- 工具函数 ----

function mapNode(
  node: LayoutNode,
  fn: (n: LayoutNode) => LayoutNode
): LayoutNode {
  const mapped = fn(node);
  if (mapped.type === 'split') {
    return {
      ...mapped,
      children: [
        mapNode(mapped.children[0], fn),
        mapNode(mapped.children[1], fn),
      ],
    };
  }
  return mapped;
}

function findArea(node: LayoutNode, id: string): AreaNode | null {
  if (node.type === 'area') return node.id === id ? node : null;
  return findArea(node.children[0], id) || findArea(node.children[1], id);
}
```

### 4. 状态管理（Preact Signals）

```typescript
// store/layout.ts
import { signal, computed } from '@preact/signals';
import type { LayoutNode, RectMap } from '../layout/types';
import { computeRects } from '../layout/rect';

// 初始布局
const defaultLayout: LayoutNode = {
  id: 'split_root',
  type: 'split',
  direction: 'vertical',
  ratio: 0.75,
  children: [
    {
      id: 'split_left',
      type: 'split',
      direction: 'horizontal',
      ratio: 0.7,
      children: [
        { id: 'area_viewport', type: 'area', editorType: 'viewport' },
        { id: 'area_timeline', type: 'area', editorType: 'timeline' },
      ],
    },
    {
      id: 'split_right',
      type: 'split',
      direction: 'horizontal',
      ratio: 0.5,
      children: [
        { id: 'area_outliner', type: 'area', editorType: 'outliner' },
        { id: 'area_properties', type: 'area', editorType: 'properties' },
      ],
    },
  ],
};

export const layoutTree = signal<LayoutNode>(defaultLayout);
export const containerSize = signal({ width: 1200, height: 800 });

// 自动派生所有 Area 的矩形
export const rectMap = computed<RectMap>(() => {
  const { width, height } = containerSize.value;
  return computeRects(layoutTree.value, { x: 0, y: 0, width, height });
});
```

### 5. 核心组件

```tsx
// components/LayoutRoot.tsx
import { useRef, useEffect } from 'preact/hooks';
import { containerSize, rectMap, layoutTree } from '../store/layout';
import { AreaView } from './AreaView';
import { SplitHandle } from './SplitHandle';
import { collectAreas, collectSplits } from '../layout/tree';

export function LayoutRoot() {
  const containerRef = useRef<HTMLDivElement>(null);

  // 监听容器尺寸变化
  useEffect(() => {
    const el = containerRef.current!;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      containerSize.value = { width, height };
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const areas = collectAreas(layoutTree.value);
  const splits = collectSplits(layoutTree.value);
  const rects = rectMap.value;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#1e1e1e',
      }}
    >
      {/* 渲染所有 Area */}
      {areas.map((area) => {
        const rect = rects.get(area.id);
        return rect ? <AreaView key={area.id} area={area} rect={rect} /> : null;
      })}

      {/* 渲染所有分割线 */}
      {splits.map((split) => (
        <SplitHandle key={split.id} split={split} />
      ))}
    </div>
  );
}
```

```tsx
// components/AreaView.tsx
import type { AreaNode, Rect } from '../layout/types';
import { EditorSwitcher } from './EditorSwitcher';
import { CornerWidget } from './CornerWidget';
import { getEditor } from '../editors/registry';

interface Props {
  area: AreaNode;
  rect: Rect;
}

export function AreaView({ area, rect }: Props) {
  const EditorComponent = getEditor(area.editorType);
  const HEADER_H = 26;

  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #333',
        boxSizing: 'border-box',
      }}
    >
      {/* Header 栏 */}
      <div style={{
        height: HEADER_H,
        background: '#2a2a2a',
        display: 'flex',
        alignItems: 'center',
        padding: '0 4px',
        gap: 4,
        flexShrink: 0,
      }}>
        <CornerWidget areaId={area.id} />
        <EditorSwitcher areaId={area.id} current={area.editorType} />
        <span style={{ color: '#888', fontSize: 11 }}>{area.editorType}</span>
      </div>

      {/* 编辑器主区域 */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <EditorComponent areaId={area.id} />
      </div>
    </div>
  );
}
```

### 6. 拖拽分割线

```typescript
// hooks/useDrag.ts
import { useRef, useCallback } from 'preact/hooks';

interface DragCallbacks {
  onStart?: (e: PointerEvent) => void;
  onMove: (e: PointerEvent, delta: { dx: number; dy: number }) => void;
  onEnd?: (e: PointerEvent) => void;
}

export function useDrag(callbacks: DragCallbacks) {
  const startPos = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback((e: PointerEvent) => {
    e.preventDefault();
    startPos.current = { x: e.clientX, y: e.clientY };
    callbacks.onStart?.(e);

    const onMove = (e: PointerEvent) => {
      callbacks.onMove(e, {
        dx: e.clientX - startPos.current.x,
        dy: e.clientY - startPos.current.y,
      });
    };

    const onUp = (e: PointerEvent) => {
      callbacks.onEnd?.(e);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [callbacks]);

  return { onPointerDown };
}
```

```tsx
// components/SplitHandle.tsx
import type { SplitNode } from '../layout/types';
import { layoutTree, containerSize } from '../store/layout';
import { resizeSplit } from '../layout/tree';
import { useDrag } from '../hooks/useDrag';

const HANDLE_SIZE = 6;

export function SplitHandle({ split }: { split: SplitNode & { parentRect: Rect } }) {
  const { direction, id } = split;
  const { parentRect } = split;
  const isVertical = direction === 'vertical';

  const { onPointerDown } = useDrag({
    onMove: (_e, { dx, dy }) => {
      const delta = isVertical ? dx : dy;
      const total = isVertical ? parentRect.width : parentRect.height;
      const newRatio = split.ratio + delta / total;

      layoutTree.value = resizeSplit(layoutTree.value, id, newRatio);
    },
  });

  // 根据分割方向计算分割线位置
  const style = isVertical
    ? {
        left: parentRect.x + parentRect.width * split.ratio - HANDLE_SIZE / 2,
        top: parentRect.y,
        width: HANDLE_SIZE,
        height: parentRect.height,
        cursor: 'col-resize',
      }
    : {
        left: parentRect.x,
        top: parentRect.y + parentRect.height * split.ratio - HANDLE_SIZE / 2,
        width: parentRect.width,
        height: HANDLE_SIZE,
        cursor: 'row-resize',
      };

  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute',
        ...style,
        zIndex: 10,
        // hover 时高亮
        background: 'transparent',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#4a90d9')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    />
  );
}
```

### 7. 角落热区（触发 Split）

```tsx
// components/CornerWidget.tsx
import { layoutTree } from '../store/layout';
import { splitArea } from '../layout/tree';

export function CornerWidget({ areaId }: { areaId: string }) {
  // 简化版：点击角落 → 弹出 split 方向选择
  const handleSplit = (direction: 'horizontal' | 'vertical') => {
    layoutTree.value = splitArea(layoutTree.value, areaId, direction);
  };

  return (
    <div
      style={{
        width: 14,
        height: 14,
        position: 'relative',
        cursor: 'crosshair',
      }}
      title="拖拽以分割区域"
    >
      {/* 右下角的小三角标记 */}
      <svg width="14" height="14" viewBox="0 0 14 14">
        <path d="M14 0 L14 14 L0 14 Z" fill="#555" />
      </svg>
      {/* 实际使用时，这里应该用 useDrag 检测拖拽方向 */}
      {/* 向下拖 → horizontal split，向右拖 → vertical split */}
    </div>
  );
}
```

### 8. 编辑器注册表

```typescript
// editors/registry.ts
import type { ComponentType } from 'preact';

interface EditorDef {
  name: string;
  icon: string;
  component: ComponentType<{ areaId: string }>;
}

const registry = new Map<string, EditorDef>();

export function registerEditor(key: string, def: EditorDef) {
  registry.set(key, def);
}

export function getEditor(key: string): ComponentType<{ areaId: string }> {
  return registry.get(key)?.component ?? FallbackEditor;
}

export function getAllEditors() {
  return Array.from(registry.entries());
}

function FallbackEditor({ areaId }: { areaId: string }) {
  return (
    <div style={{ color: '#666', padding: 16, fontSize: 12 }}>
      Unknown editor for {areaId}
    </div>
  );
}
```

---

## 关键交互细节

### Blender 式角落拖拽方向检测

```typescript
// 在 CornerWidget 的 useDrag 中
onMove: (_e, { dx, dy }) => {
  if (!directionDecided) {
    // 累计位移超过阈值后，根据方向决定 split 类型
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      const direction = Math.abs(dx) > Math.abs(dy) ? 'vertical' : 'horizontal';
      layoutTree.value = splitArea(layoutTree.value, areaId, direction);
      directionDecided = true;
    }
  }
}
```

### 鼠标悬停决定键盘事件归属

```typescript
// hooks/useLayout.ts 中
const hoveredAreaId = signal<string | null>(null);

// 在 AreaView 中
onPointerEnter={() => { hoveredAreaId.value = area.id; }}

// 全局键盘监听
window.addEventListener('keydown', (e) => {
  const targetArea = hoveredAreaId.value;
  if (targetArea) {
    // 分发给对应编辑器的快捷键处理器
    editorKeyHandlers.get(targetArea)?.(e);
  }
});
```

---

## 性能注意事项

| 问题 | 方案 |
|------|------|
| resize 时高频触发重绘 | `requestAnimationFrame` 节流 `rectMap` 计算 |
| 大量 Area 同时存在 | 实际场景很少超过 8 个，不需要虚拟化 |
| 拖拽分割线时编辑器内容闪烁 | 拖拽中给编辑器主区域加 `pointer-events: none` |
| Signal 粒度 | `rectMap` 是 computed，只有 `layoutTree` 或 `containerSize` 变化才重算 |
| 避免全树重渲染 | 每个 `AreaView` 可以 `memo` + 比较自身 rect 是否变化 |

---

## 第一版 MVP 建议

先只做这些，足够跑通核心体验：

1. **BSP 树 + Rect 计算** ✓
2. **分割线拖拽 Resize** ✓
3. **编辑器类型切换（下拉菜单）** ✓
4. **2~3 个简单编辑器占位**（Viewport 放个 Canvas，Properties 放个表单，Timeline 放个空面板）
5. **Workspace JSON 序列化到 localStorage**

暂时不做的（第二版再加）：
- 角落拖拽 Split/Join（先用右键菜单代替）
- Swap Areas
- 全屏展开
- Undo/Redo 布局变化

需要我直接帮你生成一个可运行的 Vite + Preact 脚手架项目吗？

===

暂时不用，我想继续回到blender 的界面设计，这套设计，有名字吗，各对应什么核心概念，如果没有，可以从blender的源码来分析

调研结果非常丰富。下面基于 Blender 源码和官方文档，完整梳理这套 UI 体系的命名与核心概念。

---

## 它叫什么名字？

**Blender 没有给这套系统一个独立的品牌化名称。** 但在不同层面有明确的称呼：

| 语境 | 称呼 | 出处 |
|------|------|------|
| 官方用户手册 | **Window System** | 文档路径 `User Interface > Window System` |
| 源码核心模块 | **Screen Layout System** | `screen_geometry.cc` 开头注释 |
| 2.5 重构设计文档 | "non-overlapping subdivided layouts (**Screens, Areas**)" | Ton Roosendaal 原始描述 |
| Window Manager 模块 | **WM (Window Manager)** | `source/blender/windowmanager/` |

源码 `screen_geometry.cc` 开头有一段关键注释：

> *"Screen geometry refers to the vertices (ScrVert) and edges (ScrEdge) through which the **flexible screen-layout system** of Blender is established."*

所以最准确的源码级名称是 **Screen Layout System**（屏幕布局系统），由 **Window Manager** 统一管理。

---

## 核心概念层级（从源码结构体直接提取）

整套体系是一个 6 层嵌套结构：

```
wmWindowManager          ← 全局唯一单例 (ID_WM)
  └── wmWindow           ← 一个 OS 原生窗口 (通过 GHOST 抽象层)
        └── WorkSpace    ← 工作区 (ID_WS), 持有 Screen 引用
              └── bScreen        ← 屏幕布局 (ID_SCR)
                    ├── ScrVert[]    ← 拓扑顶点
                    ├── ScrEdge[]    ← 拓扑边
                    └── ScrArea[]    ← 编辑器区域
                          ├── SpaceLink / SpaceData  ← 编辑器实例数据
                          ├── ARegion[]              ← 子区域
                          │     └── Panel[]          ← 可折叠面板
                          └── AZone[]                ← 交互热区
```

下面逐层拆解。

---

### 第 1 层：wmWindowManager — 全局管理器

```c
struct wmWindowManager {
    ID id;                    // Blender 数据块标识 (ID_WM)
    ListBase windows;         // 所有 wmWindow
    ListBase operators;       // 已注册的全局 Operator
    ListBase keyconfigs;      // 快捷键配置
    // ...
};
```

全局唯一实例。管理所有窗口、事件队列、Operator 注册表。Blender 进程中只有一个 `wmWindowManager`。

---

### 第 2 层：wmWindow — 操作系统窗口

```c
struct wmWindow {
    wmWindow *next, *prev;
    GHOST_WindowHandle ghostwin;  // OS 原生窗口句柄
    Scene *scene;                 // 当前场景
    WorkSpaceInstanceHook *workspace_hook;  // 工作区
    ScrAreaMap global_areas;      // 全局区域 (TopBar, StatusBar)
    // ...
};
```

一个 `wmWindow` 对应一个操作系统级窗口。通过 **GHOST** 抽象层（Blender 自研的跨平台窗口/输入层，类似 GLFW）和 OS 交互。

---

### 第 3 层：bScreen — 屏幕布局（最核心！）

```c
struct bScreen {
    ID id;                        // 数据块标识 (ID_SCR)
    ListBase vertbase;            // ScrVert 列表 ← 拓扑顶点
    ListBase edgebase;            // ScrEdge 列表 ← 拓扑边
    ListBase areabase;            // ScrArea 列表 ← 区域
    eScreenState state;           // SCREENNORMAL / SCREENMAXIMIZED / SCREENFULL
    // ...
};
```

这是整套布局系统的核心数据结构。关键点：**`bScreen` 不是一棵树，而是一个二维平面拓扑图**。

#### ScrVert + ScrEdge：拓扑网格（不是 BSP 树！）

这是 Blender 最独特的设计。布局不是用树来表达，而是用 **顶点 + 边** 构成的平面图：

```c
struct ScrVert {
    ScrVert *next, *prev, *newv;
    vec2s vec;          // 二维像素坐标 (short x, y)
};

struct ScrEdge {
    ScrEdge *next, *prev;
    ScrVert *v1, *v2;   // 边连接的两个顶点
    short border;        // 1 = 位于屏幕物理边缘
};
```

一个典型的 3 区域布局的拓扑结构：

```
  v5 -------- e5 -------- v6
  |                        |
  e4          e7           e6
  |           |            |
  v3 -- e3 -- v4           |
  |           |            |
  e1          e2           |
  |           |            |
  v1 -------- e8 -------- v2

  Area A: v1, v3, v4(→v5→v6→v2 路径上的 v4?), ...
```

实际上每个 `ScrArea` 通过 4 个顶点引用定义矩形：

```c
struct ScrArea {
    ScrVert *v1;  // bottom-left
    ScrVert *v2;  // top-left
    ScrVert *v3;  // top-right
    ScrVert *v4;  // bottom-right
    // ...
};
```

**相邻 Area 共享同一个 `ScrVert` 指针**，所以移动一个顶点会自动牵动所有引用它的 Area。这就是为什么拖拽边界时整行/整列会同步移动 —— 源码中 `screen_geom_select_connected_edge()` 实现了沿同方向的边传播选择。

#### 为什么用拓扑图而不是 BSP 树？

| | BSP 树 | ScrVert/ScrEdge 拓扑图 |
|------|--------|----------------------|
| 分割粒度 | 严格二叉，难以表达 T 型交叉 | 天然支持任意顶点共享 |
| 调整大小 | 需要递归更新子树 | 直接移动顶点，所有引用自动同步 |
| 合并约束 | 只能合并同一父节点的兄弟 | 只要共享完整边就能合并 |
| 序列化/恢复 | 树结构清晰 | 需要存储顶点+边+面的完整拓扑 |
| 实现复杂度 | 低 | 更高，但灵活性也更高 |

---

### 第 4 层：ScrArea + SpaceType — 编辑器区域

每个 `ScrArea` 是一个矩形编辑器容器。它和编辑器类型的关系：

```
ScrArea (容器)
   ├── spacetype (int)           ← 当前编辑器类型 ID
   ├── SpaceType *type           ← 指向类型定义（回调集合）
   └── spacedata (链表)          ← SpaceLink 历史栈
         ├── [0] SpaceView3D     ← 当前活跃的编辑器数据（第一个）
         ├── [1] SpaceOutliner   ← 上一个切换前的数据（保留）
         └── ...
```

`BKE_screen.hh` 源码注释明确了关系：

> *"an editor in Blender is a combined **ScrArea + SpaceType + SpaceData**."*

`SpaceType` 是编辑器类型的完整回调定义：

```c
struct SpaceType {
    char name[64];              // 菜单显示名 (如 "3D Viewport")
    int spaceid;                // eSpace_Type 枚举值
    int iconid;                 // 图标 ID

    // 生命周期回调
    SpaceLink *(*create)(const ScrArea *, const Scene *);
    void (*free)(SpaceLink *);
    void (*init)(wmWindowManager *, ScrArea *);
    void (*draw)(const bContext *, ARegion *);
    
    // 编辑器专属注册
    void (*operatortypes)();    // 注册 Operator
    void (*keymap)(wmKeyConfig *); // 注册快捷键
    void (*gizmos)();           // 注册 Gizmo

    ListBase regiontypes;       // 该编辑器支持的 ARegionType 列表
};
```

所有编辑器的 Space 数据都以 `SpaceLink` 开头（C 风格的"继承"）：

```c
struct SpaceLink {
    SpaceLink *next, *prev;
    ListBase regionbase;    // 非活跃时缓存的 region 列表
    char spacetype;
};

// 具体编辑器"继承"SpaceLink
struct SpaceView3D {
    SpaceLink link;          // ← 必须是第一个字段
    View3D *v3d;
    RegionView3D *rv3d;
    // ... 3D 视口专有数据
};
```

**编辑器注册**在 `spacetypes.cc` 的 `ED_spacetypes_init()` 中集中完成：

```c
void ED_spacetypes_init() {
    ED_spacetype_view3d();     // 3D Viewport
    ED_spacetype_outliner();   // Outliner
    ED_spacetype_node();       // Node Editor
    ED_spacetype_buttons();    // Properties
    ED_spacetype_info();       // Info
    ED_spacetype_file();       // File Browser
    ED_spacetype_action();     // Dope Sheet
    ED_spacetype_nla();        // NLA
    ED_spacetype_text();       // Text Editor
    ED_spacetype_sequencer();  // Video Sequencer
    ED_spacetype_console();    // Python Console
    ED_spacetype_image();      // Image/UV Editor
    ED_spacetype_ipo();        // Graph Editor
    ED_spacetype_clip();       // Movie Clip Editor
    ED_spacetype_userpref();   // Preferences
    ED_spacetype_statusbar();  // Status Bar
    ED_spacetype_topbar();     // Top Bar
    spreadsheet::register_spacetype(); // Spreadsheet
    // 共 19 种编辑器类型
}
```

---

### 第 5 层：ARegion — 子区域

一个 Area 内部被分为多个 **Region**：

```
┌─────────────────────────────────────┐
│ RGN_TYPE_HEADER        (Header 栏)  │
├──────┬──────────────────┬───────────┤
│      │                  │           │
│TOOLS │ RGN_TYPE_WINDOW  │   UI      │
│(T)   │   (主内容区)     │  (N)      │
│      │                  │           │
├──────┴──────────────────┴───────────┤
│ RGN_TYPE_FOOTER        (状态栏)     │
└─────────────────────────────────────┘
```

```c
enum eRegion_Type {
    RGN_TYPE_WINDOW = 0,       // 主内容区
    RGN_TYPE_HEADER = 1,       // 头部
    RGN_TYPE_CHANNELS = 2,     // 通道区 (Dopesheet/NLA)
    RGN_TYPE_TEMPORARY = 3,    // 临时弹出
    RGN_TYPE_UI = 4,           // 侧边栏 (N-Panel)
    RGN_TYPE_TOOLS = 5,        // 工具栏 (T-Panel)
    RGN_TYPE_TOOL_PROPS = 6,   // 工具属性
    RGN_TYPE_PREVIEW = 7,      // 预览
    RGN_TYPE_HUD = 8,          // HUD 浮窗
    RGN_TYPE_NAV_BAR = 9,      // 导航栏
    RGN_TYPE_FOOTER = 11,      // 底栏
    RGN_TYPE_ASSET_SHELF = 14, // 资产架
};
```

每个 `ARegionType` 提供独立的绘制、布局、事件回调，完全自治。

---

### 第 6 层：AZone — 交互热区

`AZone` 是覆盖在 Area 边角上的透明交互区域，负责触发布局操作：

| 类型 | 枚举值 | 功能 |
|------|--------|------|
| `AZONE_AREA` | 1 | **角落小三角**：拖拽→分割 Area；Ctrl+拖拽→交换 Area |
| `AZONE_REGION` | 2 | **Region 显隐手柄**：折叠的 Region 在边缘露出的拖拽条 |
| `AZONE_FULLSCREEN` | 4 | **全屏退出角标**：编辑器全屏时左上角的退出热区 |
| `AZONE_REGION_SCROLL` | 5 | **自动隐藏滚动条**：鼠标靠近时淡入 |

AZone 有淡入/淡出动画效果（源码中定义了 `AZONEFADEIN` 和 `AZONEFADEOUT` 距离阈值），鼠标接近时渐显，远离时渐隐。

---

## 完整概念关系图

```
┌─────────────────────────────────────────────────────────┐
│ wmWindowManager (全局单例)                                │
│                                                          │
│  ┌─── wmWindow ──────────────────────────────────────┐  │
│  │  GHOST 原生窗口                                     │  │
│  │                                                    │  │
│  │  ┌── WorkSpace ─────────────────────────────────┐ │  │
│  │  │  工作区 (可切换)                                │ │  │
│  │  │                                              │ │  │
│  │  │  ┌── bScreen ────────────────────────────┐  │ │  │
│  │  │  │  屏幕布局 (拓扑网格)                     │  │ │  │
│  │  │  │                                       │  │ │  │
│  │  │  │  ScrVert[] ←→ ScrEdge[]              │  │ │  │
│  │  │  │       ↕ (定义)                         │  │ │  │
│  │  │  │  ScrArea ──── SpaceType + SpaceData  │  │ │  │
│  │  │  │    │                                  │  │ │  │
│  │  │  │    ├── ARegion[] ─── ARegionType     │  │ │  │
│  │  │  │    │     └── Panel[]                  │  │ │  │
│  │  │  │    └── AZone[] (交互热区)              │  │ │  │
│  │  │  └───────────────────────────────────────┘  │ │  │
│  │  └──────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 设计溯源

这套系统由 **Ton Roosendaal**（Blender 创始人）在 1990 年代设计，灵感来自他在 **NeoGeo 动画工作室** 使用 **SGI IRIX 工作站**的经验。它不是模仿任何已有系统，而是**独立发明**的。甚至其中类似 MVC 的架构模式（Operator 作为 Controller、SpaceData 作为 Model、Region Draw 作为 View）也是在不了解 MVC 理论的情况下自然演化出来的。2.5 版本（2009 年）由 Ton 主导重构时正式确立了现在的 Screen/Area/Region 三层体系。

===

如果要用这一套术语来定义我的网页端游戏编辑器，应该怎么定义呢

好问题。我们用 Blender 的这套概念体系作为"语言"，来为微尘编辑器定义一套完整的架构术语。既保留 Blender 验证过的设计智慧，又针对「Web 端 2D 游戏编辑器」做适配裁剪。

---

## 术语映射总表

| Blender 概念 | 微尘对应概念 | 英文命名 | 核心差异 |
|-------------|------------|---------|---------|
| `wmWindowManager` | 编辑器应用 | `EditorApp` | 单例，但无需管理多 OS 窗口 |
| `wmWindow` | 浏览器标签页 | — | 浏览器天然管理，不抽象 |
| `WorkSpace` | 工作区 | `Workspace` | 完全复用概念 |
| `bScreen` | 布局 | `Layout` | 第一版用 BSP 树，不用顶点-边图 |
| `ScrVert` / `ScrEdge` | — | — | 第一版不需要，BSP 树隐式处理 |
| `ScrArea` | 区域 | `Area` | 完全复用概念 |
| `SpaceType` | 编辑器类型 | `EditorType` | 注册制，回调驱动 |
| `SpaceLink` / `SpaceData` | 编辑器实例 | `EditorInstance` | 保留历史栈设计 |
| `ARegion` | 子区域 | `Region` | 完全复用概念 |
| `ARegionType` | 子区域类型 | `RegionType` | 简化，去掉 Gizmo 等 |
| `Panel` | 面板 | `Panel` | 完全复用概念 |
| `AZone` | 交互热区 | `ActionZone` | 完全复用概念 |
| `DNA` | 文档模型 | `Schema` | 序列化为 JSON，不需要二进制 SDNA |
| `RNA` | 属性系统 | `PropertySystem` | 驱动 Inspector 绑定 + 撤销 |
| `wmOperator` | 操作 | `Command` | 对标 Command Pattern |

---

## 逐层定义

### 第一层：EditorApp（应用单例）

```typescript
/**
 * 微尘编辑器的顶层单例。
 * 对标 Blender 的 wmWindowManager，但无需管理 OS 窗口。
 * 
 * 职责：
 * - 持有所有 Workspace 定义
 * - 管理全局快捷键映射
 * - 管理 Command 历史（Undo/Redo 栈）
 * - 协调编辑器类型注册
 */
interface EditorApp {
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  
  commandHistory: CommandHistory;   // Undo/Redo
  editorRegistry: EditorRegistry;   // 所有已注册的 EditorType
  keymap: KeymapManager;            // 全局 + 编辑器级快捷键
  
  project: Project;                 // 当前打开的游戏项目
}
```

Blender 的 `wmWindowManager` 需要管多窗口、多屏幕，而微尘跑在浏览器里，天然单窗口。所以 `EditorApp` 更扁平。

---

### 第二层：Workspace（工作区）

```typescript
/**
 * 用户顶部的 Tab 切换。
 * 对标 Blender 的 WorkSpace。
 * 
 * 每个 Workspace 预设一种工作流的布局和编辑器组合。
 */
interface Workspace {
  id: string;
  name: string;                    // "场景编辑" / "精灵制作" / "动画" / "调试"
  icon: string;
  layout: Layout;                  // 该工作区的布局定义
}
```

微尘可以预设这些 Workspace：

| Workspace | 用途 | 典型编辑器组合 |
|-----------|------|--------------|
| **场景编辑 (Scene)** | 默认工作流 | Viewport + Inspector + Hierarchy + Assets |
| **精灵制作 (Sprite)** | 贴图和精灵表编辑 | SpriteEditor + Inspector + Preview |
| **动画 (Animation)** | 关键帧动画 | Viewport + Timeline + DopeSheet + Inspector |
| **瓦片地图 (Tilemap)** | 关卡设计 | Viewport + TilePalette + Inspector + Layers |
| **调试 (Debug)** | 运行时调试 | GamePreview + Console + Inspector + Profiler |

---

### 第三层：Layout（布局）

```typescript
/**
 * 定义 Area 如何在空间中排布。
 * 对标 Blender 的 bScreen。
 * 
 * 第一版使用 BSP 树而非顶点-边图。
 * 当需要更灵活的拓扑时再升级。
 */
type Layout = AreaNode | SplitNode;

interface SplitNode {
  type: 'split';
  id: string;
  direction: 'horizontal' | 'vertical';
  ratio: number;                    // 0.1 ~ 0.9
  children: [Layout, Layout];
}

interface AreaNode {
  type: 'area';
  id: string;
  editorType: string;               // EditorType 的注册 ID
  editorStack: EditorInstance[];     // 历史栈，[0] = 当前激活的
}
```

**和 Blender 的关键差异**：

| 方面 | Blender (bScreen) | 微尘 (Layout) |
|------|-------------------|--------------|
| 拓扑结构 | ScrVert/ScrEdge 平面图 | BSP 二叉树 |
| 序列化 | 二进制 SDNA | JSON |
| 多窗口 | 一个 Window 一个 Screen | 不需要，单窗口 |
| 全局区域 | global_areas (TopBar) | 单独的 React 组件，不进布局树 |

---

### 第四层：Area + EditorType + EditorInstance

这是编辑器系统的核心三角关系：

```
Area（物理空间）─── 持有 ──→ EditorInstance（运行时数据）
                                    │
                                    └── 由 ──→ EditorType（类型定义/回调集）创建
```

#### EditorType（编辑器类型注册）

```typescript
/**
 * 编辑器类型的完整定义。
 * 对标 Blender 的 SpaceType。
 * 
 * 通过 editorRegistry.register() 注册。
 * 所有同类型编辑器共享同一个 EditorType 实例。
 */
interface EditorType {
  id: string;                       // 'viewport' | 'inspector' | 'timeline' ...
  name: string;                     // 显示名："场景视口"
  icon: string;
  
  // 生命周期
  create(): EditorInstance;
  destroy(instance: EditorInstance): void;
  
  // 区域定义：这个编辑器类型包含哪些 Region
  regionTypes: RegionType[];
  
  // 功能注册
  commands?: CommandDef[];          // 该编辑器提供的操作
  keymaps?: KeymapDef[];            // 该编辑器的快捷键
  dropHandlers?: DropHandlerDef[];  // 拖放处理
  
  // 渲染（主区域）
  component: ComponentType<EditorProps>;  // Preact 组件
}
```

#### EditorInstance（编辑器实例数据）

```typescript
/**
 * 某个 Area 中某个编辑器的运行时状态。
 * 对标 Blender 的 SpaceLink / SpaceData。
 * 
 * 切换编辑器类型时，旧的 instance 保留在 Area.editorStack 中。
 */
interface EditorInstance {
  typeId: string;                   // 对应哪个 EditorType
  state: Record<string, any>;       // 编辑器私有状态
}

// 例：场景视口的实例状态
interface ViewportState {
  camera: { x: number; y: number; zoom: number };
  gridVisible: boolean;
  gizmoMode: 'translate' | 'rotate' | 'scale';
  selectedEntities: string[];
}

// 例：时间线的实例状态
interface TimelineState {
  currentFrame: number;
  playbackRange: [number, number];
  zoom: number;
  scrollX: number;
}
```

#### 微尘需要的 EditorType 清单

| EditorType ID | 名称 | 主区域内容 | 核心状态 |
|--------------|------|-----------|---------|
| `viewport` | 场景视口 | 2D Canvas（WebGPU/Canvas2D） | camera, selection, gizmo |
| `inspector` | 属性检查器 | 属性面板列表 | pinned entity, scroll |
| `hierarchy` | 场景层级 | 树形列表 | expanded nodes, filter |
| `assets` | 资源浏览器 | 网格缩略图 | current folder, view mode |
| `timeline` | 时间线 | 关键帧轨道 | frame, range, zoom |
| `console` | 控制台 | 日志输出 + 输入框 | log buffer, filter level |
| `sprite_editor` | 精灵编辑器 | 图片裁剪视口 | current texture, slices |
| `tile_palette` | 瓦片面板 | 瓦片选择网格 | current tileset, selected |
| `code` | 脚本编辑器 | Monaco/CodeMirror | open files, cursor pos |
| `preview` | 游戏预览 | 运行时 Canvas | play state |

---

### 第五层：Region + RegionType

```typescript
/**
 * Area 内部的子区域。
 * 对标 Blender 的 ARegion + ARegionType。
 */
interface RegionType {
  id: string;                       // 'header' | 'main' | 'sidebar' | 'toolbar' | 'footer'
  position: 'top' | 'bottom' | 'left' | 'right' | 'fill';
  defaultSize?: number;             // 像素高/宽，'fill' 不需要
  resizable?: boolean;              // 是否可拖拽调整
  collapsible?: boolean;            // 是否可折叠（对标 N/T panel 切换）
  defaultVisible?: boolean;
  component: ComponentType<RegionProps>;
}
```

每个 EditorType 组合不同的 Region：

```
Viewport 编辑器:
┌─────────────────────────────────────┐
│ header: 工具栏按钮 + 模式切换         │  position: top, 32px
├──────┬──────────────────────────────┤
│ tool │                              │  toolbar: position: left, 40px
│ bar  │     main: 2D Canvas          │  main: position: fill
│      │                              │
├──────┴──────────────────────────────┤
│ footer: 坐标 + 缩放比例 + 帧率       │  position: bottom, 24px
└─────────────────────────────────────┘

Inspector 编辑器:
┌─────────────────────────────────────┐
│ header: 锁定按钮 + 搜索框            │  position: top, 32px
├─────────────────────────────────────┤
│                                     │
│     main: Panel 列表（可滚动）        │  position: fill
│       ├─ Transform Panel            │
│       ├─ Sprite Renderer Panel      │
│       ├─ Physics Panel              │
│       └─ Script Panel               │
│                                     │
└─────────────────────────────────────┘
```

---

### 第六层：Panel（面板）

```typescript
/**
 * Region 内的可折叠内容块。
 * 对标 Blender 的 Panel / PanelType。
 * 
 * 主要用在 Inspector 类编辑器中。
 */
interface PanelType {
  id: string;                       // 'transform' | 'sprite_renderer' | 'physics'
  label: string;
  icon?: string;
  category?: string;                // 分类 Tab（对标 Blender Properties 的 Tab 栏）
  order: number;                    // 排序优先级
  
  // 条件显示：只在选中特定类型的对象时才出现
  poll?(context: EditorContext): boolean;
  
  component: ComponentType<PanelProps>;
}
```

---

### 第七层：ActionZone（交互热区）

```typescript
/**
 * Area 边缘/角落的交互热区。
 * 对标 Blender 的 AZone。
 */
interface ActionZone {
  type: 'split' | 'resize' | 'scroll';
  areaId: string;
  rect: Rect;                       // 热区矩形
  cursor: string;                   // CSS cursor
}
```

第一版可以简化为三种热区：
- **角落三角形（8×8px）**：拖拽触发 Split
- **边界线（4px 宽）**：拖拽触发 Resize
- **Header 左上角下拉**：切换 EditorType

---

### 横切层：Command（操作/命令）

```typescript
/**
 * 所有用户操作的统一抽象。
 * 对标 Blender 的 wmOperator。
 * 
 * 核心价值：统一了 Undo/Redo、快捷键绑定、菜单、宏录制。
 */
interface CommandDef {
  id: string;                       // 'viewport.translate' / 'entity.delete'
  label: string;
  icon?: string;
  
  // 前置条件
  poll?(ctx: EditorContext): boolean;
  
  // 执行（返回可撤销的逆操作数据）
  execute(ctx: EditorContext, params?: any): CommandResult;
}

interface CommandResult {
  undoData?: any;                   // 供 undo 使用的数据
  status: 'finished' | 'cancelled' | 'running';
}
```

---

### 横切层：PropertySystem（属性系统）

```typescript
/**
 * 运行时属性元数据。
 * 对标 Blender 的 RNA。
 * 
 * 让 Inspector 的 Panel 可以自动绑定到任意组件的属性，
 * 而不需要为每个组件手写 UI。
 */
interface PropertyDef {
  key: string;
  type: 'number' | 'string' | 'boolean' | 'vec2' | 'color' | 'enum' | 'asset_ref';
  label: string;
  description?: string;
  
  // 约束
  min?: number;
  max?: number;
  step?: number;
  enumItems?: { value: string; label: string }[];
  
  // 回调
  onChange?(entity: Entity, oldValue: any, newValue: any): void;
}

// 使用示例：Transform 组件的属性注册
const TransformProps: PropertyDef[] = [
  { key: 'position', type: 'vec2', label: '位置' },
  { key: 'rotation', type: 'number', label: '旋转', min: -360, max: 360, step: 0.1 },
  { key: 'scale',    type: 'vec2', label: '缩放' },
];
```

有了 PropertySystem，Inspector 就可以这样工作：

```
选中一个 Entity
    → 遍历它的所有 Component
        → 每个 Component 查询注册的 PropertyDef[]
            → 自动生成对应的 UI 控件（数字输入框、颜色选择器、下拉菜单...）
                → 控件的 onChange 直接写回 Component 属性
                    → 同时生成 Command 记录，推入 Undo 栈
```

---

## 完整架构图

```
EditorApp (单例)
 │
 ├─ EditorRegistry                    ← 所有 EditorType 在这里注册
 │    ├─ viewport: EditorType
 │    ├─ inspector: EditorType
 │    ├─ hierarchy: EditorType
 │    ├─ timeline: EditorType
 │    └─ ...
 │
 ├─ CommandHistory                    ← Undo/Redo 栈
 │
 ├─ KeymapManager                    ← 全局 + 各编辑器的快捷键映射
 │
 ├─ PropertySystem                   ← 组件属性元数据注册表
 │
 ├─ Project                          ← 当前游戏项目（场景树、资源索引）
 │
 └─ Workspace[]                      ← 顶部 Tab
      │
      └─ Workspace
           ├─ name: "场景编辑"
           └─ Layout (BSP Tree)
                │
                ├─ SplitNode
                │    ├─ direction: 'vertical'
                │    ├─ ratio: 0.75
                │    └─ children:
                │         ├─ SplitNode (horizontal, 0.7)
                │         │    ├─ Area ──→ EditorInstance(viewport) ──→ [Region...]
                │         │    └─ Area ──→ EditorInstance(timeline) ──→ [Region...]
                │         └─ SplitNode (horizontal, 0.5)
                │              ├─ Area ──→ EditorInstance(hierarchy)
                │              └─ Area ──→ EditorInstance(inspector)
                │                              │
                │                              └─ Region(main)
                │                                   ├─ Panel(transform)
                │                                   ├─ Panel(sprite_renderer)
                │                                   └─ Panel(physics)
                └─ ActionZone[] (根据 Layout 自动生成)
```

---

## 第一版实现优先级

| 优先级 | 模块 | 原因 |
|--------|------|------|
| **P0** | Layout + Area + SplitHandle | 骨架，没有这个其他都没法展示 |
| **P0** | EditorType + EditorRegistry | 编辑器的插件化基础 |
| **P0** | Region (header + main) | 最小可用区域结构 |
| **P1** | Workspace + 序列化 | 布局持久化和预设切换 |
| **P1** | Command + CommandHistory | 有了才能做 Undo/Redo |
| **P1** | 3~4 个基础 EditorType | viewport / inspector / hierarchy / console |
| **P2** | PropertySystem | Inspector 自动绑定 |
| **P2** | Panel 系统 | Inspector 内的折叠面板 |
| **P2** | ActionZone (Split/Join) | 用右键菜单可以暂时替代 |
| **P3** | KeymapManager | 前期硬编码快捷键即可 |
| **P3** | editorStack 历史切换 | 锦上添花 |

这套术语体系定义好之后，后续讨论架构、写文档、做 Code Review 都可以用同一套语言。要不要把这份定义输出成一个飞书文档，作为微尘编辑器的架构设计文档？

===

我希望第一版，把 tile sets，tile editor，跑通tile导入，地图绘制，导出，给游戏直接使用

好，目标非常清晰。把第一版的范围锁死在 **Tilemap 工作流闭环**——从这一条线来驱动整个编辑器骨架的落地。

---

## 第一版范围定义

```
导入 TileSet 图片 → 切片配置 → 在 TileMap 上绘制 → 多图层管理 → 导出 JSON → 游戏引擎加载
```

砍掉所有与此无关的功能，只保留能跑通这条链路的最小集。

---

## 架构裁剪：只留这些

```
EditorApp
 └─ Workspace: "Tilemap"（第一版唯一的 Workspace，不做切换）
      └─ Layout (BSP Tree)
           ┌──────────────────┬─────────────────┐
           │                  │   TilePalette    │
           │    Viewport      │   (瓦片选择面板)  │
           │   (地图画布)      ├─────────────────┤
           │                  │   Inspector      │
           │                  │  (属性/图层管理)  │
           └──────────────────┴─────────────────┘
```

只需要 **3 个 EditorType**，不多不少。

---

## 数据模型（Schema 层）

### TileSet —— 瓦片集

```typescript
/**
 * 一张切好的瓦片图集。
 * 对应一张 spritesheet 图片 + 切片规则。
 */
interface TileSet {
  id: string;
  name: string;                     // "overworld_tiles"
  
  // 图片源
  imageUrl: string;                 // ObjectURL 或导入后的 base64/blob 路径
  imageWidth: number;               // 原图宽（像素）
  imageHeight: number;              // 原图高（像素）
  
  // 切片规则
  tileWidth: number;                // 单个瓦片宽，如 16
  tileHeight: number;               // 单个瓦片高，如 16
  margin: number;                   // 图片外边距，默认 0
  spacing: number;                  // 瓦片间距，默认 0
  
  // 派生（由切片规则自动算出）
  columns: number;                  // 列数
  rows: number;                     // 行数
  tileCount: number;                // 总瓦片数
  
  // 单瓦片元数据（可选，第一版可以先不做）
  tileMeta?: Record<number, TileMeta>;
}

interface TileMeta {
  name?: string;                    // 给特定瓦片命名
  collision?: boolean;              // 碰撞标记
  customProps?: Record<string, any>;
}
```

### TileMap —— 瓦片地图

```typescript
/**
 * 一张完整的瓦片地图。
 * 包含多个图层，每层是一个 2D 网格。
 */
interface TileMap {
  id: string;
  name: string;                     // "level_01"
  
  // 地图尺寸
  width: number;                    // 列数（瓦片计）
  height: number;                   // 行数（瓦片计）
  tileWidth: number;                // 渲染时单瓦片宽（像素）
  tileHeight: number;               // 渲染时单瓦片高（像素）
  
  // 引用的 TileSet
  tilesets: TileSetRef[];
  
  // 图层
  layers: TileLayer[];
}

interface TileSetRef {
  tilesetId: string;                // 引用哪个 TileSet
  firstGid: number;                 // 全局起始 ID（Tiled 的 GID 机制）
}

interface TileLayer {
  id: string;
  name: string;                     // "background" / "foreground" / "collision"
  visible: boolean;
  opacity: number;                  // 0.0 ~ 1.0
  locked: boolean;
  
  // 核心数据：一维数组，row-major 排列
  // data[y * width + x] = globalTileId (0 = 空)
  data: Uint32Array;
}
```

### GID（全局瓦片 ID）规则

这套规则直接照搬 Tiled 的 GID 机制，因为它已经是事实标准：

```
TileSet A: firstGid = 1,   tileCount = 100  → GID 1~100
TileSet B: firstGid = 101, tileCount = 50   → GID 101~150

GID 0 = 空（无瓦片）

给定 GID 87:
  → 属于 TileSet A（因为 1 ≤ 87 ≤ 100）
  → 在 TileSet A 中的局部 ID = 87 - 1 = 86
  → 行 = floor(86 / columns), 列 = 86 % columns
  → 从 spritesheet 中裁出对应矩形
```

---

## 三个 EditorType 详细设计

### 1. Viewport —— 地图画布

```typescript
const ViewportEditor: EditorType = {
  id: 'viewport',
  name: '地图视口',
  icon: 'grid',
  
  regionTypes: [
    {
      id: 'header',
      position: 'top',
      defaultSize: 36,
      // 内容：工具切换（笔刷/橡皮/选区/填充/吸管）、缩放比例、网格开关
    },
    {
      id: 'main',
      position: 'fill',
      // 内容：Canvas2D 渲染的瓦片地图
    },
    {
      id: 'footer',
      position: 'bottom',
      defaultSize: 24,
      // 内容：鼠标坐标（瓦片坐标）、当前图层名、地图尺寸
    },
  ],
};
```

**Viewport 状态：**

```typescript
interface ViewportState {
  // 摄像机
  camera: { x: number; y: number; zoom: number };
  
  // 当前工具
  activeTool: 'brush' | 'eraser' | 'fill' | 'rect' | 'eyedropper';
  
  // 笔刷（可以是多个瓦片组成的矩形区域）
  brush: {
    tiles: number[];            // GID 数组
    width: number;              // 笔刷列数
    height: number;             // 笔刷行数
  };
  
  // 显示选项
  showGrid: boolean;
  showCollision: boolean;       // 叠加显示碰撞层
  highlightActiveLayer: boolean; // 非激活层半透明
}
```

**Viewport 的 Canvas 渲染流程：**

```
每帧 / 每次状态变化时:
  1. 清空 Canvas
  2. 应用 camera 变换（translate + scale）
  3. 计算可见瓦片范围（基于 camera 和 canvas 尺寸，避免绘制屏外瓦片）
  4. 从底层到顶层遍历 layers:
     a. 跳过 visible=false 的层
     b. 设置 globalAlpha = layer.opacity（非激活层额外降低）
     c. 遍历可见范围内的每个格子
     d. 查 GID → 定位 TileSet → 算出 spritesheet 上的裁剪矩形
     e. drawImage(spritesheet, sx, sy, sw, sh, dx, dy, dw, dh)
  5. 绘制网格线（如果开启）
  6. 绘制笔刷预览（鼠标悬停位置的半透明瓦片）
  7. 绘制选区高亮（如果有）
```

### 2. TilePalette —— 瓦片选择面板

```typescript
const TilePaletteEditor: EditorType = {
  id: 'tile_palette',
  name: '瓦片面板',
  icon: 'palette',
  
  regionTypes: [
    {
      id: 'header',
      position: 'top',
      defaultSize: 36,
      // 内容：TileSet 切换下拉框、导入按钮
    },
    {
      id: 'main',
      position: 'fill',
      // 内容：Canvas 渲染的瓦片网格，可点选/框选
    },
  ],
};
```

**交互行为：**

| 操作 | 效果 |
|------|------|
| 单击瓦片 | 选中为 1×1 笔刷 |
| 拖拽框选 | 选中矩形区域为多瓦片笔刷 |
| 右键瓦片 | 编辑单瓦片属性（碰撞、自定义标记） |
| 滚轮 | 缩放瓦片显示大小 |
| Header 的 "导入" | 打开文件选择器，导入 PNG 图片 |

### 3. Inspector —— 属性与图层管理

```typescript
const InspectorEditor: EditorType = {
  id: 'inspector',
  name: '属性',
  icon: 'settings',
  
  regionTypes: [
    {
      id: 'header',
      position: 'top',
      defaultSize: 36,
    },
    {
      id: 'main',
      position: 'fill',
      // 内容：Panel 列表
    },
  ],
};
```

**Inspector 中的 Panel：**

```
┌─────────────────────────────┐
│ ▼ 地图属性                    │  Panel: map_props
│   名称: [level_01        ]   │
│   尺寸: [40] × [30] 瓦片     │
│   瓦片大小: [16] × [16] px   │
├─────────────────────────────┤
│ ▼ 图层                       │  Panel: layers
│   [👁][🔒] ▌foreground    ▲  │
│   [👁][🔒] ▌background    │  │  ← 拖拽排序
│   [👁][🔒] ▌collision     ▼  │
│   [+ 添加图层]               │
├─────────────────────────────┤
│ ▼ 当前图层                    │  Panel: active_layer
│   名称: [foreground      ]   │
│   不透明度: ████████░░ 80%   │
│   □ 锁定编辑                  │
├─────────────────────────────┤
│ ▼ 瓦片集                     │  Panel: tilesets
│   overworld_tiles (16×16)    │
│   dungeon_tiles   (16×16)    │
│   [+ 导入瓦片集]              │
├─────────────────────────────┤
│ ▼ 导出                       │  Panel: export
│   格式: [JSON ▾]             │
│   [导出地图数据]              │
└─────────────────────────────┘
```

---

## 导入流程

```
用户点击 "导入瓦片集"
    │
    ▼
浏览器 <input type="file" accept=".png,.jpg,.webp"> 
    │
    ▼
读取为 Blob → createObjectURL → 加载到 Image 对象
    │
    ▼
弹出配置对话框（Modal）:
    ┌──────────────────────────────────┐
    │  导入瓦片集                       │
    │                                  │
    │  [预览图: 自动叠加网格线]          │
    │                                  │
    │  瓦片宽: [16]  瓦片高: [16]       │
    │  边距:   [0]   间距:   [0]        │
    │                                  │
    │  检测到: 20列 × 15行 = 300 瓦片   │
    │                                  │
    │  [取消]              [确认导入]   │
    └──────────────────────────────────┘
    │
    ▼
创建 TileSet 对象 → 加入 Project 的 tilesets 列表
    │
    ▼
自动设为当前 TilePalette 显示的 TileSet
```

---

## 导出格式

设计两种，一种面向你的微尘引擎直接使用，一种兼容 Tiled 生态：

### 微尘原生格式（.weichen.json）

```json
{
  "version": "1.0",
  "type": "tilemap",
  "name": "level_01",
  "width": 40,
  "height": 30,
  "tileWidth": 16,
  "tileHeight": 16,
  
  "tilesets": [
    {
      "name": "overworld_tiles",
      "image": "assets/overworld_tiles.png",
      "tileWidth": 16,
      "tileHeight": 16,
      "columns": 20,
      "rows": 15,
      "firstGid": 1,
      "tileCount": 300,
      "margin": 0,
      "spacing": 0,
      "tileMeta": {
        "45": { "collision": true },
        "46": { "collision": true }
      }
    }
  ],
  
  "layers": [
    {
      "name": "background",
      "type": "tilelayer",
      "visible": true,
      "opacity": 1.0,
      "data": [0,0,1,1,2,2,0,0,...]
    },
    {
      "name": "foreground",
      "type": "tilelayer",
      "visible": true,
      "opacity": 1.0,
      "data": [0,0,0,0,45,46,0,0,...]
    },
    {
      "name": "collision",
      "type": "tilelayer",
      "visible": false,
      "opacity": 0.5,
      "data": [0,0,0,0,1,1,0,0,...]
    }
  ]
}
```

### 游戏引擎加载侧代码示例

```typescript
// 游戏引擎中加载 tilemap 的代码
class TileMapRenderer {
  private tilesets: Map<string, HTMLImageElement> = new Map();
  
  async load(url: string) {
    const res = await fetch(url);
    const data: TileMapData = await res.json();
    
    // 预加载所有 tileset 图片
    await Promise.all(data.tilesets.map(ts => 
      this.loadImage(ts.name, ts.image)
    ));
    
    this.mapData = data;
  }
  
  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    for (const layer of this.mapData.layers) {
      if (!layer.visible) continue;
      ctx.globalAlpha = layer.opacity;
      
      for (let y = 0; y < this.mapData.height; y++) {
        for (let x = 0; x < this.mapData.width; x++) {
          const gid = layer.data[y * this.mapData.width + x];
          if (gid === 0) continue;
          
          const { tileset, localId } = this.resolveTile(gid);
          const sx = (localId % tileset.columns) * tileset.tileWidth;
          const sy = Math.floor(localId / tileset.columns) * tileset.tileHeight;
          
          ctx.drawImage(
            this.tilesets.get(tileset.name)!,
            sx, sy, tileset.tileWidth, tileset.tileHeight,
            x * this.mapData.tileWidth - cameraX,
            y * this.mapData.tileHeight - cameraY,
            this.mapData.tileWidth,
            this.mapData.tileHeight
          );
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}
```

---

## 绘制工具的 Command 定义

```typescript
// 笔刷绘制 Command —— 支持 Undo/Redo
interface PaintCommand {
  id: 'viewport.paint';
  layerId: string;
  // 记录每个被修改的格子的旧值和新值
  changes: Array<{
    x: number;
    y: number;
    oldGid: number;
    newGid: number;
  }>;
}

// 执行
function executePaint(map: TileMap, cmd: PaintCommand) {
  const layer = map.layers.find(l => l.id === cmd.layerId)!;
  for (const c of cmd.changes) {
    layer.data[c.y * map.width + c.x] = c.newGid;
  }
}

// 撤销
function undoPaint(map: TileMap, cmd: PaintCommand) {
  const layer = map.layers.find(l => l.id === cmd.layerId)!;
  for (const c of cmd.changes) {
    layer.data[c.y * map.width + c.x] = c.oldGid;
  }
}
```

**关键优化**：绘制过程中（鼠标按住拖动），持续收集 changes 但不推入 undo 栈。直到鼠标松开时，把整个拖动过程合并为一个 Command 推入栈。这样 `Ctrl+Z` 是撤销一整笔画，而不是一个像素。

---

## 完整文件结构

```
src/
├── core/
│   ├── EditorApp.ts                 # 单例入口
│   ├── Command.ts                   # Command 接口 + CommandHistory
│   └── Project.ts                   # TileSet[] + TileMap[] 管理
│
├── layout/
│   ├── types.ts                     # Layout / SplitNode / AreaNode
│   ├── tree.ts                      # split / join / resize
│   ├── rect.ts                      # computeRects
│   └── serialize.ts                 # JSON ↔ Layout
│
├── components/
│   ├── LayoutRoot.tsx               # 根容器
│   ├── AreaView.tsx                 # Area 壳
│   ├── SplitHandle.tsx              # 拖拽分割线
│   ├── RegionShell.tsx              # Region 通用壳（header/main/footer）
│   └── Modal.tsx                    # 导入配置弹窗
│
├── editors/
│   ├── registry.ts                  # EditorType 注册表
│   │
│   ├── viewport/
│   │   ├── ViewportEditor.tsx       # EditorType 注册 + 根组件
│   │   ├── ViewportCanvas.tsx       # Canvas2D 渲染逻辑
│   │   ├── ViewportHeader.tsx       # 工具栏
│   │   ├── ViewportFooter.tsx       # 状态栏
│   │   ├── tools/
│   │   │   ├── BrushTool.ts         # 笔刷
│   │   │   ├── EraserTool.ts        # 橡皮
│   │   │   ├── FillTool.ts          # 填充（Flood Fill）
│   │   │   ├── RectTool.ts          # 矩形绘制
│   │   │   └── EyedropperTool.ts    # 吸管
│   │   └── rendering/
│   │       ├── renderLayers.ts      # 图层渲染
│   │       ├── renderGrid.ts        # 网格线
│   │       └── renderBrushPreview.ts
│   │
│   ├── tile-palette/
│   │   ├── TilePaletteEditor.tsx    # EditorType 注册 + 根组件
│   │   ├── PaletteCanvas.tsx        # TileSet 网格渲染
│   │   └── PaletteHeader.tsx        # TileSet 切换 + 导入按钮
│   │
│   └── inspector/
│       ├── InspectorEditor.tsx      # EditorType 注册 + 根组件
│       └── panels/
│           ├── MapPropsPanel.tsx     # 地图属性
│           ├── LayersPanel.tsx       # 图层管理（排序/显隐/锁定）
│           ├── ActiveLayerPanel.tsx  # 当前图层属性
│           ├── TileSetsPanel.tsx     # TileSet 列表管理
│           └── ExportPanel.tsx       # 导出按钮 + 格式选择
│
├── data/
│   ├── TileSet.ts                   # TileSet 类型 + 工具函数
│   ├── TileMap.ts                   # TileMap 类型 + 工具函数
│   ├── TileLayer.ts                 # TileLayer 操作
│   ├── gid.ts                       # GID 解析（gid → tileset + localId）
│   └── import-export/
│       ├── importTileSet.ts         # 图片 → TileSet
│       └── exportTileMap.ts         # TileMap → JSON 下载
│
├── store/
│   ├── layout.ts                    # Layout 状态 (Signal)
│   ├── project.ts                   # Project 状态 (Signal)
│   ├── viewport.ts                  # Viewport 状态 (Signal)
│   └── selection.ts                 # 当前笔刷 / 选中图层 (Signal)
│
├── hooks/
│   ├── useDrag.ts                   # 通用拖拽
│   ├── useCanvas.ts                 # Canvas 渲染循环管理
│   └── useKeyboard.ts              # 快捷键分发
│
├── App.tsx                          # 顶层：Toolbar + LayoutRoot
├── main.tsx                         # Vite 入口
└── index.css                        # 全局样式（暗色主题）
```

---

## 实施节奏

| 阶段 | 天数 | 交付物 | 验收标准 |
|------|------|--------|---------|
| **S1: 骨架** | 2~3 天 | Layout + Area + SplitHandle + 3 个空 Editor 壳 | 能拖拽分割线调整三个面板大小 |
| **S2: 数据** | 1~2 天 | TileSet / TileMap / TileLayer 类型 + GID 解析 + 导入流程 | 能导入 PNG 生成 TileSet 对象 |
| **S3: 选瓦片** | 1~2 天 | TilePalette Canvas 渲染 + 点选/框选 | 能看到切好的瓦片并选中 |
| **S4: 画地图** | 2~3 天 | Viewport Canvas 渲染 + Brush/Eraser 工具 + 多图层 | 能画出一张多层瓦片地图 |
| **S5: 导出** | 1 天 | exportTileMap → JSON 下载 | 导出的 JSON 能被加载代码正确渲染 |
| **S6: 完善** | 2~3 天 | Undo/Redo、Fill 工具、图层排序拖拽、localStorage 持久化 | 基本可用的编辑体验 |

**总计约 10~14 天**可以跑通完整闭环。

要开始动手写代码了吗？可以从 S1 骨架开始，我直接生成 Vite + Preact 的初始项目。

===

直接生成初始项目

项目已打包上传：[weichen-editor.tar.gz](https://mira.bytedance.com/mira/api/v1/file/d/tos-mya-i-xobrcjvdq7/4d22a403b6d94793ba56950f7d095cf6.gz~tplv-xobrcjvdq7-image?sign=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIxMDkzOTE3IiwidXJpIjoidG9zLW15YS1pLXhvYnJjanZkcTcvNGQyMmE0MDNiNmQ5NDc5M2JhNTY5NTBmN2QwOTVjZjYuZ3oiLCJhdXQiOjAsImlzcyI6Im1pcmEiLCJleHAiOjE3NzU3NTQwMDB9.QpM1mXS1mf1vu1J3FthNDP5ciYpFKuLiWEp30-VAPZI)

## 本地启动

```bash
tar xzf weichen-editor.tar.gz
cd weichen-editor
npm install
npm run dev
```

浏览器打开 `http://localhost:5173` 即可看到编辑器。

---

## 项目包含的 37 个文件

```
weichen-editor/
├── package.json / tsconfig.json / vite.config.ts / index.html
│
├── src/
│   ├── main.tsx                          # Vite 入口
│   ├── App.tsx                           # 顶层：全局 TopBar + LayoutRoot
│   ├── index.css                         # 暗色主题全局样式
│   │
│   ├── layout/                           # ◆ 布局系统（BSP 树）
│   │   ├── types.ts                      #   LayoutNode / Rect / SplitInfo
│   │   ├── rect.ts                       #   computeRects() 递归矩形计算
│   │   └── tree.ts                       #   split / resize / setEditorType
│   │
│   ├── data/                             # ◆ 数据模型（Schema 层）
│   │   ├── TileSet.ts                    #   TileSet + 切片 + getSrcRect
│   │   ├── TileMap.ts                    #   TileMap + TileLayer + GID 解析
│   │   └── export.ts                     #   导出 .weichen.json + 下载
│   │
│   ├── core/
│   │   └── Command.ts                    #   Command + CommandHistory (Undo/Redo)
│   │
│   ├── store/                            # ◆ 状态管理（Preact Signals）
│   │   ├── layout.ts                     #   layoutTree + containerSize + computed
│   │   ├── project.ts                    #   tilesets + currentMap + activeLayer
│   │   └── selection.ts                  #   activeTool + brush + hoverTile
│   │
│   ├── hooks/
│   │   ├── useDrag.ts                    #   通用 Pointer 拖拽 hook
│   │   └── useCanvas.ts                  #   Canvas DPR + ResizeObserver
│   │
│   ├── components/                       # ◆ 布局组件
│   │   ├── LayoutRoot.tsx                #   根容器，渲染所有 Area + SplitHandle
│   │   ├── AreaView.tsx                  #   单个 Area 壳（查 registry 挂编辑器）
│   │   ├── SplitHandle.tsx               #   拖拽分割线（resize）
│   │   └── EditorSwitcher.tsx            #   编辑器类型切换下拉
│   │
│   └── editors/                          # ◆ 三个 EditorType
│       ├── registry.ts                   #   注册表 register/get/getAll
│       │
│       ├── viewport/                     #   地图视口
│       │   ├── ViewportEditor.tsx        #     注册 + 壳
│       │   ├── ViewportCanvas.tsx        #     Canvas2D 渲染 + 绘制工具 + 平移缩放
│       │   ├── ViewportHeader.tsx        #     工具栏（笔刷/橡皮/填充/吸管）
│       │   └── ViewportFooter.tsx        #     状态栏（坐标/图层名）
│       │
│       ├── tile-palette/                 #   瓦片面板
│       │   ├── TilePaletteEditor.tsx     #     注册 + 壳
│       │   ├── PaletteHeader.tsx         #     TileSet 选择 + 导入按钮
│       │   └── PaletteCanvas.tsx         #     瓦片网格渲染 + 点选/框选
│       │
│       └── inspector/                    #   属性面板
│           ├── InspectorEditor.tsx       #     注册 + 壳
│           └── panels/
│               ├── PanelShell.tsx        #       可折叠面板容器
│               ├── MapPropsPanel.tsx     #       地图名称/尺寸/瓦片大小
│               ├── LayersPanel.tsx       #       图层列表（显隐/锁定/增删）
│               ├── TileSetsPanel.tsx     #       瓦片集列表
│               └── ExportPanel.tsx       #       导出按钮
```

---

## 已实现的功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 瓦片式布局（BSP 树） | ✅ | 三面板自由拖拽分割线调整大小 |
| 编辑器类型注册 + 切换 | ✅ | EditorRegistry + 下拉切换 |
| 导入 TileSet（PNG） | ✅ | 文件选择 → 自动切片 → 加入项目 |
| 瓦片面板选择 | ✅ | 点选单瓦片 / 拖拽框选多瓦片笔刷 |
| 地图绘制 | ✅ | 笔刷、橡皮、填充（Flood Fill）、吸管 |
| 多图层 | ✅ | 添加/删除/显隐/锁定/切换激活层 |
| 视口交互 | ✅ | Alt+拖拽平移、滚轮缩放、网格线、笔刷预览 |
| 地图属性编辑 | ✅ | 名称/尺寸/瓦片大小，resize 自动迁移数据 |
| 导出 JSON | ✅ | `.weichen.json` 一键下载 |
| 暗色主题 | ✅ | Blender 风格深灰色调 |
| Command 系统 | ✅ 框架 | CommandHistory 已就位，绘制操作的接入留作 S6 |

---

## 使用流程

1. **导入瓦片集**：右侧瓦片面板 → 点「导入」→ 选择 PNG 图片（默认按 16×16 切片）
2. **选择瓦片**：在瓦片面板中点击或框选瓦片
3. **绘制地图**：在左侧视口中点击/拖拽绘制，Alt+拖拽平移画布，滚轮缩放
4. **管理图层**：右侧属性面板「图层」区域，添加/切换/显隐图层
5. **导出**：属性面板底部「导出」→ 点击「导出地图数据」，下载 JSON 文件

导出的 JSON 可以直接用上一轮我给的 `TileMapRenderer` 代码在游戏中加载渲染。

