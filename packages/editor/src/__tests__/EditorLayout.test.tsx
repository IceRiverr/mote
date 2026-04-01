import { h } from 'preact';
import { render, screen } from '@testing-library/preact';
import { EditorLayout } from '../ui/components/EditorLayout.js';
import { describe, it, expect, vi } from 'vitest';

describe('EditorLayout', () => {
  const defaultProps = {
    menuBar: h('div', { 'data-testid': 'menubar' }, 'Menu'),
    leftPanel: h('div', { 'data-testid': 'left-panel' }, 'Left'),
    viewport: h('div', { 'data-testid': 'viewport' }, 'Viewport'),
    rightPanel: h('div', { 'data-testid': 'right-panel' }, 'Right'),
    bottomPanel: h('div', { 'data-testid': 'bottom-panel' }, 'Bottom'),
    isBottomPanelOpen: true,
  };

  it('应该渲染所有面板', () => {
    render(h(EditorLayout, defaultProps));

    expect(screen.getByTestId('menubar')).toBeDefined();
    expect(screen.getByTestId('left-panel')).toBeDefined();
    expect(screen.getByTestId('viewport')).toBeDefined();
    expect(screen.getByTestId('right-panel')).toBeDefined();
    expect(screen.getByTestId('bottom-panel')).toBeDefined();
  });

  it('应该应用自定义初始宽度', () => {
    render(h(EditorLayout, {
      ...defaultProps,
      initialSidebarWidth: 300,
      initialInspectorWidth: 350,
    }));

    const leftPanel = screen.getByTestId('left-panel').parentElement;
    const rightPanel = screen.getByTestId('right-panel').parentElement;

    expect(leftPanel?.style.width).toBe('300px');
    expect(rightPanel?.style.width).toBe('350px');
  });

  it('关闭底部面板时不应该渲染底部面板', () => {
    render(h(EditorLayout, {
      ...defaultProps,
      isBottomPanelOpen: false,
    }));

    expect(screen.queryByTestId('bottom-panel')).toBeNull();
  });

  it('应该渲染调整大小的手柄', () => {
    render(h(EditorLayout, defaultProps));

    const resizers = document.querySelectorAll('.mote-layout__resizer');
    expect(resizers.length).toBe(3); // 左、右、底各一个
  });

  it('关闭底部面板时只渲染两个调整手柄', () => {
    render(h(EditorLayout, {
      ...defaultProps,
      isBottomPanelOpen: false,
    }));

    const resizers = document.querySelectorAll('.mote-layout__resizer');
    expect(resizers.length).toBe(2); // 只有左右
  });

  it('应该调用 onLayoutChange 当尺寸变化时', () => {
    const onLayoutChange = vi.fn();
    render(h(EditorLayout, {
      ...defaultProps,
      initialSidebarWidth: 250,
      initialInspectorWidth: 300,
      initialBottomHeight: 250,
      onLayoutChange,
    }));

    expect(onLayoutChange).toHaveBeenCalledWith({
      sidebarWidth: 250,
      inspectorWidth: 300,
      bottomHeight: 250,
    });
  });

  it('应该有正确的 CSS 类名', () => {
    render(h(EditorLayout, defaultProps));

    expect(document.querySelector('.mote-editor')).toBeDefined();
    expect(document.querySelector('.mote-layout')).toBeDefined();
    expect(document.querySelector('.mote-layout__menubar')).toBeDefined();
    expect(document.querySelector('.mote-layout__main')).toBeDefined();
    expect(document.querySelector('.mote-layout__left')).toBeDefined();
    expect(document.querySelector('.mote-layout__center')).toBeDefined();
    expect(document.querySelector('.mote-layout__right')).toBeDefined();
    expect(document.querySelector('.mote-layout__bottom')).toBeDefined();
  });
});
