import { signal, computed } from '@preact/signals';
import { LayoutNode, Rect, RectMap, SplitInfo } from '../layout/types';
import { computeRects } from '../layout/rect';

/**
 * Default layout (4 panels):
 * Left: Viewport (65%)
 * Right: top = TilePalette (33%) | middle = SpritePanel (33%) | bottom = Inspector (34%)
 *   Implemented as nested splits: right = split(palette | split(sprite-panel | inspector))
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
      ratio: 0.33,
      children: [
        { type: 'area', id: 'area_palette', editorType: 'tile-palette' },
        {
          type: 'split',
          id: 'split_right_bottom',
          direction: 'horizontal',
          ratio: 0.5,
          children: [
            { type: 'area', id: 'area_sprite_panel', editorType: 'sprite-panel' },
            { type: 'area', id: 'area_inspector', editorType: 'inspector' },
          ],
        },
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
