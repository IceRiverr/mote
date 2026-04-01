import type {
  EntityInfo,
  ComponentData,
  AssetInfo,
  TilemapData,
  SceneData,
  EditorEvent,
  PlayState,
} from '../types/editor.js';

/**
 * EditorBridge - 编辑器与引擎的唯一桥接口
 * 
 * 编辑器 UI（Preact）不直接操作引擎内部，所有交互通过此 Bridge 完成。
 * 这是一个抽象接口，实际实现由引擎提供。
 */
export interface EditorBridge {
  // === 场景实体操作 ===
  
  /** 获取所有实体信息 */
  getEntities(): EntityInfo[];
  
  /** 创建实体，返回新实体 ID */
  createEntity(name: string, components?: Record<string, ComponentData>): number;
  
  /** 删除实体 */
  deleteEntity(id: number): void;
  
  /** 复制实体，返回新实体 ID */
  duplicateEntity(id: number): number;
  
  /** 修改实体的父实体 */
  reparentEntity(id: number, newParentId: number | null): void;
  
  /** 重命名实体 */
  renameEntity(id: number, newName: string): void;

  // === 组件操作 ===
  
  /** 获取实体的所有组件数据 */
  getComponents(entityId: number): Record<string, ComponentData>;
  
  /** 设置组件字段值 */
  setComponentField(
    entityId: number,
    componentType: string,
    field: string,
    value: unknown
  ): void;
  
  /** 添加组件到实体 */
  addComponent(entityId: number, componentType: string, data?: ComponentData): void;
  
  /** 从实体移除组件 */
  removeComponent(entityId: number, componentType: string): void;

  // === 资源 ===
  
  /** 加载资源 */
  loadAsset<T>(path: string): Promise<T>;
  
  /** 获取目录下的资源列表 */
  getAssetList(directory: string): Promise<AssetInfo[]>;

  // === 场景序列化 ===
  
  /** 导出场景为 JSONC 字符串 */
  serializeScene(): string;
  
  /** 从 JSONC 字符串加载场景 */
  deserializeScene(json: string): void;
  
  /** 获取当前场景数据 */
  getSceneData(): SceneData;

  // === 运行控制 ===
  
  /** 开始运行 */
  play(): void;
  
  /** 暂停运行 */
  pause(): void;
  
  /** 停止运行（回到编辑状态） */
  stop(): void;
  
  /** 获取当前运行状态 */
  getPlayState(): PlayState;

  // === Tilemap ===
  
  /** 获取当前 tilemap 数据 */
  getTilemapData(): TilemapData | null;
  
  /** 设置 tile（使用 GID） */
  setTile(layerName: string, x: number, y: number, tileId: number): void;
  
  /** 获取 tile（返回 GID） */
  getTile(layerName: string, x: number, y: number): number;

  // === 事件 ===
  
  /** 订阅编辑器事件，返回取消订阅函数 */
  on(event: EditorEvent, callback: (...args: unknown[]) => void): () => void;
  
  /** 触发事件（供引擎调用） */
  emit(event: EditorEvent, ...args: unknown[]): void;
}

/**
 * MockEditorBridge - 用于测试和开发的模拟实现
 */
export class MockEditorBridge implements EditorBridge {
  private entities: Map<number, EntityInfo> = new Map();
  private components: Map<number, Record<string, ComponentData>> = new Map();
  private nextEntityId = 1;
  private eventListeners: Map<EditorEvent, Set<(...args: unknown[]) => void>> = new Map();
  private playState: PlayState = 'stopped';
  private tilemapData: TilemapData | null = null;
  private sceneData: SceneData = { name: 'Untitled', entities: [] };

  // === 实体操作 ===
  
  getEntities(): EntityInfo[] {
    return Array.from(this.entities.values());
  }

  createEntity(name: string, components: Record<string, ComponentData> = {}): number {
    const id = this.nextEntityId++;
    const entity: EntityInfo = {
      id,
      name,
      parentId: null,
      children: [],
      components: Object.keys(components),
    };
    this.entities.set(id, entity);
    this.components.set(id, { ...components });
    this.emit('entity-created', id);
    return id;
  }

  deleteEntity(id: number): void {
    const entity = this.entities.get(id);
    if (!entity) return;

    // 解除父子关系
    if (entity.parentId !== null) {
      const parent = this.entities.get(entity.parentId);
      if (parent) {
        parent.children = parent.children.filter(cid => cid !== id);
      }
    }
    
    // 递归删除子实体
    for (const childId of [...entity.children]) {
      this.deleteEntity(childId);
    }

    this.entities.delete(id);
    this.components.delete(id);
    this.emit('entity-deleted', id);
  }

  duplicateEntity(id: number): number {
    const entity = this.entities.get(id);
    if (!entity) throw new Error(`Entity ${id} not found`);

    const comps = this.components.get(id) || {};
    const newId = this.createEntity(`${entity.name}_copy`, JSON.parse(JSON.stringify(comps)));
    
    // 复制父子关系
    if (entity.parentId !== null) {
      this.reparentEntity(newId, entity.parentId);
    }

    return newId;
  }

