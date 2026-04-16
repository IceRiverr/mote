# 微尘引擎 — 项目文件结构设计实施计划

版本：1.0.0 | 日期：2026-04-15 | 状态：待实施

---

## 1. 概述

本文档基于《微尘引擎 — 项目文件结构设计规范.md》制定实施计划。当前代码库将直接迁移到最优设计，**不维护任何向后兼容代码**。旧项目数据需通过一次性脚本或手动方式更新到本规范。

### 1.1 实施目标

1. **统一路径解析**：所有 JSON 资源中的路径引用统一相对 `assets/` 解析
2. **规范化文件格式**：所有引擎资源文件添加 `type` 和 `version` 字段
3. **修改 Prefab 格式**：将 Sprite 组件的 `atlas` 字段从 ID 引用改为文件路径引用
4. **完善 project.json**：添加 `assetsDir`、`srcDir`、`entryScene`、`entryScript` 字段
5. **添加路径验证**：实施 POSIX 路径约束检查
6. **添加 Loader 分发**：实现基于扩展名的资源加载器分发逻辑

### 1.2 影响范围

| 模块 | 影响程度 | 说明 |
|------|----------|------|
| `packages/editor/src/data/formats.ts` | 高 | 更新 JSON 类型定义 |
| `packages/editor/src/data/io.ts` | 高 | 更新导入导出逻辑 |
| `packages/editor/src/data/Prefab.ts` | 中 | 修改 Prefab 组件结构 |
| `packages/editor/src/data/project.ts` | 中 | 更新项目配置格式 |
| `packages/engine/src/core/` | 中 | 添加资源加载器基础架构 |
| 现有游戏项目 | 中 | 需一次性更新数据到规范格式 |

---

## 2. 阶段一：类型定义更新（优先级：P0）

### 2.1 更新 formats.ts

**文件**：`packages/editor/src/data/formats.ts`

**任务**：
1. 更新 `SpriteSheetJson` 注释，明确 `image` 字段相对 `assets/` 解析
2. 添加 `PrefabJson` 完整定义（当前缺失）
3. 添加 `SceneJson` 完整定义（当前缺失）
4. 更新 `ProjectJson` 为规范格式

**变更详情**：

```typescript
// 更新 ProjectJson 为规范格式
export interface ProjectJson {
  id: string;
  name: string;
  version: string;
  assetsDir: string;
  srcDir: string;
  entryScene?: string;
  entryScript?: string;
  settings?: {
    defaultSceneWidth: number;
    defaultSceneHeight: number;
    defaultGridSize: number;
    autoSaveInterval: number;
    theme: string;
    editor?: Record<string, unknown>;
  };
}

// 新增完整 PrefabJson 定义
export interface PrefabJson {
  type: "mote-prefab";
  version: "1.0.0";
  id: string;
  name: string;
  tags?: string[];
  components: {
    Transform?: {
      x: number;
      y: number;
      rotation: number;
      scaleX: number;
      scaleY: number;
    };
    Sprite?: {
      atlas: string;      // 路径，如 "sprites/xxx.mote-sprite.json"
      frame: string;
      layer: number;
      tint?: string;
      flipX?: boolean;
      flipY?: boolean;
      alpha?: number;
      visible?: boolean;
    };
    Collider?: Record<string, unknown>;
    [key: string]: Record<string, unknown> | undefined;
  };
  thumbnail?: string;
  description?: string;
}

// 新增完整 SceneJson 定义
export interface SceneJson {
  type: "mote-scene";
  version: "1.0.0";
  id: string;
  name: string;
  width: number;
  height: number;
  grid?: {
    enabled: boolean;
    size: number;
    snap: boolean;
    color?: string;
  };
  entities: Array<{
    id: string;
    prefab: string;       // 路径，如 "prefabs/xxx.mote-prefab.json"
    name?: string;
    parent?: string | null;
    visible?: boolean;
    overrides?: Record<string, Record<string, unknown>>;
  }>;
}
```

### 2.2 更新 io.ts 类型引用

**文件**：`packages/editor/src/data/io.ts`

