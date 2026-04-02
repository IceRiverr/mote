核心策略：垂直切片
不是 按模块横向铺开（先做完布局→再做完 Bridge→再做面板），而是以 「能在 Blender 风格编辑器里画 Tile」 为目标做一条垂直切片，只实现这条路径上必须的东西。
传统横向铺开（原 P0→P4）：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ProjectManager ████████████████
  EditorBridge   ████████████████
  AreaTree       ████████████████
  Theme CSS      ████████████████
  ...漫长等待...                    → 终于能看到东西

垂直切片（新策略）：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Sprint 1  AreaTree骨架 + 暗色主题 + Canvas占位
  Sprint 2  TileSet导入 + 图集面板
  Sprint 3  TileMap笔刷 + 渲染
  Sprint 4  导入/导出JSON + Undo        → 每步都能看到东西

---
依赖分析：画一笔 Tile 需要什么
从终态「用户在编辑器里点击画了一个 Tile」反推，逐层列出最小依赖：
用户点击 Canvas 画了一个 Tile
 ├─ Canvas 渲染了 TileMap 网格 + 已有 Tile
 │   ├─ TileMap 数据模型（内存中的二维数组）
 │   ├─ TileSet 图片已加载（Image/ImageBitmap）
 │   └─ Canvas 2D 或 WebGPU 渲染循环
 ├─ 用户选中了要画的 Tile（从 TileSet 面板点选）
 │   ├─ TileSet 面板组件（显示图集网格，可点选）
 │   └─ 当前选中 tileId 状态
 ├─ Canvas 上的鼠标事件 → 屏幕坐标转网格坐标
 │   └─ 视口 Camera（pan + zoom）
 └─ 画的结果写入 TileMap 数据 + 触发重渲染
需要的：
模块
最小实现
完整实现（可以后补）
AreaTree 布局
3 个固定叶节点（Viewport / TileSet面板 / 空占位）
自由分割 + 合并 + 类型切换
暗色主题
CSS Token + 基础样式
完整组件库
头栏
26px 静态头栏（图标 + 标题）
下拉切换编辑器类型
Canvas 视口
Canvas 2D + 网格线 + Tile 渲染
WebGPU 渲染管线
Camera
pan（Space+拖拽）+ zoom（滚轮）
平滑动画 + 边界约束
TileSet 加载
<input type="file"> 选图片 + 指定 tileSize/columns
File System Access API 完整流程
TileSet 面板
Canvas 渲染图集网格，点击选中 tileId
多 tileset 切换、搜索、预览
TileMap 数据
{ tileSize, width, height, data: number[] }
多层 + 多 tileset + firstgid
笔刷
单格点击/拖拽涂色
矩形选区、填充、橡皮擦
导入/导出
JSON.stringify / JSON.parse + download/upload
File System Access API 原地保存
Undo
单步 SetTileCommand
完整 CommandHistory
明确不需要的（这轮不做）：
- ❌ EditorBridge（没有 ECS 引擎，直接操作 TileMap 数据）
- ❌ Entity / Scene / Inspector（纯 TileMap 编辑，不涉及实体）
- ❌ ProjectManager（用 <input> + download，不需要 File System Access API）
- ❌ SelectionManager（选 tile 用独立的 tileId 状态即可）
- ❌ TransformGizmo（没有实体可拖）
- ❌ WebGPU（Canvas 2D 完全够用，后续替换）

