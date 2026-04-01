import { describe, it, expect, vi } from 'vitest';
import { SelectionManager } from '../core/SelectionManager.js';
import type { EntityInfo } from '../types/editor.js';

describe('SelectionManager', () => {
  // 辅助函数：创建测试用的实体列表
  const createEntities = (count: number): EntityInfo[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: `Entity ${i + 1}`,
      parentId: null,
      children: [],
      components: [],
    }));
  };

  describe('基本选择操作', () => {
    it('应该正确单选实体', () => {
      const manager = new SelectionManager();
      
      manager.select(1);
      
      expect(manager.selected.value).toEqual([1]);
      expect(manager.isSelected(1)).toBe(true);
      expect(manager.isSelected(2)).toBe(false);
    });

    it('单选应该替换之前的选中', () => {
      const manager = new SelectionManager();
      
      manager.select(1);
      manager.select(2);
      
      expect(manager.selected.value).toEqual([2]);
      expect(manager.isSelected(1)).toBe(false);
    });

    it('应该正确多选实体', () => {
      const manager = new SelectionManager();
      
      manager.selectMany([1, 2, 3]);
      
      expect(manager.selected.value).toEqual([1, 2, 3]);
      expect(manager.count).toBe(3);
    });

    it('应该正确切换选中状态', () => {
      const manager = new SelectionManager();
      
      manager.toggleSelect(1);
      expect(manager.isSelected(1)).toBe(true);
      
      manager.toggleSelect(1);
      expect(manager.isSelected(1)).toBe(false);
    });

    it('切换选中应该追加到现有选中', () => {
      const manager = new SelectionManager();
      
      manager.select(1);
      manager.toggleSelect(2);
      
      expect(manager.selected.value).toContain(1);
      expect(manager.selected.value).toContain(2);
      expect(manager.count).toBe(2);
    });
  });

  describe('主选中实体', () => {
    it('应该返回第一个选中的实体作为主选中', () => {
      const manager = new SelectionManager();
      
      manager.selectMany([2, 5, 8]);
      
      expect(manager.primary).toBe(2);
    });

    it('无选中时主选中应该返回 null', () => {
      const manager = new SelectionManager();
      
      expect(manager.primary).toBeNull();
      expect(manager.hasSelection()).toBe(false);
    });

    it('hasSelection 应该在有选中时返回 true', () => {
      const manager = new SelectionManager();
      
      manager.select(1);
      
      expect(manager.hasSelection()).toBe(true);
    });
  });

  describe('范围选择', () => {
    it('应该正确选择范围', () => {
      const manager = new SelectionManager();
      const entities = createEntities(10);
      
      manager.select(2); // 先选中第2个
      manager.selectRange(5, entities); // shift+点击第5个
      
      expect(manager.selected.value).toEqual([2, 3, 4, 5]);
    });

    it('反向范围选择应该工作', () => {
      const manager = new SelectionManager();
      const entities = createEntities(10);
      
      manager.select(5);
      manager.selectRange(2, entities);
      
      expect(manager.selected.value).toEqual([2, 3, 4, 5]);
    });

    it('无主选中时范围选择应该退化为单选', () => {
      const manager = new SelectionManager();
      const entities = createEntities(10);
      
      manager.selectRange(3, entities);
      
      expect(manager.selected.value).toEqual([3]);
    });

    it('实体不存在时应该退化为单选', () => {
      const manager = new SelectionManager();
      const entities = createEntities(5);
      
      manager.select(999); // 不存在的实体
      manager.selectRange(3, entities);
      
      expect(manager.selected.value).toEqual([3]);
    });
  });

  describe('清空选择', () => {
    it('应该清空所有选中', () => {
      const manager = new SelectionManager();
      
      manager.selectMany([1, 2, 3]);
      manager.clear();
      
      expect(manager.selected.value).toEqual([]);
      expect(manager.hasSelection()).toBe(false);
    });

    it('清空空选择不应该触发不必要的变化', () => {
      const manager = new SelectionManager();
      const onChange = vi.fn();
      manager.onChange = onChange;
      
      manager.clear();
      
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('变化通知', () => {
    it('select 应该触发 onChange', () => {
      const manager = new SelectionManager();
      const onChange = vi.fn();
      manager.onChange = onChange;
      
      manager.select(1);
      
      expect(onChange).toHaveBeenCalledWith([1]);
    });

    it('selectMany 应该触发 onChange', () => {
      const manager = new SelectionManager();
      const onChange = vi.fn();
      manager.onChange = onChange;
      
      manager.selectMany([1, 2]);
      
      expect(onChange).toHaveBeenCalledWith([1, 2]);
    });

    it('toggleSelect 应该触发 onChange', () => {
      const manager = new SelectionManager();
      const onChange = vi.fn();
      manager.onChange = onChange;
      
      manager.toggleSelect(1);
      
      expect(onChange).toHaveBeenCalledWith([1]);
    });

    it('clear 应该触发 onChange', () => {
      const manager = new SelectionManager();
      const onChange = vi.fn();
      manager.onChange = onChange;
      
      manager.select(1);
      onChange.mockClear();
      
      manager.clear();
      
      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('selectRange 应该触发 onChange', () => {
      const manager = new SelectionManager();
      const onChange = vi.fn();
      manager.onChange = onChange;
      const entities = createEntities(5);
      
      manager.select(1);
      manager.selectRange(3, entities);
      
      expect(onChange).toHaveBeenLastCalledWith([1, 2, 3]);
    });

    it('应该支持取消订阅', () => {
      const manager = new SelectionManager();
      const onChange = vi.fn();
      
      manager.onChange = onChange;
      manager.select(1);
      expect(onChange).toHaveBeenCalledTimes(1);
      
      manager.onChange = null;
      manager.select(2);
      expect(onChange).toHaveBeenCalledTimes(1); // 不再增加
    });
  });

  describe('响应式 Signal', () => {
    it('Signal 应该在选中变化时更新', () => {
      const manager = new SelectionManager();
      
      expect(manager.selected.value).toEqual([]);
      
      manager.select(1);
      expect(manager.selected.value).toEqual([1]);
      
      manager.select(2);
      expect(manager.selected.value).toEqual([2]);
    });

    it('多次操作应该保持 Signal 的响应性', () => {
      const manager = new SelectionManager();
      
      manager.select(1);
      manager.toggleSelect(2);
      manager.toggleSelect(3);
      manager.toggleSelect(2); // 取消选中 2
      
      expect(manager.selected.value).toEqual([1, 3]);
    });
  });
});
