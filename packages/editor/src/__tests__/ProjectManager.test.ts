import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectManager } from '../core/ProjectManager.js';
import type { ProjectConfig } from '../types/editor.js';

// Mock IDB
vi.mock('idb', () => ({
  openDB: vi.fn(),
}));

import { openDB } from 'idb';

// Mock File System Access API
declare global {
  interface Window {
    showDirectoryPicker: typeof showDirectoryPicker;
  }
}

// 创建模拟的 FileSystemHandle
function createMockFileHandle(name: string, content = '') {
  return {
    name,
    kind: 'file',
    getFile: vi.fn().mockResolvedValue({
      text: vi.fn().mockResolvedValue(content),
      size: content.length,
      lastModified: Date.now(),
    }),
    createWritable: vi.fn().mockResolvedValue({
      write: vi.fn(),
      close: vi.fn(),
    }),
  };
}

function createMockDirHandle(name: string, entries: Map<string, any> = new Map()) {
  const handle = {
    name,
    kind: 'directory',
    entries,
    requestPermission: vi.fn().mockResolvedValue('granted'),
    getFileHandle: vi.fn().mockImplementation((fileName: string, opts?: { create?: boolean }) => {
      if (entries.has(fileName)) {
        return entries.get(fileName);
      }
      if (opts?.create) {
        const newFile = createMockFileHandle(fileName);
        entries.set(fileName, newFile);
        return newFile;
      }
      throw new Error('File not found');
    }),
    getDirectoryHandle: vi.fn().mockImplementation((dirName: string, opts?: { create?: boolean }) => {
      if (entries.has(dirName)) {
        return entries.get(dirName);
      }
      if (opts?.create) {
        const newDir = createMockDirHandle(dirName);
        entries.set(dirName, newDir);
        return newDir;
      }
      throw new Error('Directory not found');
    }),
    removeEntry: vi.fn().mockImplementation((entryName: string) => {
      entries.delete(entryName);
    }),
    [Symbol.asyncIterator]: async function* () {
      for (const [name, entry] of entries) {
        yield [name, entry];
      }
    },
  };
  return handle;
}