**任务**：
1. 从 `formats.ts` 导入新类型定义
2. 更新 `prefabToJson` 和 `prefabFromJson` 以处理路径引用（`atlas` 字段直接存储路径字符串）
3. 更新 `sceneToJson` 和 `sceneFromJson` 添加 type/version 字段，Entity transform 统一放入 `overrides`

---

## 3. 阶段二：Prefab 格式更新（优先级：P0）

### 3.1 变更说明

当前 Prefab 使用 ID 引用 Sprite Atlas：
```json
"Sprite": {
  "atlas": "sheet_1776215139011_wtj0",
  "frame": "frame_100"
}
```

直接改为路径引用：
```json
"Sprite": {
  "atlas": "sprites/tiny-dungeon_tilemap_packed.mote-sprite.json",
  "frame": "frame_100"
}
```

### 3.2 实施步骤

1. **修改 `packages/editor/src/data/io.ts`**：
   - `prefabFromJson` 直接读取 `atlas` 字符串作为路径
   - `prefabToJson` 直接写入路径字符串
   - 删除任何与 atlas ID 查找/映射相关的逻辑

2. **修改编辑器 UI**：
   - `packages/editor/src/editors/sprite-editor/` 或相关组件中，将 Sprite Atlas 选择器从"ID 下拉框"改为"文件路径输入/选择器"
   - 选择 `.mote-sprite.json` 文件后，将其相对 `assets/` 的路径写入 `atlas` 字段

---

## 4. 阶段三：项目配置更新（优先级：P0）

### 4.1 project.json 新格式

```json
{
  "id": "my_project_mnvp9109",
  "name": "My Project",
  "version": "1.0.0",
  "assetsDir": "assets",
  "srcDir": "src",
  "entryScene": "scenes/main.mote-scene.json",
  "entryScript": "main.ts",
  "settings": { ... }
}
```

### 4.2 实施步骤

1. **修改 `packages/editor/src/data/project.ts`**：
   - `loadProject` 直接按新格式解析，无版本检测、无自动迁移
   - 如果读取到旧格式字段，直接按新类型断言（假设数据已人工更新）或抛出明确的解析错误
   - `saveProject` 始终输出新格式

2. **更新现有项目数据**：
   - 手动修改 `games/aa/project.json` 和 `games/tiny-dungeon/project.json` 等为新格式

---

## 5. 阶段四：路径解析与验证（优先级：P0）

### 5.1 新增路径工具模块

**文件**：`packages/engine/src/core/path.ts`（新建）或 `packages/shared/src/path.ts`

```typescript
/**
 * 验证资源路径是否符合规范
 */
export function validateAssetPath(path: string): string | null {
  if (typeof path !== "string" || path.trim() === "") {
    return "Path must be a non-empty string";
  }
  if (path.includes("\\")) {
    return `Path must use forward slashes (/), not backslashes: "${path}"`;
  }
  if (path.startsWith("/")) {
    return `Absolute paths are not allowed: "${path}"`;
  }
  if (/^[a-zA-Z]:/.test(path)) {
    return `Drive letters are not allowed: "${path}"`;
  }
  if (path === ".." || path.startsWith("../") || path.includes("/../")) {
    return `Path traversal (../) is not allowed: "${path}"`;
  }
  if (path.startsWith("assets/") || path === "assets") {
    return `Path should not include "assets/" prefix: "${path}"`;
  }
  if (path.startsWith("./")) {
    return `Path should not start with "./": "${path}"`;
  }
  return null;
}

/**
 * 解析资源路径（拼接 assetsRoot + relativePath）
 */
export function resolveAssetPath(assetsRoot: string, relativePath: string): string {
  const error = validateAssetPath(relativePath);
  if (error) {
    throw new Error(`Invalid asset reference "${relativePath}": ${error}`);
  }
  if (assetsRoot.endsWith("/")) {
    return assetsRoot + relativePath;
  }
  return assetsRoot + "/" + relativePath;
}
```

### 5.2 在 IO 层集成验证

**文件**：`packages/editor/src/data/io.ts`

在 `prefabFromJson`、`sceneFromJson`、`spriteSheetFromJson` 中遇到路径字段时，调用 `validateAssetPath`，非法路径直接抛出错误，阻止加载/保存：

