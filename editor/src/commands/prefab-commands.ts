// ═══════════════════════════════════════════════════════════════
// prefab-commands.ts - Prefab Editor 专用 Command
// ═══════════════════════════════════════════════════════════════

import type { Command } from '../store/history';
import { editingPrefab } from '../store/prefabEditor';
import { setPrefab } from '../store/prefabs';
import { syncPrefabToEngine } from '../store/engineSync';
import type { Prefab, PrefabId } from '../data/Prefab';
import { getPrefabFS } from '../fs/PrefabFS';

// ═══════════════════════════════════════════════════════════════
// EditPrefabPropertyCommand - 编辑 Prefab 属性
// ═══════════════════════════════════════════════════════════════

export class EditPrefabPropertyCommand implements Command {
  readonly label: string;
  private component: string;
  private property: string;
  private oldValue: unknown;
  private newValue: unknown;

  constructor(
    component: string,
    property: string,
    newValue: unknown,
    label?: string
  ) {
    this.label = label || `修改 ${component}.${property}`;
    this.component = component;
    this.property = property;
    this.newValue = structuredClone(newValue);

    const current = editingPrefab.value;
    if (component === '__meta__') {
      this.oldValue = structuredClone((current?.draft as any)?.[property]);
    } else {
      this.oldValue = structuredClone(current?.draft.components[component]?.[property]);
    }
  }

  execute(): void {
    this.apply(this.newValue);
  }

  undo(): void {
    this.apply(this.oldValue);
  }

  private apply(value: unknown): void {
    const current = editingPrefab.value;
    if (!current) return;

    if (this.component === '__meta__') {
      current.draft = { ...current.draft, [this.property]: value } as Prefab;
    } else {
      current.draft = {
        ...current.draft,
        components: {
          ...current.draft.components,
          [this.component]: {
            ...current.draft.components[this.component],
            [this.property]: structuredClone(value),
          },
        },
      };
    }

    // 触发 Signal 更新
    editingPrefab.value = { ...current };
  }
}

// ═══════════════════════════════════════════════════════════════
// AddPrefabComponentCommand - 添加组件
// ═══════════════════════════════════════════════════════════════

export class AddPrefabComponentCommand implements Command {
  readonly label: string;
  private componentName: string;
  private defaultData: Record<string, any>;

  constructor(componentName: string, defaultData: Record<string, any>) {
    this.label = `添加 ${componentName}`;
    this.componentName = componentName;
    this.defaultData = structuredClone(defaultData);
  }

  execute(): void {
    const current = editingPrefab.value;
    if (!current) return;

    if (current.draft.components[this.componentName]) return;

    current.draft = {
      ...current.draft,
      components: {
        ...current.draft.components,
        [this.componentName]: this.defaultData,
      },
    };
    editingPrefab.value = { ...current };
  }

  undo(): void {
    const current = editingPrefab.value;
    if (!current) return;

    const comps = { ...current.draft.components };
    delete comps[this.componentName];
    current.draft = { ...current.draft, components: comps };
    editingPrefab.value = { ...current };
  }
}

// ═══════════════════════════════════════════════════════════════
// RemovePrefabComponentCommand - 删除组件
// ═══════════════════════════════════════════════════════════════

export class RemovePrefabComponentCommand implements Command {
  readonly label: string;
  private componentName: string;
  private removedData: Record<string, any> | null = null;

  constructor(componentName: string) {
    this.label = `删除 ${componentName}`;
    this.componentName = componentName;
  }

  execute(): void {
    const current = editingPrefab.value;
    if (!current) return;

    // Transform 不可删除
    if (this.componentName === 'Transform') {
      console.warn('[RemovePrefabComponent] Transform cannot be removed');
      return;
    }

    this.removedData = structuredClone(current.draft.components[this.componentName]);

    const comps = { ...current.draft.components };
    delete comps[this.componentName];
    current.draft = { ...current.draft, components: comps };
    editingPrefab.value = { ...current };
  }

  undo(): void {
    const current = editingPrefab.value;
    if (!current || !this.removedData) return;

    current.draft = {
      ...current.draft,
      components: {
        ...current.draft.components,
        [this.componentName]: this.removedData,
      },
    };
    editingPrefab.value = { ...current };
  }
}

// ═══════════════════════════════════════════════════════════════
// SavePrefabCommand - 保存 Prefab
// ═══════════════════════════════════════════════════════════════

export class SavePrefabCommand implements Command {
  readonly label = '保存 Prefab';
  private prefabId: PrefabId;
  private path: string;
  private oldFileContent: string | null = null;
  private saved = false;

  constructor(prefabId: PrefabId, path: string) {
    this.prefabId = prefabId;
    this.path = path;
  }

  async execute(): Promise<void> {
    const current = editingPrefab.value;
    if (!current) return;

    const prefabFS = getPrefabFS();

    // 保存前读取旧内容（用于 undo）
    try {
      const existing = await prefabFS.loadFromPath(this.path);
      this.oldFileContent = existing ? JSON.stringify(existing, null, 2) : null;
    } catch {
      this.oldFileContent = null;
    }

    // 保存 draft
    const success = await prefabFS.save(current.draft, this.path);
    if (success) {
      this.saved = true;
      // 更新全局 prefabs Signal
      setPrefab(this.prefabId, current.draft, this.path);
      // 更新 original 快照，使后续编辑基于新保存状态
      current.original = structuredClone(current.draft);
      editingPrefab.value = { ...current };
      // 触发 Engine 同步
      syncPrefabToEngine(this.prefabId);
    }
  }

  async undo(): Promise<void> {
    if (!this.saved) return;

    const prefabFS = getPrefabFS();

    if (this.oldFileContent) {
      // 写回旧内容
      const assetPath = `${prefabFS.getAssetsDir()}/${this.path}`;
      const fs = (prefabFS as any).fs;
      await fs.writeFile(assetPath, this.oldFileContent);

      // 重新加载旧 Prefab
      const oldPrefab = JSON.parse(this.oldFileContent);
      setPrefab(this.prefabId, oldPrefab, this.path);

      // 恢复 draft
      const current = editingPrefab.value;
      if (current) {
        current.draft = structuredClone(oldPrefab);
        current.original = structuredClone(oldPrefab);
        editingPrefab.value = { ...current };
      }
    }
  }
}
