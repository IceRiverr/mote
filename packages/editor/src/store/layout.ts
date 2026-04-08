import { signal, computed } from '@preact/signals';
import { LayoutNode, Rect, RectMap, SplitInfo } from '../layout/types';
import { computeRects } from '../layout/rect';

/**
 * Default layout (6 panels) — Blender-style:
 *
 * ┌──────────────────┬───────────┐
 * │                  │  Scene    │
 * │                  │  Tree     │
 * │    Viewport      ├───────────┤
 * │                  │ Inspector │
 * │                  │ (Props)   │
 * ├──────────────────┼───────────┤
 * │  Sprite Editor   │  Assets   │
 * └──────────────────┴───────────┘
 *
 * Right side: Scene Tree (top) + Inspector (bottom)
 * Left side: Viewport (top) + Sprite Editor (bottom)
 */
const defaultLayout: LayoutNode = {
  type: 'split',
  id: 'root',
  direction: 'vertical',  // Main split: left vs right
  ratio: 0.75,            // 75% for left (viewport area), 25% for right (panels)
  children: [
    // Left side: Viewport (top) + Sprite Editor (bottom)
    {
      type: 'split',
      id: 'left',
      direction: 'horizontal',
      ratio: 0.65,
      children: [
        { type: 'area', id: 'area_viewport', editorType: 'viewport' },
        { type: 'area', id: 'area_sprite_editor', editorType: 'sprite-editor' },
      ],
    },
    // Right side: Scene Tree (top) + Inspector (bottom)
    {
      type: 'split',
      id: 'right',
      direction: 'horizontal',
      ratio: 0.45,
      children: [
        { type: 'area', id: 'area_scene_tree', editorType: 'scene-tree' },
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
