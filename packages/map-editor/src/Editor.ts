import type { MapData, GameConfig } from './MapData.js';
import { BrushTool } from './tools/BrushTool.js';
import { EraserTool } from './tools/EraserTool.js';
import { RectTool } from './tools/RectTool.js';
import type { Tool } from './tools/Tool.js';
import { CommandHistory } from './commands/Command.js';
import type { Command } from './commands/Command.js';

// 重新导出 RectTool 类型用于 instanceof 检查
export { RectTool };

export class MapEditor {
  private canvas!: HTMLCanvasElement;
  
  private config: GameConfig | null = null;
  private mapData: MapData | null = null;
  
  private currentTool: Tool | null = null;
  private tools: Map<string, Tool> = new Map();
  
  private selectedTileId = 0;
  private showGrid = true;
  
  // 缩放比例 (0.5 - 3.0)
  private zoomLevel = 1.0;
  private readonly MIN_ZOOM = 0.5;
  private readonly MAX_ZOOM = 3.0;
  private readonly ZOOM_STEP = 0.25;
  
  // 绘制缓存
  private ctx2d!: CanvasRenderingContext2D;

  // Tileset 图片缓存：图片路径 -> HTMLImageElement
  private imageCache = new Map<string, HTMLImageElement>();
  // 加载中的图片：图片路径 -> Promise（防止重复请求）
  private imageLoading = new Map<string, Promise<HTMLImageElement>>();

  // 命令历史（用于撤销/重做）
  private commandHistory = new CommandHistory();

  async init(): Promise<void> {
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    
    // 使用 2D context 进行简单渲染（后续可升级为 WebGPU）
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.ctx2d = ctx;
    
    // 初始化工具
    this.tools.set('brush', new BrushTool(this));
    this.tools.set('eraser', new EraserTool(this));
    this.tools.set('rect', new RectTool(this));
    this.currentTool = this.tools.get('brush')!;
    
    // 绑定鼠标事件
    this.bindMouseEvents();
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
    
    // 开始渲染循环
    this.startRenderLoop();

    // 初始化撤销/重做按钮状态
    this.updateUndoRedoUI();
  }

  loadConfig(config: GameConfig): void {
    this.config = config;
    if (!this.config) throw new Error('Invalid config');
    
    // 创建新地图
    this.mapData = {
      version: 1,
      name: 'untitled',
      width: this.config.defaultWidth,
      height: this.config.defaultHeight,
      tileSize: this.config.tileSize,
      tiles: new Array(this.config.defaultWidth * this.config.defaultHeight).fill(0),
      spawnPoint: { x: Math.floor(this.config.defaultWidth / 2), y: Math.floor(this.config.defaultHeight / 2) },
    };
    
    // 更新 UI
    this.updatePalette();
    this.updateProperties();
    document.getElementById('configName')!.textContent = this.config.name;
    
    // 调整画布大小
    this.resizeCanvas();
  }

  private resizeCanvas(): void {
    if (!this.config || !this.mapData) return;
    
    const w = this.mapData.width * this.config.tileSize;
    const h = this.mapData.height * this.config.tileSize;
    
    // 获取容器大小
    const wrapper = this.canvas.parentElement;
    if (!wrapper) return;
    
    const wrapperRect = wrapper.getBoundingClientRect();
    const padding = 40; // 内边距
    const availWidth = wrapperRect.width - padding * 2;
    const availHeight = wrapperRect.height - padding * 2;
    
    // 基础缩放（适应容器，保持宽高比）
    const scaleX = availWidth / w;
    const scaleY = availHeight / h;
    const baseScale = Math.min(scaleX, scaleY, 1); // 最大1:1显示
    
    // 应用用户设置的缩放级别
    const finalScale = baseScale * this.zoomLevel;
    
    this.canvas.width = w * finalScale;
    this.canvas.height = h * finalScale;
    this.canvas.style.width = `${this.canvas.width}px`;
    this.canvas.style.height = `${this.canvas.height}px`;
  }

  /**
   * 放大
   */
  zoomIn(): void {
    if (this.zoomLevel < this.MAX_ZOOM) {
      this.zoomLevel = Math.min(this.MAX_ZOOM, this.zoomLevel + this.ZOOM_STEP);
      this.applyZoom();
    }
  }

  /**
   * 缩小
   */
  zoomOut(): void {
    if (this.zoomLevel > this.MIN_ZOOM) {
      this.zoomLevel = Math.max(this.MIN_ZOOM, this.zoomLevel - this.ZOOM_STEP);
      this.applyZoom();
    }
  }

  /**
   * 重置缩放
   */
  resetZoom(): void {
    this.zoomLevel = 1.0;
    this.applyZoom();
  }

  /**
   * 应用缩放并更新UI
   */
  private applyZoom(): void {
    this.resizeCanvas();
    
    // 更新UI显示
    const zoomPercent = Math.round(this.zoomLevel * 100);
    const zoomDisplay = document.getElementById('zoomLevel');
    if (zoomDisplay) {
      zoomDisplay.textContent = `${zoomPercent}%`;
    }
  }