```typescript
export function prefabFromJson(json: PrefabJson): Prefab {
  if (json.components.Sprite?.atlas) {
    const error = validateAssetPath(json.components.Sprite.atlas);
    if (error) throw new Error(`Invalid atlas path in prefab ${json.id}: ${error}`);
  }
  // ...
}
```

---

## 6. 阶段五：Loader 架构（优先级：P1）

### 6.1 定义 Loader 接口

**文件**：`packages/engine/src/core/loader.ts`（新建）

```typescript
export interface AssetLoader<T> {
  type: string;
  extensions: string[];
  load(path: string, data: ArrayBuffer | string): Promise<T>;
  unload?(resource: T): void;
}

export class LoaderRegistry {
  private loaders = new Map<string, AssetLoader<any>>();
  register<T>(loader: AssetLoader<T>): void {
    for (const ext of loader.extensions) {
      this.loaders.set(ext.toLowerCase(), loader);
    }
  }
  get<T>(path: string): AssetLoader<T> | undefined {
    const ext = path.split(".").pop()?.toLowerCase();
    if (!ext) return undefined;
    return this.loaders.get(ext) as AssetLoader<T> | undefined;
  }
}

export const assetLoaders = new LoaderRegistry();
```

### 6.2 实现基础 Loader

**文件**：`packages/engine/src/core/json-loader.ts`（新建）

```typescript
import { AssetLoader, assetLoaders } from "./loader";

export class JsonLoader implements AssetLoader<any> {
  type = "json";
  extensions = [".json"];
  async load(path: string, data: ArrayBuffer | string): Promise<any> {
    const text = typeof data === "string" ? data : new TextDecoder("utf-8").decode(data);
    return JSON.parse(text);
  }
}

assetLoaders.register(new JsonLoader());
```

**文件**：`packages/engine/src/core/sprite-loader.ts`（新建）

```typescript
import { AssetLoader, assetLoaders } from "./loader";
import type { SpriteSheet } from "../../types";

export class SpriteLoader implements AssetLoader<SpriteSheet> {
  type = "sprite";
  extensions = [".mote-sprite.json"];
  async load(path: string, data: ArrayBuffer | string): Promise<SpriteSheet> {
    const json = typeof data === "string" ? JSON.parse(data) : JSON.parse(
      new TextDecoder("utf-8").decode(data)
    );
    return spriteSheetFromJson(json);  // 需实现
  }
}

assetLoaders.register(new SpriteLoader());
```

### 6.3 AssetManager

**文件**：`packages/engine/src/core/asset-manager.ts`（新建）

```typescript
import { assetLoaders, type AssetLoader } from "./loader";
import { resolveAssetPath, validateAssetPath } from "./path";

export class AssetManager {
  private cache = new Map<string, any>();
  constructor(private assetsRoot: string) {}

  async load<T>(relativePath: string, options?: { cache?: boolean; loader?: AssetLoader<T> }): Promise<T> {
    const error = validateAssetPath(relativePath);
    if (error) throw new Error(`Invalid asset path "${relativePath}": ${error}`);

    const cacheKey = relativePath;
    if (options?.cache !== false && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const fullPath = resolveAssetPath(this.assetsRoot, relativePath);
    const loader = options?.loader || assetLoaders.get<T>(relativePath);
    if (!loader) throw new Error(`No loader found for: ${relativePath}`);

    const data = await this.fetch(fullPath);
    const resource = await loader.load(relativePath, data);

    if (options?.cache !== false) {
      this.cache.set(cacheKey, resource);
    }
    return resource;
  }

  private async fetch(path: string): Promise<ArrayBuffer> {
    throw new Error("Not implemented");
  }
}
```

---

## 7. 阶段六：一次性数据更新（优先级：P1）

### 7.1 更新现有项目

由于不维护兼容层，所有 `games/*/` 下的现有项目需一次性更新到新格式：

