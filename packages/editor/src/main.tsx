// Mote Editor - Preact Entry Point with Floating Panels
import { h, render, type ComponentChildren } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { signal } from '@preact/signals';
import { EditorContext, type EditorStore } from './context/EditorContext.js';
import { MockEditorBridge, CommandHistory, SelectionManager, ProjectManager } from './core/index.js';
import { 
  EditorLayout, 
  SceneTreePanel, 
  InspectorPanel, 
  ViewportPanel,
  TilemapEditor,
  FloatingPanel,
  DockedPanel 
} from './ui/index.js';
import type { EditorTool, PlayState, GizmoMode } from './types/editor.js';
import './ui/styles/variables.css';

type PanelType = 'hierarchy' | 'inspector' | 'tilemap' | 'assets' | 'console';

// 创建编辑器状态
function createEditorStore(): EditorStore {
  const bridge = new MockEditorBridge();
  const history = new CommandHistory();
  const selection = new SelectionManager();
  const project = new ProjectManager();

  // 初始化一些测试数据
  const entity1 = bridge.createEntity('Player', {
    Position: { x: 100, y: 200 },
    Sprite: { texture: 'player.png' },
  });
  const entity2 = bridge.createEntity('Enemy', {
    Position: { x: 300, y: 150 },
    Velocity: { dx: 0, dy: 0 },
  });
  bridge.createEntity('Ground', {
    Position: { x: 0, y: 400 },
  });

  // 创建嵌套结构
  const parent = bridge.createEntity('Environment');
  const child1 = bridge.createEntity('Tree');
  const child2 = bridge.createEntity('Rock');
  bridge.reparentEntity(child1, parent);
  bridge.reparentEntity(child2, parent);
  
  // 创建测试用的 tilemap
  bridge.setTilemapData({
    tileSize: 32,
    width: 20,
    height: 15,
    tilesets: [
      { image: '/assets/tiles/grass.png', columns: 8, tilecount: 16 },
      { image: '/assets/tiles/dungeon.png', columns: 8, tilecount: 24 },
    ],
    layers: [
      { name: 'ground', data: new Array(300).fill(0).map(() => Math.floor(Math.random() * 3) + 1) },
      { name: 'objects', data: new Array(300).fill(0) },
    ],
  });

  // 选中第一个实体
  selection.select(entity1);

  // 同步 play state
  const playState = signal<PlayState>('stopped');
  bridge.on('play-state-changed', (state) => {
    playState.value = state as PlayState;
  });

  return {
    bridge,
    history,
    selection,
    project,
    tool: signal<EditorTool>('select'),
    bottomTab: signal('tilemap'),
    isBottomPanelOpen: signal(true),
    showGrid: signal(true),
    zoom: signal(1),
    playState,
    gizmoMode: signal<GizmoMode>('translate'),
  };
}