  private updatePalette(): void {
    if (!this.config) return;

    const palette = document.getElementById('palette')!;
    palette.innerHTML = '';

    // 网格容器
    const grid = document.createElement('div');
    grid.className = 'tileset-grid';
    palette.appendChild(grid);

    const CELL = 40; // 每格显示尺寸（px）

    this.config.tiles.forEach(tile => {
      const cell = document.createElement('div');
      cell.className = 'tileset-cell' + (tile.id === this.selectedTileId ? ' active' : '');
      cell.title = tile.name;

      const canvas = document.createElement('canvas');
      canvas.width = CELL;
      canvas.height = CELL;
      canvas.style.cssText = `width:${CELL}px;height:${CELL}px;image-rendering:pixelated;display:block;`;
      const pctx = canvas.getContext('2d')!;

      const draw = (img?: HTMLImageElement) => {
        pctx.clearRect(0, 0, CELL, CELL);
        if (img && tile.tilesetImage) {
          const sx = tile.srcX ?? 0;
          const sy = tile.srcY ?? 0;
          const sw = tile.srcW ?? this.config!.tileSize;
          const sh = tile.srcH ?? this.config!.tileSize;
          pctx.drawImage(img, sx, sy, sw, sh, 0, 0, CELL, CELL);
        } else {
          pctx.fillStyle = tile.color;
          pctx.fillRect(0, 0, CELL, CELL);
        }
      };

      if (tile.tilesetImage) {
        const img = this.loadImage(tile.tilesetImage);
        if (img) {
          draw(img);
        } else {
          draw(); // 先画颜色占位
          const src = tile.tilesetImage;
          let attempts = 0;
          const maxAttempts = 50; // 最多轮询5秒
          const poll = () => {
            attempts++;
            const loaded = this.imageCache.get(src);
            if (loaded) {
              draw(loaded);
            } else if (attempts < maxAttempts && this.imageLoading.has(src)) {
              setTimeout(poll, 100);
            } else {
              // 加载失败或超时，显示错误标记
              pctx.fillStyle = '#ff4444';
              pctx.fillRect(0, 0, CELL, CELL);
              pctx.fillStyle = '#fff';
              pctx.font = '10px sans-serif';
              pctx.textAlign = 'center';
              pctx.fillText('!', CELL/2, CELL/2 + 3);
            }
          };
          setTimeout(poll, 100);
        }
      } else {
        draw();
      }

      cell.appendChild(canvas);
      cell.addEventListener('click', () => {
        this.selectedTileId = tile.id;
        grid.querySelectorAll('.tileset-cell').forEach(el => el.classList.remove('active'));
        cell.classList.add('active');
        document.getElementById('selectedTile')!.textContent = tile.name;
      });
      cell.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.value = tile.name;
        input.style.cssText = `
          position:absolute; inset:0; width:100%; height:100%;
          background:#1a1a24; border:1px solid #6bb8ff; border-radius:3px;
          color:#e0e0e0; font-size:9px; text-align:center;
          padding:2px; box-sizing:border-box; z-index:10;
        `;
        cell.style.position = 'relative';
        cell.appendChild(input);
        input.focus();
        input.select();
        const commit = () => {
          const newName = input.value.trim() || tile.name;
          tile.name = newName;
          cell.title = newName;
          if (this.selectedTileId === tile.id) {
            document.getElementById('selectedTile')!.textContent = newName;
          }
          input.remove();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') { ke.preventDefault(); commit(); }
          if (ke.key === 'Escape') { input.remove(); }
        });
      });
      grid.appendChild(cell);
    });
  }

  private updateProperties(): void {
    if (!this.mapData) return;

    (document.getElementById('mapName') as HTMLInputElement).value = this.mapData.name;
    (document.getElementById('mapWidth') as HTMLInputElement).value = String(this.mapData.width);
    (document.getElementById('mapHeight') as HTMLInputElement).value = String(this.mapData.height);
    document.getElementById('tileSize')!.textContent = `${this.mapData.tileSize} px`;

    // 绑定尺寸输入框事件（只绑定一次）
    this.bindDimensionInputs();
  }

  private dimensionListenersBound = false;

  private bindDimensionInputs(): void {
    if (this.dimensionListenersBound) return;

    const widthInput = document.getElementById('mapWidth') as HTMLInputElement;
    const heightInput = document.getElementById('mapHeight') as HTMLInputElement;

    const handleResize = () => {
      if (!this.mapData) return;

      const newWidth = Math.max(4, Math.min(128, parseInt(widthInput.value) || this.mapData.width));
      const newHeight = Math.max(4, Math.min(128, parseInt(heightInput.value) || this.mapData.height));

      if (newWidth !== this.mapData.width || newHeight !== this.mapData.height) {
        this.resizeMap(newWidth, newHeight);
        widthInput.value = String(newWidth);
        heightInput.value = String(newHeight);
      }
    };

    widthInput.addEventListener('change', handleResize);
    heightInput.addEventListener('change', handleResize);

    this.dimensionListenersBound = true;
  }

  private resizeMap(newWidth: number, newHeight: number): void {
    if (!this.mapData) return;

    const oldWidth = this.mapData.width;
    const oldHeight = this.mapData.height;
    const oldTiles = this.mapData.tiles;

    // 创建新数组
    const newTiles = new Array(newWidth * newHeight).fill(0);

    // 复制原有数据（保留左上角的区域）
    const copyWidth = Math.min(oldWidth, newWidth);
    const copyHeight = Math.min(oldHeight, newHeight);

    for (let y = 0; y < copyHeight; y++) {
      for (let x = 0; x < copyWidth; x++) {
        newTiles[y * newWidth + x] = oldTiles[y * oldWidth + x];
      }
    }

    // 更新地图数据
    this.mapData.width = newWidth;
    this.mapData.height = newHeight;
    this.mapData.tiles = newTiles;

    // 调整出生点（确保在地图内）
    this.mapData.spawnPoint.x = Math.min(this.mapData.spawnPoint.x, newWidth - 1);
    this.mapData.spawnPoint.y = Math.min(this.mapData.spawnPoint.y, newHeight - 1);

    // 重新调整画布
    this.resizeCanvas();
    this.markDirty();

    console.log(`地图尺寸调整为: ${newWidth}x${newHeight}`);
  }

  private bindMouseEvents(): void {
    let isDragging = false;
    
    this.canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      const pos = this.getTilePos(e);
      this.currentTool?.onMouseDown(pos);
      this.markDirty();
    });
    
    this.canvas.addEventListener('mousemove', (e) => {
      const pos = this.getTilePos(e);
      this.updateCanvasInfo(pos);
      
      if (isDragging) {
        this.currentTool?.onMouseMove(pos);
        this.markDirty();
      }
    });
    
    this.canvas.addEventListener('mouseup', (e) => {
      isDragging = false;
      const pos = this.getTilePos(e);
      this.currentTool?.onMouseUp(pos);
    });
    
    this.canvas.addEventListener('mouseleave', () => {
      isDragging = false;
    });
  }

  private getTilePos(e: MouseEvent): { x: number; y: number } {
    if (!this.mapData) return { x: 0, y: 0 };

    const rect = this.canvas.getBoundingClientRect();
    // 计算鼠标在画布上的相对位置（0-1 比例）
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    // 转换为瓦片坐标
    return {
      x: Math.floor(relX * this.mapData.width),
      y: Math.floor(relY * this.mapData.height),
    };
  }

  private updateCanvasInfo(pos: { x: number; y: number }): void {
    if (!this.mapData || !this.config) return;
    
    const tileId = this.getTile(pos.x, pos.y);
    const tileName = this.config.tiles.find(t => t.id === tileId)?.name || 'VOID';
    document.getElementById('canvasInfo')!.textContent = `坐标: (${pos.x}, ${pos.y}) | 瓦片: ${tileName}`;
  }

  private startRenderLoop(): void {
    const render = () => {
      this.render();
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  private render(): void {
    if (!this.mapData || !this.config) return;
    
    const ctx = this.ctx2d;
    const ts = this.config.tileSize;
    const scaleX = this.canvas.width / (this.mapData.width * ts);
    const scaleY = this.canvas.height / (this.mapData.height * ts);
    const scale = Math.min(scaleX, scaleY);
    const size = ts * scale;
    
    // 清空背景
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 绘制瓦片
    for (let y = 0; y < this.mapData.height; y++) {
      for (let x = 0; x < this.mapData.width; x++) {
        const tileId = this.getTile(x, y);
        const tile = this.config.tiles.find(t => t.id === tileId);
        
        const px = x * size;
        const py = y * size;
        
        // 优先用 spritesheet 图片，否则回退到颜色块
        let drawn = false;
        if (tile?.tilesetImage) {
          const img = this.loadImage(tile.tilesetImage);
          if (img) {
            const sx = tile.srcX ?? 0;
            const sy = tile.srcY ?? 0;
            const sw = tile.srcW ?? this.config.tileSize;
            const sh = tile.srcH ?? this.config.tileSize;
            ctx.drawImage(img, sx, sy, sw, sh, px, py, size, size);
            drawn = true;
          }
        }
        if (!drawn) {
          ctx.fillStyle = tile?.color || '#000000';
          ctx.fillRect(px, py, size, size);
        }
        
        // 绘制网格
        if (this.showGrid) {
          ctx.strokeStyle = '#1e1e2e';
          ctx.lineWidth = 1;
          ctx.strokeRect(px, py, size, size);
        }
      }
    }
    
    // 绘制出生点
    if (this.mapData.spawnPoint) {
      const sp = this.mapData.spawnPoint;
      const px = sp.x * size + size / 2;
      const py = sp.y * size + size / 2;
      
      ctx.fillStyle = '#6bb8ff';
      ctx.beginPath();
      ctx.arc(px, py, size / 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 绘制矩形工具预览
    if (this.currentTool instanceof RectTool) {
      const preview = this.currentTool.getPreviewRect();
      if (preview) {
        const px = preview.x * size;
        const py = preview.y * size;
        const pw = preview.w * size;
        const ph = preview.h * size;

        // 绘制半透明填充
        const tileId = this.getSelectedTile();
        const tile = this.config.tiles.find(t => t.id === tileId);
        ctx.fillStyle = (tile?.color || '#ffffff') + '40'; // 25% 透明度
        ctx.fillRect(px, py, pw, ph);

        // 绘制虚线边框
        ctx.strokeStyle = '#6bb8ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(px, py, pw, ph);
        ctx.setLineDash([]);
      }
    }
  }

  // 加载图片（带缓存，防重复请求）
  private loadImage(src: string): HTMLImageElement | null {
    if (this.imageCache.has(src)) return this.imageCache.get(src)!;

    if (!this.imageLoading.has(src)) {
      const promise = new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => { this.imageCache.set(src, img); resolve(img); };
        img.onerror = () => {
          console.warn(`[MapEditor] 图片加载失败: ${src}`);
          this.imageLoading.delete(src);
          reject(new Error(`Failed to load image: ${src}`));
        };
        img.src = src;
      });
      this.imageLoading.set(src, promise);
    }

    return null; // 首次调用时图片还未加载完，返回 null 用颜色回退
  }

  // 公共 API
  getTile(x: number, y: number): number {
    if (!this.mapData) return 0;
    if (x < 0 || x >= this.mapData.width || y < 0 || y >= this.mapData.height) return 0;
    return this.mapData.tiles[y * this.mapData.width + x];
  }

  setTile(x: number, y: number, tileId: number): void {
    if (!this.mapData) return;
    if (x < 0 || x >= this.mapData.width || y < 0 || y >= this.mapData.height) return;
    this.mapData.tiles[y * this.mapData.width + x] = tileId;
  }

  getSelectedTile(): number {
    return this.selectedTileId;
  }

  setTool(toolName: string): void {
    this.currentTool = this.tools.get(toolName) || this.tools.get('brush')!;
  }

  toggleGrid(): void {
    this.showGrid = !this.showGrid;
    document.getElementById('btnGrid')?.classList.toggle('active', this.showGrid);
  }

  undo(): void {
    if (this.commandHistory.undo()) {
      this.markDirty();
      this.updateUndoRedoUI();
    }
  }

  redo(): void {
    if (this.commandHistory.redo()) {
      this.markDirty();
      this.updateUndoRedoUI();
    }
  }

  /**
   * 执行命令（添加到历史记录）
   */
  executeCommand(cmd: Command): void {
    this.commandHistory.execute(cmd);
    this.updateUndoRedoUI();
  }

  /**
   * 更新撤销/重做按钮状态
   */
  private updateUndoRedoUI(): void {
    const undoBtn = document.getElementById('btnUndo');
    const redoBtn = document.getElementById('btnRedo');
    
    if (undoBtn) {
      undoBtn.style.opacity = this.commandHistory.canUndo() ? '1' : '0.4';
    }
    if (redoBtn) {
      redoBtn.style.opacity = this.commandHistory.canRedo() ? '1' : '0.4';
    }
  }

  markDirty(): void {
    document.getElementById('saveStatus')!.textContent = '未保存';
  }

  // 当前待导出的回调
  private pendingExport: { resolve: (name: string | null) => void } | null = null;

  /**
   * 显示导出对话框，返回用户输入的名称（或 null 如果取消）
   */
  private showExportDialog(): Promise<string | null> {
    return new Promise((resolve) => {
      this.pendingExport = { resolve };

      const modal = document.getElementById('exportModal')!;
      const input = document.getElementById('exportNameInput') as HTMLInputElement;
      const currentName = (document.getElementById('mapName') as HTMLInputElement).value || 'untitled';

      input.value = currentName;
      input.focus();
      input.select();

      modal.classList.remove('hidden');
    });
  }

  /**
   * 确认导出（由 main.ts 调用）
   */
  async confirmExport(): Promise<void> {
    if (!this.pendingExport) return;

    const input = document.getElementById('exportNameInput') as HTMLInputElement;
    const name = input.value.trim() || 'untitled';

    // 隐藏模态框
    document.getElementById('exportModal')!.classList.add('hidden');

    const { resolve } = this.pendingExport;
    this.pendingExport = null;

    resolve(name);

    // 执行实际导出
    await this.doExport(name);
  }

  /**
   * 取消导出（由 main.ts 调用）
   */
  cancelExport(): void {
    if (!this.pendingExport) return;

    document.getElementById('exportModal')!.classList.add('hidden');

    const { resolve } = this.pendingExport;
    this.pendingExport = null;

    resolve(null);
  }

  /**
   * 开始导出流程
   */
  async export(): Promise<void> {
    if (!this.mapData || !this.config) return;

    const name = await this.showExportDialog();
    if (name === null) return; // 用户取消

    // 实际导出在 confirmExport 中执行
  }

  /**
   * 执行实际导出（JSON 格式）
   */
  private async doExport(inputName: string): Promise<void> {
    if (!this.mapData || !this.config) return;

    // 规范化名称
    const sanitizedName = inputName.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&') || 'untitled';

    // 更新属性面板中的名称
    (document.getElementById('mapName') as HTMLInputElement).value = sanitizedName;

    // 文件名使用小写（kebab-case）
    const fileName = sanitizedName.toLowerCase().replace(/_/g, '-');

    // 导出为 JSON
    const tilesRows: string[] = [];
    for (let y = 0; y < this.mapData.height; y++) {
      const rowTiles: string[] = [];
      for (let x = 0; x < this.mapData.width; x++) {
        const tileId = this.mapData.tiles[y * this.mapData.width + x];
        rowTiles.push(String(tileId));
      }
      tilesRows.push(`    ${rowTiles.join(', ')}`);
    }

    const tilesetJson = this.config.tileset ? `\n  "tileset": "${this.config.tileset}",` : '';

    const content = `{
  "version": ${this.mapData.version},
  "name": "${sanitizedName}",
  "width": ${this.mapData.width},
  "height": ${this.mapData.height},
  "tileSize": ${this.mapData.tileSize},${tilesetJson}
  "tiles": [
${tilesRows.join(',\n')}
  ],
  "spawnPoint": {
    "x": ${this.mapData.spawnPoint.x},
    "y": ${this.mapData.spawnPoint.y}
  }
}`;
    const defaultFilename = `${fileName}.json`;
    const mimeType = 'application/json';

    // 尝试使用 File System Access API
    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: defaultFilename,
          types: [{ description: 'JSON 文件', accept: { [mimeType]: ['.json'] } }],
        });

        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();

        document.getElementById('saveStatus')!.textContent = `已导出: ${fileHandle.name}`;
        this.showExportSuccess(fileHandle.name);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('导出失败:', err);
          this.downloadFile(content, defaultFilename, mimeType);
        }
      }
    } else {
      this.downloadFile(content, defaultFilename, mimeType);
    }
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    document.getElementById('saveStatus')!.textContent = `已导出: ${filename}`;
    this.showExportSuccess(filename);
  }

  /**
   * 新建地图
   */
  newMap(): void {
    if (!this.config) return;

    this.mapData = {
      version: 1,
      name: 'untitled',
      width: this.config.defaultWidth,
      height: this.config.defaultHeight,
      tileSize: this.config.tileSize,
      tiles: new Array(this.config.defaultWidth * this.config.defaultHeight).fill(0),
      spawnPoint: { x: Math.floor(this.config.defaultWidth / 2), y: Math.floor(this.config.defaultHeight / 2) },
    };

    this.updateProperties();
    this.resizeCanvas();
    this.markDirty();
    this.commandHistory.clear();
    this.updateUndoRedoUI();
    document.getElementById('saveStatus')!.textContent = '新建地图';
  }

  /**
   * 导入地图（仅支持 JSON 格式）
   * 如果地图包含 tileset 字段，会自动加载对应的 tileset 配置
   */
  importMap(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const content = await file.text();
        const data = JSON.parse(content);

        if (!data.tiles || !data.width || !data.height) {
          alert('无效的地图文件');
          return;
        }

        // 如果地图包含 tileset 字段，自动加载 tileset 配置
        if (data.tileset) {
          try {
            const tilesetResponse = await fetch(data.tileset);
            if (tilesetResponse.ok) {
              const tilesetData = await tilesetResponse.json();
              
              // 创建或更新 config
              this.config = {
                id: data.name || 'imported',
                name: data.name || 'Imported Map',
                tileSize: data.tileSize || tilesetData.tileSize || 64,
                defaultWidth: data.width,
                defaultHeight: data.height,
                exportMode: 'index',
                tileset: data.tileset,
                tiles: tilesetData.tiles.map((t: any, idx: number) => ({
                  id: idx,
                  name: t.name,
                  color: '#888888',
                  solid: false,
                  tilesetImage: tilesetData.image || t.image,
                  srcX: t.x,
                  srcY: t.y,
                  srcW: t.width,
                  srcH: t.height,
                })),
              };
              
              // 预加载图片
              for (const tile of this.config.tiles) {
                if (tile.tilesetImage) {
                  this.loadImage(tile.tilesetImage);
                }
              }
              
              // 更新 UI
              this.updatePalette();
              document.getElementById('configName')!.textContent = this.config.name;
            }
          } catch (tilesetErr) {
            console.warn('加载 tileset 失败:', tilesetErr);
            // 继续加载地图，只是没有 tileset 配置
          }
        }

        this.mapData = {
          version: data.version || 1,
          name: data.name || 'imported',
          width: data.width,
          height: data.height,
          tileSize: data.tileSize || this.config?.tileSize || 64,
          tiles: data.tiles,
          spawnPoint: data.spawnPoint || { x: Math.floor(data.width / 2), y: Math.floor(data.height / 2) },
        };

        this.updateProperties();
        this.resizeCanvas();
        this.markDirty();
        this.commandHistory.clear();
        this.updateUndoRedoUI();
        document.getElementById('saveStatus')!.textContent = `已导入: ${file.name}`;
      } catch (err) {
        console.error('导入失败:', err);
        alert('导入失败: ' + (err as Error).message);
      }
    };
    input.click();
  }

  /**
   * 导出 tileset 配置为 tilesets.json
   */
  async exportTileset(): Promise<void> {
    if (!this.config) { alert('请先加载或创建 tileset 配置'); return; }

    const imagePaths = new Set<string>();
    for (const tile of this.config.tiles) {
      if (tile.tilesetImage && !tile.tilesetImage.startsWith('data:')) {
        imagePaths.add(tile.tilesetImage);
      }
    }

    const firstTile = this.config.tiles[0];
    const isSpritesheet = imagePaths.size === 1 && firstTile?.srcX !== undefined;

    let exportData: any;

    if (isSpritesheet) {
      const imagePath = [...imagePaths][0];
      let spacing = 0;
      if (this.config.tiles.length > 1) {
        const secondTile = this.config.tiles.find(t => t.srcY === firstTile.srcY && (t.srcX ?? 0) > (firstTile.srcX ?? 0));
        if (secondTile && secondTile.srcX !== undefined && firstTile.srcX !== undefined) {
          spacing = secondTile.srcX - firstTile.srcX - (firstTile.srcW ?? this.config.tileSize);
        }
      }

      exportData = {
        image: imagePath,
        tileSize: this.config.tileSize,
        spacing: spacing > 0 ? spacing : 0,
        tiles: this.config.tiles.map((tile, idx) => ({
          id: idx,
          name: tile.name,
          x: tile.srcX ?? 0,
          y: tile.srcY ?? 0,
          width: tile.srcW ?? this.config!.tileSize,
          height: tile.srcH ?? this.config!.tileSize,
        })),
      };
    } else {
      exportData = {
        tileSize: this.config.tileSize,
        tiles: this.config.tiles.map((tile, idx) => ({
          id: idx,
          name: tile.name,
          image: tile.tilesetImage || '',
          width: tile.srcW ?? this.config!.tileSize,
          height: tile.srcH ?? this.config!.tileSize,
        })),
      };
    }

    const json = JSON.stringify(exportData, null, 2);

    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: 'tilesets.json',
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
        });

        const writable = await fileHandle.createWritable();
        await writable.write(json);
        await writable.close();

        this.showExportSuccess('tilesets.json');
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('导出失败:', err);
          this.downloadFile(json, 'tilesets.json', 'application/json');
        }
      }
    } else {
      this.downloadFile(json, 'tilesets.json', 'application/json');
    }
  }

  /**
   * 显示导出成功提示
   */
  private showExportSuccess(filename: string): void {
    const toast = document.getElementById('exportSuccessToast')!;
    const message = document.getElementById('toastMessage')!;

    message.textContent = `已导出: ${filename}`;
    toast.classList.remove('hidden', 'hiding');

    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('hiding');
      }, 300);
    }, 3000);
  }

  /**
   * 打开批量导入文件夹精灵弹窗
   */
  openFolderSpriteImporter(): void {
    const importer = new FolderSpriteImporter((tiles, folderPath) => {
      if (!this.config) {
        // 如果没有配置，创建新配置
        const tileSize = tiles[0]?.srcW || 64;
        this.config = {
          id: 'imported-folder',
          name: 'Imported Folder',
          tileSize: tileSize,
          defaultWidth: 20,
          defaultHeight: 15,
          exportMode: 'index',
          tileset: `${folderPath}/tilesets.json`,
          tiles,
        };
        this.mapData = {
          version: 1,
          name: 'untitled',
          width: this.config.defaultWidth,
          height: this.config.defaultHeight,
          tileSize: this.config.tileSize,
          tiles: new Array(this.config.defaultWidth * this.config.defaultHeight).fill(0),
          spawnPoint: { x: 10, y: 7 },
        };
        document.getElementById('configName')!.textContent = this.config.name;
        this.updateProperties();
        this.resizeCanvas();
      } else {
        // 追加到现有配置
        const maxId = this.config.tiles.reduce((m, t) => Math.max(m, t.id), -1);
        tiles.forEach((t, i) => { t.id = maxId + 1 + i; });
        this.config.tiles.push(...tiles);
        this.config.exportMode = 'index';
      }

      // 预加载所有图片到缓存
      tiles.forEach(t => {
        if (t.tilesetImage) {
          this.loadImage(t.tilesetImage);
        }
      });

      this.updatePalette();
      this.markDirty();
    });
    importer.open();
  }

  /**
   * 打开图集导入弹窗
   */
  openTilesetImporter(): void {
    const importer = new TilesetImporter((tiles, imagePath) => {
      if (!this.config) {
        this.config = {
          id: 'imported',
          name: 'Imported',
          tileSize: tiles[0]?.srcW ?? 16,
          defaultWidth: 20,
          defaultHeight: 15,
          exportMode: 'index',
          tiles,
        };
        this.mapData = {
          version: 1,
          name: 'untitled',
          width: this.config.defaultWidth,
          height: this.config.defaultHeight,
          tileSize: this.config.tileSize,
          tiles: new Array(this.config.defaultWidth * this.config.defaultHeight).fill(0),
          spawnPoint: { x: 10, y: 7 },
        };
        document.getElementById('configName')!.textContent = this.config.name;
        this.updateProperties();
        this.resizeCanvas();
      } else {
        const maxId = this.config.tiles.reduce((m, t) => Math.max(m, t.id), -1);
        tiles.forEach((t, i) => { t.id = maxId + 1 + i; });
        this.config.tiles.push(...tiles);
        this.config.exportMode = 'index';
      }
      if (imagePath) {
        const img = new Image();
        img.onload = () => {
          tiles.forEach(t => {
            if (t.tilesetImage) this.imageCache.set(t.tilesetImage, img);
          });
          this.updatePalette();
        };
        img.src = imagePath;
      } else {
        this.updatePalette();
      }
    });
    importer.open();
  }
}

