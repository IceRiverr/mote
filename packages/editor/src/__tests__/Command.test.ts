import { describe, it, expect, beforeEach } from 'vitest';
import { CommandHistory, type Command } from '../commands/Command.js';

// 测试用的简单命令
class TestCommand implements Command {
  readonly name: string;
  public executed = false;
  public undone = false;
  private onExecute?: () => void;
  private onUndo?: () => void;

  constructor(
    name: string,
    options?: { onExecute?: () => void; onUndo?: () => void }
  ) {
    this.name = name;
    this.onExecute = options?.onExecute;
    this.onUndo = options?.onUndo;
  }

  execute(): void {
    this.executed = true;
    this.undone = false;
    this.onExecute?.();
  }

  undo(): void {
    this.undone = true;
    this.executed = false;
    this.onUndo?.();
  }
}

describe('CommandHistory', () => {
  let history: CommandHistory;

  beforeEach(() => {
    history = new CommandHistory();
  });

  describe('execute', () => {
    it('应该执行命令并添加到历史', () => {
      const cmd = new TestCommand('test');
      history.execute(cmd);

      expect(cmd.executed).toBe(true);
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);
    });

    it('执行新命令后应该清除重做历史', () => {
      const cmd1 = new TestCommand('cmd1');
      const cmd2 = new TestCommand('cmd2');

      history.execute(cmd1);
      history.undo();
      expect(history.canRedo()).toBe(true);

      history.execute(cmd2);
      expect(history.canRedo()).toBe(false);
    });

    it('历史记录不应该超过最大限制', () => {
      // 执行 105 个命令（超过 maxSize=100）
      for (let i = 0; i < 105; i++) {
        history.execute(new TestCommand(`cmd${i}`));
      }

      // 只能撤销 100 次
      let undoCount = 0;
      while (history.undo()) {
        undoCount++;
      }
      expect(undoCount).toBe(100);
    });
  });

  describe('undo', () => {
    it('空历史时撤销应该返回 false', () => {
      expect(history.undo()).toBe(false);
    });

    it('撤销应该调用命令的 undo 方法', () => {
      const cmd = new TestCommand('test');
      history.execute(cmd);
      history.undo();

      expect(cmd.undone).toBe(true);
      expect(history.canUndo()).toBe(false);
    });

    it('应该支持多次撤销', () => {
      const cmds: TestCommand[] = [];
      for (let i = 0; i < 5; i++) {
        cmds.push(new TestCommand(`cmd${i}`));
        history.execute(cmds[i]);
      }

      // 撤销 3 次
      for (let i = 0; i < 3; i++) {
        history.undo();
      }

      // 最后 3 个命令应该被撤销
      expect(cmds[4].undone).toBe(true);
      expect(cmds[3].undone).toBe(true);
      expect(cmds[2].undone).toBe(true);
      expect(cmds[1].executed).toBe(true);
      expect(cmds[0].executed).toBe(true);
    });
  });

  describe('redo', () => {
    it('空历史时重做应该返回 false', () => {
      expect(history.redo()).toBe(false);
    });

    it('重做应该重新执行命令', () => {
      const cmd = new TestCommand('test');
      history.execute(cmd);
      history.undo();
      expect(cmd.undone).toBe(true);

      history.redo();
      expect(cmd.executed).toBe(true);
    });

    it('撤销后修改应该清除重做历史', () => {
      const cmd1 = new TestCommand('cmd1');
      const cmd2 = new TestCommand('cmd2');

      history.execute(cmd1);
      history.execute(cmd2);
      history.undo();
      expect(history.canRedo()).toBe(true);

      const cmd3 = new TestCommand('cmd3');
      history.execute(cmd3);
      expect(history.canRedo()).toBe(false);
    });
  });

  describe('canUndo / canRedo', () => {
    it('初始状态都应该返回 false', () => {
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
    });

    it('执行命令后 canUndo 返回 true', () => {
      history.execute(new TestCommand('test'));
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);
    });

    it('撤销后 canRedo 返回 true', () => {
      history.execute(new TestCommand('test'));
      history.undo();
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(true);
    });
  });

  describe('clear', () => {
    it('清空后历史状态应该重置', () => {
      history.execute(new TestCommand('cmd1'));
      history.execute(new TestCommand('cmd2'));
      history.undo();

      history.clear();

      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
    });
  });

  describe('复杂场景', () => {
    it('多次撤销重做应该保持正确状态', () => {
      const states: number[] = [];
      let currentState = 0;

      // 创建会修改状态的命令
      const createAddCommand = (value: number) =>
        new TestCommand(`add${value}`, {
          onExecute: () => {
            currentState += value;
            states.push(currentState);
          },
          onUndo: () => {
            currentState -= value;
            states.push(currentState);
          },
        });

      // 执行: +1, +2, +3
      history.execute(createAddCommand(1)); // state: 1
      history.execute(createAddCommand(2)); // state: 3
      history.execute(createAddCommand(3)); // state: 6

      expect(currentState).toBe(6);

      // 撤销到最开始
      history.undo(); // state: 3
      history.undo(); // state: 1
      history.undo(); // state: 0

      expect(currentState).toBe(0);

      // 重做全部
      history.redo(); // state: 1
      history.redo(); // state: 3
      history.redo(); // state: 6

      expect(currentState).toBe(6);
    });

    it('撤销后执行新命令应该截断历史', () => {
      const cmd1 = new TestCommand('cmd1');
      const cmd2 = new TestCommand('cmd2');
      const cmd3 = new TestCommand('cmd3');

      history.execute(cmd1);
      history.execute(cmd2);
      history.undo(); // 撤销 cmd2

      // cmd2 应该被丢弃，无法重做
      history.execute(cmd3);

      expect(history.canRedo()).toBe(false);
      expect(cmd3.executed).toBe(true);

      // 撤销应该回到 cmd1
      history.undo();
      expect(cmd3.undone).toBe(true);
      expect(history.canUndo()).toBe(true); // cmd1 还在
    });
  });
});
