// ═══════════════════════════════════════════════════════════════
// spawnMenu.ts - Shift+A Spawn Menu 状态
// ═══════════════════════════════════════════════════════════════

import { signal } from '@preact/signals';

/** Spawn Menu 是否打开 */
export const spawnMenuOpen = signal(false);

/** 菜单显示位置（相对于 viewport container，px） */
export const spawnMenuPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

/** 放置目标世界坐标 */
export const spawnWorldPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

/** 打开 Spawn Menu */
export function openSpawnMenu(screenX: number, screenY: number, worldX: number, worldY: number) {
  spawnMenuPos.value = { x: screenX, y: screenY };
  spawnWorldPos.value = { x: worldX, y: worldY };
  spawnMenuOpen.value = true;
}

/** 关闭 Spawn Menu */
export function closeSpawnMenu() {
  spawnMenuOpen.value = false;
}
