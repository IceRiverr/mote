# Plan: 2D 地图视口重构

**日期：** 2026-04-19
**目标：** 将编辑器视口从占位渲染升级为专业级关卡编辑器：双模式工作流、真实精灵渲染、完整 HUD 和导航辅助。

---

## 功能清单

### 功能 1：视口顶部可切换「实体/笔刷」模式标签
- 新建 `store/viewport-mode.ts`：`editMode` signal、`entityTool`/`brushTool` signal、模式切换函数
- 改造 `ViewportHeader.tsx`：将原有工具按钮替换为模式标签页（实体 / 笔刷），点击切换
- Footer 同步显示当前模式名称
- 模式切换时清除瞬态交互状态（拖拽中、框选中等），保留选择集和相机
→ 验证：打开编辑器，视口顶部看到「实体」「笔刷」两个标签；点击切换，Footer 显示对应模式名；模式切换时不会卡死或报错

### 功能 2：页眉缩放控制 + 页脚世界坐标实时读数
- 新建 `store/viewport.ts`：`viewportCamera` signal、坐标转换函数（`screenToWorld`、`worldToScreen`）、`setZoomAt`（以鼠标位置锚定缩放）
- 从 `ViewportCanvas.tsx` 提取现有相机状态到共享 store
- `ViewportHeader.tsx` 添加缩放显示（×1.0）和 +/- 按钮，读写 `viewportCamera`
- `ViewportFooter.tsx` 添加鼠标世界坐标读数，实时跟随鼠标移动
→ 验证：鼠标在视口移动时，Footer 坐标读数实时变化；点击页眉缩放按钮或滚轮缩放时，视口内容正确缩放，且以鼠标位置为锚点

### 功能 3：场景边界外变暗 + 网格裁剪到边界 + 世界轴向指示器
- `ViewportCanvas.tsx` 绘制顺序调整：背景填充 → 边界外 dimming → 网格（裁剪到场景 bounds）
- 网格线使用极淡颜色 `rgba(255,255,255,0.04)`，中心轴用 `rgba(255,255,255,0.25)` + 红/绿加粗
- 左下角屏幕空间绘制轴向 Gizmo（红 X / 绿 Y，~48px）
- `store/viewport.ts` 添加 `viewportSettings`（网格颜色、变暗开关、Gizmo 开关）
→ 验证：视口背景为 `#1a1a1a`；场景区域外有半透明黑色覆盖；网格线不出场景边界；左下角有红绿箭头指示世界方向

### 功能 4：实体显示真实精灵图片，替代占位方块
- 新建 `utils/entitySprite.ts`：`resolveEntitySprite()`（通过 `prefabs` + `spriteSheets` stores 查找 `HTMLImageElement` 和帧矩形）、`getEntityDisplaySize()`
- `ViewportCanvas.tsx` `drawEntity()` 改造：优先 `ctx.drawImage` 绘制真实精灵帧；图片未加载时回退到网格大小的矩形
- 实体按 layer 然后按 Y 排序绘制（俯视遮挡）
→ 验证：场景中的实体从彩色方块变为实际的精灵图片；移动实体时图片跟随移动；未导入图集的实体显示为灰色矩形（大小等于网格尺寸）

### 功能 5：实体模式左侧 T-Panel 工具栏（选择/移动）
- 新建 `editors/viewport/ViewportTPanel.tsx`：垂直图标栏，仅在 `editMode === 'entity'` 时显示
- 两个工具按钮：选择（↖）、移动（✋），点击切换 `entityTool`
- 当前激活工具高亮显示
- 笔刷模式下 T-Panel 自动隐藏
→ 验证：实体模式下视口左侧出现窄面板，有选择/移动两个图标按钮；点击切换时按钮高亮；切换到笔刷模式面板消失

### 功能 6：吸附与网格分离（snapSize ≠ grid.size），页脚可配置
- `data/Scene.ts` `GridSettings` 扩展：添加 `snapSize?: number`（默认 8）
- `store/scene.ts` 更新 `snapToGrid()` 和相关调用：使用 `snapSize ?? grid.size`
- `ViewportFooter.tsx` 添加：「吸附: 开/关」切换按钮、「吸附: 8px」下拉（1/2/4/8/16/32/64）
- 拖拽时按住 Ctrl 临时禁用吸附，按住 Shift 临时启用吸附
→ 验证：Footer 显示吸附开关和尺寸下拉；关闭吸附后拖拽实体可平滑到任意像素位置；打开吸附 8px 后拖拽按 8px 增量跳动；按住 Ctrl 拖拽时临时无视吸附设置

