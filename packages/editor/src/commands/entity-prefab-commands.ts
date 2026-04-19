// ═══════════════════════════════════════════════════════════════
// entity-prefab-commands.ts - Inspector 中实例与 Prefab 交互命令
// ═══════════════════════════════════════════════════════════════

import type { Command } from '../store/history';
import { currentScene, bumpVersion } from '../store/scene';
import { getPrefab, setPrefab, getPrefabPath } from '../store/prefabs';
import { getPrefabFS } from '../fs/PrefabFS';
import type { SceneEntity } from '../data/Scene';
import type { Prefab, PrefabId } from '../data/Prefab';
import { applyOverrides } from '@mote/engine/core/prefab';

// ═══════════════════════════════════════════════════════════════
// ApplyOverridesToPrefabCommand - 将实例 overrides 合并回 Prefab
// ═══════════════════════════════════════════════════════════════

export class ApplyOverridesToPrefabCommand implements Command {
  readonly label = 'Apply to Prefab';
  private entityId: string;
  private prefabId: PrefabId;
  private oldPrefabContent: string | null = null;
  private oldOverrides: SceneEntity['overrides'];
  private applied = false;

  constructor(entity: SceneEntity) {
    this.entityId = entity.id;
    this.prefabId = entity.prefab;
    this.oldOverrides = entity.overrides ? structuredClone(entity.overrides) : undefined;
  }

  execute(): void {
    const scene = currentScene.value;
    if (!scene) return;
    const entity = scene.entities.find(e => e.id === this.entityId);
    if (!entity || !entity.overrides) return;

    const prefab = getPrefab(this.prefabId);
    if (!prefab) {
      console.error(`[ApplyOverrides] Prefab "${this.prefabId}" not found`);
      return;
    }

    const path = getPrefabPath(this.prefabId);
    if (!path) {
      console.error(`[ApplyOverrides] Path for Prefab "${this.prefabId}" not found`);
      return;
    }

    // 1. 合并 overrides 回 Prefab
    const newComponents = applyOverrides(prefab.components, entity.overrides);
    const newPrefab: Prefab = {
      ...prefab,
      components: newComponents as Prefab['components'],
    };

    // 2. 保存前记录旧内容（异步保存但命令同步执行）
    this.doSave(newPrefab, path, entity);
  }

  private async doSave(newPrefab: Prefab, path: string, entity: SceneEntity): Promise<void> {
    const prefabFS = getPrefabFS();

    try {
      const existing = await prefabFS.loadFromPath(path);
      this.oldPrefabContent = existing ? JSON.stringify(existing, null, 2) : null;
    } catch {
      this.oldPrefabContent = null;
    }

    const success = await prefabFS.save(newPrefab, path);
    if (success) {
      this.applied = true;
      setPrefab(this.prefabId, newPrefab, path);

      // 3. 清空 entity overrides
      entity.overrides = undefined;
      bumpVersion();
    }
  }