1. **project.json**：添加 `assetsDir`、`srcDir`、`entryScene`、`entryScript`
2. **Prefab 文件**：将所有 `*.mote-prefab.json`（或旧扩展名）中的 `atlas` ID 替换为相对 `assets/` 的路径
3. **Scene 文件**：将 Entity 平铺的 transform 字段移入 `overrides.Transform`，添加 `type` 和 `version`
4. **Sprite Atlas**：添加 `type` 和 `version`（如需要）
5. **文件扩展名**：如有旧扩展名（如 `.prefab.json`），统一重命名为 `.mote-prefab.json`

### 7.2 一次性脚本（可选）

可提供一个独立的 Node.js 脚本 `scripts/convert-legacy-data.ts` 批量处理上述转换，但脚本运行后即删除，不作为代码库长期维护的一部分。

---

## 8. 阶段七：测试（优先级：P0）

### 8.1 单元测试

**文件**：`packages/engine/src/core/__tests__/path.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { validateAssetPath, resolveAssetPath } from "../path";

describe("validateAssetPath", () => {
  it("accepts valid paths", () => {
    expect(validateAssetPath("sprites/hero.png")).toBeNull();
    expect(validateAssetPath("prefabs/ground.mote-prefab.json")).toBeNull();
  });
  it("rejects backslashes", () => {
    expect(validateAssetPath("sprites\\hero.png")).not.toBeNull();
  });
  it("rejects absolute paths", () => {
    expect(validateAssetPath("/sprites/hero.png")).not.toBeNull();
  });
  it("rejects ../", () => {
    expect(validateAssetPath("../other/hero.png")).not.toBeNull();
    expect(validateAssetPath("sprites/../other/hero.png")).not.toBeNull();
  });
  it("rejects assets/ prefix", () => {
    expect(validateAssetPath("assets/sprites/hero.png")).not.toBeNull();
  });
});
```

### 8.2 集成测试

1. 加载包含路径引用的 Prefab
2. 验证 Sprite Atlas 能正确找到图片
3. 验证 Scene 能正确加载所有 Entity

---

## 9. 实施顺序建议

| 顺序 | 阶段 | 预计工时 | 依赖 |
|------|------|----------|------|
| 1 | 阶段一：类型定义更新 | 2h | 无 |
| 2 | 阶段四：路径解析与验证 | 3h | 阶段一 |
| 3 | 阶段五：Loader 架构 | 5h | 阶段一、四 |
| 4 | 阶段二：Prefab 格式更新 | 3h | 阶段一、四、五 |
| 5 | 阶段三：项目配置更新 | 2h | 阶段一、四、五 |
| 6 | 阶段六：一次性数据更新 | 3h | 阶段二、三 |
| 7 | 阶段七：测试 | 4h | 全部 |

**总计**：约 22 小时（约 3 个工作日）

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 旧项目无法打开 | 高 | 提供一次性转换脚本；不接受旧格式 |
| 编辑器 UI 需要修改 | 中 | Sprite Atlas 选择器从 ID 下拉改为路径选择 |
| 路径验证过严 | 低 | 规则明确，无例外 |

---

## 11. 验收标准

1. **格式规范**：所有 `.mote-*.json` 文件包含正确的 `type` 和 `version` 字段
2. **路径验证**：非法路径（如 `../xxx`）在加载和保存时均抛出错误
3. **Prefab 路径引用**：`atlas` 字段为相对 `assets/` 的文件路径，无 ID 引用
4. **Scene 格式统一**：Entity 的 transform 覆盖统一通过 `overrides.{Component}` 实现，无平铺字段
5. **Loader 分发**：根据文件扩展名正确选择 Loader
6. **现有项目更新**：`games/aa`、`games/tiny-dungeon` 等项目的所有数据已更新到新规范并可正常运行

---

## 12. 附录：文件清单

**新建文件**：
- `packages/engine/src/core/path.ts`
- `packages/engine/src/core/loader.ts`
- `packages/engine/src/core/json-loader.ts`
- `packages/engine/src/core/asset-manager.ts`

**修改文件**：
- `packages/editor/src/data/formats.ts`
- `packages/editor/src/data/io.ts`
- `packages/editor/src/data/Prefab.ts`
- `packages/editor/src/data/project.ts`
- `packages/editor/src/data/Scene.ts`（可能）

---

*文档结束*
