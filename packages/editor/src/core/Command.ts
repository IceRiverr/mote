export interface Command {
  name: string;
  execute(): void;
  undo(): void;
}

export class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private _onChange?: () => void;

  constructor(onChange?: () => void) {
    this._onChange = onChange;
  }

  execute(cmd: Command) {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack = [];
    this._onChange?.();
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    cmd.undo();
    this.redoStack.push(cmd);
    this._onChange?.();
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.execute();
    this.undoStack.push(cmd);
    this._onChange?.();
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
}
