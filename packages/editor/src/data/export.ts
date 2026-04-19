// ═══════════════════════════════════════════════════════════════
// export.ts - 导出功能（新架构）
// ═══════════════════════════════════════════════════════════════

import type { Scene } from "./Scene";
import type { Prefab } from "./Prefab";
import { exportBuildBundle, downloadBuildBundle, sceneToJson, prefabToJson } from "./io";
import { getSceneFS } from "../fs/SceneFS";

/**
 * 导出 Scene 到项目 assets/ 目录（类似 Prefab 的保存流程）
 * @param scene - 要保存的场景
 * @param filePath - 相对于 assets/ 的文件路径（如 "scenes/level1.mote-scene.json"）
 * @returns 是否保存成功
 */
export async function exportScene(scene: Scene, filePath?: string): Promise<boolean> {
  const sceneFS = getSceneFS();
  const targetPath = filePath || scene.path;
  if (!targetPath) {
    console.error('[exportScene] Scene has no path, please provide a file path');
    return false;
  }
  return await sceneFS.save(scene, targetPath);
}

/**
 * 导出 Scene 为浏览器下载（旧方式，保留用于无文件系统环境）
 */
export function exportSceneAsDownload(scene: Scene): void {
  const data = sceneToJson(scene);
  downloadJson(data, `${scene.name || scene.id}.mote-scene.json`);
}

/**
 * 导出 Prefab 为 JSON 文件
 */
export function exportPrefab(prefab: Prefab, prefabId: string): void {
  const data = prefabToJson(prefab);
  downloadJson(data, `${prefabId}.mote-prefab.json`);
}

/**
 * 导出项目构建包
 */
export function exportProject(prefabs: Array<{ id: string; prefab: Prefab }>, scenes: Scene[]): void {
  const bundle = exportBuildBundle(prefabs, scenes);
  downloadBuildBundle(bundle);
}

/**
 * 下载 JSON 数据
 */
export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  
  URL.revokeObjectURL(url);
}
