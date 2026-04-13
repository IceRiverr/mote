// ═══════════════════════════════════════════════════════════════
// history.ts - Undo/Redo 历史管理系统
// ═══════════════════════════════════════════════════════════════

import { signal } from "@preact/signals";

// ═══════════════════════════════════════════════════════════════
// Command 接口
// ═══════════════════════════════════════════════════════════════

export interface Command {
  /** 人类可读的操作标签，如 "添加实体", "移动实体" */
  readonly label: string;
  
  /** 执行（或重做）命令 */
  execute(): void;
  
  /** 撤销命令 */
  undo(): void;
}

// ═══════════════════════════════════════════════════════════════
// 历史管理器 - 单例，通过 Preact Signals 实现响应式
// ═══════════════════════════════════════════════════════════════

const MAX_UNDO = 100;

const undoStack = signal<Command[]>([]);
const redoStack = signal<Command[]>([]);

/** 是否可以撤销 */
export const canUndo = signal(false);

/** 是否可以重做 */
export const canRedo = signal(false);

/** 下一个撤销命令的标签 */
export const undoLabel = signal("");

/** 下一个重做命令的标签 */
export const redoLabel = signal("");

/** 同步状态信号 */
function sync() {
  const us = undoStack.value;
  const rs = redoStack.value;
  canUndo.value = us.length > 0;
  canRedo.value = rs.length > 0;
  undoLabel.value = us.length > 0 ? us[us.length - 1].label : "";
  redoLabel.value = rs.length > 0 ? rs[rs.length - 1].label : "";
}

/** 
 * 执行命令并推入撤销栈
 * @param cmd 要执行的命令
 */
export function executeCommand(cmd: Command): void {
  cmd.execute();

  const us = [...undoStack.value, cmd];
  // 限制栈深度
  if (us.length > MAX_UNDO) {
    us.splice(0, us.length - MAX_UNDO);
  }
  undoStack.value = us;
  // 新操作清空重做栈
  redoStack.value = [];
  sync();
}

/** 
 * 撤销最后一个命令
 * @returns 是否成功撤销
 */
export function undo(): boolean {
  const us = [...undoStack.value];
  const cmd = us.pop();
  if (!cmd) return false;
  
  cmd.undo();
  undoStack.value = us;
  redoStack.value = [...redoStack.value, cmd];
  sync();
  return true;
}

/** 
 * 重做最后一个撤销的命令
 * @returns 是否成功重做
 */
export function redo(): boolean {
  const rs = [...redoStack.value];
  const cmd = rs.pop();
  if (!cmd) return false;
  
  cmd.execute();
  redoStack.value = rs;
  undoStack.value = [...undoStack.value, cmd];
  sync();
  return true;
}

/** 
 * 清空所有历史（如加载新项目时调用）
 */
export function clearHistory(): void {
  undoStack.value = [];
  redoStack.value = [];
  sync();
}

/** 
 * 获取当前撤销栈深度（用于调试）
 */
export function getUndoStackSize(): number {
  return undoStack.value.length;
}

/** 
 * 获取当前重做栈深度（用于调试）
 */
export function getRedoStackSize(): number {
  return redoStack.value.length;
}
