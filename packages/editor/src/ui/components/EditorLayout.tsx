import { h, type ComponentChildren } from 'preact';
import { useState, useCallback, useEffect } from 'preact/hooks';
import '../styles/variables.css';

interface EditorLayoutProps {
  /** 菜单栏 */
  menuBar: ComponentChildren;
  /** 左侧面板（Scene Tree） */
  leftPanel: ComponentChildren;
  /** 中央视口 */
  viewport: ComponentChildren;
  /** 右侧面板（Inspector） */
  rightPanel: ComponentChildren;
  /** 底部面板 */
  bottomPanel: ComponentChildren;
  /** 是否显示底部面板 */
  isBottomPanelOpen: boolean;
  /** 初始左侧面板宽度 */
  initialSidebarWidth?: number;
  /** 初始右侧面板宽度 */
  initialInspectorWidth?: number;
  /** 初始底部面板高度 */
  initialBottomHeight?: number;
  /** 面板大小变化回调 */
  onLayoutChange?: (layout: {
    sidebarWidth: number;
    inspectorWidth: number;
    bottomHeight: number;
  }) => void;
}

/**
 * EditorLayout - 编辑器主布局
 * 
 * 使用 CSS Grid 实现三栏布局，支持拖拽调整面板大小。
 * 
 * ```
 * ┌─────────────────────────────────────────────────────────┐
 * │  MenuBar                                                │
 * ├───────────┬───────────────────────────┬─────────────────┤
 * │           │                           │                 │
 * │  Left     │       Viewport            │   Right         │
 * │  Panel    │       (Canvas)            │   Panel         │
 * │  ~220px   │       flex: 1             │   ~280px        │
 * │           │                           │                 │
 * ├───────────┴───────────────────────────┴─────────────────┤
 * │  Bottom Panel (可折叠)                                   │
 * └─────────────────────────────────────────────────────────┘
 * ```
 */
export function EditorLayout({
  menuBar,
  leftPanel,
  viewport,
  rightPanel,
  bottomPanel,
  isBottomPanelOpen,
  initialSidebarWidth = 220,
  initialInspectorWidth = 280,
  initialBottomHeight = 200,
  onLayoutChange,
}: EditorLayoutProps) {
  // 面板尺寸状态
  const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth);
  const [inspectorWidth, setInspectorWidth] = useState(initialInspectorWidth);
  const [bottomHeight, setBottomHeight] = useState(initialBottomHeight);
  
  // 拖拽状态
  const [isDragging, setIsDragging] = useState<'left' | 'right' | 'bottom' | null>(null);

  // 通知布局变化
  useEffect(() => {
    onLayoutChange?.({ sidebarWidth, inspectorWidth, bottomHeight });
  }, [sidebarWidth, inspectorWidth, bottomHeight, onLayoutChange]);

  // 左侧面板拖拽
  const handleLeftResizeStart = useCallback(() => {
    setIsDragging('left');
  }, []);

  // 右侧面板拖拽
  const handleRightResizeStart = useCallback(() => {
    setIsDragging('right');
  }, []);

  // 底部面板拖拽
  const handleBottomResizeStart = useCallback(() => {
    setIsDragging('bottom');
  }, []);

  // 全局鼠标移动处理
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging === 'left') {
        const newWidth = Math.max(160, Math.min(400, e.clientX));
        setSidebarWidth(newWidth);
      } else if (isDragging === 'right') {
        const newWidth = Math.max(200, Math.min(500, window.innerWidth - e.clientX));
        setInspectorWidth(newWidth);
      } else if (isDragging === 'bottom') {
        const rect = document.querySelector('.mote-layout__main')?.getBoundingClientRect();
        if (rect) {
          const newHeight = Math.max(100, Math.min(600, rect.bottom - e.clientY));
          setBottomHeight(newHeight);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // 拖拽时禁用选择
    document.body.style.userSelect = 'none';
    document.body.style.cursor = isDragging === 'bottom' ? 'ns-resize' : 'ew-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging]);

  return (
    <div class="mote-editor mote-layout" style={layoutStyles.container}>
      {/* Menu Bar */}
      <div class="mote-layout__menubar" style={layoutStyles.menubar}>
        {menuBar}
      </div>

      {/* Main Content */}
      <div class="mote-layout__main" style={layoutStyles.main}>
        {/* Left Panel */}
        <div 
          class="mote-layout__left" 
          style={{ ...layoutStyles.left, width: sidebarWidth }}
        >
          {leftPanel}
        </div>

        {/* Left Resizer */}
        <div
          class="mote-layout__resizer mote-layout__resizer--vertical"
          style={{
            ...layoutStyles.resizerVertical,
            cursor: isDragging === 'left' ? 'ew-resize' : undefined,
          }}
          onMouseDown={handleLeftResizeStart}
        />

        {/* Center Viewport */}
        <div class="mote-layout__center" style={layoutStyles.center}>
          {viewport}
        </div>

        {/* Right Resizer */}
        <div
          class="mote-layout__resizer mote-layout__resizer--vertical"
          style={{
            ...layoutStyles.resizerVertical,
            cursor: isDragging === 'right' ? 'ew-resize' : undefined,
          }}
          onMouseDown={handleRightResizeStart}
        />

        {/* Right Panel */}
        <div 
          class="mote-layout__right" 
          style={{ ...layoutStyles.right, width: inspectorWidth }}
        >
          {rightPanel}
        </div>
      </div>

      {/* Bottom Resizer */}
      {isBottomPanelOpen && (
        <div
          class="mote-layout__resizer mote-layout__resizer--horizontal"
          style={{
            ...layoutStyles.resizerHorizontal,
            cursor: isDragging === 'bottom' ? 'ns-resize' : undefined,
          }}
          onMouseDown={handleBottomResizeStart}
        />
      )}

      {/* Bottom Panel */}
      {isBottomPanelOpen && (
        <div 
          class="mote-layout__bottom" 
          style={{ ...layoutStyles.bottom, height: bottomHeight }}
        >
          {bottomPanel}
        </div>
      )}
    </div>
  );
}

// 样式对象
const layoutStyles: Record<string, h.JSX.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: 'var(--color-bg-primary)',
  },
  menubar: {
    flexShrink: 0,
    height: 'var(--menubar-height)',
    backgroundColor: 'var(--color-bg-secondary)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 var(--space-md)',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  },
  left: {
    flexShrink: 0,
    backgroundColor: 'var(--color-bg-secondary)',
    borderRight: '1px solid var(--color-border)',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  center: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'var(--color-bg-primary)',
  },
  right: {
    flexShrink: 0,
    backgroundColor: 'var(--color-bg-secondary)',
    borderLeft: '1px solid var(--color-border)',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  bottom: {
    flexShrink: 0,
    backgroundColor: 'var(--color-bg-secondary)',
    borderTop: '1px solid var(--color-border)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  resizerVertical: {
    width: '4px',
    backgroundColor: 'transparent',
    cursor: 'ew-resize',
    transition: 'background-color var(--transition-fast)',
    zIndex: 10,
  },
  resizerHorizontal: {
    height: '4px',
    backgroundColor: 'transparent',
    cursor: 'ns-resize',
    transition: 'background-color var(--transition-fast)',
    zIndex: 10,
  },
};
