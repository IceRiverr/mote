// ═══════════════════════════════════════════════════════════════
// scene.ts — Scene store
// Manages the current scene, layers, and scene-level state
// ═══════════════════════════════════════════════════════════════

import { signal, computed } from '@preact/signals';
import type { Scene, SceneLayer, TileLayerData, EntityLayerData } from '../data/Scene';

// For now, re-export scene as "currentScene" parallel to the old currentMap.
// The integration step will wire this up.

/** Current active scene */
export const currentScene = signal<Scene | null>(null);

/** Scene version bump for re-render */
export const sceneVersion = signal(0);
export const bumpSceneVersion = () => { sceneVersion.value++; };

/** Active layer ID */
export const activeSceneLayerId = signal<string>('');

/** Get active layer */
export const activeSceneLayer = computed((): SceneLayer | null => {
  const scene = currentScene.value;
  if (!scene) return null;
  return scene.layers.find(l => l.id === activeSceneLayerId.value) ?? scene.layers[0] ?? null;
});

// ── Layer helpers ─────────────────────────────────────────────

export function addLayer(layer: SceneLayer): void {
  const scene = currentScene.value;
  if (!scene) return;
  currentScene.value = { ...scene, layers: [...scene.layers, layer] };
  bumpSceneVersion();
}

export function removeLayer(layerId: string): void {
  const scene = currentScene.value;
  if (!scene) return;
  currentScene.value = { ...scene, layers: scene.layers.filter(l => l.id !== layerId) };
  bumpSceneVersion();
}

export function moveLayer(layerId: string, direction: 'up' | 'down'): void {
  const scene = currentScene.value;
  if (!scene) return;
  const idx = scene.layers.findIndex(l => l.id === layerId);
  if (idx < 0) return;
  const newIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= scene.layers.length) return;
  const layers = [...scene.layers];
  [layers[idx], layers[newIdx]] = [layers[newIdx], layers[idx]];
  currentScene.value = { ...scene, layers };
  bumpSceneVersion();
}

export function updateLayer(layerId: string, updater: (layer: SceneLayer) => SceneLayer): void {
  const scene = currentScene.value;
  if (!scene) return;
  currentScene.value = {
    ...scene,
    layers: scene.layers.map(l => l.id === layerId ? updater(l) : l),
  };
  bumpSceneVersion();
}

export function renameLayer(layerId: string, name: string): void {
  updateLayer(layerId, l => ({ ...l, name }));
}

export function toggleLayerVisibility(layerId: string): void {
  updateLayer(layerId, l => ({ ...l, visible: !l.visible }));
}

export function toggleLayerLocked(layerId: string): void {
  updateLayer(layerId, l => ({ ...l, locked: !l.locked }));
}
