import type { MapData, TileDef } from './MapData.js';
import { BrushTool } from './tools/BrushTool.js';
import { EraserTool } from './tools/EraserTool.js';
import type { Tool } from './tools/Tool.js';

interface GameConfig {
  id: string;
  name: string;
  tileSize: number;
  tiles: TileDef[];
  defaultWidth: number;
  defaultHeight: number;
}

// 内嵌配置，后续可改为 JSON 文件
const GAME_CONFIGS: Record<string, GameConfig> = {
  dungeon: {
    id: 'dungeon',
    name: 'Dungeon',
    tileSize: 64,
    defaultWidth: 16,
    defaultHeight: 12,
    tiles: [
      { id: 0, name: 'VOID', color: '#000000', solid: false },
      { id: 1, name: 'FLOOR', color: '#8B7355', solid: false },
      { id: 2, name: 'WALL', color: '#4A4A4A', solid: true },
      { id: 3, name: 'WALL_CORNER', color: '#3A3A3A', solid: true },
      { id: 4, name: 'WALL_EDGE', color: '#5A5A5A', solid: true },
      { id: 5, name: 'DOOR_CLOSED', color: '#6B4E3D', solid: true },
      { id: 6, name: 'DOOR_OPEN', color: '#5A3D2D', solid: false },
      { id: 7, name: 'CHEST', color: '#D4A84B', solid: true },
      { id: 8, name: 'BARREL', color: '#8B4513', solid: true },
      { id: 9, name: 'STAIRS_DOWN', color: '#666666', solid: false },
      { id: 10, name: 'WATER', color: '#4A90D9', solid: true },
      { id: 11, name: 'PLANKS', color: '#A0826D', solid: false },
      { id: 12, name: 'TRAP', color: '#8B0000', solid: false },
      { id: 13, name: 'CAMPFIRE', color: '#FF6B35', solid: true },
    ],
  },
  'tiny-town': {
    id: 'tiny-town',
    name: 'Tiny Town',
    tileSize: 32,
    defaultWidth: 20,
    defaultHeight: 15,
    tiles: [
      { id: 0, name: 'GRASS', color: '#7C9A63', solid: false },
      { id: 1, name: 'WATER', color: '#5B8DB8', solid: true },
      { id: 2, name: 'TREE', color: '#4A6741', solid: true },
      { id: 3, name: 'HOUSE', color: '#A67B5B', solid: true },
    ],
  },
};

export class MapEditor {
  private canvas!: HTMLCanvasElement;
  
  private config: GameConfig | null = null;
  private mapData: MapData | null = null;
  
  private currentTool: Tool | null = null;
  private tools: Map<string, Tool> = new Map();
  
  private selectedTileId = 0;
  private showGrid = true;
  
  // 绘制缓存
  private ctx2d!: CanvasRenderingContext2D;

  async init(): Promise<void> {
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    
    // 使用 2D context 进行简单渲染（后续可升级为 WebGPU）
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.ctx2d = ctx;
    
    // 初始化工具
    this.tools.set('brush', new BrushTool(this));
    this.tools.set('eraser', new EraserTool(this));
    this.currentTool = this.tools.get('brush')!;
    
    // 绑定鼠标事件
    this.bindMouseEvents();
    
    // 开始渲染循环
    this.startRenderLoop();
  }

  loadConfig(configId: string): void {
    this.config = GAME_CONFIGS[configId];
    if (!this.config) throw new Error(`Config not found: ${configId}`);
    
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
    
    // 限制最大尺寸
    const maxSize = 1024;
    const scale = Math.min(1, maxSize / Math.max(w, h));
    
    this.canvas.width = w * scale;
    this.canvas.height = h * scale;
    this.canvas.style.width = `${this.canvas.width}px`;
    this.canvas.style.height = `${this.canvas.height}px`;
  }

  private updatePalette(): void {
    if (!this.config) return;
    
    const palette = document.getElementById('palette')!;
    palette.innerHTML = '';
    
    this.config.tiles.forEach(tile => {
      const item = document.createElement('div');
      item.className = 'tile-item' + (tile.id === this.selectedTileId ? ' active' : '');
      item.innerHTML = `
        <div class="tile-preview" style="background: ${tile.color}"></div>
        <div class="tile-name">${tile.name}</div>
      `;
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
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    
    const tileSize = this.config?.tileSize || 64;
    return {
      x: Math.floor(x / tileSize),
      y: Math.floor(y / tileSize),
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
        
        ctx.fillStyle = tile?.color || '#000000';
        ctx.fillRect(px, py, size, size);
        
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
    // TODO: 实现撤销
    console.log('Undo');
  }

  redo(): void {
    // TODO: 实现重做
    console.log('Redo');
  }

  markDirty(): void {
    document.getElementById('saveStatus')!.textContent = '未保存';
  }

  export(format: 'ts' | 'json'): void {
    if (!this.mapData || !this.config) return;

    // 获取当前名称作为默认值
    const currentName = (document.getElementById('mapName') as HTMLInputElement).value || 'untitled';

    // 弹出输入框让用户输入地图名
    const inputName = prompt('输入地图名称（用于文件名和导出常量）：', currentName);

    // 用户点击取消则退出
    if (inputName === null) return;

    // 规范化名称：移除非字母数字字符，转为有效标识符
    const sanitizedName = inputName.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&') || 'untitled';

    // 更新属性面板中的名称
    (document.getElementById('mapName') as HTMLInputElement).value = sanitizedName;

    // 常量名使用大写（蛇形命名），文件名使用小写（kebab-case）
    const constName = sanitizedName.toUpperCase();
    const fileName = sanitizedName.toLowerCase().replace(/_/g, '-');

    let content: string;
    let filename: string;
    let mimeType: string;

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
      filename = `${fileName}.ts`;
      mimeType = 'text/typescript';
    } else {
      // 导出为 JSON
      const jsonData = {
        ...this.mapData,
        name: sanitizedName,
      };
      content = JSON.stringify(jsonData, null, 2);
      filename = `${fileName}.json`;
      mimeType = 'application/json';
    }

    // 下载文件
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    document.getElementById('saveStatus')!.textContent = `已导出: ${filename}`;
  }
}
