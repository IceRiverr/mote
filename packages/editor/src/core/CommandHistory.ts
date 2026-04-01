import type { Command } from '../types/editor.js';

/**
 * CommandHistory - Undo/Redo 管理器
 * 
 * 所有编辑器操作封装为 Command 对象，支持完整的撤销/重做。
 * 使用栈结构管理历史记录，限制最大数量防止内存溢出。
 */
export class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory = 100;
  private _onChange: (() => void) | null = null;

  /**
   * 执行命令并压入 undo 栈
   */
  execute(cmd: Command): void {
    cmd.execute();
    this.undoStack.push(cmd);
    
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    
    this.redoStack.length = 0; // 新操作清空 redo
    this._notifyChange();
  }

  /**
   * 撤销最后一个操作
   */
  undo(): boolean {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    
    cmd.undo();
    this.redoStack.push(cmd);
    this._notifyChange();
    return true;
  }

  /**
   * 重做下一个操作
   */
  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    
    cmd.execute();
    this.undoStack.push(cmd);
    this._notifyChange();
    return true;
  }

  /**
   * 是否可以撤销
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * 是否可以重做
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * 清空所有历史
   */
  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this._notifyChange();
  }

  /**
   * 获取当前 undo 栈长度（用于调试）
   */
  getUndoStackSize(): number {
    return this.undoStack.length;
  }

  /**
   * 获取当前 redo 栈长度（用于调试）
   */
  getRedoStackSize(): number {
    return this.redoStack.length;
  }

  /**
   * 获取最近的操作描述列表（用于 UI 显示历史）
   */
  getRecentCommands(count: number = 10): string[] {
    return this.undoStack
      .slice(-count)
      .reverse()
      .map(cmd => cmd.description);
  }

  /**
   * 订阅状态变化
   */
  set onChange(callback: (() => void) | null) {
    this._onChange = callback;
  }

  get onChange(): (() => void) | null {
    return this._onChange;
  }

  private _notifyChange(): void {
    this._onChange?.();
  }
}
