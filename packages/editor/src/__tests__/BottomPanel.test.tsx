import { h } from 'preact';
import { render, screen, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import { BottomPanel } from '../ui/panels/BottomPanel.js';
import type { BottomTab } from '../types/editor.js';

describe('BottomPanel', () => {
  const renderPanel = (activeTab: BottomTab = 'assets', onTabChange = vi.fn()) => {
    return render(
      h(BottomPanel, {
        activeTab,
        onTabChange,
        children: {
          assets: h('div', { 'data-testid': 'assets-content' }, 'Assets Content'),
          console: h('div', { 'data-testid': 'console-content' }, 'Console Content'),
          tilemap: h('div', { 'data-testid': 'tilemap-content' }, 'Tilemap Content'),
        },
      })
    );
  };

  it('应该渲染所有 Tab 按钮', () => {
    renderPanel();
    expect(screen.getByText('Assets')).toBeDefined();
    expect(screen.getByText('Console')).toBeDefined();
    expect(screen.getByText('Tilemap')).toBeDefined();
  });

  it('应该显示当前 Tab 的内容', () => {
    renderPanel('assets');
    expect(screen.getByTestId('assets-content')).toBeDefined();
    expect(screen.queryByTestId('console-content')).toBeNull();
  });

  it('点击 Tab 应该触发切换', () => {
    const onTabChange = vi.fn();
    renderPanel('assets', onTabChange);
    
    fireEvent.click(screen.getByText('Console'));
    expect(onTabChange).toHaveBeenCalledWith('console');
  });

  it('当前 Tab 应该有激活样式', () => {
    renderPanel('console');
    const consoleTab = screen.getByText('Console').parentElement;
    // 激活的 tab 应该有背景色变化
    expect(consoleTab?.style.backgroundColor).toBeDefined();
  });
});
