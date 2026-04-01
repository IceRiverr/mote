import { signal, type Signal } from '@preact/signals';
import type { EntityInfo } from '../types/editor.js';

/**
 * SelectionManager - 实体选中状态管理
 * 
 * 使用 Preact Signals 实现响应式选中状态。
 * 支持单选、多选、切换选中状态。
 */
export class SelectionManager {
  /** 当前选中的实体 ID 列表（响应式 Signal） */
  readonly selected: Signal<number[]> = signal([]);

  /** 选中变化时的回调 */
  private onSelectionChange: ((ids: number[]) => void) | null = null;

  /**
   * 选中单个实体（替换已有选中）
   */
  select(entityId: number): void {
    this.selected.value = [entityId];
    this._notifyChange();
  }

  /**
   * 选中多个实体（替换已有选中）
   */
  selectMany(entityIds: number[]): void {
    this.selected.value = [...entityIds];
    this._notifyChange();
  }

  /**
   * 追加选中（Ctrl+Click 行为）
   * 如果已选中则取消选中
   */
  toggleSelect(entityId: number): void {
    const current = this.selected.value;
    if (current.includes(entityId)) {
      this.selected.value = current.filter(id => id !== entityId);
    } else {
      this.selected.value = [...current, entityId];
    }
    this._notifyChange();
  }

  /**
   * 范围选择（Shift+Click 行为）
   * 从当前主选实体到目标实体之间的所有实体
   */
  selectRange(entityId: number, allEntities: EntityInfo[]): void {
    const primary = this.primary;
    if (primary === null) {
      this.select(entityId);
      return;
    }

    const primaryIndex = allEntities.findIndex(e => e.id === primary);
    const targetIndex = allEntities.findIndex(e => e.id === entityId);

    if (primaryIndex === -1 || targetIndex === -1) {
      this.select(entityId);
      return;
    }

    const start = Math.min(primaryIndex, targetIndex);
    const end = Math.max(primaryIndex, targetIndex);
    const rangeIds = allEntities.slice(start, end + 1).map(e => e.id);

    this.selected.value = rangeIds;
    this._notifyChange();
  }

  /**
   * 清空选中
   */
  clear(): void {
    if (this.selected.value.length === 0) return;
    this.selected.value = [];
    this._notifyChange();
  }

  /**
   * 获取主选中实体（第一个）
   */
  get primary(): number | null {
    return this.selected.value[0] ?? null;
  }

  /**
   * 是否选中了指定实体
   */
  isSelected(entityId: number): boolean {
    return this.selected.value.includes(entityId);
  }

  /**
   * 获取选中数量
   */
  get count(): number {
    return this.selected.value.length;
  }

  /**
   * 是否有选中
   */
  hasSelection(): boolean {
    return this.selected.value.length > 0;
  }

  /**
   * 订阅选中变化
   */
  set onChange(callback: ((ids: number[]) => void) | null) {
    this.onSelectionChange = callback;
  }

  get onChange(): ((ids: number[]) => void) | null {
    return this.onSelectionChange;
  }

  private _notifyChange(): void {
    this.onSelectionChange?.(this.selected.value);
  }
}
