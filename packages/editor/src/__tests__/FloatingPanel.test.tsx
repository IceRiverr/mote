import { h } from 'preact';
import { render, screen, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import { FloatingPanel, DockedPanel } from '../ui/components/FloatingPanel.js';

describe('FloatingPanel', () => {
  it('应该渲染标题', () => {
    render(
      h(FloatingPanel, {
        id: 'test',
        title: 'Test Panel',
      }, 'Content')
    );
    expect(screen.getByText('Test Panel')).toBeDefined();
  });

  it('应该渲染子内容', () => {
    render(
      h(FloatingPanel, {
        id: 'test',
        title: 'Test Panel',
      }, h('div', { 'data-testid': 'content' }, 'Panel Content'))
    );
    expect(screen.getByTestId('content')).toBeDefined();
  });

  it('点击关闭按钮应该触发 onClose', () => {
    const onClose = vi.fn();
    render(
      h(FloatingPanel, {
        id: 'test',
        title: 'Test Panel',
        onClose,
      }, 'Content')
    );
    
    // 关闭按钮是 ×
    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('点击最小化按钮应该触发 onMinimize', () => {
    const onMinimize = vi.fn();
    render(
      h(FloatingPanel, {
        id: 'test',
        title: 'Test Panel',
        onMinimize,
      }, 'Content')
    );
    
    const minimizeBtn = screen.getByTitle('Minimize');
    fireEvent.click(minimizeBtn);
    
    expect(onMinimize).toHaveBeenCalled();
  });

  it('点击面板应该触发 onFocus', () => {
    const onFocus = vi.fn();
    render(
      h(FloatingPanel, {
        id: 'test',
        title: 'Test Panel',
        onFocus,
      }, 'Content')
    );
    
    const panel = document.querySelector('.floating-panel');
    fireEvent.mouseDown(panel!);
    
    expect(onFocus).toHaveBeenCalled();
  });

  it('激活状态应该有不同样式', () => {
    const { container } = render(
      h(FloatingPanel, {
        id: 'test',
        title: 'Test Panel',
        isActive: true,
      }, 'Content')
    );
    
    const panel = container.querySelector('.floating-panel');
    expect(panel?.classList.contains('active')).toBe(true);
  });

  it('应该有调整大小手柄', () => {
    const { container } = render(
      h(FloatingPanel, {
        id: 'test',
        title: 'Test Panel',
      }, 'Content')
    );
    
    // 检查是否有 resize 手柄（通过样式判断）
    const panel = container.querySelector('.floating-panel');
    const resizeHandle = panel?.querySelector('[style*="nwse-resize"]');
    expect(resizeHandle).toBeDefined();
  });

  it('应该有控制按钮', () => {
    render(
      h(FloatingPanel, {
        id: 'test',
        title: 'Test Panel',
      }, 'Content')
    );
    
    expect(screen.getByTitle('Minimize')).toBeDefined();
    expect(screen.getByTitle('Maximize')).toBeDefined();
    expect(screen.getByTitle('Close')).toBeDefined();
  });
});

describe('DockedPanel', () => {
  it('应该渲染标题', () => {
    render(
      h(DockedPanel, {
        title: 'Docked Panel',
      }, 'Content')
    );
    expect(screen.getByText('Docked Panel')).toBeDefined();
  });

  it('应该渲染子内容', () => {
    render(
      h(DockedPanel, {
        title: 'Docked Panel',
      }, h('div', { 'data-testid': 'docked-content' }, 'Content'))
    );
    expect(screen.getByTestId('docked-content')).toBeDefined();
  });

  it('有 onUndock 时应该显示浮动按钮', () => {
    const onUndock = vi.fn();
    render(
      h(DockedPanel, {
        title: 'Docked Panel',
        onUndock,
      }, 'Content')
    );
    
    // 浮动按钮
    const floatBtn = screen.getByTitle('Float');
    expect(floatBtn).toBeDefined();
    
    fireEvent.click(floatBtn);
    expect(onUndock).toHaveBeenCalled();
  });

  it('无 onUndock 时不应该显示浮动按钮', () => {
    render(
      h(DockedPanel, {
        title: 'Docked Panel',
      }, 'Content')
    );
    
    expect(screen.queryByTitle('Float')).toBeNull();
  });
});
