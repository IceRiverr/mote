import { describe, it, expect, vi } from 'vitest';
import { CommandHistory } from '../core/CommandHistory.js';
import type { Command } from '../types/editor.js';

// 测试用的模拟命令
class MockCommand implements Command {
  description: string;
  private onExecute: () => void;
  private onUndo: () => void;

  constructor(
    desc: string,
    onExecute: () => void = () => {},
    onUndo: () => void = () => {}
  ) {
    this.description = desc;
    this.onExecute = onExecute;
    this.onUndo = onUndo;
  }

  execute(): void {
    this.onExecute();
  }

  undo(): void {
    this.onUndo();
  }
}

describe('CommandHistory', () => {
  describe('基本操作', () => {
    it('应该正确执行命令', () => {
      const history = new CommandHistory();
      const executeSpy = vi.fn();
      const cmd = new MockCommand('Test Command', executeSpy);

      history.execute(cmd);

      expect(executeSpy).toHaveBeenCalledTimes(1);
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);
    });

    it('应该正确撤销命令', () => {
      const history = new CommandHistory();
      const undoSpy = vi.fn();
      const cmd = new MockCommand('Test Command', () => {}, undoSpy);

      history.execute(cmd);
      const result = history.undo();

      expect(result).toBe(true);
      expect(undoSpy).toHaveBeenCalledTimes(1);
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(true);
    });

    it('应该正确重做命令', () => {
      const history = new CommandHistory();
      const executeSpy = vi.fn();
      const cmd = new MockCommand('Test Command', executeSpy);

      history.execute(cmd);
      history.undo();
      const result = history.redo();

      expect(result).toBe(true);
      expect(executeSpy).toHaveBeenCalledTimes(2); // 初始执行 + 重做
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);
    });
  });

  describe('边界条件', () => {
    it('空历史时撤销应该返回 false', () => {
      const history = new CommandHistory();
      expect(history.undo()).toBe(false);
    });

    it('空历史时重做应该返回 false', () => {
      const history = new CommandHistory();
      expect(history.redo()).toBe(false);
    });

    it('新操作应该清空 redo 栈', () => {
      const history = new CommandHistory();
      const cmd1 = new MockCommand('Command 1');
      const cmd2 = new MockCommand('Command 2');

      history.execute(cmd1);
      history.undo();
      expect(history.canRedo()).toBe(true);

      history.execute(cmd2);
      expect(history.canRedo()).toBe(false);
    });
  });

  describe('历史记录限制', () => {
    it('应该限制历史记录数量', () => {
      const history = new CommandHistory();
      
      // 执行超过 100 个命令
      for (let i = 0; i < 105; i++) {
        history.execute(new MockCommand(`Command ${i}`));
      }

      expect(history.getUndoStackSize()).toBe(100);
    });
  });

  describe('状态通知', () => {
    it('执行命令应该触发 onChange', () => {
      const history = new CommandHistory();
      const onChange = vi.fn();
      history.onChange = onChange;

      history.execute(new MockCommand('Test'));

      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('撤销应该触发 onChange', () => {
      const history = new CommandHistory();
      const onChange = vi.fn();
      history.onChange = onChange;

      history.execute(new MockCommand('Test'));
      onChange.mockClear();
      
      history.undo();
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('重做应该触发 onChange', () => {
      const history = new CommandHistory();
      const onChange = vi.fn();
      history.onChange = onChange;

      history.execute(new MockCommand('Test'));
      history.undo();
      onChange.mockClear();
      
      history.redo();
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('清空应该触发 onChange', () => {
      const history = new CommandHistory();
      const onChange = vi.fn();
      history.onChange = onChange;

      history.execute(new MockCommand('Test'));
      onChange.mockClear();
      
      history.clear();
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('命令描述', () => {
    it('应该正确返回最近命令列表', () => {
      const history = new CommandHistory();
      
      history.execute(new MockCommand('Command A'));
      history.execute(new MockCommand('Command B'));
      history.execute(new MockCommand('Command C'));

      const recent = history.getRecentCommands(2);
      expect(recent).toEqual(['Command C', 'Command B']);
    });

    it('getRecentCommands 不应该超过实际数量', () => {
      const history = new CommandHistory();
      
      history.execute(new MockCommand('Command A'));

      const recent = history.getRecentCommands(10);
      expect(recent).toEqual(['Command A']);
    });
  });

  describe('复杂场景', () => {
    it('应该正确处理多步撤销重做', () => {
      const history = new CommandHistory();
      const state: number[] = [];

      const cmd1 = new MockCommand(
        'Add 1',
        () => state.push(1),
        () => state.pop()
      );
      const cmd2 = new MockCommand(
        'Add 2',
        () => state.push(2),
        () => state.pop()
      );
      const cmd3 = new MockCommand(
        'Add 3',
        () => state.push(3),
        () => state.pop()
      );

      history.execute(cmd1);
      history.execute(cmd2);
      history.execute(cmd3);
      expect(state).toEqual([1, 2, 3]);

      history.undo();
      expect(state).toEqual([1, 2]);

      history.undo();
      expect(state).toEqual([1]);

      history.redo();
      expect(state).toEqual([1, 2]);

      history.execute(new MockCommand('Add 4', () => state.push(4), () => state.pop()));
      expect(state).toEqual([1, 2, 4]);
      expect(history.canRedo()).toBe(false);
    });
  });
});
