# 精灵图导出路径引用研究

## 用户的设计

**场景：**
```
D:\dev\mote\games\tiny-dungeon\assets\
  ├── tiny-dungeon_tilemap_packed.mote-sprite.json
  └── tiny-dungeon_tilemap_packed.png
```

**期望的 JSON：**
```json
{
  "image": "tiny-dungeon_tilemap_packed.png"
}
```

**设计原则：**
- image 路径是相对于 JSON 文件的相对路径
- 如果 PNG 和 JSON 在同一目录，只写文件名即可

---

## 其他软件的解决方案

### 1. Tiled (瓦片图编辑器)

**存储方式：**
```xml
<!-- tileset.tsx -->
<image source="tiny-dungeon.png" width="192" height="176"/>
```

**规则：**
- 默认使用相对于 `.tsx` 文件的相对路径
- 如果图片移动，Tiled 会提示"找不到图片"并提供重新定位
- 也支持绝对路径，但不推荐

**优点：**
- 文件可以整体移动（整个 assets 文件夹移到别处）
- 版本控制友好（路径不包含机器相关路径如 `D:\`）

**缺点：**
- 如果 JSON 和图片分开移动，链接会断开

### 2. Godot 引擎

**存储方式：**
```json
{
  "texture": "res://assets/tiny-dungeon.png"
}
```

**规则：**
- 使用 `res://` 虚拟路径，表示项目根目录
- 也支持 `user://` 表示用户数据目录
- 不存储绝对路径

**优点：**
- 项目可以在不同机器上运行
- 移动项目文件夹不会破坏引用

**缺点：**
- 需要引擎解析 `res://` 前缀
- 文件必须在项目目录内

### 3. Unity

**存储方式：**
- 不使用路径引用！
- 使用 GUID（全局唯一标识符）

```yaml
# .meta 文件
guid: a1b2c3d4e5f6...
```

**规则：**
- 资源文件有一个对应的 `.meta` 文件存储 GUID
- 引用时存储 GUID，而不是路径
- 即使移动文件，GUID 不变，引用不断

**优点：**
- 重命名、移动文件不会破坏引用
- 完全解耦路径和引用

**缺点：**
- 需要 meta 文件系统
- 文件丢失时无法通过路径猜测

### 4. Aseprite

**存储方式：**
```json
{
  "spriteSheet": {
    "image": "sheet.png",
    "frames": [...]
  }
}
```

**规则：**
- 支持相对路径（相对于文件位置）
- 支持绝对路径（不推荐）
- 导出时会询问图片路径如何存储

### 5. TexturePacker

**存储方式：**
```json
{
  "meta": {
    "image": "sprites.png",
    "prefix": ""
  }
}
```

**规则：**
- 默认使用相对路径
- 可以配置为绝对路径
- 提供 "trim" 选项移除路径前缀

### 6. Unreal Engine

**存储方式：**
```
/Game/Assets/Sprites/tiny-dungeon
```

**规则：**
- 使用虚拟路径系统
- 不直接引用文件系统路径
- 资源导入时会重新组织

---

## 相对路径 vs 绝对路径 vs GUID

