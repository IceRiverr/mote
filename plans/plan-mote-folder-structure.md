# 微尘引擎 — 项目文件结构设计实施计划

版本：1.0.0 | 日期：2026-04-15 | 状态：待实施

---

## 1. 概述

本文档基于《微尘引擎_项目文件结构设计规范.md》制定详细实施计划，将当前代码库迁移到统一的路径解析和资源格式规范。

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
| `packages/editor/src/data/migrate.ts` | 新 | 添加迁移逻辑 |
| `packages/engine/src/core/` | 中 | 添加资源加载器基础架构 |
| 现有游戏项目 | 中 | 需要迁移脚本 |

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
  id: string;              // 新增：项目唯一标识
  name: string;
  version: string;
  assetsDir: string;       // 新增：资源目录名，默认 "assets"
  srcDir: string;          // 新增：源码目录名，默认 "src"
  entryScene?: string;     // 新增：入口场景路径（相对于 assetsDir）
  entryScript?: string;    // 新增：入口脚本路径（相对于 srcDir）
  settings?: {             // 保留当前设置，但移至 settings 下
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
  category: string;
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
    x: number;
    y: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
    visible?: boolean;
    overrides?: Record<string, Record<string, unknown>>;
  }>;
}
```

### 2.2 更新 io.ts 类型引用

**文件**：`packages/editor/src/data/io.ts`

**任务**：
1. 从 `formats.ts` 导入新类型定义
2. 更新 `prefabToJson` 和 `prefabFromJson` 以处理路径引用
3. 更新 `sceneToJson` 和 `sceneFromJson` 添加 type/version 字段

---

## 3. 阶段二：Prefab 格式迁移（优先级：P0）

### 3.1 问题说明

当前 Prefab 使用 ID 引用 Sprite Atlas：
```json
"Sprite": {
  "atlas": "sheet_1776215139011_wtj0",  // ID 引用
  "frame": "frame_100"
}
```

需改为路径引用：
```json
"Sprite": {
  "atlas": "sprites/tiny-dungeon_tilemap_packed.mote-sprite.json",  // 路径引用
  "frame": "frame_100"
}
```

### 3.2 迁移策略

**方案 A：破坏性更新（推荐用于新项目）**
- 直接修改格式，旧项目需手动更新

**方案 B：向后兼容 + 自动迁移（推荐）**
- 加载时检测 `atlas` 字段是 ID 还是路径
- 如果是 ID，通过查找 Sprite Atlas 索引转换为路径
- 保存时自动写回路径格式

**实施方案 B**：

1. 在 `packages/editor/src/data/io.ts` 添加迁移函数：
```typescript
/**
 * 迁移 Prefab JSON：将 atlas ID 转换为路径
 */
export function migratePrefabJson(
  json: any,
  atlasIndex: Map<string, string>  // atlasId -> path
): PrefabJson {
  if (!json.components?.Sprite?.atlas) return json;
  
  const atlasId = json.components.Sprite.atlas;
  const atlasPath = atlasIndex.get(atlasId);
  
  if (atlasPath && !atlasPath.includes('.')) {
    // 看起来是 ID 而非路径，尝试转换
    json.components.Sprite.atlas = atlasPath;
  }
  
  return json;
}
```

2. 在加载 Prefab 时调用迁移：
```typescript
export async function loadPrefab(
  fileHandle: FileSystemFileHandle,
  atlasIndex?: Map<string, string>  // 可选：用于迁移
): Promise<Prefab | null> {
  const json = await readJsonFile(fileHandle);
  
  // 如果是旧格式（无 type 字段），添加 type 和 version
  if (!json.type) {
    json.type = "mote-prefab";
    json.version = "1.0.0";
  }
  
  // 迁移 atlas 引用
  if (atlasIndex) {
    migratePrefabJson(json, atlasIndex);
  }
  
  return prefabFromJson(json);
}
```

### 3.3 编辑器 UI 更新

**文件**：`packages/editor/src/editors/sprite-editor/` 相关

**任务**：
1. 修改 Sprite 组件编辑器，从下拉选择 ID 改为文件选择器或路径输入
2. 当选择 Sprite Atlas 文件时，自动填充 `atlas` 路径

---

## 4. 阶段三：项目配置迁移（优先级：P0）

### 4.1 更新 project.json 格式

**当前格式**（games/aa/project.json）：
```json
{
  "id": "my_project_mnvp9109",
  "name": "My Project",
  "version": "1.0.0",
  "createdAt": "...",
  "settings": { ... }
}
```

**目标格式**：
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

### 4.2 迁移函数

**文件**：`packages/editor/src/data/migrate.ts`（新建或扩展）

```typescript
// 检测项目格式版本
export function detectProjectVersion(json: unknown): "v0" | "v1" | "unknown" {
  if (!json || typeof json !== "object") return "unknown";
  const obj = json as Record<string, unknown>;
  
  // v1 格式有 assetsDir 字段
  if ("assetsDir" in obj) return "v1";
  
  // v0 格式只有 settings 等旧字段
  if ("settings" in obj || "spriteSheets" in obj) return "v0";
  
  return "unknown";
}