// ---------------------------------------------------------------------------
// FolderSpriteImporter — 批量导入文件夹精灵（独立图片模式）
// ---------------------------------------------------------------------------

interface FolderSpriteItem {
  id: number;
  name: string;
  filename: string;
  imageUrl: string;
  width: number;
  height: number;
  selected: boolean;
  element?: HTMLElement;
  imgElement?: HTMLImageElement;
}

class FolderSpriteImporter {
  private overlay: HTMLElement;
  private grid: HTMLElement;
  private pathInput: HTMLInputElement;
  private basePathInput: HTMLInputElement;
  private localPathDisplay: HTMLElement;
  private selectionInfo: HTMLElement;
  private pathModeSection: HTMLElement;
  private localModeSection: HTMLElement;
  private basePathSection: HTMLElement;
  private btnPathMode: HTMLElement;
  private btnLocalMode: HTMLElement;

  private sprites: FolderSpriteItem[] = [];
  private currentMode: 'path' | 'local' = 'path';
  private folderPath = '';

  constructor(private onConfirm: (tiles: TilesetImporterResult[], folderPath: string) => void) {
    this.overlay = document.getElementById('folderSpriteModal')!;
    this.grid = document.getElementById('folderSpriteGrid')!;
    this.pathInput = document.getElementById('folderSpritePath') as HTMLInputElement;
    this.basePathInput = document.getElementById('folderSpriteBasePath') as HTMLInputElement;
    this.localPathDisplay = document.getElementById('folderSpriteLocalPath')!;
    this.selectionInfo = document.getElementById('folderSpriteSelectionInfo')!;
    this.pathModeSection = document.getElementById('folderPathMode')!;
    this.localModeSection = document.getElementById('folderLocalMode')!;
    this.basePathSection = document.getElementById('folderBasePathSection')!;
    this.btnPathMode = document.getElementById('btnFolderModePath')!;
    this.btnLocalMode = document.getElementById('btnFolderModeLocal')!;

    this.bindEvents();
  }

