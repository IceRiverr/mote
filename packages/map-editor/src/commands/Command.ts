// Command Pattern for Undo/Redo

export interface Command {
  readonly name: string;
  execute(): void;
  undo(): void;
}

export class CommandHistory {
  private history: Command[] = [];
  private currentIndex = -1;
  private readonly maxSize = 100;

  /**
   * 执行新命令
   */
  execute(cmd: Command): void {
    // 如果有重做历史，清除它
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // 执行命令
    cmd.execute();

    // 添加到历史
    this.history.push(cmd);
    this.currentIndex++;

    // 限制历史大小
    if (this.history.length > this.maxSize) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  /**
   * 撤销
   */
  undo(): boolean {
    if (this.currentIndex < 0) return false;

    const cmd = this.history[this.currentIndex];
    cmd.undo();
    this.currentIndex--;
    return true;
  }

  /**
   * 重做
   */
  redo(): boolean {
    if (this.currentIndex >= this.history.length - 1) return false;

    this.currentIndex++;
    const cmd = this.history[this.currentIndex];
    cmd.execute();
    return true;
  }

  /**
   * 是否可以撤销
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * 是否可以重做
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * 清空历史
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }
}
