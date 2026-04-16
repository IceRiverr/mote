// ═══════════════════════════════════════════════════════════════
// export.ts - 导出功能（新架构）
// ═══════════════════════════════════════════════════════════════

import type { Scene } from "./Scene";
import type { Prefab } from "./Prefab";
import { exportBuildBundle, downloadBuildBundle, sceneToJson, prefabToJson } from "./io";

/**
 * 导出 Scene 为 JSON 文件
 */
export function exportScene(scene: Scene): void {
  const data = sceneToJson(scene);
  downloadJson(data, `${scene.name || scene.id}.mote-scene.json`);
}

/**
 * 导出 Prefab 为 JSON 文件
 */
export function exportPrefab(prefab: Prefab): void {
  const data = prefabToJson(prefab);
  downloadJson(data, `${prefab.id}.mote-prefab.json`);
}

/**
 * 导出项目构建包
 */
export function exportProject(prefabs: Prefab[], scenes: Scene[]): void {
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