  open(): void {
    this.reset();
    this.overlay.classList.remove('hidden');
  }

  private close(): void {
    this.overlay.classList.add('hidden');
    this.reset();
  }

  private reset(): void {
    this.sprites = [];
    this.folderPath = '';
    this.pathInput.value = '';
    this.basePathInput.value = '';
    this.localPathDisplay.textContent = '未选择文件夹';
    this.updateGrid();
    this.updateSelectionInfo();
    this.setMode('path');
  }

  private bindEvents(): void {
    // 关闭按钮
    document.getElementById('btnFolderSpriteModalClose')!.addEventListener('click', () => this.close());
    document.getElementById('btnFolderSpriteCancel')!.addEventListener('click', () => this.close());

    // 模式切换
    this.btnPathMode.addEventListener('click', () => this.setMode('path'));
    this.btnLocalMode.addEventListener('click', () => this.setMode('local'));

    // 路径模式：扫描文件夹
    document.getElementById('btnFolderSpriteLoadPath')!.addEventListener('click', () => this.scanFolderPath());
    this.pathInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.scanFolderPath();
    });

    // 本地模式：选择文件夹
    document.getElementById('btnFolderSpriteSelectFolder')!.addEventListener('click', () => this.selectLocalFolder());

    // 全选/取消全选
    document.getElementById('btnFolderSpriteSelectAll')!.addEventListener('click', () => this.selectAll(true));
    document.getElementById('btnFolderSpriteSelectNone')!.addEventListener('click', () => this.selectAll(false));

    // 确认导入
    document.getElementById('btnFolderSpriteConfirm')!.addEventListener('click', () => this.confirm());
  }

  private setMode(mode: 'path' | 'local'): void {
    this.currentMode = mode;
    this.btnPathMode.classList.toggle('active', mode === 'path');
    this.btnLocalMode.classList.toggle('active', mode === 'local');
    this.pathModeSection.classList.toggle('hidden', mode !== 'path');
    this.localModeSection.classList.toggle('hidden', mode !== 'local');
    this.basePathSection.classList.toggle('hidden', mode !== 'local');
  }

  private async scanFolderPath(): Promise<void> {
    let path = this.pathInput.value.trim();
    if (!path) {
      alert('请输入文件夹路径');
      return;
    }

    // 检测并转换本地路径格式
    // 支持格式: D:\dev\mote\games\dungeon\assets\... 或 D:/dev/mote/games/dungeon/assets/...
    const localPathMatch = path.match(/^([a-zA-Z]:[/\\]|\\)(.+)$/);
    if (localPathMatch) {
      const localPath = path.replace(/\\/g, '/');
      // 尝试匹配项目结构，查找 games 目录
      const gamesMatch = localPath.match(/[/\\]games[/\\](.+)$/i);
      if (gamesMatch) {
        // 提取 games 后面的路径
        const relativePath = '/' + gamesMatch[1].replace(/\\/g, '/');
        path = relativePath;
        this.pathInput.value = path;
        console.log(`[MapEditor] 本地路径已转换: ${localPath} -> ${path}`);
      } else {
        alert('无法从本地路径自动推断服务器路径。\n\n请确保路径包含 games 目录，\n或手动输入服务器路径格式：/games/游戏名/assets/Sprites');
        return;
      }
    }

    this.folderPath = path;

    // 尝试获取文件夹内容
    // 使用 fetch 获取目录索引（如果服务器支持）
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();

      // 解析 HTML 目录索引
      if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
        const pngFiles = this.parseHtmlDirectoryListing(text, path);
        if (pngFiles.length === 0) {
          alert('未在文件夹中找到 PNG 文件');
          return;
        }
        await this.loadSpritesFromPaths(pngFiles);
      } else {
        // 尝试解析为 JSON（如果服务器返回文件列表）
        try {
          const files = JSON.parse(text);
          if (Array.isArray(files)) {
            const pngFiles = files
              .filter((f: string) => f.endsWith('.png') || f.endsWith('.PNG'))
              .map((f: string) => `${path}/${f}`);
            await this.loadSpritesFromPaths(pngFiles);
          }
        } catch {
          alert('无法解析文件夹内容。请确保路径正确且服务器支持目录索引。');
        }
      }
    } catch (err) {
      console.error('扫描文件夹失败:', err);

      // 如果 fetch 失败，提示用户手动输入文件列表
      const useManualList = confirm(
        '无法自动扫描文件夹。是否手动输入文件列表？\n\n' +
        '您可以：\n' +
        '1. 在终端运行: ls *.png > files.txt\n' +
        '2. 复制文件内容到弹窗中'
      );

      if (useManualList) {
        this.promptManualFileList(path);
      }
    }
  }

  private parseHtmlDirectoryListing(html: string, basePath: string): string[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = Array.from(doc.querySelectorAll('a'));

    return links
      .map(a => {
        const href = a.getAttribute('href') || '';
        // 处理相对路径
        if (href.startsWith('http')) return href;
        if (href.startsWith('/')) return href;
        return `${basePath}/${href}`.replace(/\/+/g, '/');
      })
      .filter(href => href.endsWith('.png') || href.endsWith('.PNG'));
  }

  private promptManualFileList(basePath: string): void {
    const input = prompt(
      '请输入 PNG 文件名列表（每行一个）：',
      'arrow.png\nbarrel.png\nbed.png'
    );
    if (!input) return;

    const files = input
      .split('\n')
      .map(f => f.trim())
      .filter(f => f && (f.endsWith('.png') || f.endsWith('.PNG')))
      .map(f => {
        if (f.startsWith('http') || f.startsWith('/')) return f;
        return `${basePath}/${f}`.replace(/\/+/g, '/');
      });

    this.loadSpritesFromPaths(files);
  }

  private async loadSpritesFromPaths(urls: string[]): Promise<void> {
    this.sprites = [];
    this.updateGridLoading();

    // 并行加载所有图片
    const loadPromises = urls.map((url, index) => this.loadSpriteFromUrl(url, index));
    const results = await Promise.all(loadPromises);

    this.sprites = results.filter((s): s is FolderSpriteItem => s !== null);
    this.sprites.sort((a, b) => a.name.localeCompare(b.name));
    this.sprites.forEach((s, i) => { s.id = i; });

    this.updateGrid();
    this.updateSelectionInfo();
  }

  private async loadSpriteFromUrl(url: string, index: number): Promise<FolderSpriteItem | null> {
    try {
      const img = await this.loadImage(url);
      const filename = url.split('/').pop() || `sprite_${index}`;
      const name = filename.replace(/\.png$/i, '');

      return {
        id: index,
        name,
        filename,
        imageUrl: url,
        width: img.width,
        height: img.height,
        selected: true,
      };
    } catch (err) {
      console.warn(`加载图片失败: ${url}`, err);
      return null;
    }
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  private selectLocalFolder(): void {
    const input = document.createElement('input');
    input.type = 'file';
    (input as any).webkitdirectory = true;
    (input as any).directory = true;

    input.onchange = async () => {
      const files = Array.from(input.files || []).filter(f =>
        f.name.endsWith('.png') || f.name.endsWith('.PNG')
      );

      if (files.length === 0) {
        alert('所选文件夹中没有 PNG 文件');
        return;
      }

      this.localPathDisplay.textContent = `${files.length} 个 PNG 文件`;

      // 从 webkitRelativePath 推断基础路径
      // webkitRelativePath 格式取决于用户选择的文件夹层级
      // 例如用户选择 D:\dev\mote\games\dungeon\assets\kenney_scribble-dungeons\Sprites
      // 如果选的是父文件夹(kenney_scribble-dungeons): "Sprites/arrow.png"
      // 如果选的是 Sprites 文件夹本身: "arrow.png" (缺少上层路径!)
      const fullPath = files[0].webkitRelativePath;
      const pathParts = fullPath.split('/');
      
      // 检查是否直接选择了 Sprites 文件夹（只有文件名，没有文件夹层级）
      if (pathParts.length === 1) {
        // 用户直接选择了 Sprites 文件夹，无法推断完整路径
        alert('⚠️ 选择错误！\n\n您直接选择了 Sprites 文件夹。\n\n请重新选择 Sprites 的父文件夹（如 kenney_scribble-dungeons），\n以便程序能正确推断完整路径结构。');
      }
      
      // 尝试推断路径
      let defaultBasePath = '';
      
      if (pathParts.length >= 2) {
        // 取除文件名外的所有路径
        const folderPath = pathParts.slice(0, -1).join('/');
        defaultBasePath = `/games/{游戏名}/${folderPath}`;
      } else {
        defaultBasePath = '/games/{游戏名}/assets/Sprites';
      }
      
      this.basePathInput.value = defaultBasePath;
      this.basePathInput.style.borderColor = '#ff6b6b';
      
      // 自动选择占位符部分，方便用户直接输入替换
      setTimeout(() => {
        const input = this.basePathInput;
        const start = input.value.indexOf('{');
        const end = input.value.indexOf('}') + 1;
        if (start >= 0 && end > start) {
          input.setSelectionRange(start, end);
          input.focus();
        }
      }, 100);

      await this.loadSpritesFromFiles(files);
    };

    input.click();
  }

  private async loadSpritesFromFiles(files: File[]): Promise<void> {
    this.sprites = [];
    this.updateGridLoading();

    const loadPromises = files.map((file, index) => this.loadSpriteFromFile(file, index));
    const results = await Promise.all(loadPromises);

    this.sprites = results.filter((s): s is FolderSpriteItem => s !== null);
    this.sprites.sort((a, b) => a.name.localeCompare(b.name));
    this.sprites.forEach((s, i) => { s.id = i; });

    this.updateGrid();
    this.updateSelectionInfo();
  }

  private async loadSpriteFromFile(file: File, index: number): Promise<FolderSpriteItem | null> {
    try {
      const url = URL.createObjectURL(file);
      const img = await this.loadImage(url);
      const name = file.name.replace(/\.png$/i, '');

      return {
        id: index,
        name,
        filename: file.name,
        imageUrl: url,
        width: img.width,
        height: img.height,
        selected: true,
      };
    } catch (err) {
      console.warn(`加载文件失败: ${file.name}`, err);
      return null;
    }
  }

  private updateGridLoading(): void {
    this.grid.innerHTML = `
      <div style="color:#666; font-size:13px; text-align:center; padding:40px; grid-column:1/-1;">
        加载中...
      </div>
    `;
  }

  private updateGrid(): void {
    this.grid.innerHTML = '';

    if (this.sprites.length === 0) {
      this.grid.innerHTML = `
        <div style="color:#666; font-size:13px; text-align:center; padding:40px; grid-column:1/-1;">
          ${this.currentMode === 'path' ? '请输入文件夹路径并点击扫描' : '请选择本地文件夹'}
        </div>
      `;
      return;
    }

    this.sprites.forEach(sprite => {
      const item = document.createElement('div');
      item.className = `folder-sprite-item ${sprite.selected ? 'selected' : ''}`;

      const preview = document.createElement('div');
      preview.className = 'folder-sprite-preview';

      const img = document.createElement('img');
      img.src = sprite.imageUrl;
      img.alt = sprite.name;
      img.onload = () => {
        // 如果图片太大，限制显示尺寸
        if (img.width > 64 || img.height > 64) {
          const scale = Math.min(64 / img.width, 64 / img.height);
          img.style.width = `${img.width * scale}px`;
          img.style.height = `${img.height * scale}px`;
        }
      };

      preview.appendChild(img);
      sprite.imgElement = img;

      const name = document.createElement('div');
      name.className = 'folder-sprite-name';
      name.textContent = sprite.name;

      const size = document.createElement('div');
      size.className = 'folder-sprite-size';
      size.textContent = `${sprite.width}×${sprite.height}`;

      item.appendChild(preview);
      item.appendChild(name);
      item.appendChild(size);

      item.addEventListener('click', () => {
        sprite.selected = !sprite.selected;
        item.classList.toggle('selected', sprite.selected);
        this.updateSelectionInfo();
      });

      // 双击重命名
      item.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.value = sprite.name;
        input.style.cssText = `
          position: absolute;
          bottom: 4px;
          left: 4px;
          right: 4px;
          width: calc(100% - 8px);
          padding: 2px 4px;
          background: #1a1a24;
          border: 1px solid #6bb8ff;
          border-radius: 3px;
          color: #e0e0e0;
          font-size: 11px;
          text-align: center;
          z-index: 10;
        `;
        item.style.position = 'relative';
        item.appendChild(input);
        input.focus();
        input.select();

        const commit = () => {
          const newName = input.value.trim() || sprite.name;
          sprite.name = newName;
          name.textContent = newName;
          input.remove();
        };

        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') { ke.preventDefault(); commit(); }
          if (ke.key === 'Escape') { input.remove(); }
        });
      });

      this.grid.appendChild(item);
      sprite.element = item;
    });
  }

  private selectAll(selected: boolean): void {
    this.sprites.forEach(sprite => {
      sprite.selected = selected;
      if (sprite.element) {
        sprite.element.classList.toggle('selected', selected);
      }
    });
    this.updateSelectionInfo();
  }

  private updateSelectionInfo(): void {
    const selectedCount = this.sprites.filter(s => s.selected).length;
    this.selectionInfo.textContent = `已选 ${selectedCount} / ${this.sprites.length} 个`;
  }

  private confirm(): void {
    const selectedSprites = this.sprites.filter(s => s.selected);
    if (selectedSprites.length === 0) {
      alert('请至少选择一个精灵');
      return;
    }

    // 本地模式下验证基础路径
    if (this.currentMode === 'local') {
      const basePath = this.basePathInput.value.trim();
      if (!basePath || basePath.includes('{') || !basePath.startsWith('/')) {
        alert('请填写正确的基础路径！格式：/games/游戏名/assets/Sprites');
        this.basePathInput.focus();
        this.basePathInput.style.borderColor = '#ff6b6b';
        return;
      }
    }

    // 构建 tile 数据
    const tiles: TilesetImporterResult[] = selectedSprites.map((sprite, index) => {
      let imagePath: string;

      if (this.currentMode === 'local') {
        // 本地模式：使用基础路径 + 文件名
        const basePath = this.basePathInput.value.trim() || '/games/assets/Sprites';
        imagePath = `${basePath}/${sprite.filename}`.replace(/\/+/g, '/');
      } else {
        // 路径模式：直接使用 URL
        imagePath = sprite.imageUrl;
      }

      return {
        id: index,
        name: sprite.name,
        color: '#888888',
        solid: false,
        tilesetImage: imagePath,
        srcX: 0,
        srcY: 0,
        srcW: sprite.width,
        srcH: sprite.height,
      };
    });

    // 构建文件夹路径（用于导出 tileset）
    const folderPath = this.currentMode === 'local'
      ? (this.basePathInput.value.trim() || '/games/assets/Sprites')
      : this.folderPath;

    this.onConfirm(tiles, folderPath);
    this.close();
  }
}