  undo(): void {
    const scene = currentScene.value;
    if (!scene) return;
    const entity = scene.entities.find(e => e.id === this.entityId);
    if (!entity) return;

    // 恢复 overrides
    entity.overrides = this.oldOverrides ? structuredClone(this.oldOverrides) : undefined;
    bumpVersion();

    // 恢复 Prefab 文件（如果保存成功过）
    if (this.applied && this.oldPrefabContent) {
      const path = getPrefabPath(this.prefabId);
      if (path) {
        const prefabFS = getPrefabFS();
        const assetPath = `${prefabFS.getAssetsDir()}/${path}`;
        const fs = (prefabFS as any).fs;
        fs.writeFile(assetPath, this.oldPrefabContent).then(() => {
          const oldPrefab = JSON.parse(this.oldPrefabContent!);
          setPrefab(this.prefabId, oldPrefab, path);
        });
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// RevertToPrefabCommand - 清空实例所有 overrides
// ═══════════════════════════════════════════════════════════════

export class RevertToPrefabCommand implements Command {
  readonly label = 'Revert to Prefab';
  private entityId: string;
  private oldOverrides: SceneEntity['overrides'];

  constructor(entity: SceneEntity) {
    this.entityId = entity.id;
    this.oldOverrides = entity.overrides ? structuredClone(entity.overrides) : undefined;
  }

  execute(): void {
    const scene = currentScene.value;
    if (!scene) return;
    const entity = scene.entities.find(e => e.id === this.entityId);
    if (!entity) return;

    entity.overrides = undefined;
    bumpVersion();
  }

  undo(): void {
    const scene = currentScene.value;
    if (!scene) return;
    const entity = scene.entities.find(e => e.id === this.entityId);
    if (!entity) return;

    entity.overrides = this.oldOverrides ? structuredClone(this.oldOverrides) : undefined;
    bumpVersion();
  }
}

// ═══════════════════════════════════════════════════════════════
// SaveEntityAsPrefabCommand - 将场景实体保存为新 Prefab
// ═══════════════════════════════════════════════════════════════

export class SaveEntityAsPrefabCommand implements Command {
  readonly label = '保存为 Prefab';
  private entityId: string;
  private newPrefabId: PrefabId;
  private newPath: string;
  private oldPrefabId: PrefabId;
  private oldOverrides: SceneEntity['overrides'];
  private oldTransform: SceneEntity['transform'];
  private saved = false;

  constructor(
    entity: SceneEntity,
    newPrefabId: PrefabId,
    newPath: string
  ) {
    this.entityId = entity.id;
    this.oldPrefabId = entity.prefab;
    this.oldOverrides = entity.overrides ? structuredClone(entity.overrides) : undefined;
    this.oldTransform = { ...entity.transform };
    this.newPrefabId = newPrefabId;
    this.newPath = newPath;
  }

  async execute(): Promise<void> {
    const scene = currentScene.value;
    if (!scene) return;
    const entity = scene.entities.find(e => e.id === this.entityId);
    if (!entity) return;

    // 1. 构建新 Prefab 的 components
    const basePrefab = getPrefab(this.oldPrefabId);
    const baseComponents = basePrefab ? structuredClone(basePrefab.components) : {};

    // 用 entity overrides 覆盖
    if (entity.overrides) {
      for (const [compName, props] of Object.entries(entity.overrides)) {
        if (!baseComponents[compName]) baseComponents[compName] = {};
        Object.assign(baseComponents[compName], structuredClone(props));
      }
    }

    // Transform 使用 entity 的 transform 作为默认值
    baseComponents.Transform = { ...entity.transform };

    const { PREFAB_VERSION, PREFAB_KIND } = await import('../data/Prefab');
    const newPrefab: Prefab = {
      version: PREFAB_VERSION,
      kind: PREFAB_KIND,
      name: this.newPrefabId.split('/').pop() || this.newPrefabId,
      components: baseComponents,
    };

    // 2. 保存
    const prefabFS = getPrefabFS();
    const success = await prefabFS.save(newPrefab, this.newPath);
    if (!success) return;

    this.saved = true;

    // 3. 更新全局 store
    setPrefab(this.newPrefabId, newPrefab, this.newPath);

    // 4. 更新 entity 引用
    entity.prefab = this.newPrefabId;
    entity.overrides = undefined;
    // transform 保持不变
    bumpVersion();
  }

  undo(): void {
    if (!this.saved) return;

    const scene = currentScene.value;
    if (!scene) return;
    const entity = scene.entities.find(e => e.id === this.entityId);
    if (!entity) return;

    entity.prefab = this.oldPrefabId;
    entity.overrides = this.oldOverrides ? structuredClone(this.oldOverrides) : undefined;
    entity.transform = { ...this.oldTransform };
    bumpVersion();

    // 删除新创建的 Prefab 文件（可选，暂不实现文件删除以保持安全）
  }
}
