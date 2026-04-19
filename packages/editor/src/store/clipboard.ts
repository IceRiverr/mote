// ═══════════════════════════════════════════════════════════════
// clipboard.ts — 编辑器内部剪贴板（实体复制/粘贴）
// ═══════════════════════════════════════════════════════════════

import { signal } from "@preact/signals";
import type { SceneEntity } from "../data/Scene";
import { cloneEntity } from "../data/Scene";
import { currentScene, addEntity, selectEntity, clearSelection } from "./scene";

/** 剪贴板中的实体数据（深拷贝后的快照） */
const clipboardEntities = signal<SceneEntity[]>([]);

/** 是否有可粘贴的内容 */
export const hasClipboard = () => clipboardEntities.value.length > 0;

/**
 * 复制当前选中的实体到剪贴板
 */
export function copyEntities(entities: SceneEntity[]): void {
  if (entities.length === 0) return;
  // 深拷贝，避免后续修改影响剪贴板内容
  clipboardEntities.value = entities.map(e =>
    cloneEntity(e, { ...e.transform })
  );
}

/**
 * 从剪贴板粘贴实体到场景
 * @param offsetX 粘贴时的 X 偏移（避免与原件完全重叠）
 * @param offsetY 粘贴时的 Y 偏移
 * @returns 新创建的实体列表
 */
export function pasteEntities(offsetX = 32, offsetY = 32): SceneEntity[] {
  const scene = currentScene.value;
  if (!scene || clipboardEntities.value.length === 0) return [];

  const gridSize = scene.grid.size;
  // 使用网格大小的整数倍作为默认偏移
  const snapOffsetX = offsetX || gridSize;
  const snapOffsetY = offsetY || gridSize;

  const newEntities: SceneEntity[] = [];

  for (const source of clipboardEntities.value) {
    const pasted = cloneEntity(source, {
      x: source.transform.x + snapOffsetX,
      y: source.transform.y + snapOffsetY,
    });
    newEntities.push(pasted);
    addEntity(pasted);
  }

  // 选中新粘贴的实体
  clearSelection();
  for (const e of newEntities) {
    selectEntity(e.id);
  }

  return newEntities;
}

/**
 * 清空剪贴板
 */
export function clearClipboard(): void {
  clipboardEntities.value = [];
}