// ---------------------------------------------------------------------------
// TilesetImporter — 独立的图集切割工具
// ---------------------------------------------------------------------------

interface TilesetImporterResult {
  id: number;
  name: string;
  color: string;
  solid: boolean;
  tilesetImage: string;
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
}

class TilesetImporter {
  private overlay: HTMLElement;
  private previewCanvas: HTMLCanvasElement;
  private pctx: CanvasRenderingContext2D;
  private image: HTMLImageElement | null = null;
  private imagePath = '';
  private tileSize = 16;
  private spacing = 1;
  private margin = 0;
  private cols = 0;
  private rows = 0;
  private zoom = 3;
  private selected = new Set<number>();
  private hoveredIdx = -1;

  constructor(private onConfirm: (tiles: TilesetImporterResult[], imagePath: string) => void) {
    this.overlay = document.getElementById('tilesetModal')!;
    this.previewCanvas = document.getElementById('tilesetPreviewCanvas') as HTMLCanvasElement;
    this.pctx = this.previewCanvas.getContext('2d')!;
    this.bindEvents();
  }

  open(): void {
    this.overlay.classList.remove('hidden');
  }

  private close(): void {
    this.overlay.classList.add('hidden');
    this.image = null;
    this.imagePath = '';
    this.selected.clear();
    this.hoveredIdx = -1;
    this.pctx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
    this.previewCanvas.width = 0;
    this.updateInfo();
  }