// 迁移 v0 -> v1
export function migrateProjectConfig(json: unknown): ProjectJson {
  const version = detectProjectVersion(json);
  
  if (version === "v1") return json as ProjectJson;
  if (version === "unknown") throw new Error("Unknown project format");
  
  // 迁移 v0 到 v1
  const old = json as Record<string, unknown>;
  return {
    id: old.id as string || "untitled",
    name: old.name as string || "Untitled",
    version: old.version as string || "1.0.0",
    assetsDir: "assets",  // 默认值
    srcDir: "src",       // 默认值
    entryScene: old.startScene as string || undefined,
    entryScript: "main.ts",
    settings: old.settings as any,
  };
}
```

### 4.3 更新加载逻辑

**文件**：`packages/editor/src/data/project.ts`

```typescript
export async function loadProject(
  folderHandle: FileSystemDirectoryHandle
): Promise<Project | null> {
  // ... 读取 JSON ...
  
  // 自动迁移
  const migrated = migrateProjectConfig(json);
  
  // 保存迁移后的版本（静默升级）
  await writeJsonFile(configHandle, migrated);
  
  // 继续处理...
}
```

---

## 5. 阶段四：路径解析与验证（优先级：P0）

### 5.1 新增路径工具模块

**文件**：`packages/engine/src/core/path.ts`（新建）或 `packages/shared/src/path.ts`

```typescript
/**
 * 验证资源路径是否符合规范
 * - POSIX 正斜杠
 * - 禁止 ../
 * - 禁止绝对路径
 * - 禁止 assets/ 前缀
 */
export function validateAssetPath(path: string): string | null {
  if (typeof path !== "string" || path.trim() === "") {
    return "Path must be a non-empty string";
  }
  
  // 禁止反斜杠
  if (path.includes("\\")) {
    return `Path must use forward slashes (/), not backslashes: "${path}"`;
  }
  
  // 禁止绝对路径（以 / 开头）
  if (path.startsWith("/")) {
    return `Absolute paths are not allowed: "${path}"`;
  }
  
  // 禁止盘符（Windows）
  if (/^[a-zA-Z]:/.test(path)) {
    return `Drive letters are not allowed: "${path}"`;
  }
  
  // 禁止跳出 assets
  if (path.startsWith("..") || path.includes("/..")) {
    return `Path traversal (../) is not allowed: "${path}"`;
  }
  
  // 禁止 assets/ 前缀（路径已经是相对于 assets 的）
  if (path.startsWith("assets/") || path === "assets") {
    return `Path should not include "assets/" prefix: "${path}"`;
  }
  
  // 禁止 . 开头（当前目录）
  if (path.startsWith("./")) {
    return `Path should not start with "./": "${path}"`;
  }
  
  return null;  // 有效
}

/**
 * 解析资源路径（拼接 assetsRoot + relativePath）
 */
export function resolveAssetPath(assetsRoot: string, relativePath: string): string {
  const error = validateAssetPath(relativePath);
  if (error) {
    throw new Error(`Invalid asset reference "${relativePath}": ${error}`);
  }
  
  // 使用 POSIX 风格拼接
  if (assetsRoot.endsWith("/")) {
    return assetsRoot + relativePath;
  }
  return assetsRoot + "/" + relativePath;
}
```

### 5.2 在 IO 层集成验证

**文件**：`packages/editor/src/data/io.ts`

在 `prefabFromJson`、`sceneFromJson`、`spriteSheetFromJson` 中添加验证：

```typescript
export function prefabFromJson(json: PrefabJson): Prefab {
  // 验证 Sprite atlas 路径
  if (json.components.Sprite?.atlas) {
    const error = validateAssetPath(json.components.Sprite.atlas);
    if (error) {
      console.warn(`Invalid atlas path in prefab ${json.id}: ${error}`);
    }
  }
  
  return {
    id: json.id,
    // ... 其他字段
  };
}
```

---

## 6. 阶段五：Loader 架构（优先级：P1）

### 6.1 定义 Loader 接口

**文件**：`packages/engine/src/core/loader.ts`（新建）

```typescript
/**
 * 资源加载器接口
 */
