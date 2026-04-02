import { signal, computed } from "@preact/signals";
import type { LayoutNode } from "../layout/types";
import { computeRects, HANDLE_SIZE } from "../layout/rect";

export const layoutTree = signal<LayoutNode>({
  id: "split_root",
  type: "split",
  direction: "vertical",
  ratio: 0.65,
  children: [
    {
      id: "area_viewport",
      type: "area",
      editorType: "viewport",
    },
    {
      id: "split_right",
      type: "split",
      direction: "horizontal",
      ratio: 0.55,
      children: [
        {
          id: "area_palette",
          type: "area",
          editorType: "tile_palette",
        },
        {
          id: "area_inspector",
          type: "area",
          editorType: "inspector",
        },
      ],
    },
  ],
});

export const containerSize = signal({ width: 1200, height: 800 });

export const layoutComputed = computed(() => {
  const { width, height } = containerSize.value;
  return computeRects(layoutTree.value, { x: 0, y: 0, width, height });
});