### 功能 7：选择框按实际精灵尺寸绘制，多选有视觉层级
- 利用功能 4 的 `getEntityDisplaySize()` 获取选择框尺寸
- `drawEntity()` 中绘制选择轮廓：单选橙色 `#f4a742` 2px；多选中活动项最亮 `#ffbb5c`，非活动项 `#c4802a` 1px
- 轴心点（pivot）小圆点标记
→ 验证：点击实体后选择框大小精确匹配精灵图片；多选多个实体时，最后点击的实体轮廓最亮，其他较暗

### 功能 8：选择工具拖拽实体 = 移动（Blender 风格）
- `ViewportCanvas.tsx` 实体模式处理器 `handleEntityPointerDown/Move/Up`
- `select` 工具：点击空白处 = 框选；点击实体 = 选中；在已选实体上拖拽 = 移动（同 `move` 工具）
- `move` 工具：无论点击哪里，只要有选中的实体就直接移动
- 移动时考虑吸附设置
- 移动结束生成 `MoveCommand` 入 Undo 栈
→ 验证：选择工具下，在实体上按住拖拽可以直接移动该实体；在空白处拖拽出现框选矩形；框选松开时矩形内的实体被选中；移动后按 Ctrl+Z 可撤销

### 功能 9：笔刷模式完整工具（笔刷/橡皮/吸管/框选）+ 笔刷预览幽灵
- `ViewportCanvas.tsx` 笔刷模式处理器 `handleBrushPointerDown/Move/Up`
- `brush`：点击/拖拽在网格单元格放置当前 `brushStamp`（预制体），生成 `PaintBrushCommand`
- `eraser`：点击/拖拽擦除网格单元格内实体，生成 `EraseCommand`
- `eyedropper`：点击拾取单元格内实体作为新 `brushStamp`
- `rect-select`：拖拽高亮网格矩形区域（M1 仅高亮，复制/粘贴推迟）
- 鼠标悬停时绘制半透明笔刷预览（预制体幽灵或擦除高亮）
- `store/brush.ts` 扩展 `BrushStamp` 接口
→ 验证：切换到笔刷模式，选择笔刷工具，鼠标悬停网格时显示半透明预制体预览；点击绘制实体到网格；选择橡皮工具悬停时显示擦除范围高亮；点击擦除实体；吸管工具点击后笔刷变为所拾取实体

### 功能 10：完整快捷键体系
- `store/viewport-mode.ts` `handleViewportShortcut()` 实现
- `ViewportCanvas.tsx` 键盘事件监听（仅在画布聚焦时）
- `Tab`：切换实体/笔刷模式
- `V`/`G`：实体模式切换选择/移动工具
- `B`/`E`/`I`/`M`：笔刷模式切换笔刷/橡皮/吸管/框选工具
- `T`：实体模式下切换 T-Panel 可见性
- `N`：切换 Inspector（N-Panel）可见性
- `Ctrl+Shift+G`：吸附开关；`Shift+G`：循环吸附尺寸
- `F`：框选相机适配场景；`Home`：居中相机
- `Delete`/`Backspace`：删除已选实体
→ 验证：焦点在视口画布时，按 Tab 切换模式标签；按 V 切换到选择工具、B 切换到笔刷工具；按 T 隐藏/显示左侧 T-Panel；按 Delete 删除已选实体

---

## 依赖关系

```
功能 1（模式切换）
  → 功能 5（T-Panel 仅实体模式可见）
  → 功能 8（实体工具行为）
  → 功能 9（笔刷工具行为）
  → 功能 10（快捷键分模式响应）

功能 2（相机 store）
  → 功能 3（背景/网格/Gizmo 绘制依赖相机）
  → 功能 8（拖拽移动需要 world→screen 转换）
  → 功能 9（笔刷网格坐标转换）

功能 4（真实精灵渲染）
  → 功能 7（选择框按精灵尺寸）

功能 6（吸附系统）
  → 功能 8（实体移动考虑吸附）
  → 功能 9（笔刷放置考虑吸附）

功能 8 || 功能 9（实体工具与笔刷工具可部分并行开发，但共享同一画布事件循环）
```

---

## 执行顺序建议

按「最早看到效果」优先：

1. **功能 1** — 模式标签，立即看到顶部 UI 变化
2. **功能 2** — 坐标读数 + 缩放，页脚立即有用
3. **功能 3** — 背景/网格/Gizmo，视口看起来专业
4. **功能 4** — 实体变图片，核心视觉升级
5. **功能 5** — T-Panel 工具栏，左侧有图标
6. **功能 7** — 准确选择框，配合功能 4 完成
7. **功能 6** — 吸附系统，拖拽体验提升
8. **功能 8** — 实体模式交互完整
9. **功能 9** — 笔刷模式交互完整
10. **功能 10** — 快捷键，效率收尾
