// Mote Map Editor - Main Entry

import { MapEditor } from './Editor.js';

const editor = new MapEditor();

// 绑定工具按钮
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.getAttribute('data-tool')!;
    editor.setTool(tool);

    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const toolNames: Record<string, string> = {
      brush: '画笔',
      eraser: '橡皮',
      fill: '填充',
      rect: '矩形',
    };
    document.getElementById('currentTool')!.textContent = toolNames[tool];
  });
});

// 键盘快捷键
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;

  switch (e.key.toLowerCase()) {
    case 'b': document.querySelector('[data-tool="brush"]')?.dispatchEvent(new Event('click')); break;
    case 'e': document.querySelector('[data-tool="eraser"]')?.dispatchEvent(new Event('click')); break;
    case 'f': document.querySelector('[data-tool="fill"]')?.dispatchEvent(new Event('click')); break;
    case 'r': document.querySelector('[data-tool="rect"]')?.dispatchEvent(new Event('click')); break;
    case 'g': editor.toggleGrid(); break;
    case 'z':
      if (e.ctrlKey) { e.preventDefault(); editor.undo(); }
      break;
    case 'y':
      if (e.ctrlKey) { e.preventDefault(); editor.redo(); }
      break;
  }
});

// 顶部工具栏
document.getElementById('btnNew')!.addEventListener('click', () => {
  if (confirm('确定要新建地图吗？当前未保存的更改将丢失。')) editor.newMap();
});
document.getElementById('btnImportTileset')!.addEventListener('click', () => editor.openTilesetImporter());
document.getElementById('btnImportConfig')!.addEventListener('click', () => editor.importConfig());
document.getElementById('btnImport')!.addEventListener('click', () => editor.importMap());
document.getElementById('btnExport')!.addEventListener('click', () => editor.export('ts'));

// 右侧导出按钮
document.getElementById('btnExportTs')!.addEventListener('click', () => editor.export('ts'));
document.getElementById('btnExportJson')!.addEventListener('click', () => editor.export('json'));

// 导出对话框
document.getElementById('confirmExport')!.addEventListener('click', () => editor.confirmExport());
document.getElementById('cancelExport')!.addEventListener('click', () => editor.cancelExport());
document.getElementById('exportNameInput')!.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') editor.confirmExport();
  else if (e.key === 'Escape') editor.cancelExport();
});

// 网格 / 缩放
document.getElementById('btnGrid')!.addEventListener('click', () => editor.toggleGrid());
document.getElementById('btnZoomIn')!.addEventListener('click', () => editor.zoomIn());
document.getElementById('btnZoomOut')!.addEventListener('click', () => editor.zoomOut());

editor.init();
