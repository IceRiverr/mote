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

  /**
   * 从 JSON 文件导入游戏配置
   */
  importConfig(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const config: GameConfig = JSON.parse(await file.text());
        this.loadConfig(config);
      } catch (err) {
        alert('配置文件无效: ' + (err as Error).message);
      }
    };
    input.click();
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
    
    this.config.tiles.forEach(tile => {
      const item = document.createElement('div');
      item.className = 'tile-item' + (tile.id === this.selectedTileId ? ' active' : '');
      if (tile.tilesetImage) {
        const sx = tile.srcX ?? 0;
        const sy = tile.srcY ?? 0;
        const sw = tile.srcW ?? this.config!.tileSize;
        const sh = tile.srcH ?? this.config!.tileSize;

        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        canvas.style.cssText = 'width:32px;height:32px;image-rendering:pixelated;';
        const pctx = canvas.getContext('2d')!;

        const preview = document.createElement('div');
        preview.className = 'tile-preview';
        preview.style.background = tile.color;
        preview.appendChild(canvas);

        const label = document.createElement('div');
        label.className = 'tile-name';
        label.textContent = tile.name;

        item.appendChild(preview);
        item.appendChild(label);

        const drawPreview = (img: HTMLImageElement) =>
          pctx.drawImage(img, sx, sy, sw, sh, 0, 0, 32, 32);

        const img = this.loadImage(tile.tilesetImage);
        if (img) {
          drawPreview(img);
        } else {
          const src = tile.tilesetImage;
          const poll = () => {
            const loaded = this.imageCache.get(src);
            loaded ? drawPreview(loaded) : setTimeout(poll, 100);
          };
          setTimeout(poll, 100);
        }
      } else {
        item.innerHTML = `
          <div class="tile-preview" style="background: ${tile.color}"></div>
          <div class="tile-name">${tile.name}</div>
        `;
      }
      item.addEventListener('click', () => {
        this.selectedTileId = tile.id;
        document.querySelectorAll('.tile-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        document.getElementById('selectedTile')!.textContent = tile.name;
      });
      palette.appendChild(item);
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
        img.onerror = reject;
        img.src = src;
      });
      this.imageLoading.set(src, promise);
      promise.finally(() => this.imageLoading.delete(src));
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

  // 当前待导出的格式和回调
  private pendingExport: { format: 'ts' | 'json'; resolve: (name: string | null) => void } | null = null;

  /**
   * 显示导出对话框，返回用户输入的名称（或 null 如果取消）
   */
  private showExportDialog(format: 'ts' | 'json'): Promise<string | null> {
    return new Promise((resolve) => {
      this.pendingExport = { format, resolve };

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

    const { format, resolve } = this.pendingExport;
    this.pendingExport = null;

    resolve(name);

    // 执行实际导出
    await this.doExport(format, name);
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
  async export(format: 'ts' | 'json'): Promise<void> {
    if (!this.mapData || !this.config) return;

    const name = await this.showExportDialog(format);
    if (name === null) return; // 用户取消

    // 实际导出在 confirmExport 中执行
  }

  /**
   * 执行实际导出
   */
  private async doExport(format: 'ts' | 'json', inputName: string): Promise<void> {
    if (!this.mapData || !this.config) return;

    // 规范化名称：移除非字母数字字符，转为有效标识符
    const sanitizedName = inputName.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&') || 'untitled';

    // 更新属性面板中的名称
    (document.getElementById('mapName') as HTMLInputElement).value = sanitizedName;

    // 常量名使用大写（蛇形命名），文件名使用小写（kebab-case）
    const constName = sanitizedName.toUpperCase();
    const fileName = sanitizedName.toLowerCase().replace(/_/g, '-');

    let content: string;
    let defaultFilename: string;
    let mimeType: string;
    let fileExtension: string;

    if (format === 'ts') {
      // 导出为 TypeScript
      const tilesStr = this.mapData.tiles
        .map((t, i) => {
          const sep = (i + 1) % this.mapData!.width === 0 ? ',\n' : ', ';
          return `  T.${this.config!.tiles.find(tile => tile.id === t)?.name || 'VOID'}${sep}`;
        })
        .join('');

      content = `// Auto-generated by Mote Map Editor
// Map: ${sanitizedName}
import { T } from './TileIds.js';

export const ${constName} = {
  name: '${sanitizedName}',
  width: ${this.mapData.width},
  height: ${this.mapData.height},
  tileSize: ${this.mapData.tileSize},
  spawnPoint: { x: ${this.mapData.spawnPoint.x}, y: ${this.mapData.spawnPoint.y} },
  tiles: [
${tilesStr}  ] as const,
};

// 默认导出，方便直接导入
export default ${constName};
`;
      defaultFilename = `${fileName}.ts`;
      mimeType = 'text/typescript';
      fileExtension = '.ts';
    } else {
      // 导出为 JSON，自定义格式让 tiles 按行列排列
      const tilesRows: string[] = [];
      for (let y = 0; y < this.mapData.height; y++) {
        const rowTiles: string[] = [];
        for (let x = 0; x < this.mapData.width; x++) {
          const tileId = this.mapData.tiles[y * this.mapData.width + x];
          rowTiles.push(String(tileId));
        }
        tilesRows.push(`    ${rowTiles.join(', ')}`);
      }

      content = `{
  "version": ${this.mapData.version},
  "name": "${sanitizedName}",
  "width": ${this.mapData.width},
  "height": ${this.mapData.height},
  "tileSize": ${this.mapData.tileSize},
  "tiles": [
${tilesRows.join(',\n')}
  ],
  "spawnPoint": {
    "x": ${this.mapData.spawnPoint.x},
    "y": ${this.mapData.spawnPoint.y}
  }
}`;
      defaultFilename = `${fileName}.json`;
      mimeType = 'application/json';
      fileExtension = '.json';
    }

    // 尝试使用 File System Access API 让用户选择保存路径
    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: defaultFilename,
          types: [
            {
              description: format === 'ts' ? 'TypeScript 文件' : 'JSON 文件',
              accept: {
                [mimeType]: [fileExtension],
              },
            },
          ],
        });

        // 写入文件
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();

        document.getElementById('saveStatus')!.textContent = `已导出: ${fileHandle.name}`;

        // 显示成功提示
        this.showExportSuccess(fileHandle.name);
      } catch (err) {
        // 用户取消选择或发生错误
        if ((err as Error).name !== 'AbortError') {
          console.error('导出失败:', err);
          // 回退到传统下载方式
          this.downloadFile(content, defaultFilename, mimeType);
        }
      }
    } else {
      // 浏览器不支持 File System Access API，使用传统下载方式
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

    // 显示成功提示
    this.showExportSuccess(filename);
  }

  /**
   * 新建地图
   */
  newMap(): void {
    if (!this.config) return;

    // 重置为默认尺寸
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
    this.updateProperties();
    this.resizeCanvas();
    this.markDirty();

    // 清空命令历史
    this.commandHistory.clear();
    this.updateUndoRedoUI();

    document.getElementById('saveStatus')!.textContent = '新建地图';
  }

  /**
   * 导入地图
   */
  importMap(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.ts';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const content = await file.text();
        let data: any;

        if (file.name.endsWith('.json')) {
          data = JSON.parse(content);
        } else {
          // 解析 TypeScript 文件
          data = this.parseTypeScriptMap(content);
          if (!data) {
            alert('无法解析 TypeScript 文件，请确保格式正确');
            return;
          }
        }

        // 验证数据结构
        if (!data.tiles || !data.width || !data.height) {
          alert('无效的地图文件');
          return;
        }

        // 应用导入的数据
        this.mapData = {
          version: data.version || 1,
          name: data.name || 'imported',
          width: data.width,
          height: data.height,
          tileSize: data.tileSize || this.config?.tileSize || 64,
          tiles: data.tiles,
          spawnPoint: data.spawnPoint || { x: Math.floor(data.width / 2), y: Math.floor(data.height / 2) },
        };

        // 更新 UI
        this.updateProperties();
        this.resizeCanvas();
        this.markDirty();

        // 清空命令历史
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
   * 解析 TypeScript 地图文件
   */
  private parseTypeScriptMap(content: string): { tiles: number[]; width: number; height: number; name: string; tileSize: number; spawnPoint: { x: number; y: number } } | null {
    // 创建 T 枚举名称到 ID 的反向映射
    const tileNameToId = new Map<string, number>();
    this.config?.tiles.forEach(tile => {
      tileNameToId.set(tile.name, tile.id);
    });

    // 尝试提取 width 和 height
    const widthMatch = content.match(/width:\s*(\d+)/);
    const heightMatch = content.match(/height:\s*(\d+)/);
    const tileSizeMatch = content.match(/tileSize:\s*(\d+)/);
    const nameMatch = content.match(/name:\s*['"]([^'"]+)['"]/);

    // 尝试提取 spawnPoint
    const spawnXMatch = content.match(/spawnPoint:\s*\{[^}]*x:\s*(\d+)/);
    const spawnYMatch = content.match(/spawnPoint:\s*\{[^}]*y:\s*(\d+)/);

    // 提取 tiles 数组内容
    // 匹配 tiles: [ ... ] 或 tiles: [ ... ] as const
    const tilesMatch = content.match(/tiles:\s*\[([\s\S]*?)\](?:\s*as\s+const)?/);
    if (!tilesMatch) return null;

    const tilesContent = tilesMatch[1];

    // 解析 tiles 内容，支持两种格式：
    // 1. T.VOID, T.WALL, ... (枚举格式)
    // 2. 0, 1, 2, ... (数字格式)
    const tiles: number[] = [];
    const tileEntries = tilesContent.split(',');

    for (const entry of tileEntries) {
      const trimmed = entry.trim();
      if (!trimmed) continue;

      // 尝试匹配 T.XXX 格式
      const enumMatch = trimmed.match(/^T\.(\w+)$/);
      if (enumMatch) {
        const tileName = enumMatch[1];
        const tileId = tileNameToId.get(tileName);
        if (tileId !== undefined) {
          tiles.push(tileId);
        } else {
          console.warn(`未知的瓦片类型: T.${tileName}`);
          tiles.push(0); // 默认使用 VOID
        }
      } else {
        // 尝试直接解析数字
        const numId = parseInt(trimmed, 10);
        if (!isNaN(numId)) {
          tiles.push(numId);
        }
      }
    }

    const width = widthMatch ? parseInt(widthMatch[1], 10) : Math.floor(Math.sqrt(tiles.length));
    const height = heightMatch ? parseInt(heightMatch[1], 10) : Math.ceil(tiles.length / width);

    return {
      tiles,
      width,
      height,
      name: nameMatch ? nameMatch[1] : 'imported',
      tileSize: tileSizeMatch ? parseInt(tileSizeMatch[1], 10) : (this.config?.tileSize || 64),
      spawnPoint: {
        x: spawnXMatch ? parseInt(spawnXMatch[1], 10) : Math.floor(width / 2),
        y: spawnYMatch ? parseInt(spawnYMatch[1], 10) : Math.floor(height / 2),
      },
    };
  }

  /**
   * 显示导出成功提示
   */
  private showExportSuccess(filename: string): void {
    const toast = document.getElementById('exportSuccessToast')!;
    const message = document.getElementById('toastMessage')!;

    message.textContent = `已导出: ${filename}`;
    toast.classList.remove('hidden', 'hiding');

    // 3秒后自动隐藏
    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('hiding');
      }, 300);
    }, 3000);
  }
}