---
Sprint 拆解
Sprint 1 — Blender 壳 + 暗色主题（2-3 天）
目标：打开页面看到一个 Blender 风格的暗色编辑器骨架
┌───────────────────────────────────────────────────┐
│  [◆ mote]                                          │  ← GlobalMenuBar（静态）
├──────────────────────────────┬─────────────────────┤
│  [🗺️ TileSet ▾]              │  [🎮 Viewport ▾]    │
│                              │                     │
│   (空面板，暗色背景)           │  (空 Canvas，网格线) │
│                              │                     │
│                              │                     │
│                              │                     │
└──────────────────────────────┴─────────────────────┘
交付物：
#
任务
预估
1.1
Vite + Preact + TypeScript 项目脚手架
2h
1.2
CSS Token 变量 + 全局暗色样式（复用设计文档）
2h
1.3
AreaTree 数据结构 + SplitPane 组件（仅支持拖拽调整比例，暂不支持角落分割/合并）
4h
1.4
AreaPanel + 26px AreaHeader（下拉菜单 UI 存在但不切换，仅显示当前类型）
2h
1.5
GlobalMenuBar 静态壳（logo + 标题，菜单项为占位）
1h
1.6
Viewport 面板：空白 Canvas + 背景色 + 网格线渲染
3h
合计：~14h（2 天）
Sprint 1 结束时的体验：
打开 localhost:5173，看到暗色 Blender 风格的两栏布局，左侧空面板，右侧有网格线的 Canvas，可以拖拽分割条调整比例。看起来就像一个编辑器。

---
Sprint 2 — TileSet 导入 + 图集面板（2-3 天）
目标：能导入一张 tileset 图片，在左侧面板看到切好的图集网格，点选某个 tile
交付物：
#
任务
预估
2.1
TileSet 数据模型：{ image: ImageBitmap, tileSize, columns, tileCount }
1h
2.2
导入流程：点击按钮 → <input type="file" accept="image/*"> → 弹窗填 tileSize → 创建 TileSet 对象
3h
2.3
TileSet 面板：Canvas 渲染图集网格，hover 高亮，click 选中 tileId
4h
2.4
全局状态：currentTileSetId + currentTileId（用 Preact Signals）
1h
2.5
支持多个 TileSet 导入，面板顶部 tab/下拉切换
2h
2.6
TileSet 持久化：导出为 JSON（image 路径 + 参数），导入时重新加载
2h
合计：~13h（2 天）
Sprint 2 结束时的体验：
点击「Import TileSet」→ 选一张图片 → 输入 tile 大小 → 左侧面板显示切好的 tile 网格 → 点击选中某个 tile，选中态高亮。

---
Sprint 3 — TileMap 渲染 + 笔刷（3-4 天）
目标：在 Viewport Canvas 上画 Tile，能看到实时结果
交付物：
#
任务
预估
3.1
TileMap 数据模型：{ tileSize, width, height, data: number[] } + 新建地图对话框
2h
3.2
Camera 类：pan（Space+拖拽 / 中键拖拽）+ zoom（滚轮）
4h
3.3
Viewport 渲染：Canvas 2D 绘制 TileMap（遍历 data，从 TileSet 切图 drawImage）
4h
3.4
网格线叠加层（编辑模式下显示）
1h
3.5
笔刷工具：pointermove 实时计算网格坐标 → pointerdown/move（按住）写入 data → 触发重绘
4h
3.6
橡皮擦工具：右键或切换工具，写入 tileId=0
1h
3.7
光标预览：鼠标移动时在对应网格位置半透明显示当前选中 tile
2h
3.8
工具栏：头栏中的 Pen / Eraser 切换按钮
1h
合计：~19h（3 天）
Sprint 3 结束时的体验：
创建一张 15×9 的地图 → 在 TileSet 面板选一个 tile → 在 Viewport 上点击/拖拽画 tile → 滚轮缩放，Space+拖拽平移 → 右键擦除。这是第一个「能用」的时刻。