// Menu Bar 组件
function MenuBar({ 
  store,
  floatingPanels,
  onToggleFloat 
}: { 
  store: EditorStore;
  floatingPanels: Set<PanelType>;
  onToggleFloat: (id: PanelType) => void;
}) {
  const { showGrid, zoom, history, playState } = store;

  const menuBtnStyle = (active: boolean): h.JSX.CSSProperties => ({
    padding: '6px 12px',
    backgroundColor: active ? 'var(--color-accent)' : 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    color: active ? '#fff' : 'var(--color-text-primary)',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  });

  const iconBtnStyle: h.JSX.CSSProperties = {
    padding: '6px 10px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    fontSize: '14px',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '100%',
      padding: '0 12px',
    }}>
      {/* 左侧：Logo 和 Undo/Redo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Logo */}
        <div style={{ 
          fontWeight: 700, 
          fontSize: '14px',
          color: 'var(--color-accent)',
          marginRight: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span>🎮</span>
          <span>Mote</span>
        </div>

        {/* Undo/Redo */}
        <button
          onClick={() => history.undo()}
          disabled={!history.canUndo()}
          style={{ ...iconBtnStyle, opacity: history.canUndo() ? 1 : 0.4 }}
          title="Undo (Ctrl+Z)"
        >
          ↩
        </button>
        <button
          onClick={() => history.redo()}
          disabled={!history.canRedo()}
          style={{ ...iconBtnStyle, opacity: history.canRedo() ? 1 : 0.4 }}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↪
        </button>

        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)', margin: '0 8px' }} />

        {/* 视图控制 */}
        <button
          onClick={() => showGrid.value = !showGrid.value}
          style={menuBtnStyle(showGrid.value)}
          title="Toggle Grid"
        >
          #
        </button>
        <button
          onClick={() => zoom.value = Math.max(0.5, zoom.value - 0.25)}
          style={iconBtnStyle}
          title="Zoom Out"
        >
          −
        </button>
        <span style={{ fontSize: '12px', minWidth: '50px', textAlign: 'center' }}>
          {Math.round(zoom.value * 100)}%
        </span>
        <button
          onClick={() => zoom.value = Math.min(3, zoom.value + 0.25)}
          style={iconBtnStyle}
          title="Zoom In"
        >
          +
        </button>
      </div>

      {/* 中间：播放控制 */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {playState.value === 'stopped' ? (
          <button
            onClick={() => store.bridge.play()}
            style={{
              padding: '6px 20px',
              backgroundColor: 'var(--color-success)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>▶</span>
            <span>Play</span>
          </button>
        ) : (
          <>
            <button
              onClick={() => store.bridge.pause()}
              style={{
                padding: '6px 16px',
                backgroundColor: playState.value === 'playing' ? 'var(--color-warning)' : 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              {playState.value === 'playing' ? '⏸ Pause' : '▶ Resume'}
            </button>
            <button
              onClick={() => store.bridge.stop()}
              style={{
                padding: '6px 16px',
                backgroundColor: 'var(--color-error)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              ⏹ Stop
            </button>
          </>
        )}
      </div>

      {/* 右侧：浮动面板开关 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Float:</span>
        {[
          { id: 'hierarchy' as PanelType, label: 'H' },
          { id: 'inspector' as PanelType, label: 'I' },
          { id: 'tilemap' as PanelType, label: 'T' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onToggleFloat(id)}
            style={{
              width: '28px',
              height: '28px',
              padding: 0,
              backgroundColor: floatingPanels.has(id) ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              color: floatingPanels.has(id) ? '#fff' : 'var(--color-text-primary)',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
            }}
            title={`Float ${id}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// 状态栏组件
function StatusBar({ store }: { store: EditorStore }) {
  const { history, selection, project } = store;
  const selectedCount = selection.selected.value.length;
  const projectName = project.getProjectName() || 'Untitled';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '100%',
      padding: '0 12px',
      fontSize: '12px',
      color: 'var(--color-text-secondary)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span>{selectedCount > 0 ? `${selectedCount} selected` : 'Ready'}</span>
        <span style={{ color: 'var(--color-border)' }}>|</span>
        <span style={{ 
          color: history.canUndo() ? 'var(--color-warning)' : 'var(--color-text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          {history.canUndo() && <span>●</span>}
          {history.canUndo() ? 'Modified' : 'Saved'}
        </span>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span>Project: {projectName}</span>
        <span style={{ color: 'var(--color-border)' }}>|</span>
        <span style={{ color: 'var(--color-accent)' }}>Mote Editor v0.1.0</span>
      </div>
    </div>
  );
}

// 画布渲染器
function CanvasRenderer({ store }: { store: EditorStore }) {
  const canvasRef = (el: HTMLCanvasElement | null) => {
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const tilemap = store.bridge.getTilemapData();
      if (!tilemap) return;

      el.width = tilemap.width * tilemap.tileSize;
      el.height = tilemap.height * tilemap.tileSize;

      // 背景
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(0, 0, el.width, el.height);

      // 网格
      if (store.showGrid.value) {
        ctx.strokeStyle = '#2a2a3c';
        ctx.lineWidth = 1;
        for (let x = 0; x <= tilemap.width; x++) {
          ctx.beginPath();
          ctx.moveTo(x * tilemap.tileSize, 0);
          ctx.lineTo(x * tilemap.tileSize, el.height);
          ctx.stroke();
        }
        for (let y = 0; y <= tilemap.height; y++) {
          ctx.beginPath();
          ctx.moveTo(0, y * tilemap.tileSize);
          ctx.lineTo(el.width, y * tilemap.tileSize);
          ctx.stroke();
        }
      }

      // Tiles
      const layer = tilemap.layers[0];
      if (layer) {
        for (let y = 0; y < tilemap.height; y++) {
          for (let x = 0; x < tilemap.width; x++) {
            const tileId = layer.data[y * tilemap.width + x];
            if (tileId !== 0) {
              const hue = (tileId * 30) % 360;
              ctx.fillStyle = `hsl(${hue}, 60%, 50%)`;
              ctx.fillRect(
                x * tilemap.tileSize + 1,
                y * tilemap.tileSize + 1,
                tilemap.tileSize - 2,
                tilemap.tileSize - 2
              );
            }
          }
        }
      }

      // 选中实体高亮
      store.selection.selected.value.forEach(entityId => {
        const entity = store.bridge.getEntities().find(e => e.id === entityId);
        if (entity && entity.components.includes('Position')) {
          const comps = store.bridge.getComponents(entityId);
          const pos = comps.Position as { x: number; y: number };
          ctx.strokeStyle = '#6bb8ff';
          ctx.lineWidth = 2;
          ctx.strokeRect(pos.x - 16, pos.y - 16, 32, 32);
        }
      });

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  };

  return (
    <canvas
      ref={canvasRef}
      style={{
        maxWidth: '100%',
        maxHeight: '100%',
        boxShadow: '0 0 0 1px var(--color-border)',
        cursor: store.tool.value === 'select' ? 'default' : 'crosshair',
      }}
    />
  );
}

// App 组件
function EditorApp() {
  const [store] = useState(() => createEditorStore());
  
  // 浮动面板状态
  const [floatingPanels, setFloatingPanels] = useState<Set<PanelType>>(new Set());
  const [activePanel, setActivePanel] = useState<PanelType | null>(null);

  // 切换浮动状态
  const toggleFloat = useCallback((id: PanelType) => {
    setFloatingPanels(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setActivePanel(id);
      }
      return next;
    });
  }, []);

  // 关闭浮动面板
  const closeFloat = useCallback((id: PanelType) => {
    setFloatingPanels(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // 渲染浮动面板
  const renderFloatingPanel = (id: PanelType, title: string, content: ComponentChildren) => {
    if (!floatingPanels.has(id)) return null;

    // 使用 safe window dimensions
    const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;

    // 右侧面板列的 x 坐标（竖向排列）
    const rightColumnX = Math.max(50, winWidth - 350);

    const positions: Record<PanelType, { x: number; y: number }> = {
      hierarchy: { x: 50, y: 50 },
      inspector: { x: rightColumnX, y: 50 },  // 右上角第一个
      tilemap: { x: rightColumnX, y: 570 },   // 右下角，在 Inspector 下方
      assets: { x: 100, y: 100 },
      console: { x: 200, y: 200 },
    };

    const sizes: Record<PanelType, { width: number; height: number }> = {
      hierarchy: { width: 260, height: 400 },
      inspector: { width: 320, height: 500 },
      tilemap: { width: 320, height: 400 },   // 与 Inspector 同宽，竖向排列
      assets: { width: 300, height: 400 },
      console: { width: 500, height: 300 },
    };

    return (
      <FloatingPanel
        id={id}
        title={title}
        defaultPosition={positions[id]}
        defaultWidth={sizes[id].width}
        defaultHeight={sizes[id].height}
        onClose={() => closeFloat(id)}
        onFocus={() => setActivePanel(id)}
        isActive={activePanel === id}
      >
        {content}
      </FloatingPanel>
    );
  };

  return (
    <EditorContext.Provider value={store}>
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        {/* 浮动面板层 - pointerEvents: 'none' 让点击穿透到下层 */}
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          zIndex: 1000,
          pointerEvents: 'none',
        }}>
          {renderFloatingPanel('hierarchy', 'Hierarchy', 
            <SceneTreePanel isFloating={true} />
          )}
          {renderFloatingPanel('inspector', 'Inspector', 
            <InspectorPanel isFloating={true} />
          )}
          {renderFloatingPanel('tilemap', 'Tile Sets', 
            <TilemapEditor />
          )}
        </div>

        {/* 主布局（停靠面板） */}
        <EditorLayout
          menuBar={
            <MenuBar 
              store={store} 
              floatingPanels={floatingPanels}
              onToggleFloat={toggleFloat}
            />
          }
          leftPanel={
            !floatingPanels.has('hierarchy') ? (
              <DockedPanel 
                title="Hierarchy"
                onUndock={() => toggleFloat('hierarchy')}
              >
                <SceneTreePanel isFloating={false} />
              </DockedPanel>
            ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
              <button 
                onClick={() => toggleFloat('hierarchy')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--color-bg-tertiary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                }}
              >
                Restore Hierarchy
              </button>
            </div>
          }
          viewport={
            <ViewportPanel
              toolbar={null}
              statusBar={<StatusBar store={store} />}
              overlay={null}
            >
              <CanvasRenderer store={store} />
            </ViewportPanel>
          }
          rightPanel={
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Inspector 面板 */}
              {!floatingPanels.has('inspector') ? (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <DockedPanel 
                    title="Inspector"
                    onUndock={() => toggleFloat('inspector')}
                  >
                    <InspectorPanel isFloating={false} />
                  </DockedPanel>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                  <button 
                    onClick={() => toggleFloat('inspector')}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'var(--color-bg-tertiary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    Restore Inspector
                  </button>
                </div>
              )}
              
              {/* 分割线 */}
              <div style={{ height: '4px', backgroundColor: 'var(--color-border)', cursor: 'ns-resize' }} />
              
              {/* Tile Sets 面板 */}
              {!floatingPanels.has('tilemap') ? (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <DockedPanel 
                    title="Tile Sets"
                    onUndock={() => toggleFloat('tilemap')}
                  >
                    <TilemapEditor compact={true} />
                  </DockedPanel>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                  <button 
                    onClick={() => toggleFloat('tilemap')}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'var(--color-bg-tertiary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    Restore Tile Sets
                  </button>
                </div>
              )}
            </div>
          }
          bottomPanel={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
              <span>Bottom Panel (Tile Sets moved to right sidebar)</span>
            </div>
          }
          isBottomPanelOpen={store.isBottomPanelOpen.value && !floatingPanels.has('tilemap')}
        />
      </div>
    </EditorContext.Provider>
  );
}

// 渲染应用
const appContainer = document.getElementById('app');
if (appContainer) {
  render(<EditorApp />, appContainer);
} else {
  console.error('Could not find #app container');
}

// Export for external access
export { EditorApp, createEditorStore };