| 方案 | 代表软件 | 优点 | 缺点 |
|------|---------|------|------|
| **相对路径** | Tiled, Aseprite, TexturePacker | 简单、可移植、版本控制友好 | 文件分离移动会断开 |
| **虚拟路径** | Godot (res://) | 项目内稳定、跨平台 | 需要引擎支持 |
| **GUID** | Unity | 完全解耦、可任意移动 | 复杂、需要 meta 文件 |
| **绝对路径** | 无（不推荐） | 简单直接 | 不可移植、版本控制灾难 |

---

## 用户设计的评估

### 设计：相对路径（相对于 JSON 文件）

```json
{
  "image": "tiny-dungeon_tilemap_packed.png"
}
```

### ✅ 优势

1. **简单直观**
   - 人类可读，容易理解
   - 不需要特殊前缀（如 `res://`）
   - 符合直觉：两个文件放一起就能工作

2. **版本控制友好**
   - Git 提交时路径有效
   - 不同开发者克隆项目后路径仍然有效
   - 不包含机器相关路径（如 `D:\Users\xxx`）

3. **可移植**
   - 整个项目文件夹可以移动到任何地方
   - 可以在不同操作系统使用（Windows/Mac/Linux）

4. **易于手动编辑**
   - 开发者可以用文本编辑器直接修改
   - 不需要特殊工具解析

5. **符合行业标准**
   - Tiled、Aseprite、TexturePacker 都采用类似方案
   - 开发者学习成本低

### ❌ 劣势

1. **文件分离会断开链接**
   - 如果 PNG 被移到其他文件夹，JSON 需要手动更新
   - 重命名 PNG 文件需要同步更新 JSON

2. **跨目录引用复杂**
   - 如果 JSON 在 `assets/sprites/`，图片在 `assets/images/`
   - 需要写 `"../images/tiny-dungeon.png"`
   - 路径嵌套层级深时难以维护

3. **没有重命名检测**
   - 不像 Unity 的 GUID，重命名文件会丢失引用

### 缓解劣势的方法

```typescript
// 加载时提供友好的错误提示
try {
  loadImage(json.image);
} catch (e) {
  console.error(`无法加载图片: ${json.image}`);
  console.error(`请确保图片与 JSON 文件在同一目录，或检查路径是否正确`);
}
```

---

## 推荐方案

### 方案 A：纯相对路径（用户的设计）✅ 推荐

```json
{
  "image": "tiny-dungeon.png"
}
```

**适用场景：**
- 简单项目
- 资源文件和 JSON 文件通常在一起
- 不需要复杂资源管理

### 方案 B：支持相对路径 + 绝对路径（可选）

```json
{
  "image": "tiny-dungeon.png",
  // 或者
  "image": "../images/tiny-dungeon.png",
  // 或者（外部资源）
  "image": "https://example.com/tiny-dungeon.png"
}
```

**适用场景：**
- 需要引用外部资源
- 资源共享（多个 JSON 引用同一张图）

### 方案 C：项目根目录相对路径（Godot 风格）

```json
{
  "image": "@games/tiny-dungeon/assets/tiny-dungeon.png"
}
```

**适用场景：**
- 大型项目
- 需要统一的资源管理
- 有资源加载器可以解析 `@games/` 前缀

---

## 结论

**用户的设计（相对路径）是完全合理的**，理由：

1. 这是行业标准（Tiled、Aseprite、TexturePacker 都这么干）
2. 简单、可移植、版本控制友好
3. 符合"约定优于配置"原则
4. 对于你的使用场景（编辑器导出给引擎使用），这是最直接的方案

**建议的实现：**

```typescript
// 导出时：从 JSON 文件路径计算相对路径
function getRelativePath(fromFile: string, toFile: string): string {
  const fromDir = path.dirname(fromFile);
  return path.relative(fromDir, toFile);
}

// 使用时：从 JSON 文件路径解析绝对路径
function resolvePath(jsonPath: string, imageRelativePath: string): string {
  const jsonDir = path.dirname(jsonPath);
  return path.resolve(jsonDir, imageRelativePath);
}
```

**在浏览器环境中（没有 path 模块）：**

```typescript
// 简单的路径解析
function resolveRelativePath(jsonUrl: string, imagePath: string): string {
  // 如果 imagePath 已经是绝对路径（http:// 或 /），直接返回
  if (imagePath.startsWith('http') || imagePath.startsWith('/')) {
    return imagePath;
  }
  
  // 获取 JSON 所在的目录
  const jsonDir = jsonUrl.substring(0, jsonUrl.lastIndexOf('/'));
  return `${jsonDir}/${imagePath}`;
}
```
