import { h, type ComponentChildren } from 'preact';
import { useRef, useEffect } from 'preact/hooks';

interface ViewportPanelProps {
  /** Canvas 元素（由引擎渲染） */
  canvas?: HTMLCanvasElement;
  /** 顶部工具栏 */
  toolbar?: ComponentChildren;
  /** 底部信息栏 */
  statusBar?: ComponentChildren;
  /** 叠加层内容（如 Gizmos） */
  overlay?: ComponentChildren;
  /** 点击回调 */
  onClick?: (e: MouseEvent) => void;
  /** 拖拽开始回调 */
  onPointerDown?: (e: PointerEvent) => void;
  /** 拖拽移动回调 */
  onPointerMove?: (e: PointerEvent) => void;
  /** 拖拽结束回调 */
  onPointerUp?: (e: PointerEvent) => void;
}

/**
 * ViewportPanel - 中央视口面板
 * 
 * 包含 Canvas 渲染区域和可选的 Gizmo 叠加层。
 * 所有输入事件传递给编辑器处理。
 */
export function ViewportPanel({
  canvas,
  toolbar,
  statusBar,
  overlay,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: ViewportPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 如果提供了 canvas 元素，将其挂载到容器
  useEffect(() => {
    if (canvas && canvasRef.current) {
      // 替换内部的 canvas 为引擎提供的 canvas
      const parent = canvasRef.current.parentElement;
      if (parent) {
        parent.replaceChild(canvas, canvasRef.current);
        canvasRef.current = canvas;
      }
    }
  }, [canvas]);

  return (
    <div ref={containerRef} style={panelStyles.container}>
      {/* Toolbar */}
      {toolbar && (
        <div style={panelStyles.toolbar}>
          {toolbar}
        </div>
      )}

      {/* Canvas Container */}
      <div
        style={panelStyles.canvasContainer}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <canvas
          ref={canvasRef}
          style={panelStyles.canvas}
        />

        {/* Overlay (Gizmos) */}
        {overlay && (
          <div style={panelStyles.overlay}>
            {overlay}
          </div>
        )}
      </div>

      {/* Status Bar */}
      {statusBar && (
        <div style={panelStyles.statusBar}>
          {statusBar}
        </div>
      )}
    </div>
  );
}

const panelStyles: Record<string, h.JSX.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  toolbar: {
    height: 'var(--toolbar-height)',
    backgroundColor: 'var(--color-bg-secondary)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 var(--space-md)',
    flexShrink: 0,
  },
  canvasContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-bg-primary)',
  },
  canvas: {
    maxWidth: '100%',
    maxHeight: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  statusBar: {
    height: '24px',
    backgroundColor: 'var(--color-bg-secondary)',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 var(--space-md)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
    flexShrink: 0,
  },
};
