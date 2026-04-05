import { signal, computed } from '@preact/signals';
import { LayoutNode, Rect, RectMap, SplitInfo } from '../layout/types';
import { computeRects } from '../layout/rect';

/**
 * Default layout (6 panels) — Blender-style:
 *
 * ┌──────────┬──────────────────┬──────────┐
 * │          │                  │          │
 * │ Scene    │     Viewport     │Inspector │
 * │ Tree     │                  │          │
 * │          │                  │          │
 * ├──────────┴────────┬─────────┴──────────┤
 * │                   │                    │
 * │  Sprite Editor    │  Assets Browser    │
 * │                   │                    │
 * └───────────────────┴────────────────────┘
 */
const defaultLayout: LayoutNode = {
  type: 'split',
  id: 'root',
  direction: 'horizontal',
  ratio: 0.65,
  children: [
    // Top row
    {
      type: 'split',
      id: 'top',
      direction: 'vertical',
      ratio: 0.18,
      children: [
        { type: 'area', id: 'area_scene_tree', editorType: 'scene-tree' },
        {
          type: 'split',
          id: 'top_right',
          direction: 'vertical',
          ratio: 0.75,
          children: [
            { type: 'area', id: 'area_viewport', editorType: 'viewport' },
            { type: 'area', id: 'area_inspector', editorType: 'inspector' },
          ],
        },
      ],
    },
    // Bottom row
    {
      type: 'split',
      id: 'bottom',
      direction: 'vertical',
      ratio: 0.55,
      children: [
        { type: 'area', id: 'area_sprite_editor', editorType: 'sprite-editor' },
        { type: 'area', id: 'area_assets', editorType: 'assets' },
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
