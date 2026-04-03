import { signal, computed } from '@preact/signals';
import { LayoutNode, Rect, RectMap, SplitInfo } from '../layout/types';
import { computeRects } from '../layout/rect';

/**
 * New default layout:
 * Left: Viewport (65%)
 * Right: top = TilePalette, bottom = Inspector (vertical split inside horizontal split)
 */
const defaultLayout: LayoutNode = {
  type: 'split',
  id: 'root_split',
  direction: 'vertical',
  ratio: 0.65,
  children: [
    { type: 'area', id: 'area_viewport', editorType: 'viewport' },
    {
      type: 'split',
      id: 'split_right',
      direction: 'horizontal',
      ratio: 0.5,
      children: [
        { type: 'area', id: 'area_palette', editorType: 'tile-palette' },
        { type: 'area', id: 'area_inspector', editorType: 'inspector' },
      ],
    },
  ],
};

export const layoutTree = signal<LayoutNode>(defaultLayout);
export const containerSize = signal<Rect>({ x: 0, y: 0, w: 1200, h: 800 });

export const layoutComputed = computed<{ areas: RectMap; splits: SplitInfo[] }>(() => {
  const areas: RectMap = new Map();
  const splits: SplitInfo[] = [];
  computeRects(layoutTree.value, containerSize.value, areas, splits);
  return { areas, splits };
});