export interface AssetLoader<T> {
  /** 资源类型标识 */
  type: string;
  
  /** 支持的扩展名 */
  extensions: string[];
  
  /** 加载资源 */
  load(path: string, data: ArrayBuffer | string): Promise<T>;
  
  /** 可选：释放资源 */
  unload?(resource: T): void;
}

/**
 * 加载器注册表
 */
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

// 全局单例
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
    if (typeof data === "string") {
      return JSON.parse(data);
    }
    const text = new TextDecoder("utf-8").decode(data);
    return JSON.parse(text);
  }
}

// 注册
assetLoaders.register(new JsonLoader());
```

**文件**：`packages/engine/src/core/sprite-loader.ts`（新建）

```typescript
import { AssetLoader, assetLoaders } from "./loader";
import type { SpriteSheet } from "../../types";  // 需要定义 SpriteSheet 类型

export class SpriteLoader implements AssetLoader<SpriteSheet> {
  type = "sprite";
  extensions = [".mote-sprite.json"];
  
  async load(path: string, data: ArrayBuffer | string): Promise<SpriteSheet> {
    const json = typeof data === "string" ? JSON.parse(data) : JSON.parse(
      new TextDecoder("utf-8").decode(data)
    );
    
    // 这里调用迁移/验证逻辑
    return spriteSheetFromJson(json, path);  // 需要实现
  }
}

assetLoaders.register(new SpriteLoader());
```

### 6.3 Loader 分发逻辑

**文件**：`packages/engine/src/core/asset-manager.ts`（新建）

```typescript
import { assetLoaders, type AssetLoader } from "./loader";
import { resolveAssetPath, validateAssetPath } from "./path";

export class AssetManager {
  private assetsRoot: string;
  private cache = new Map<string, any>();
  
  constructor(assetsRoot: string) {
    this.assetsRoot = assetsRoot;
  }
  