describe('ProjectManager', () => {
  let manager: ProjectManager;
  let mockDB: any;

  beforeEach(() => {
    manager = new ProjectManager();
    
    // Mock IndexedDB
    mockDB = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn().mockResolvedValue([]),
      getAllKeys: vi.fn().mockResolvedValue([]),
    };
    
    (openDB as any).mockResolvedValue(mockDB);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (window as any).showDirectoryPicker;
  });

  describe('初始化', () => {
    it('应该正确初始化 IndexedDB', async () => {
      await manager.init();
      expect(openDB).toHaveBeenCalledWith('mote-editor', 1, expect.any(Object));
    });
  });

  describe('浏览器支持检测', () => {
    it('应该检测 File System Access API 支持', () => {
      (window as any).showDirectoryPicker = vi.fn();
      expect(manager.isFileSystemAccessSupported()).toBe(true);
    });

    it('应该检测 File System Access API 不支持', () => {
      delete (window as any).showDirectoryPicker;
      expect(manager.isFileSystemAccessSupported()).toBe(false);
    });
  });

  describe('项目打开', () => {
    it('应该正确打开项目', async () => {
      const mockDir = createMockDirHandle('my-project');
      (window as any).showDirectoryPicker = vi.fn().mockResolvedValue(mockDir);

      const result = await manager.openProject();

      expect(result).toBe(true);
      expect(manager.hasOpenProject()).toBe(true);
      expect(manager.getProjectName()).toBe('my-project');
    });

    it('用户取消时应该返回 false', async () => {
      const error = new Error('User cancelled');
      (error as any).name = 'AbortError';
      (window as any).showDirectoryPicker = vi.fn().mockRejectedValue(error);

      const result = await manager.openProject();

      expect(result).toBe(false);
    });

    it('不支持 API 时应该抛出错误', async () => {
      delete (window as any).showDirectoryPicker;

      await expect(manager.openProject()).rejects.toThrow('File System Access API is not supported');
    });
  });

  describe('项目恢复', () => {
    it('应该恢复上次打开的项目', async () => {
      const mockDir = createMockDirHandle('my-project');
      mockDB.get.mockResolvedValue({ handle: mockDir });

      const result = await manager.restoreProject();

      expect(result).toBe(true);
      expect(manager.getProjectName()).toBe('my-project');
    });

    it('无记录时应该返回 false', async () => {
      mockDB.get.mockResolvedValue(null);

      const result = await manager.restoreProject();

      expect(result).toBe(false);
    });

    it('权限被拒绝时应该返回 false', async () => {
      const mockDir = createMockDirHandle('my-project');
      mockDir.requestPermission = vi.fn().mockResolvedValue('denied');
      mockDB.get.mockResolvedValue({ handle: mockDir });

      const result = await manager.restoreProject();

      expect(result).toBe(false);
    });
  });

  describe('文件操作', () => {
    beforeEach(async () => {
      const entries = new Map([
        ['file1.txt', createMockFileHandle('file1.txt', 'Hello World')],
        ['file2.json', createMockFileHandle('file2.json', '{"key": "value"}')],
        ['subdir', createMockDirHandle('subdir', new Map([
          ['nested.txt', createMockFileHandle('nested.txt', 'Nested content')],
        ]))],
      ]);
      const mockDir = createMockDirHandle('test-project', entries);
      (window as any).showDirectoryPicker = vi.fn().mockResolvedValue(mockDir);
      await manager.openProject();
    });

    it('应该正确读取文本文件', async () => {
      const content = await manager.readFile('file1.txt');
      expect(content).toBe('Hello World');
    });

    it('应该正确读取嵌套文件', async () => {
      const content = await manager.readFile('subdir/nested.txt');
      expect(content).toBe('Nested content');
    });

    it('应该正确解析 JSON', async () => {
      const data = await manager.readJsonc('file2.json');
      expect(data).toEqual({ key: 'value' });
    });

    it('应该正确写入文件', async () => {
      await manager.writeFile('newfile.txt', 'New content');
      
      const handle = await manager['dirHandle']!.getFileHandle('newfile.txt');
      expect(handle.createWritable).toHaveBeenCalled();
    });

    it('应该正确检查文件存在', async () => {
      expect(await manager.exists('file1.txt')).toBe(true);
      expect(await manager.exists('nonexistent.txt')).toBe(false);
    });

    it('应该正确删除文件', async () => {
      await manager.delete('file1.txt');
      expect(await manager.exists('file1.txt')).toBe(false);
    });

    it('无项目时应该抛出错误', async () => {
      manager.closeProject();
      await expect(manager.readFile('file.txt')).rejects.toThrow('No project opened');
    });
  });

  describe('目录操作', () => {
    let mockDir: any;

    beforeEach(async () => {
      mockDir = createMockDirHandle('test-project');
      (window as any).showDirectoryPicker = vi.fn().mockResolvedValue(mockDir);
      await manager.openProject();
    });

    it('应该正确列出目录内容', async () => {
      // 添加一些文件和目录
      mockDir.entries.set('file1.txt', createMockFileHandle('file1.txt'));
      mockDir.entries.set('file2.txt', createMockFileHandle('file2.txt'));
      mockDir.entries.set('assets', createMockDirHandle('assets'));

      const entries = await manager.listDir();

      expect(entries).toHaveLength(3);
      expect(entries[0].kind).toBe('directory'); // assets 应该排在前面
      expect(entries[0].name).toBe('assets');
    });

    it('应该正确创建目录', async () => {
      await manager.createDir('assets/sprites');

      expect(mockDir.getDirectoryHandle).toHaveBeenCalledWith('assets', { create: true });
    });

    it('应该正确递归删除', async () => {
      const subEntries = new Map([
        ['file.txt', createMockFileHandle('file.txt')],
      ]);
      mockDir.entries.set('folder', createMockDirHandle('folder', subEntries));

      await manager.delete('folder');

      expect(await manager.exists('folder')).toBe(false);
    });
  });

  describe('JSONC 解析', () => {
    it('应该正确去除行注释', async () => {
      const entries = new Map([
        ['config.json', createMockFileHandle('config.json', `{
          // 这是行注释
          "key": "value"
        }`)],
      ]);
      const mockDir = createMockDirHandle('test', entries);
      (window as any).showDirectoryPicker = vi.fn().mockResolvedValue(mockDir);
      await manager.openProject();

      const data = await manager.readJsonc('config.json');
      expect(data).toEqual({ key: 'value' });
    });

    it('应该正确去除块注释', async () => {
      const entries = new Map([
        ['config.json', createMockFileHandle('config.json', `{
          /* 这是
             块注释 */
          "key": "value"
        }`)],
      ]);
      const mockDir = createMockDirHandle('test', entries);
      (window as any).showDirectoryPicker = vi.fn().mockResolvedValue(mockDir);
      await manager.openProject();

      const data = await manager.readJsonc('config.json');
      expect(data).toEqual({ key: 'value' });
    });
  });

  describe('项目配置', () => {
    it('应该正确加载 game.json', async () => {
      const config: ProjectConfig = {
        name: 'Test Game',
        entry: 'data/scenes/title.scene.json',
        resolution: { width: 960, height: 540 },
        pixelPerfect: true,
      };

      const entries = new Map([
        ['game.json', createMockFileHandle('game.json', JSON.stringify(config))],
      ]);
      const mockDir = createMockDirHandle('test', entries);
      (window as any).showDirectoryPicker = vi.fn().mockResolvedValue(mockDir);
      await manager.openProject();

      const loaded = await manager.loadProjectConfig();
      expect(loaded).toEqual(config);
    });

    it('无 game.json 时应该返回 null', async () => {
      const mockDir = createMockDirHandle('test');
      (window as any).showDirectoryPicker = vi.fn().mockResolvedValue(mockDir);
      await manager.openProject();

      const loaded = await manager.loadProjectConfig();
      expect(loaded).toBeNull();
    });

    it('应该正确保存 game.json', async () => {
      const mockDir = createMockDirHandle('test');
      (window as any).showDirectoryPicker = vi.fn().mockResolvedValue(mockDir);
      await manager.openProject();

      const config: ProjectConfig = {
        name: 'Test Game',
        entry: 'data/scenes/game.scene.json',
        resolution: { width: 960, height: 540 },
        pixelPerfect: true,
      };

      await manager.saveProjectConfig(config);

      expect(mockDir.getFileHandle).toHaveBeenCalledWith('game.json', { create: true });
    });
  });

  describe('IndexedDB 状态存储', () => {
    it('应该保存编辑器状态', async () => {
      await manager.saveEditorState('layout', { width: 200 });

      expect(mockDB.put).toHaveBeenCalledWith('editor-state', expect.objectContaining({
        id: 'layout',
        data: { width: 200 },
      }));
    });

    it('应该加载编辑器状态', async () => {
      mockDB.get.mockResolvedValue({ data: { width: 200 } });

      const state = await manager.loadEditorState('layout');
      expect(state).toEqual({ width: 200 });
    });

    it('应该保存游戏存档', async () => {
      const saveData = { level: 1, score: 1000 };
      await manager.saveGame('slot-1', saveData);

      expect(mockDB.put).toHaveBeenCalledWith('saves', expect.objectContaining({
        id: 'slot-1',
        data: saveData,
      }));
    });

    it('应该加载游戏存档', async () => {
      const saveData = { level: 1, score: 1000 };
      mockDB.get.mockResolvedValue({ data: saveData, timestamp: 123456 });

      const loaded = await manager.loadGame('slot-1');
      expect(loaded?.data).toEqual(saveData);
      expect(loaded?.timestamp).toBe(123456);
    });

    it('应该列出所有存档', async () => {
      mockDB.getAllKeys.mockResolvedValue(['slot-1', 'slot-2', 'slot-3']);

      const saves = await manager.listSaves();
      expect(saves).toEqual(['slot-1', 'slot-2', 'slot-3']);
    });

    it('应该删除存档', async () => {
      await manager.deleteSave('slot-1');
      expect(mockDB.delete).toHaveBeenCalledWith('saves', 'slot-1');
    });
  });

  describe('最近项目', () => {
    it('应该获取最近项目列表', async () => {
      mockDB.getAll.mockResolvedValue([
        { path: '/project1', name: 'Project 1', timestamp: 1000 },
        { path: '/project2', name: 'Project 2', timestamp: 2000 },
      ]);

      const recent = await manager.getRecentProjects();

      expect(recent[0].name).toBe('Project 2'); // 按时间倒序
      expect(recent).toHaveLength(2);
    });

    it('应该只返回最近 10 个项目', async () => {
      const projects = Array.from({ length: 15 }, (_, i) => ({
        path: `/project${i}`,
        name: `Project ${i}`,
        timestamp: i * 1000,
      }));
      mockDB.getAll.mockResolvedValue(projects);

      const recent = await manager.getRecentProjects();

      expect(recent).toHaveLength(10);
    });
  });

  describe('关闭项目', () => {
    it('应该正确关闭项目', async () => {
      const mockDir = createMockDirHandle('test');
      (window as any).showDirectoryPicker = vi.fn().mockResolvedValue(mockDir);
      await manager.openProject();
      expect(manager.hasOpenProject()).toBe(true);

      manager.closeProject();

      expect(manager.hasOpenProject()).toBe(false);
      expect(manager.getProjectName()).toBeNull();
    });
  });
});
