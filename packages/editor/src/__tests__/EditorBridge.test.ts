import { describe, it, expect, vi } from 'vitest';
import { MockEditorBridge } from '../core/EditorBridge.js';
import type { TilemapData } from '../types/editor.js';

describe('MockEditorBridge', () => {
  describe('实体操作', () => {
    it('应该正确创建实体', () => {
      const bridge = new MockEditorBridge();
      
      const id = bridge.createEntity('Player');
      
      expect(id).toBe(1);
      expect(bridge.getEntities()).toHaveLength(1);
      
      const entity = bridge.getEntities()[0];
      expect(entity.name).toBe('Player');
      expect(entity.parentId).toBeNull();
    });

    it('应该自动生成递增的实体ID', () => {
      const bridge = new MockEditorBridge();
      
      const id1 = bridge.createEntity('Entity1');
      const id2 = bridge.createEntity('Entity2');
      const id3 = bridge.createEntity('Entity3');
      
      expect(id1).toBe(1);
      expect(id2).toBe(2);
      expect(id3).toBe(3);
    });

    it('应该正确删除实体', () => {
      const bridge = new MockEditorBridge();
      const id = bridge.createEntity('ToDelete');
      
      bridge.deleteEntity(id);
      
      expect(bridge.getEntities()).toHaveLength(0);
    });

    it('删除实体应该触发 entity-deleted 事件', () => {
      const bridge = new MockEditorBridge();
      const onDeleted = vi.fn();
      bridge.on('entity-deleted', onDeleted);
      
      const id = bridge.createEntity('ToDelete');
      bridge.deleteEntity(id);
      
      expect(onDeleted).toHaveBeenCalledWith(id);
    });

    it('应该正确复制实体', () => {
      const bridge = new MockEditorBridge();
      const id = bridge.createEntity('Original');
      
      const copyId = bridge.duplicateEntity(id);
      
      expect(copyId).not.toBe(id);
      expect(bridge.getEntities()).toHaveLength(2);
      
      const copy = bridge.getEntities().find(e => e.id === copyId);
      expect(copy?.name).toBe('Original_copy');
    });

    it('应该正确重命名实体', () => {
      const bridge = new MockEditorBridge();
      const id = bridge.createEntity('OldName');
      
      bridge.renameEntity(id, 'NewName');
      
      const entity = bridge.getEntities()[0];
      expect(entity.name).toBe('NewName');
    });

    it('重命名应该触发 entity-changed 事件', () => {
      const bridge = new MockEditorBridge();
      const onChanged = vi.fn();
      bridge.on('entity-changed', onChanged);
      
      const id = bridge.createEntity('Test');
      bridge.renameEntity(id, 'NewName');
      
      expect(onChanged).toHaveBeenCalledWith(id);
    });
  });

  describe('父子关系', () => {
    it('应该正确设置父实体', () => {
      const bridge = new MockEditorBridge();
      const parentId = bridge.createEntity('Parent');
      const childId = bridge.createEntity('Child');
      
      bridge.reparentEntity(childId, parentId);
      
      const child = bridge.getEntities().find(e => e.id === childId);
      const parent = bridge.getEntities().find(e => e.id === parentId);
      
      expect(child?.parentId).toBe(parentId);
      expect(parent?.children).toContain(childId);
    });

    it('应该正确解除父实体', () => {
      const bridge = new MockEditorBridge();
      const parentId = bridge.createEntity('Parent');
      const childId = bridge.createEntity('Child');
      bridge.reparentEntity(childId, parentId);
      
      bridge.reparentEntity(childId, null);
      
      const child = bridge.getEntities().find(e => e.id === childId);
      const parent = bridge.getEntities().find(e => e.id === parentId);
      
      expect(child?.parentId).toBeNull();
      expect(parent?.children).not.toContain(childId);
    });

    it('删除父实体应该递归删除子实体', () => {
      const bridge = new MockEditorBridge();
      const parentId = bridge.createEntity('Parent');
      const childId = bridge.createEntity('Child');
      const grandChildId = bridge.createEntity('GrandChild');
      bridge.reparentEntity(childId, parentId);
      bridge.reparentEntity(grandChildId, childId);
      
      bridge.deleteEntity(parentId);
      
      expect(bridge.getEntities()).toHaveLength(0);
    });

    it('应该防止循环引用', () => {
      const bridge = new MockEditorBridge();
      const id1 = bridge.createEntity('Entity1');
      const id2 = bridge.createEntity('Entity2');
      bridge.reparentEntity(id2, id1);
      
      expect(() => bridge.reparentEntity(id1, id2)).toThrow('Cannot set parent: would create cycle');
    });

    it('实体不能成为自己的父实体', () => {
      const bridge = new MockEditorBridge();
      const id = bridge.createEntity('Entity');
      
      expect(() => bridge.reparentEntity(id, id)).toThrow('Cannot set parent: would create cycle');
    });
  });

  describe('组件操作', () => {
    it('应该正确添加组件', () => {
      const bridge = new MockEditorBridge();
      const id = bridge.createEntity('Test');
      
      bridge.addComponent(id, 'Position', { x: 10, y: 20 });
      
      const components = bridge.getComponents(id);
      expect(components).toHaveProperty('Position');
      expect(components.Position).toEqual({ x: 10, y: 20 });
    });

    it('应该正确设置组件字段', () => {
      const bridge = new MockEditorBridge();
      const id = bridge.createEntity('Test');
      bridge.addComponent(id, 'Position', { x: 0, y: 0 });
      
      bridge.setComponentField(id, 'Position', 'x', 100);
      
      const components = bridge.getComponents(id);
      expect(components.Position.x).toBe(100);
    });

    it('应该正确移除组件', () => {
      const bridge = new MockEditorBridge();
      const id = bridge.createEntity('Test');
      bridge.addComponent(id, 'Position', { x: 0, y: 0 });
      
      bridge.removeComponent(id, 'Position');
      
      const components = bridge.getComponents(id);
      expect(components).not.toHaveProperty('Position');
    });

    it('组件变化应该触发 entity-changed 事件', () => {
      const bridge = new MockEditorBridge();
      const onChanged = vi.fn();
      bridge.on('entity-changed', onChanged);
      
      const id = bridge.createEntity('Test');
      bridge.addComponent(id, 'Position', { x: 0, y: 0 });
      
      expect(onChanged).toHaveBeenCalledWith(id);
    });

    it('应该支持创建时带组件', () => {
      const bridge = new MockEditorBridge();
      
      const id = bridge.createEntity('Player', {
        Position: { x: 10, y: 20 },
        Sprite: { texture: 'player.png' },
      });
      
      const components = bridge.getComponents(id);
      expect(components).toHaveProperty('Position');
      expect(components).toHaveProperty('Sprite');
      
      const entity = bridge.getEntities()[0];
      expect(entity.components).toContain('Position');
      expect(entity.components).toContain('Sprite');
    });
  });

  describe('场景序列化', () => {
    it('应该正确序列化场景', () => {
      const bridge = new MockEditorBridge();
      bridge.createEntity('Player', { Position: { x: 10, y: 20 } });
      bridge.createEntity('Enemy', { Position: { x: 50, y: 50 } });
      
      const json = bridge.serializeScene();
      const data = JSON.parse(json);
      
      expect(data.entities).toHaveLength(2);
      expect(data.entities[0].name).toBe('Player');
      expect(data.entities[0].components).toHaveProperty('Position');
    });

    it('应该正确反序列化场景', () => {
      const bridge = new MockEditorBridge();
      const sceneData = {
        name: 'TestScene',
        entities: [
          {
            id: 1,
            name: 'Player',
            parentId: null,
            children: [],
            components: { Position: { x: 10, y: 20 } },
          },
        ],
      };
      
      bridge.deserializeScene(JSON.stringify(sceneData));
      
      const entities = bridge.getEntities();
      expect(entities).toHaveLength(1);
      expect(entities[0].name).toBe('Player');
      expect(bridge.getComponents(1)).toEqual({ Position: { x: 10, y: 20 } });
    });

    it('反序列化应该触发 scene-loaded 事件', () => {
      const bridge = new MockEditorBridge();
      const onLoaded = vi.fn();
      bridge.on('scene-loaded', onLoaded);
      
      bridge.deserializeScene('{"entities":[]}');
      
      expect(onLoaded).toHaveBeenCalled();
    });
  });

  describe('运行控制', () => {
    it('初始状态应该是 stopped', () => {
      const bridge = new MockEditorBridge();
      expect(bridge.getPlayState()).toBe('stopped');
    });

    it('play 应该切换到 playing 状态', () => {
      const bridge = new MockEditorBridge();
      
      bridge.play();
      
      expect(bridge.getPlayState()).toBe('playing');
    });

    it('pause 应该从 playing 切换到 paused', () => {
      const bridge = new MockEditorBridge();
      bridge.play();
      
      bridge.pause();
      
      expect(bridge.getPlayState()).toBe('paused');
    });

    it('play 应该从 paused 恢复到 playing', () => {
      const bridge = new MockEditorBridge();
      bridge.play();
      bridge.pause();
      
      bridge.play();
      
      expect(bridge.getPlayState()).toBe('playing');
    });

    it('stop 应该回到 stopped 状态', () => {
      const bridge = new MockEditorBridge();
      bridge.play();
      
      bridge.stop();
      
      expect(bridge.getPlayState()).toBe('stopped');
    });

    it('状态变化应该触发 play-state-changed 事件', () => {
      const bridge = new MockEditorBridge();
      const onChanged = vi.fn();
      bridge.on('play-state-changed', onChanged);
      
      bridge.play();
      expect(onChanged).toHaveBeenCalledWith('playing');
      
      bridge.pause();
      expect(onChanged).toHaveBeenLastCalledWith('paused');
    });
  });

  describe('Tilemap', () => {
    const createTestTilemap = (): TilemapData => ({
      tileSize: 32,
      width: 10,
      height: 10,
      tilesets: [{ image: 'tiles.png', columns: 8, tilecount: 16 }],
      layers: [
        { name: 'ground', data: new Array(100).fill(0) },
        { name: 'objects', data: new Array(100).fill(0) },
      ],
    });

    it('应该正确设置和获取 tile', () => {
      const bridge = new MockEditorBridge();
      bridge.setTilemapData(createTestTilemap());
      
      bridge.setTile('ground', 5, 5, 10);
      
      expect(bridge.getTile('ground', 5, 5)).toBe(10);
    });

    it('应该正确计算 tile 索引', () => {
      const bridge = new MockEditorBridge();
      bridge.setTilemapData(createTestTilemap());
      
      bridge.setTile('ground', 0, 0, 1);
      bridge.setTile('ground', 9, 9, 99);
      
      expect(bridge.getTile('ground', 0, 0)).toBe(1);
      expect(bridge.getTile('ground', 9, 9)).toBe(99);
    });

    it('越界访问应该返回 0', () => {
      const bridge = new MockEditorBridge();
      bridge.setTilemapData(createTestTilemap());
      
      expect(bridge.getTile('ground', -1, 0)).toBe(0);
      expect(bridge.getTile('ground', 0, -1)).toBe(0);
      expect(bridge.getTile('ground', 100, 0)).toBe(0);
      expect(bridge.getTile('ground', 0, 100)).toBe(0);
    });

    it('不存在的 layer 应该返回 0', () => {
      const bridge = new MockEditorBridge();
      bridge.setTilemapData(createTestTilemap());
      
      expect(bridge.getTile('nonexistent', 0, 0)).toBe(0);
    });

    it('无 tilemap 时应该返回 null', () => {
      const bridge = new MockEditorBridge();
      
      expect(bridge.getTilemapData()).toBeNull();
    });
  });

  describe('事件系统', () => {
    it('应该支持订阅和触发事件', () => {
      const bridge = new MockEditorBridge();
      const callback = vi.fn();
      
      bridge.on('entity-created', callback);
      bridge.createEntity('Test');
      
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('应该支持多个监听器', () => {
      const bridge = new MockEditorBridge();
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      bridge.on('entity-created', callback1);
      bridge.on('entity-created', callback2);
      bridge.createEntity('Test');
      
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('取消订阅应该生效', () => {
      const bridge = new MockEditorBridge();
      const callback = vi.fn();
      
      const unsubscribe = bridge.on('entity-created', callback);
      unsubscribe();
      bridge.createEntity('Test');
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('on 返回的函数应该只取消自己的订阅', () => {
      const bridge = new MockEditorBridge();
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      const unsubscribe1 = bridge.on('entity-created', callback1);
      bridge.on('entity-created', callback2);
      
      unsubscribe1();
      bridge.createEntity('Test');
      
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });
});
