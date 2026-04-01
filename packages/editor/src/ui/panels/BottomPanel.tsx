import { h, type ComponentChildren } from 'preact';
import type { BottomTab } from '../../types/editor.js';

interface Tab {
  id: BottomTab;
  label: string;
  icon?: string;
}

const TABS: Tab[] = [
  { id: 'assets', label: 'Assets', icon: '📁' },
  { id: 'console', label: 'Console', icon: '📋' },
  { id: 'tilemap', label: 'Tilemap', icon: '🗺️' },
];

interface BottomPanelProps {
  /** 当前激活的 Tab */
  activeTab: BottomTab;
  /** Tab 切换回调 */
  onTabChange: (tab: BottomTab) => void;
  /** Tab 内容 */
  children: Record<BottomTab, ComponentChildren>;
}

/**
 * BottomPanel - 底部面板
 *
 * 可折叠的 Tab 面板，显示 Assets、Console、Tilemap 等内容。
 */
export function BottomPanel({ activeTab, onTabChange, children }: BottomPanelProps) {
  return (
    <div style={panelStyles.container}>
      {/* Tabs */}
      <div style={panelStyles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              ...panelStyles.tab,
              ...(activeTab === tab.id ? panelStyles.tabActive : {}),
            }}
          >
            {tab.icon && <span style={{ marginRight: '4px' }}>{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={panelStyles.content}>
        {children[activeTab]}
      </div>
    </div>
  );
}

const panelStyles: Record<string, h.JSX.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    height: 'var(--tab-height)',
    backgroundColor: 'var(--color-bg-tertiary)',
    borderBottom: '1px solid var(--color-border)',
    flexShrink: 0,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 var(--space-md)',
    backgroundColor: 'transparent',
    border: 'none',
    borderRight: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
    fontSize: 'var(--font-size-sm)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  tabActive: {
    backgroundColor: 'var(--color-bg-secondary)',
    color: 'var(--color-text-primary)',
    borderBottom: '2px solid var(--color-accent)',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: 'var(--space-md)',
  },
};
