import { h, type ComponentChildren } from 'preact';
import { useState, useCallback, useRef } from 'preact/hooks';
import { FloatingPanel, DockedPanel } from './FloatingPanel.js';

export type PanelType = 'hierarchy' | 'inspector' | 'tilemap' | 'assets' | 'console';

interface PanelConfig {
  id: PanelType;
  title: string;
  icon?: string;
  defaultFloating: boolean;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  allowFloat: boolean;
  allowDock: boolean;
}

interface FloatingLayoutProps {
  children: {
    hierarchy: ComponentChildren;
    inspector: ComponentChildren;
    tilemap: ComponentChildren;
    assets: ComponentChildren;
    console: ComponentChildren;
  };
  /** 面板配置 */
  panelConfigs?: Partial<Record<PanelType, Partial<PanelConfig>>>;
  /** 面板状态变化回调 */
  onPanelStateChange?: (id: PanelType, isFloating: boolean) => void;
}

const defaultConfigs: Record<PanelType, PanelConfig> = {
  hierarchy: {
    id: 'hierarchy',
    title: 'Hierarchy',
    icon: '📁',
    defaultFloating: false,
    allowFloat: true,
    allowDock: true,
  },
  inspector: {
    id: 'inspector',
    title: 'Inspector',
    icon: '🔍',
    defaultFloating: false,
    allowFloat: true,
    allowDock: true,
  },
  tilemap: {
    id: 'tilemap',
    title: 'Tile Sets',
    icon: '🗺️',
    defaultFloating: false,
    allowFloat: true,
    allowDock: true,
  },
  assets: {
    id: 'assets',
    title: 'Assets',
    icon: '📦',
    defaultFloating: false,
    allowFloat: true,
    allowDock: true,
  },
  console: {
    id: 'console',
    title: 'Console',
    icon: '📋',
    defaultFloating: false,
    allowFloat: true,
    allowDock: true,
  },
};

/**
 * FloatingLayout - 浮动布局管理器
 * 
 * 管理所有面板的浮动/停靠状态
 */
export function FloatingLayout({
  children,
  panelConfigs = {},
  onPanelStateChange,
}: FloatingLayoutProps) {
  // 合并配置
  const configs = useRef<Record<PanelType, PanelConfig>>(
    (Object.keys(defaultConfigs) as PanelType[]).reduce((acc, key) => {
      acc[key] = { ...defaultConfigs[key], ...panelConfigs[key] };
      return acc;
    }, {} as Record<PanelType, PanelConfig>)
  );

  // 面板浮动状态
  const [floatingState, setFloatingState] = useState<Record<PanelType, boolean>>(() =>
    (Object.keys(defaultConfigs) as PanelType[]).reduce((acc, key) => {
      acc[key] = configs.current[key].defaultFloating;
      return acc;
    }, {} as Record<PanelType, boolean>)
  );

  // 当前激活的浮动面板
  const [activePanel, setActivePanel] = useState<PanelType | null>(null);

  // 切换浮动状态
  const toggleFloat = useCallback((id: PanelType) => {
    setFloatingState(prev => {
      const newState = { ...prev, [id]: !prev[id] };
      onPanelStateChange?.(id, newState[id]);
      return newState;
    });
  }, [onPanelStateChange]);

  // 关闭浮动面板（恢复到停靠）
  const closeFloat = useCallback((id: PanelType) => {
    setFloatingState(prev => {
      const newState = { ...prev, [id]: false };
      onPanelStateChange?.(id, false);
      return newState;
    });
  }, [onPanelStateChange]);

  // 渲染浮动面板
  const renderFloatingPanel = (id: PanelType, content: ComponentChildren) => {
    const config = configs.current[id];
    if (!floatingState[id]) return null;

    return (
      <FloatingPanel
        id={id}
        title={config.title}
        defaultPosition={config.defaultPosition}
        defaultWidth={config.defaultSize?.width}
        defaultHeight={config.defaultSize?.height}
        onClose={() => closeFloat(id)}
        onFocus={() => setActivePanel(id)}
        isActive={activePanel === id}
      >
        {content}
      </FloatingPanel>
    );
  };

  // 渲染停靠面板
  const renderDockedPanel = (id: PanelType, content: ComponentChildren) => {
    const config = configs.current[id];
    if (floatingState[id]) return null;

    return (
      <DockedPanel
        title={config.title}
        onUndock={config.allowFloat ? () => toggleFloat(id) : undefined}
      >
        {content}
      </DockedPanel>
    );
  };

  return (
    <div class="floating-layout" style={layoutStyles.container}>
      {/* 浮动面板层 */}
      <div style={layoutStyles.floatingLayer}>
        {renderFloatingPanel('hierarchy', children.hierarchy)}
        {renderFloatingPanel('inspector', children.inspector)}
        {renderFloatingPanel('tilemap', children.tilemap)}
        {renderFloatingPanel('assets', children.assets)}
        {renderFloatingPanel('console', children.console)}
      </div>

      {/* 主布局（停靠面板） */}
      <div style={layoutStyles.mainLayout}>
        {/* 左侧停靠区 */}
        <div style={layoutStyles.leftDock}>
          {renderDockedPanel('hierarchy', children.hierarchy)}
        </div>

        {/* 中央区域 */}
        <div style={layoutStyles.center}>
          {/* Viewport 等主内容 */}
        </div>

        {/* 右侧停靠区 */}
        <div style={layoutStyles.rightDock}>
          {renderDockedPanel('inspector', children.inspector)}
        </div>

        {/* 底部停靠区 */}
        <div style={layoutStyles.bottomDock}>
          {renderDockedPanel('tilemap', children.tilemap)}
          {renderDockedPanel('assets', children.assets)}
          {renderDockedPanel('console', children.console)}
        </div>
      </div>
    </div>
  );
}

const layoutStyles: Record<string, h.JSX.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
  },
  floatingLayer: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    zIndex: 1000,
  },
  mainLayout: {
    display: 'grid',
    gridTemplateColumns: '220px 1fr 280px',
    gridTemplateRows: '1fr 200px',
    gridTemplateAreas: `
      'left center right'
      'bottom bottom bottom'
    `,
    width: '100%',
    height: '100%',
  },
  leftDock: {
    gridArea: 'left',
    overflow: 'hidden',
    borderRight: '1px solid var(--color-border)',
  },
  center: {
    gridArea: 'center',
    overflow: 'hidden',
  },
  rightDock: {
    gridArea: 'right',
    overflow: 'hidden',
    borderLeft: '1px solid var(--color-border)',
  },
  bottomDock: {
    gridArea: 'bottom',
    display: 'flex',
    overflow: 'hidden',
    borderTop: '1px solid var(--color-border)',
  },
};

// 为浮动面板层添加 pointer-events
const style = document.createElement('style');
style.textContent = `
  .floating-layer > * {
    pointer-events: auto;
  }
`;
document.head.appendChild(style);
