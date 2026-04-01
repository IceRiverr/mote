import { h, type ComponentChildren } from 'preact';
import { useState, useCallback, useRef, useEffect } from 'preact/hooks';

export type PanelPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PanelState = {
  id: string;
  title: string;
  isFloating: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  position: PanelPosition;
  zIndex: number;
};

interface FloatingPanelProps {
  id: string;
  title: string;
  children: ComponentChildren;
  defaultPosition?: Partial<PanelPosition>;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onFocus?: () => void;
  isActive?: boolean;
  className?: string;
}

/**
 * FloatingPanel - 可浮动面板组件
 * 
 * 支持拖拽移动、调整大小、最小化、最大化、关闭
 */
export function FloatingPanel({
  id,
  title,
  children,
  defaultPosition = {},
  defaultWidth = 300,
  defaultHeight = 400,
  minWidth = 200,
  minHeight = 150,
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
  isActive = false,
  className = '',
}: FloatingPanelProps) {
  const [position, setPosition] = useState<PanelPosition>({
    x: defaultPosition.x ?? 100,
    y: defaultPosition.y ?? 100,
    width: defaultPosition.width ?? defaultWidth,
    height: defaultPosition.height ?? defaultHeight,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // 使用 ref 获取标题栏元素并绑定原生事件
  const headerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const handleMouseDown = (e: globalThis.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.panel-controls')) return;
      e.preventDefault();
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
      onFocus?.();
    };

    header.addEventListener('mousedown', handleMouseDown);
    return () => header.removeEventListener('mousedown', handleMouseDown);
  }, [position, onFocus]);

  // 处理调整大小
  const handleResizeMouseDown = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: position.width,
      height: position.height,
    });
  }, [position]);

  // 全局鼠标移动
  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition(prev => ({
          ...prev,
          x: Math.max(0, e.clientX - dragStart.x),
          y: Math.max(0, e.clientY - dragStart.y),
        }));
      } else if (isResizing) {
        const newWidth = Math.max(minWidth, resizeStart.width + e.clientX - resizeStart.x);
        const newHeight = Math.max(minHeight, resizeStart.height + e.clientY - resizeStart.y);
        setPosition(prev => ({
          ...prev,
          width: newWidth,
          height: newHeight,
        }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, isResizing, dragStart, resizeStart, minWidth, minHeight]);

  return (
    <div
      ref={panelRef}
      data-panel-id={id}
      class={`floating-panel ${isActive ? 'active' : ''} ${className}`}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: position.width,
        height: position.height,
        zIndex: isActive ? 1000 : 100,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-bg-secondary)',
        border: `1px solid ${isActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
        pointerEvents: 'auto',  // 恢复点击事件
        borderRadius: 'var(--radius-md)',
        boxShadow: isActive 
          ? '0 8px 32px rgba(0,0,0,0.4)' 
          : '0 4px 16px rgba(0,0,0,0.3)',
        transition: isDragging || isResizing ? 'none' : 'box-shadow 0.15s ease',
      }}
      onMouseDown={() => onFocus?.()}
    >
      {/* 标题栏 */}
      <div
        ref={headerRef}
        class="floating-panel-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: isActive ? 'var(--color-bg-tertiary)' : 'var(--color-bg-hover)',
          borderBottom: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          pointerEvents: 'auto',  // 确保标题栏可以接收事件
        }}
      >
        <span style={{ 
          flex: 1, 
          fontWeight: 600, 
          fontSize: '12px',
          color: 'var(--color-text-primary)',
        }}>
          {title}
        </span>
        
        <div class="panel-controls" style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={onMinimize}
            style={controlBtnStyle}
            title="Minimize"
          >
            ─
          </button>
          <button
            onClick={onMaximize}
            style={controlBtnStyle}
            title="Maximize"
          >
            □
          </button>
          <button
            onClick={onClose}
            style={{ ...controlBtnStyle, color: 'var(--color-error)' }}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div
        class="floating-panel-content"
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {children}
      </div>

      {/* 调整大小手柄 */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '16px',
          height: '16px',
          cursor: 'nwse-resize',
          background: `linear-gradient(135deg, transparent 50%, var(--color-border) 50%)`,
          borderRadius: '0 0 var(--radius-md) 0',
        }}
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  );
}

const controlBtnStyle: h.JSX.CSSProperties = {
  width: '20px',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  fontSize: '14px',
  lineHeight: 1,
  padding: 0,
};

/**
 * DockedPanel - 停靠面板（用于非浮动状态）
 */
interface DockedPanelProps {
  title: string;
  children: ComponentChildren;
  onUndock?: () => void;
  className?: string;
}

export function DockedPanel({ title, children, onUndock, className = '' }: DockedPanelProps) {
  return (
    <div 
      class={`docked-panel ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--color-bg-secondary)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: 'var(--color-bg-tertiary)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span style={{ 
          flex: 1, 
          fontWeight: 600, 
          fontSize: '12px',
          textTransform: 'uppercase',
        }}>
          {title}
        </span>
        {onUndock && (
          <button
            onClick={onUndock}
            style={{
              ...controlBtnStyle,
              fontSize: '12px',
            }}
            title="Float"
          >
            ⧉
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
}
