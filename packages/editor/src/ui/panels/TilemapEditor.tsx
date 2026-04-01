import { h, type ComponentChildren } from 'preact';
import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import { useEditor } from '../../hooks/useEditor.js';
import { BrushTool } from '../../tools/BrushTool.js';
import { EraserTool } from '../../tools/EraserTool.js';
import { RectTool } from '../../tools/RectTool.js';
import type { TilemapTool, TilePreview } from '../../tools/TilemapTool.js';
import type { TilesetRef } from '../../types/editor.js';

interface TilePaletteProps {
  tilesets: TilesetRef[];
  selectedTileId: number;
  onSelectTile: (tileId: number) => void;
}

/**
 * Tile 调色板 - 显示可选择的 tiles
 */
function TilePalette({ tilesets, selectedTileId, onSelectTile }: TilePaletteProps) {
  // 计算 firstgid
  let firstGid = 1;
  const tilesetInfos: Array<{ tileset: TilesetRef; firstGid: number }> = [];
  
  for (const tileset of tilesets) {
    tilesetInfos.push({ tileset, firstGid });
    firstGid += tileset.tilecount;
  }

  return (
    <div style={paletteStyles.container}>
      <div style={paletteStyles.header}>Tile Palette</div>
      <div style={paletteStyles.grid}>
        {tilesetInfos.map(({ tileset, firstGid }) => (
          <div key={tileset.image} style={paletteStyles.tilesetGroup}>
            <div style={paletteStyles.tilesetName}>{tileset.image}</div>
            <div style={paletteStyles.tiles}>
              {Array.from({ length: tileset.tilecount }, (_, i) => {
                const tileId = firstGid + i;
                return (
                  <button
                    key={tileId}
                    style={{
                      ...paletteStyles.tile,
                      ...(tileId === selectedTileId ? paletteStyles.tileSelected : {}),
                    }}
                    onClick={() => onSelectTile(tileId)}
                    title={`Tile ${tileId}`}
                  >
                    {tileId}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TilemapEditorProps {
  /** 头部内容 */
  header?: ComponentChildren;
}

/**
 * TilemapEditor - Tilemap 编辑面板
 * 
 * 集成在 BottomPanel 中的 tilemap 编辑器，包含：
 * - 工具选择（画笔、橡皮、矩形）
 * - Tile 调色板
 * - 图层选择
 * - 画布预览
 */
export function TilemapEditor({ header }: TilemapEditorProps) {
  const { bridge, history } = useEditor();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTool, setSelectedTool] = useState<'brush' | 'eraser' | 'rect'>('brush');
  const [selectedTileId, setSelectedTileId] = useState(1);
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [preview, setPreview] = useState<TilePreview | null>(null);

  const tilemap = bridge.getTilemapData();
  const toolsRef = useRef<Map<string, TilemapTool>>(new Map());

  // 初始化工具
  useEffect(() => {
    toolsRef.current.set('brush', new BrushTool(bridge, history));
    toolsRef.current.set('eraser', new EraserTool(bridge, history));
    toolsRef.current.set('rect', new RectTool(bridge, history));
  }, [bridge, history]);

  // 更新工具的 layer 和 tileId
  useEffect(() => {
    const layerName = tilemap?.layers[selectedLayer]?.name ?? '';
    for (const tool of toolsRef.current.values()) {
      tool.setLayer(layerName);
      tool.setTileId(selectedTileId);
    }
  }, [selectedLayer, selectedTileId, tilemap]);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !tilemap) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = tilemap.width / rect.width;
    const scaleY = tilemap.height / rect.height;
    
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const tool = toolsRef.current.get(selectedTool);
    if (tool) {
      tool.onPointerDown(x, y);
      setPreview(tool.getPreview?.() ?? null);
    }
  }, [selectedTool, tilemap]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !tilemap) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = tilemap.width / rect.width;
    const scaleY = tilemap.height / rect.height;
    
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const tool = toolsRef.current.get(selectedTool);
    if (tool) {
      tool.onPointerMove(x, y);
      setPreview(tool.getPreview?.() ?? null);
    }
  }, [selectedTool, tilemap]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !tilemap) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = tilemap.width / rect.width;
    const scaleY = tilemap.height / rect.height;
    
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const tool = toolsRef.current.get(selectedTool);
    if (tool) {
      tool.onPointerUp(x, y);
      setPreview(null);
    }
  }, [selectedTool, tilemap]);

  // 渲染画布
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tilemap) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置画布大小
    canvas.width = tilemap.width;
    canvas.height = tilemap.height;

    // 清空
    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制当前图层的 tiles
    const layer = tilemap.layers[selectedLayer];
    if (layer) {
      for (let y = 0; y < tilemap.height; y++) {
        for (let x = 0; x < tilemap.width; x++) {
          const tileId = layer.data[y * tilemap.width + x];
          if (tileId !== 0) {
            ctx.fillStyle = '#4a5568';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    // 绘制预览
    if (preview && preview.type === 'rect') {
      ctx.strokeStyle = '#6bb8ff';
      ctx.lineWidth = 0.1;
      ctx.strokeRect(preview.x, preview.y, preview.w!, preview.h!);
      
      ctx.fillStyle = 'rgba(107, 184, 255, 0.3)';
      ctx.fillRect(preview.x, preview.y, preview.w!, preview.h!);
    }
  }, [tilemap, selectedLayer, preview]);

  if (!tilemap) {
    return (
      <div style={editorStyles.container}>
        {header && <div style={editorStyles.header}>{header}</div>}
        <div style={editorStyles.empty}>No tilemap loaded</div>
      </div>
    );
  }

  return (
    <div style={editorStyles.container}>
      {header && <div style={editorStyles.header}>{header}</div>}

      <div style={editorStyles.content}>
        {/* Toolbar */}
        <div style={editorStyles.toolbar}>
          <div style={editorStyles.toolGroup}>
            <button
              style={{
                ...editorStyles.toolBtn,
                ...(selectedTool === 'brush' ? editorStyles.toolBtnActive : {}),
              }}
              onClick={() => setSelectedTool('brush')}
              title="Brush (B)"
            >
              🖌️ Brush
            </button>
            <button
              style={{
                ...editorStyles.toolBtn,
                ...(selectedTool === 'eraser' ? editorStyles.toolBtnActive : {}),
              }}
              onClick={() => setSelectedTool('eraser')}
              title="Eraser (E)"
            >
              🧼 Eraser
            </button>
            <button
              style={{
                ...editorStyles.toolBtn,
                ...(selectedTool === 'rect' ? editorStyles.toolBtnActive : {}),
              }}
              onClick={() => setSelectedTool('rect')}
              title="Rectangle (R)"
            >
              ▭ Rect
            </button>
          </div>

          <div style={editorStyles.layerSelect}>
            <span>Layer:</span>
            <select
              value={selectedLayer}
              onChange={(e) => setSelectedLayer(parseInt((e.target as HTMLSelectElement).value))}
              style={editorStyles.select}
            >
              {tilemap.layers.map((layer, idx) => (
                <option key={layer.name} value={idx}>{layer.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={editorStyles.main}>
          {/* Canvas */}
          <div style={editorStyles.canvasWrapper}>
            <canvas
              ref={canvasRef}
              style={editorStyles.canvas}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
          </div>

          {/* Palette */}
          <TilePalette
            tilesets={tilemap.tilesets}
            selectedTileId={selectedTileId}
            onSelectTile={setSelectedTileId}
          />
        </div>
      </div>
    </div>
  );
}

const editorStyles: Record<string, h.JSX.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg-tertiary)',
    flexShrink: 0,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '8px 12px',
    borderBottom: '1px solid var(--color-border)',
    flexShrink: 0,
  },
  toolGroup: {
    display: 'flex',
    gap: '4px',
  },
  toolBtn: {
    padding: '4px 12px',
    backgroundColor: 'var(--color-bg-tertiary)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    fontSize: '12px',
  },
  toolBtnActive: {
    backgroundColor: 'var(--color-accent)',
    borderColor: 'var(--color-accent)',
  },
  layerSelect: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
  },
  select: {
    padding: '4px 8px',
    backgroundColor: 'var(--color-bg-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text-primary)',
    fontSize: '12px',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  canvasWrapper: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
  },
  canvas: {
    imageRendering: 'pixelated',
    boxShadow: '0 0 0 1px var(--color-border)',
    maxWidth: '100%',
    maxHeight: '100%',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    color: 'var(--color-text-muted)',
    fontSize: '14px',
  },
};

const paletteStyles: Record<string, h.JSX.CSSProperties> = {
  container: {
    width: '200px',
    borderLeft: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--color-border)',
    fontWeight: 600,
    fontSize: '12px',
    textTransform: 'uppercase',
  },
  grid: {
    flex: 1,
    overflow: 'auto',
    padding: '8px',
  },
  tilesetGroup: {
    marginBottom: '12px',
  },
  tilesetName: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    marginBottom: '4px',
  },
  tiles: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '4px',
  },
  tile: {
    aspectRatio: '1',
    backgroundColor: 'var(--color-bg-tertiary)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    padding: 0,
  },
  tileSelected: {
    backgroundColor: 'var(--color-accent)',
    borderColor: 'var(--color-accent)',
    color: '#fff',
  },
};
