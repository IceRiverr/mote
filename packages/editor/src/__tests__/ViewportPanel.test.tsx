import { h } from 'preact';
import { render, screen, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import { ViewportPanel } from '../ui/panels/ViewportPanel.js';

describe('ViewportPanel', () => {
  it('应该渲染 Canvas', () => {
    render(h(ViewportPanel, {}));
    expect(document.querySelector('canvas')).toBeDefined();
  });

  it('应该渲染工具栏', () => {
    render(h(ViewportPanel, {
      toolbar: h('div', { 'data-testid': 'toolbar' }, 'Tools'),
    }));
    expect(screen.getByTestId('toolbar')).toBeDefined();
  });

  it('应该渲染状态栏', () => {
    render(h(ViewportPanel, {
      statusBar: h('div', { 'data-testid': 'status' }, 'Status'),
    }));
    expect(screen.getByTestId('status')).toBeDefined();
  });

  it('应该渲染叠加层', () => {
    render(h(ViewportPanel, {
      overlay: h('div', { 'data-testid': 'overlay' }, 'Gizmos'),
    }));
    expect(screen.getByTestId('overlay')).toBeDefined();
  });

  it('应该触发点击事件', () => {
    const onClick = vi.fn();
    render(h(ViewportPanel, { onClick }));
    
    const canvas = document.querySelector('canvas')!;
    fireEvent.click(canvas);
    
    expect(onClick).toHaveBeenCalled();
  });

  it('应该有正确的样式类', () => {
    render(h(ViewportPanel, {}));
    
    expect(document.querySelector('canvas')).toBeDefined();
  });
});
