// Mote Map Editor - Main Entry
// 直接使用 @mote/engine 渲染

import { MapEditor } from './Editor.js';

const editor = new MapEditor();

// 初始化配置选择
async function initConfigSelect(): Promise<void> {
  const configs = [
    { id: 'dungeon', name: 'Dungeon', desc: '地牢探索 - 64px 瓦片' },
    { id: 'tiny-town', name: 'Tiny Town', desc: '城镇建设 - 32px 瓦片' },
  ];

  const list = document.getElementById('configList')!;
  
  configs.forEach((cfg, i) => {
    const item = document.createElement('label');
    item.className = 'config-item';
    item.innerHTML = `
      <input type="radio" name="config" value="${cfg.id}" ${i === 0 ? 'checked' : ''}>
      <div>
        <div class="config-name">${cfg.name}</div>
        <div class="config-desc">${cfg.desc}</div>
      </div>
    `;
    list.appendChild(item);
  });

  // 确认按钮
  document.getElementById('confirmConfig')!.addEventListener('click', () => {
    const selected = document.querySelector('input[name="config"]:checked') as HTMLInputElement;
    if (selected) {
      editor.loadConfig(selected.value);
      document.getElementById('configModal')!.classList.add('hidden');
    }
  });
}

// 绑定工具按钮
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.getAttribute('data-tool')!;
    editor.setTool(tool);
    
    // UI 更新
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // 更新属性面板
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
      if (e.ctrlKey) {
        e.preventDefault();
        editor.undo();
      }
      break;
    case 'y':
      if (e.ctrlKey) {
        e.preventDefault();
        editor.redo();
      }
      break;
  }
});

// 顶部工具栏按钮
document.getElementById('btnNew')!.addEventListener('click', () => {
  if (confirm('确定要新建地图吗？当前未保存的更改将丢失。')) {
    editor.newMap();
  }
});

document.getElementById('btnImport')!.addEventListener('click', () => {
  editor.importMap();
});

document.getElementById('btnExport')!.addEventListener('click', () => {
  // 默认导出为 TypeScript
  editor.export('ts');
});

// 右侧导出按钮
document.getElementById('btnExportTs')!.addEventListener('click', () => {
  editor.export('ts');
});
document.getElementById('btnExportJson')!.addEventListener('click', () => {
  editor.export('json');
});

// 导出对话框按钮
document.getElementById('confirmExport')!.addEventListener('click', () => {
  editor.confirmExport();
});
document.getElementById('cancelExport')!.addEventListener('click', () => {
  editor.cancelExport();
});

// 导出对话框支持 Enter 键确认
document.getElementById('exportNameInput')!.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    editor.confirmExport();
  } else if (e.key === 'Escape') {
    editor.cancelExport();
  }
});

// 网格切换
document.getElementById('btnGrid')!.addEventListener('click', () => editor.toggleGrid());

// 缩放按钮
document.getElementById('btnZoomIn')!.addEventListener('click', () => editor.zoomIn());
document.getElementById('btnZoomOut')!.addEventListener('click', () => editor.zoomOut());

// 初始化
initConfigSelect();
editor.init();