---
Sprint 4 — 导入/导出 + Undo + 打磨（2-3 天）
目标：工作流闭环——能保存、能加载、能撤销
交付物：
#
任务
预估
4.1
导出 TileMap：JSON.stringify → <a download> 下载 .tilemap.json
2h
4.2
导入 TileMap：<input type="file"> → 解析 JSON → 加载关联的 TileSet 图片
3h
4.3
导出 TileSet 配置：JSON（不含图片二进制，含相对路径）
1h
4.4
CommandHistory：SetTileCommand（execute/undo）+ BatchCommand（连续拖拽合并）
4h
4.5
Ctrl+Z / Ctrl+Shift+Z 全局监听
1h
4.6
菜单栏功能化：File → New Map / Import Map / Export Map / Import TileSet
2h
4.7
边界打磨：空状态提示、错误处理、拖拽边界
2h
合计：~15h（2-3 天）
Sprint 4 结束时的体验：
完整工作流：新建地图 → 导入 TileSet → 画 Tile → Ctrl+Z 撤销 → 导出 JSON → 关闭 → 重新导入 → 继续编辑。

---
总览
Sprint 1 ──── Sprint 2 ──── Sprint 3 ──── Sprint 4
 Blender壳     TileSet导入    TileMap笔刷    导入导出+Undo
 ~2天           ~2天           ~3天           ~2-3天
                                              │
                                              ▼
                                        ✅ MVP 可用
                                        总计 9-11 天
每个 Sprint 结束都有可感知的产出
Sprint
用户看到什么
1
暗色 Blender 风格编辑器骨架，有网格线的 Canvas
2
能导入 tileset 图片，在面板中浏览和选择 tile
3
能画了！ 在地图上点击/拖拽绑定 tile
4
能存能读能撤销，工作流闭环

---
技术风险与应对
风险
概率
影响
应对
Canvas 2D 大地图性能
中
中
脏矩形渲染：只重绘变化的 tile 区域，不全量重绘
SplitPane 拖拽在不同浏览器表现差异
低
低
用 PointerEvent + setPointerCapture 统一处理
TileSet 图片跨域/格式问题
低
低
全部用 <input type="file"> 本地加载，不存在跨域
导入/导出时 TileSet 图片路径丢失
中
高
导出时将图片 base64 内嵌，或导出为 zip 包含图片
Undo 在连续拖拽时产生过多 Command
中
中
拖拽期间收集所有变更，pointerup 时合并为一个 BatchCommand

---
暂缓清单（MVP 后再做）
以下功能明确 不在这 4 个 Sprint 范围内，但设计文档中已有完整规划：
功能
归入阶段
AreaTree 角落拖拽分割/合并
Phase 2 — 布局增强
区域类型自由切换
Phase 2
File System Access API（原地保存到文件夹）
Phase 2 — 存储增强
多层 TileMap（terrain + interactive）
Phase 2 — TileMap 增强
多 TileSet firstgid 自动计算
Phase 2
填充工具（Flood Fill）
Phase 2
矩形选区笔刷
Phase 2
Entity 系统 / Scene Tree / Inspector
Phase 3 — 实体系统
EditorBridge 引擎桥接
Phase 3
WebGPU 渲染替换 Canvas 2D
Phase 3
PWA / 单 HTML 导出
Phase 4

---
Sprint 1 详细文件清单
作为起步参考，Sprint 1 的预期产出文件：
mote-editor/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── src/
│   ├── main.tsx                   # 入口，挂载 <EditorApp>
│   ├── theme.css                  # Blender 暗色 Token + 全局样式
│   ├── editor/
│   │   ├── EditorApp.tsx          # 顶层容器
│   │   ├── GlobalMenuBar.tsx      # 菜单栏壳
│   │   ├── layout/
│   │   │   ├── AreaTree.ts        # 区域树数据结构 + 操作函数
│   │   │   ├── AreaTreeRenderer.tsx  # 递归渲染
│   │   │   ├── SplitPane.tsx      # 分割面板（拖拽调整比例）
│   │   │   └── AreaPanel.tsx      # 叶节点面板 + 26px 头栏
│   │   └── panels/
│   │       ├── ViewportPanel.tsx  # Canvas + 网格线
│   │       └── EmptyPanel.tsx     # 占位空面板
│   └── types.ts                   # 共享类型定义
└── public/
    └── favicon.svg                # logo