  /**
   * 加载资源（通用接口）
   */
  async load<T>(
    relativePath: string,
    options?: { cache?: boolean; loader?: AssetLoader<T> }
  ): Promise<T> {
    // 验证路径
    const error = validateAssetPath(relativePath);
    if (error) {
      throw new Error(`Invalid asset path "${relativePath}": ${error}`);
    }
    
    // 检查缓存
    const cacheKey = relativePath;
    if (options?.cache !== false && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // 解析完整路径
    const fullPath = resolveAssetPath(this.assetsRoot, relativePath);
    
    // 获取 Loader
    const loader = options?.loader || assetLoaders.get<T>(relativePath);
    if (!loader) {
      throw new Error(`No loader found for: ${relativePath}`);
    }
    
    // 加载（这里需要实际的文件读取逻辑）
    const data = await this.fetch(fullPath);  // TODO: 实现 fetch
    const resource = await loader.load(relativePath, data);
    
    // 缓存
    if (options?.cache !== false) {
      this.cache.set(cacheKey, resource);
    }
    
    return resource;
  }
  
  private async fetch(path: string): Promise<ArrayBuffer> {
    // TODO: 根据平台实现（Node.js / Web / Deno）
    throw new Error("Not implemented");
  }
}
```

---

## 7. 阶段六：Sprite Atlas 格式微调（优先级：P1）

### 7.1 确认 image 字段解析

**当前代码**（`games/tiny-dungeon/assets/xxx.mote-sprite.json`）：
```json
{
  "image": "tiny-dungeon_tilemap_packed.png"
}
```

这个路径已经符合规范（相对 assets/ 解析），无需更改。

### 7.2 添加路径验证

在 `io.ts` 的 `spriteSheetFromJson` 中添加验证：

```typescript
export function spriteSheetFromJson(
  json: SpriteSheetJson,
  imageUrl: string  // 这个参数可能需要重新设计
): SpriteSheet {
  // 验证 image 路径
  const error = validateAssetPath(json.image);
  if (error) {
    console.warn(`Invalid image path in sprite sheet ${json.id}: ${error}`);
  }
  
  // ...
}
```

---

## 8. 阶段七：数据迁移脚本（优先级：P1）

### 8.1 批量迁移现有项目

**文件**：`scripts/migrate-projects.ts`（新建）

```typescript
import * as fs from "fs";
import * as path from "path";
import { migrateProjectConfig, detectProjectVersion } from "../packages/editor/src/data/migrate";

/**
 * 迁移所有 games/*/ 下的项目
 */
async function migrateAll() {
  const gamesDir = "./games";
  const projects = fs.readdirSync(gamesDir);
  
  for (const project of projects) {
    const projectPath = path.join(gamesDir, project);
    const projectJson = path.join(projectPath, "project.json");
    
    if (!fs.existsSync(projectJson)) continue;
    
    const json = JSON.parse(fs.readFileSync(projectJson, "utf-8"));
    const version = detectProjectVersion(json);
    
    console.log(`Project: ${project} (${version})`);
    
    if (version === "v0") {
      const migrated = migrateProjectConfig(json);
      fs.writeFileSync(projectJson, JSON.stringify(migrated, null, 2));
      console.log(`  -> Migrated to v1`);
    }
  }
}

migrateAll();
```

### 8.2 Prefab 迁移

需要扫描所有 `*.prefab.json` 文件，将 `atlas` ID 转换为路径。

---

## 9. 阶段八：测试（优先级：P0）

### 9.1 单元测试

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

### 9.2 集成测试

1. 加载包含路径引用的 Prefab
2. 验证 Sprite Atlas 能正确找到图片
3. 验证 Scene 能正确加载所有 Entity

---

## 10. 实施顺序建议

| 顺序 | 阶段 | 预计工时 | 依赖 |
|------|------|----------|------|
| 1 | 阶段一：类型定义更新 | 2h | 无 |
| 2 | 阶段四：路径解析与验证 | 3h | 阶段一 |
| 3 | 阶段二：Prefab 格式迁移 | 4h | 阶段一、四 |
| 4 | 阶段三：项目配置迁移 | 3h | 阶段一、四 |
| 5 | 阶段六：Sprite Atlas 微调 | 1h | 阶段四 |
| 6 | 阶段五：Loader 架构 | 6h | 阶段四 |
| 7 | 阶段七：数据迁移脚本 | 4h | 阶段二、三 |
| 8 | 阶段八：测试 | 4h | 全部 |

**总计**：约 27 小时（约 3-4 个工作日）

---

## 11. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 旧项目无法打开 | 高 | 实施方案 B（向后兼容），提供迁移脚本 |
| Prefab atlas 引用断裂 | 高 | 迁移时建立 ID->路径映射表 |
| 编辑器 UI 需要大量修改 | 中 | 优先保证数据层正确，UI 逐步适配 |
| 路径验证过严导致误报 | 中 | 提供白名单机制或配置选项 |

---

## 12. 验收标准

1. **格式规范**：所有新创建的 `.mote-*.json` 文件包含正确的 `type` 和 `version` 字段
2. **路径验证**：尝试保存非法路径（如 `../xxx`）时抛出错误
3. **Prefab 迁移**：旧格式 Prefab（`atlas: "id"`）能正确加载并自动转换为路径格式
4. **project.json 迁移**：旧格式 `project.json` 能正确加载并自动升级
5. **Loader 分发**：根据文件扩展名正确选择 Loader
6. **无破坏性**：现有游戏项目（games/aa, games/tiny-dungeon 等）在迁移后能正常加载

---

## 13. 附录：文件清单

**新建文件**：
- `packages/engine/src/core/path.ts`
- `packages/engine/src/core/loader.ts`
- `packages/engine/src/core/json-loader.ts`
- `packages/engine/src/core/asset-manager.ts`
- `packages/editor/src/data/migrate.ts`
- `scripts/migrate-projects.ts`

**修改文件**：
- `packages/editor/src/data/formats.ts`
- `packages/editor/src/data/io.ts`
- `packages/editor/src/data/Prefab.ts`
- `packages/editor/src/data/project.ts`
- `packages/editor/src/data/Scene.ts`（可能）

---

*文档结束*
