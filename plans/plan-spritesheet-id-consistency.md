# Plan: SpriteSheet ID 一致性优化（待执行）

**日期：** 2026-04-19
**状态：** 🟡 待后续优化 — 当前保留现状
**优先级：** P2（不影响当前功能，属代码债务）

---

## 问题

当前 SpriteSheet 有两套标识体系并存，导致查找逻辑需要多层回退：

| 标识来源 | 值 | 使用者 |
|----------|-----|--------|
| JSON 文件内的 `id` | `"sheet_1776384805115_ikdi"` | `spriteSheets` store 键、`spriteSheetImages` Map 键、Sprite Editor Header |
| 文件名（去掉扩展名）| `"tiny-dungeon"` | Prefab `components.Sprite.atlas`（存的是 `"tiny-dungeon.mote-sprite.json"`）|

### 已暴露的 Bug
- `resolveEntitySprite()` 需要三层回退才能匹配到 SpriteSheet：①`id` → ②文件名 → ③遍历 `name`
- 用户双击 `.mote-sprite.json` 时，Prefeb 的 `atlas` 字段写的是文件名，但 store 用 `id` 做键，两者不匹配

---

## 现状（已缓解，未根治）

当前通过以下代码在运行时兼容：
- `SpriteSheetFS.ts` `normalizeFrame()` 规范化碰撞体格式
- `entitySprite.ts` `resolveEntitySprite()` 三层回退查找 atlas
- `store/spriteSheet.ts` `addSpriteSheet()` 去重替换同 `id` sheet

这些补丁让功能正常工作，但增加了维护复杂度。

---

## 目标方案

### 方案 A：以文件名为唯一标识（推荐）

**核心**：去掉 `.mote-sprite.json` 文件内的 `id` 字段，改用**文件名去掉扩展名**作为 `SpriteSheet.id`。Prefab 的 `atlas` 引用同步改为同样规则。

**改动点**：

| 文件 | 变更 |
|------|------|
| `data/SpriteSheet.ts` | `SpriteSheet` 接口去掉 `id`，增加从文件名推导的 getter 或工具函数 |
| `fs/SpriteSheetFS.ts` | `parseSpriteSheetJson()` 不再读取 `json.id`，改用 `sourcePath.replace(/\.mote-sprite\.json$/, '')` |
| `store/spriteSheet.ts` | `addSpriteSheet()` 去重逻辑不变，键直接用文件名 |
| 所有 `.mote-sprite.json` | 删除 `id` 字段，保留 `name`（显示用）|
| `data/Prefab.ts` / `Prefab` 创建流程 | `Sprite.atlas` 从 `"xxx.mote-sprite.json"` 改为 `"xxx"`（或保持现有文件名，让查找函数统一处理）|
| `entitySprite.ts` | 简化 `resolveEntitySprite()`，去掉三层回退，直接按文件名匹配 |

**优点**：
- 文件名即标识，直观无歧义
- Prefab 引用和 store 键一致，消除查找回退
- 删除 `id` 字段后，`.mote-sprite.json` 更接近纯数据文件

**风险**：
- 重命名 `.mote-sprite.json` 时，需要批量更新引用它的所有 Prefab（这个风险**已经存在**，因为 Prefab 目前存的就是文件名）
- 如果未来需要支持同一名称的 sprite sheet 放在不同目录，文件名会冲突。→ 可用相对路径（如 `"chars/tiny-dungeon"`）作为 `id` 解决

---

### 方案 B：保留 `id`，但强制所有引用用 `id`

**核心**：Prefab 的 `atlas` 字段从文件名改为 SpriteSheet 的 `id`。

**优点**：逻辑标识符与物理路径解耦，重命名文件不影响 Prefab。

**缺点**：
- 需要修改 Prefab 创建流程，让用户/编辑器在创建 Prefab 时知道 sheet 的 `id`
- 现有所有 Prefab 需要迁移（`atlas` 从文件名改为 `id`）
- SpriteSheet JSON 需要保留 `id`，增加文件复杂度
- 与 Tiled/Godot 等工具的惯例不一致（它们通常用文件名或路径引用资源）

---

## 决策建议

**推荐方案 A**。理由：
1. mote 是一个文件系统优先的编辑器，资源天然以文件路径组织
2. Prefab 已经用文件名引用 atlas，说明系统设计选择了"路径即标识"
3. 去掉 `id` 后，`.mote-sprite.json` 更简洁，新用户不需要理解 `id` 和文件名的区别
4. 如果真需要目录隔离，用 `"folder/name"` 作为 `id` 即可，不需要额外抽象层

---

## 触发条件

以下情况出现时应优先执行此优化：

1. **新增第 2 个 `.mote-sprite.json` 到项目中**：当前只有 `tiny-dungeon` 一个，问题不明显；多项目时会暴露更多查找/去重问题
2. **Prefab 创建工具化**：当编辑器支持从 Sprite Editor 一键创建 Prefab 时，`atlas` 字段到底存 `id` 还是文件名必须确定
3. **资源重命名功能**：如果编辑器支持右键重命名资源文件，此时标识符体系必须清晰

---

## 修订记录

| 日期 | 变更 |
|------|------|
| 2026-04-19 | 创建计划，记录当前两套标识体系的问题和两套方案 |
