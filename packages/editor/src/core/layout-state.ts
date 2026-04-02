/**
 * Layout State - 布局状态管理
 * 
 * 使用 Preact Signals 管理布局状态
 * 支持持久化到 localStorage
 */

import { signal, computed, effect, type Signal } from "@preact/signals";
import type { AreaNode, EditorType, LeafNode } from "./area-tree.js";
import {
  createDefaultLayout,
  updateEditorType,
  updateRatio,
  splitNode,
  removeNode,
  getAllLeafs,
  serializeLayout,
  deserializeLayout,
  type SplitNode,
} from "./area-tree.js";

const STORAGE_KEY = "mote-editor-layout";

/** 布局状态管理器 */
export class LayoutState {
  /** 区域树根节点 */
  root: Signal<AreaNode>;
  
  /** 当前活动的编辑器（用于快捷键等） */
  activeEditorId: Signal<string | null>;
  
  /** 所有叶子节点（计算属性） */
  leafs: Signal<LeafNode[]>;
  
  constructor() {
    // 尝试从 localStorage 恢复，否则使用默认布局
    const saved = this.loadFromStorage();
    this.root = signal(saved ?? createDefaultLayout());
    this.activeEditorId = signal(null);
    this.leafs = computed(() => getAllLeafs(this.root.value));
    
    // 自动保存到 localStorage
    effect(() => {
      this.saveToStorage();
    });
  }
  
  /** 更新编辑器类型 */
  setEditorType(id: string, type: EditorType) {
    this.root.value = updateEditorType(this.root.value, id, type);
  }
  
  /** 更新分割比例 */
  setRatio(node: SplitNode, ratio: number) {
    this.root.value = updateRatio(this.root.value, node, ratio);
  }
  
  /** 分割区域 */
  split(id: string, direction: "horizontal" | "vertical", ratio: number = 0.5) {
    this.root.value = splitNode(this.root.value, id, direction, ratio);
  }
  
  /** 删除区域 */
  remove(id: string) {
    // 至少保留一个区域
    const leafs = getAllLeafs(this.root.value);
    if (leafs.length <= 1) return;
    
    this.root.value = removeNode(this.root.value, id);
  }
  
  /** 重置为默认布局 */
  reset() {
    this.root.value = createDefaultLayout();
  }
  
  /** 从 storage 加载 */
  private loadFromStorage(): AreaNode | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return deserializeLayout(saved);
      }
    } catch {
      // 忽略存储错误
    }
    return null;
  }
  
  /** 保存到 storage */
  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, serializeLayout(this.root.value));
    } catch {
      // 忽略存储错误
    }
  }
  
  /** 导出布局 */
  export(): string {
    return serializeLayout(this.root.value);
  }
  
  /** 导入布局 */
  import(json: string) {
    try {
      this.root.value = deserializeLayout(json);
    } catch (e) {
      console.error("Failed to import layout:", e);
    }
  }
}

/** 全局布局状态实例 */
export const layoutState = new LayoutState();

/** Hook：使用布局状态 */
export function useLayout() {
  return layoutState;
}
