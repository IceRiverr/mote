// ═══════════════════════════════════════════════════════════════
// index.ts - Phase 1 模块导出
// 用于测试所有新创建的模块是否正确导出
// ═══════════════════════════════════════════════════════════════

// Data layer
export type { 
  Prefab, 
  PrefabComponents,
} from './data/Prefab';
export { 
  createPrefab, 
  createPrefabFromSprite,
  validatePrefab,
  getPrefabDisplayName,
  getPrefabThumbnail,
} from './data/Prefab';

export type { 
  Scene, 
  SceneEntity, 
  GridSettings,
} from './data/Scene';
export { 
  createScene, 
  createSceneEntity,
  validateScene,
  validateEntity,
  cloneEntity,
  gridToWorld,
  snapToGrid,
  exportToECS,
} from './data/Scene';

// Stores
export {
  // State
  prefabs,
  searchQuery,
  selectedTag,
  prefabVersion,
  // Computed
  allTags,
  filteredPrefabs,
  prefabsByTag,
  // Actions
  setPrefab,
  setPrefabs,
  deletePrefab,
  getPrefab,
  hasPrefab,
  generateUniqueId,
  clearPrefabs,
  bumpVersion as bumpPrefabVersion,
  loadBuiltinPrefabs,
} from './store/prefabs';

export {
  // State
  currentScene,
  sceneVersion,
  selectedEntityIds,
  hoveredEntityId,
  snapEnabled,
  // Computed
  selectedEntities,
  singleSelectedEntity,
  gridSettings,
  // Scene actions
  loadScene,
  newScene,
  clearScene,
  updateScene,
  // Entity actions
  addEntity,
  spawnPrefab,
  removeEntity,
  updateEntity,
  moveEntity,
  // Selection actions
  selectEntity,
  toggleEntitySelection,
  addToSelection,
  selectEntitiesInRect,
  clearSelection,
  selectAll,
  // Grid actions
  updateGrid,
  toggleSnap,
  // Utils
  bumpVersion as bumpSceneVersion,
  getEntity,
  findEntityAt,
} from './store/scene';

// Tools
export type {
  SpriteFrame,
  SpriteAtlas,
  GeneratePrefabOptions,
  ColliderShape,
} from './tools/frameToPrefab';
export {
  generatePrefabFromFrame,
  generatePrefabsFromFrames,
  loadSpriteAtlas,
  suggestPrefabId,
  parseSpriteRef,
  buildSpriteRef,
} from './tools/frameToPrefab';
