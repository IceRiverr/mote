// ═══════════════════════════════════════════════════════════════
// fs/index.ts - 文件系统模块导出
// ═══════════════════════════════════════════════════════════════

// 核心文件系统
export {
  FileSystem,
  FileSystemAccessAPI,
  InMemoryFileSystem,
  getFileSystem,
  resetFileSystem,
} from './FileSystem';
export type {
  FileSystemConfig,
  FileSystemHandle,
  FileHandle,
  DirectoryHandle,
  FileSystemMode,
} from './FileSystem';

// Prefab 文件系统
export {
  PrefabFS,
  PREFAB_EXTENSION,
  getPrefabFS,
  resetPrefabFS,
} from './PrefabFS';
export type { PrefabMeta } from './PrefabFS';

// Scene 文件系统
export {
  SceneFS,
  SCENE_EXTENSION,
  getSceneFS,
  resetSceneFS,
} from './SceneFS';
export type { SceneMeta } from './SceneFS';
