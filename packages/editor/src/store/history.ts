import { signal } from "@preact/signals";

// ---------------------------------------------------------------------------
// Command interface
// ---------------------------------------------------------------------------

export interface Command {
  /** Human-readable label, e.g. "绘制 tile", "添加图层" */
  readonly label: string;
  /** Execute (or re-do) the command */
  execute(): void;
  /** Reverse the command */
  undo(): void;
}

// ---------------------------------------------------------------------------
// History manager – singleton, reactive via Preact Signals
// ---------------------------------------------------------------------------

const MAX_UNDO = 100;

const undoStack = signal<Command[]>([]);
const redoStack = signal<Command[]>([]);

/** Whether an undo operation is available */
export const canUndo = signal(false);
/** Whether a redo operation is available */
export const canRedo = signal(false);
/** Label of the next undo command */
export const undoLabel = signal("");
/** Label of the next redo command */
export const redoLabel = signal("");

function sync() {
  const us = undoStack.value;
  const rs = redoStack.value;
  canUndo.value = us.length > 0;
  canRedo.value = rs.length > 0;
  undoLabel.value = us.length > 0 ? us[us.length - 1].label : "";
  redoLabel.value = rs.length > 0 ? rs[rs.length - 1].label : "";
}

/** Execute a command and push it onto the undo stack */
export function executeCommand(cmd: Command): void {
  cmd.execute();

  const us = [...undoStack.value, cmd];
  // Enforce max stack depth
  if (us.length > MAX_UNDO) {
    us.splice(0, us.length - MAX_UNDO);
  }
  undoStack.value = us;
  // New action clears the redo stack
  redoStack.value = [];
  sync();
}

/** Undo the last command */
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

/** Redo the last undone command */
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

/** Clear all history (e.g. on new project load) */
export function clearHistory(): void {
  undoStack.value = [];
  redoStack.value = [];
  sync();
}