  private bindEvents(): void {
    document.getElementById('btnTilesetModalClose')!.addEventListener('click', () => this.close());
    document.getElementById('btnTilesetCancel')!.addEventListener('click', () => this.close());

    const pathInput = document.getElementById('tilesetImagePath') as HTMLInputElement;
    const btnLoadPath = document.getElementById('btnTilesetLoadPath')!;
    
    btnLoadPath.addEventListener('click', () => {
      const path = pathInput.value.trim();
      if (!path) return;
      this.loadImageFromPath(path);
    });
    
    pathInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const path = pathInput.value.trim();
        if (!path) return;
        this.loadImageFromPath(path);
      }
    });

    document.getElementById('btnTilesetLoadImage')!.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        this.imagePath = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { 
          this.image = img; 
          this.redraw(); 
          const actualPath = prompt('请输入图片的实际路径（如 /games/tiny-town/assets/kenney_tiny-town_tilemap.png）：', 
            `/games/tiny-town/assets/${file.name}`);
          if (actualPath) {
            this.imagePath = actualPath;
            if (pathInput) pathInput.value = actualPath;
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          alert('图片加载失败');
        };
        img.src = url;
      };
      input.click();
    });

    const redrawOnChange = () => { this.readParams(); this.redraw(); };
    document.getElementById('tilesetTileSize')!.addEventListener('change', redrawOnChange);
    document.getElementById('tilesetSpacing')!.addEventListener('change', redrawOnChange);
    document.getElementById('tilesetMargin')!.addEventListener('change', redrawOnChange);

    const zoomSlider = document.getElementById('tilesetZoom') as HTMLInputElement;
    const zoomLabel  = document.getElementById('tilesetZoomLabel')!;
    zoomSlider.addEventListener('input', () => {
      this.zoom = parseInt(zoomSlider.value);
      zoomLabel.textContent = `${this.zoom}×`;
      this.redraw();
    });

    document.getElementById('btnTilesetSelectAll')!.addEventListener('click', () => {
      if (!this.image) return;
      for (let i = 0; i < this.cols * this.rows; i++) this.selected.add(i);
      this.redraw();
    });
    document.getElementById('btnTilesetSelectNone')!.addEventListener('click', () => {
      this.selected.clear();
      this.redraw();
    });

    let dragging = false;
    let dragMode: 'add' | 'remove' = 'add';

    this.previewCanvas.addEventListener('mousedown', (e) => {
      dragging = true;
      const idx = this.hitTest(e);
      if (idx < 0) return;
      dragMode = this.selected.has(idx) ? 'remove' : 'add';
      this.toggle(idx, dragMode);
    });
    this.previewCanvas.addEventListener('mousemove', (e) => {
      const idx = this.hitTest(e);
      if (idx !== this.hoveredIdx) {
        this.hoveredIdx = idx;
        this.updateHoverInfo(idx);
        this.redraw();
      }
      if (dragging && idx >= 0) this.toggle(idx, dragMode);
    });
    this.previewCanvas.addEventListener('mouseleave', () => {
      this.hoveredIdx = -1;
      this.updateHoverInfo(-1);
      this.redraw();
    });
    window.addEventListener('mouseup', () => { dragging = false; });

    document.getElementById('btnTilesetConfirm')!.addEventListener('click', () => {
      if (!this.image || this.selected.size === 0) return;
      const tiles = this.buildTiles();
      this.onConfirm(tiles, this.imagePath);
      this.close();
    });
  }

  private readParams(): void {
    this.tileSize = Math.max(1, parseInt((document.getElementById('tilesetTileSize') as HTMLInputElement).value) || 16);
    this.spacing  = Math.max(0, parseInt((document.getElementById('tilesetSpacing')  as HTMLInputElement).value) || 0);
    this.margin   = Math.max(0, parseInt((document.getElementById('tilesetMargin')   as HTMLInputElement).value) || 0);
  }

  private redraw(): void {
    if (!this.image) return;
    this.readParams();

    const { tileSize: ts, spacing: sp, margin: mg, zoom } = this;
    const step = ts + sp;
    this.cols = Math.floor((this.image.width  - mg * 2 + sp) / step);
    this.rows = Math.floor((this.image.height - mg * 2 + sp) / step);

    const scale = zoom;
    this.previewCanvas.width  = Math.round(this.image.width  * scale);
    this.previewCanvas.height = Math.round(this.image.height * scale);
    this.previewCanvas.style.width  = this.previewCanvas.width  + 'px';
    this.previewCanvas.style.height = this.previewCanvas.height + 'px';

    this.pctx.imageSmoothingEnabled = false;
    this.pctx.drawImage(this.image, 0, 0, this.previewCanvas.width, this.previewCanvas.height);

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const sx = (mg + col * step) * scale;
        const sy = (mg + row * step) * scale;
        const sw = ts * scale;
        const sh = ts * scale;
        const idx = row * this.cols + col;

        if (this.selected.has(idx)) {
          this.pctx.fillStyle = 'rgba(107, 184, 255, 0.35)';
          this.pctx.fillRect(sx, sy, sw, sh);
          this.pctx.strokeStyle = '#6bb8ff';
          this.pctx.lineWidth = 1.5;
        } else if (idx === this.hoveredIdx) {
          this.pctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          this.pctx.fillRect(sx, sy, sw, sh);
          this.pctx.strokeStyle = 'rgba(255,255,255,0.5)';
          this.pctx.lineWidth = 1;
        } else {
          this.pctx.strokeStyle = 'rgba(255,255,255,0.15)';
          this.pctx.lineWidth = 0.5;
        }
        this.pctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
      }
    }
    this.updateInfo();
  }

  private hitTest(e: MouseEvent): number {
    if (!this.image) return -1;
    const rect = this.previewCanvas.getBoundingClientRect();
    const scale = this.previewCanvas.width / this.image.width;
    const { tileSize: ts, spacing: sp, margin: mg } = this;
    const step = ts + sp;

    const px = (e.clientX - rect.left) / scale;
    const py = (e.clientY - rect.top)  / scale;
    const col = Math.floor((px - mg) / step);
    const row = Math.floor((py - mg) / step);

    const localX = (px - mg) - col * step;
    const localY = (py - mg) - row * step;
    if (localX < 0 || localX >= ts || localY < 0 || localY >= ts) return -1;
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return -1;

    return row * this.cols + col;
  }

  private toggle(idx: number, mode: 'add' | 'remove'): void {
    if (mode === 'add') this.selected.add(idx);
    else this.selected.delete(idx);
    this.redraw();
  }

  private updateInfo(): void {
    const total = this.cols * this.rows;
    document.getElementById('tilesetSelectionInfo')!.textContent =
      this.cols
        ? `已选 ${this.selected.size} / ${total} 个  (图集 ${this.cols}×${this.rows})`
        : '点击图集中的 tile 来选择，已选 0 个';
  }

  private updateHoverInfo(idx: number): void {
    const el = document.getElementById('tilesetHoverInfo')!;
    if (idx < 0 || !this.cols) { el.textContent = ''; return; }
    const col = idx % this.cols;
    const row = Math.floor(idx / this.cols);
    el.textContent = `index ${idx}  (${col}, ${row})`;
  }

  private loadImageFromPath(path: string): void {
    this.imagePath = path;
    const img = new Image();
    img.onload = () => {
      this.image = img;
      this.redraw();
      const pathInput = document.getElementById('tilesetImagePath') as HTMLInputElement;
      if (pathInput) pathInput.value = path;
    };
    img.onerror = () => {
      alert(`无法加载图片: ${path}\n请检查路径是否正确（如 /games/tiny-town/assets/kenney_tiny-town_tilemap.png）`);
    };
    img.src = path;
  }

  private buildTiles(): TilesetImporterResult[] {
    const { tileSize: ts, spacing: sp, margin: mg } = this;
    const step = ts + sp;
    const src = this.imagePath;

    return [...this.selected]
      .sort((a, b) => a - b)
      .map((idx, i) => {
        const col = idx % this.cols;
        const row = Math.floor(idx / this.cols);
        return {
          id: i,
          name: `TILE_${String(idx).padStart(4, '0')}`,
          color: '#888888',
          solid: false,
          tilesetImage: src,
          srcX: mg + col * step,
          srcY: mg + row * step,
          srcW: ts,
          srcH: ts,
        };
      });
  }
}