  reparentEntity(id: number, newParentId: number | null): void {
    const entity = this.entities.get(id);
    if (!entity) return;

    // 从旧父节点移除
    if (entity.parentId !== null) {
      const oldParent = this.entities.get(entity.parentId);
      if (oldParent) {
        oldParent.children = oldParent.children.filter(cid => cid !== id);
      }
    }

    // 检查循环引用
    if (newParentId !== null) {
      if (newParentId === id || this._isDescendant(id, newParentId)) {
        throw new Error('Cannot set parent: would create cycle');
      }
      const newParent = this.entities.get(newParentId);
      if (newParent) {
        newParent.children.push(id);
      }
    }

    entity.parentId = newParentId;
    this.emit('entity-changed', id);
  }

  renameEntity(id: number, newName: string): void {
    const entity = this.entities.get(id);
    if (entity) {
      entity.name = newName;
      this.emit('entity-changed', id);
    }
  }

  // === 组件操作 ===
  
  getComponents(entityId: number): Record<string, ComponentData> {
    return this.components.get(entityId) || {};
  }

  setComponentField(
    entityId: number,
    componentType: string,
    field: string,
    value: unknown
  ): void {
    const comps = this.components.get(entityId);
    if (!comps || !comps[componentType]) return;
    
    comps[componentType][field] = value;
    this.emit('entity-changed', entityId);
  }

  addComponent(entityId: number, componentType: string, data: ComponentData = {}): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;

    const comps = this.components.get(entityId) || {};
    comps[componentType] = data;
    this.components.set(entityId, comps);
    
    if (!entity.components.includes(componentType)) {
      entity.components.push(componentType);
    }
    
    this.emit('entity-changed', entityId);
  }

  removeComponent(entityId: number, componentType: string): void {
    const entity = this.entities.get(entityId);
    const comps = this.components.get(entityId);
    if (!entity || !comps) return;

    delete comps[componentType];
    entity.components = entity.components.filter(c => c !== componentType);
    
    this.emit('entity-changed', entityId);
  }

  // === 资源（模拟实现） ===
  
  async loadAsset<T>(path: string): Promise<T> {
    return { path } as T;
  }

  async getAssetList(_directory: string): Promise<AssetInfo[]> {
    return [];
  }

  // === 场景序列化 ===
  
  serializeScene(): string {
    const data = {
      name: this.sceneData.name,
      entities: this.getEntities().map(e => ({
        ...e,
        components: this.components.get(e.id) || {},
      })),
      tilemap: this.tilemapData,
    };
    return JSON.stringify(data, null, 2);
  }

  deserializeScene(json: string): void {
    const data = JSON.parse(json);
    this.entities.clear();
    this.components.clear();
    this.nextEntityId = 1;

    for (const e of data.entities) {
      const id = e.id;
      this.entities.set(id, {
        id,
        name: e.name,
        parentId: e.parentId,
        children: e.children || [],
        components: Object.keys(e.components || {}),
      });
      this.components.set(id, e.components || {});
      this.nextEntityId = Math.max(this.nextEntityId, id + 1);
    }

    this.tilemapData = data.tilemap || null;
    this.emit('scene-loaded');
  }

  getSceneData(): SceneData {
    return { ...this.sceneData, entities: this.getEntities() };
  }

  // === 运行控制 ===
  
  play(): void {
    if (this.playState === 'stopped') {
      this.playState = 'playing';
      this.emit('play-state-changed', this.playState);
    } else if (this.playState === 'paused') {
      this.playState = 'playing';
      this.emit('play-state-changed', this.playState);
    }
  }

  pause(): void {
    if (this.playState === 'playing') {
      this.playState = 'paused';
      this.emit('play-state-changed', this.playState);
    }
  }

  stop(): void {
    if (this.playState !== 'stopped') {
      this.playState = 'stopped';
      this.emit('play-state-changed', this.playState);
    }
  }

  getPlayState(): PlayState {
    return this.playState;
  }

  // === Tilemap ===
  
  getTilemapData(): TilemapData | null {
    return this.tilemapData;
  }

  setTilemapData(data: TilemapData): void {
    this.tilemapData = data;
  }

  setTile(layerName: string, x: number, y: number, tileId: number): void {
    if (!this.tilemapData) return;
    const layer = this.tilemapData.layers.find(l => l.name === layerName);
    if (!layer) return;
    
    const index = y * this.tilemapData.width + x;
    if (index >= 0 && index < layer.data.length) {
      layer.data[index] = tileId;
    }
  }

  getTile(layerName: string, x: number, y: number): number {
    if (!this.tilemapData) return 0;
    const layer = this.tilemapData.layers.find(l => l.name === layerName);
    if (!layer) return 0;
    
    const index = y * this.tilemapData.width + x;
    if (index >= 0 && index < layer.data.length) {
      return layer.data[index];
    }
    return 0;
  }

  // === 事件系统 ===
  
  on(event: EditorEvent, callback: (...args: unknown[]) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  emit(event: EditorEvent, ...args: unknown[]): void {
    this.eventListeners.get(event)?.forEach(cb => cb(...args));
  }

  // === 私有方法 ===
  
  private _isDescendant(parentId: number, childId: number): boolean {
    const parent = this.entities.get(parentId);
    if (!parent) return false;
    if (parent.children.includes(childId)) return true;
    return parent.children.some(cid => this._isDescendant(cid, childId));
  }
}
