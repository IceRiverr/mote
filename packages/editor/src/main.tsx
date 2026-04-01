// Mote Editor - Preact Entry Point
import { h, render } from 'preact';
import { signal } from '@preact/signals';
import { EditorContext, type EditorStore } from './context/EditorContext.js';
import { MockEditorBridge, CommandHistory, SelectionManager, ProjectManager } from './core/index.js';
import { EditorLayout, SceneTreePanel, InspectorPanel, ViewportPanel, BottomPanel, TilemapEditor } from './ui/index.js';
import type { EditorTool, BottomTab, PlayState, GizmoMode } from './types/editor.js';
import './ui/styles/variables.css';

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
    bottomTab: signal<BottomTab>('tilemap'),
    isBottomPanelOpen: signal(true),
    showGrid: signal(true),
    zoom: signal(1),
    playState,
    gizmoMode: signal<GizmoMode>('translate'),
  };
}

// App 组件
function EditorApp() {
  const store = createEditorStore();
  
  // 工具栏组件
  const Toolbar = () => {
    const { tool, showGrid, zoom, history, playState } = store;
    
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        height: '100%',
      }}>
        {/* 工具选择 */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { id: 'select', icon: '↖', label: 'Select' },
            { id: 'brush', icon: '🖌️', label: 'Brush' },
            { id: 'eraser', icon: '🧼', label: 'Eraser' },
            { id: 'rect', icon: '▭', label: 'Rect' },
          ].map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => { tool.value = id as EditorTool; }}
              style={{
                padding: '4px 12px',
                backgroundColor: tool.value === id ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: tool.value === id ? '#fff' : 'var(--color-text-primary)',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* 分隔线 */}
        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--color-border)' }} />

        {/* Undo/Redo */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => history.undo()}
            disabled={!history.canUndo()}
            style={{
              padding: '4px 12px',
              backgroundColor: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              color: history.canUndo() ? 'var(--color-text-primary)' : 'var(--color-text-disabled)',
              cursor: history.canUndo() ? 'pointer' : 'not-allowed',
              fontSize: '12px',
            }}
          >
            ↩ Undo
          </button>
          <button
            onClick={() => history.redo()}
            disabled={!history.canRedo()}
            style={{
              padding: '4px 12px',
              backgroundColor: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              color: history.canRedo() ? 'var(--color-text-primary)' : 'var(--color-text-disabled)',
              cursor: history.canRedo() ? 'pointer' : 'not-allowed',
              fontSize: '12px',
            }}
          >
            ↪ Redo
          </button>
        </div>

        {/* 分隔线 */}
        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--color-border)' }} />

        {/* 视图控制 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => showGrid.value = !showGrid.value}
            style={{
              padding: '4px 12px',
              backgroundColor: showGrid.value ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              color: showGrid.value ? '#fff' : 'var(--color-text-primary)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            # Grid
          </button>
          <button
            onClick={() => zoom.value = Math.max(0.5, zoom.value - 0.25)}
            style={{
              padding: '4px 8px',
              backgroundColor: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            -
          </button>
          <span style={{ fontSize: '12px', minWidth: '50px', textAlign: 'center' }}>
            {Math.round(zoom.value * 100)}%
          </span>
          <button
            onClick={() => zoom.value = Math.min(3, zoom.value + 0.25)}
            style={{
              padding: '4px 8px',
              backgroundColor: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            +
          </button>
        </div>

        {/* 分隔线 */}
        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--color-border)' }} />

        {/* 播放控制 */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {playState.value === 'stopped' ? (
            <button
              onClick={() => store.bridge.play()}
              style={{
                padding: '4px 16px',
                backgroundColor: 'var(--color-success)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              ▶ Play
            </button>
          ) : (
            <>
              <button
                onClick={() => store.bridge.pause()}
                style={{
                  padding: '4px 12px',
                  backgroundColor: playState.value === 'playing' ? 'var(--color-warning)' : 'var(--color-bg-tertiary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ⏸ {playState.value === 'playing' ? 'Pause' : 'Resume'}
              </button>
              <button
                onClick={() => store.bridge.stop()}
                style={{
                  padding: '4px 12px',
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
      </div>
    );
  };

  // 状态栏组件
  const StatusBar = () => {
    const { history, selection } = store;
    const selectedCount = selection.selected.value.length;

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        height: '100%',
        fontSize: '12px',
        color: 'var(--color-text-secondary)',
      }}>
        <span>{selectedCount > 0 ? `${selectedCount} selected` : 'Ready'}</span>
        <span style={{ color: 'var(--color-border)' }}>|</span>
        <span style={{ color: history.canUndo() ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
          {history.canUndo() ? 'Modified' : 'Saved'}
        </span>
        <span style={{ color: 'var(--color-border)' }}>|</span>
        <span>Project: Untitled</span>
      </div>
    );
  };

  // 画布渲染器（简化版）
  const CanvasRenderer = () => {
    const canvasRef = (el: HTMLCanvasElement | null) => {
      if (!el) return;
      const ctx = el.getContext('2d');
      if (!ctx) return;

      // 简单的渲染循环
      const render = () => {
        const tilemap = store.bridge.getTilemapData();
        if (!tilemap) return;

        // 设置画布大小
        el.width = tilemap.width * tilemap.tileSize;
        el.height = tilemap.height * tilemap.tileSize;

        // 清空
        ctx.fillStyle = '#1e1e2e';
        ctx.fillRect(0, 0, el.width, el.height);

        // 绘制网格
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

        // 绘制 tiles（简化：只显示第一个图层）
        const layer = tilemap.layers[0];
        if (layer) {
          for (let y = 0; y < tilemap.height; y++) {
            for (let x = 0; x < tilemap.width; x++) {
              const tileId = layer.data[y * tilemap.width + x];
              if (tileId !== 0) {
                // 根据 tileId 生成颜色
                const hue = (tileId * 30) % 360;
                ctx.fillStyle = `hsl(${hue}, 60%, 50%)`;
                ctx.fillRect(
                  x * tilemap.tileSize,
                  y * tilemap.tileSize,
                  tilemap.tileSize - 1,
                  tilemap.tileSize - 1
                );
              }
            }
          }
        }

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
        }}
      />
    );
  };

  return (
    <EditorContext.Provider value={store}>
      <EditorLayout
        menuBar={<Toolbar />}
        leftPanel={<SceneTreePanel />}
        viewport={
          <ViewportPanel
            toolbar={null}
            statusBar={<StatusBar />}
            overlay={null}
          >
            <CanvasRenderer />
          </ViewportPanel>
        }
        rightPanel={<InspectorPanel />}
        bottomPanel={
          <BottomPanel
            activeTab={store.bottomTab.value}
            onTabChange={(tab) => { store.bottomTab.value = tab; }}
          >
            {{
              tilemap: <TilemapEditor />,
              assets: <div style={{ padding: '20px', color: 'var(--color-text-muted)' }}>Assets Browser (Coming Soon)</div>,
              console: <div style={{ padding: '20px', color: 'var(--color-text-muted)' }}>Console (Coming Soon)</div>,
            }}
          </BottomPanel>
        }
        isBottomPanelOpen={store.isBottomPanelOpen.value}
      />
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
