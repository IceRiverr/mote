/**
 * Area Tree - 区域树结构
 * 
 * 实现 Blender 风格的自由分割布局系统
 * 整个编辑器窗口是一棵可动态分割/合并的区域树
 */

/** 支持的编辑器类型 */
export type EditorType =
  | "viewport"      // 2D 场景视口
  | "scene-tree"    // 实体树
  | "inspector"     // 属性面板
  | "asset-browser" // 资源浏览器
  | "tilemap"       // Tilemap 编辑器
  | "console"       // 控制台
  | "code";         // 脚本预览

/** 编辑器类型配置 */
export const EDITOR_TYPES: { type: EditorType; label: string; icon: string }[] = [
  { type: "viewport", label: "Viewport", icon: "🎮" },
  { type: "scene-tree", label: "Scene Tree", icon: "🌳" },
  { type: "inspector", label: "Inspector", icon: "🔧" },
  { type: "asset-browser", label: "Assets", icon: "📁" },
  { type: "tilemap", label: "Tilemap", icon: "🗺️" },
  { type: "console", label: "Console", icon: "💬" },
  { type: "code", label: "Code", icon: "📄" },
];

/** 分割方向 */
export type SplitDirection = "horizontal" | "vertical";

/** 区域节点 - 叶子节点（实际的面板） */
export interface LeafNode {
  type: "leaf";
  id: string;
  editorType: EditorType;
}

/** 区域节点 - 分割节点（内部节点） */
export interface SplitNode {
  type: "split";
  direction: SplitDirection;
  ratio: number;  // 0~1, first 占的比例
  first: AreaNode;
  second: AreaNode;
}

/** 区域节点 */
export type AreaNode = LeafNode | SplitNode;

/** 生成唯一 ID */
export function generateId(): string {
  return `area_${Math.random().toString(36).substring(2, 9)}`;
}

/** 创建叶子节点 */
export function createLeaf(editorType: EditorType = "viewport", id?: string): LeafNode {
  return {
    type: "leaf",
    id: id ?? generateId(),
    editorType,
  };
}

/** 创建分割节点 */
export function createSplit(
  direction: SplitDirection,
  ratio: number,
  first: AreaNode,
  second: AreaNode
): SplitNode {
  return {
    type: "split",
    direction,
    ratio,
    first,
    second,
  };
}

/** 默认布局 - 经典的 3 面板布局 */
export function createDefaultLayout(): AreaNode {
  // 左侧 Scene Tree | 中间 Viewport | 右侧 Inspector
  // 底部 Asset Browser
  const left = createLeaf("scene-tree");
  const center = createLeaf("viewport");
  const right = createLeaf("inspector");
  const bottom = createLeaf("asset-browser");

  // 先分割左右：左 20% | 中右 80%
  const topRow = createSplit("horizontal", 0.2, left, 
    // 中右再分割：中 70% | 右 30%
    createSplit("horizontal", 0.7, center, right)
  );

  // 上下分割：上 75% | 下 25%
  return createSplit("vertical", 0.75, topRow, bottom);
}

/** 查找节点 */
export function findNode(root: AreaNode, id: string): AreaNode | null {
  if (root.type === "leaf") {
    return root.id === id ? root : null;
  }
  return findNode(root.first, id) ?? findNode(root.second, id);
}

/** 查找父节点 */
export function findParent(root: AreaNode, id: string): SplitNode | null {
  if (root.type === "leaf") return null;
  
  if (root.first.type === "leaf" && root.first.id === id) return root;
  if (root.second.type === "leaf" && root.second.id === id) return root;
  
  return findParent(root.first, id) ?? findParent(root.second, id);
}

/** 更新叶子节点的编辑器类型 */
export function updateEditorType(root: AreaNode, id: string, editorType: EditorType): AreaNode {
  if (root.type === "leaf") {
    if (root.id === id) {
      return { ...root, editorType };
    }
    return root;
  }
  return {
    ...root,
    first: updateEditorType(root.first, id, editorType),
    second: updateEditorType(root.second, id, editorType),
  };
}

/** 更新分割比例 */
export function updateRatio(root: AreaNode, targetNode: SplitNode, ratio: number): AreaNode {
  if (root.type === "leaf") return root;
  
  if (root === targetNode) {
    return { ...root, ratio: Math.max(0.1, Math.min(0.9, ratio)) };
  }
  
  return {
    ...root,
    first: updateRatio(root.first, targetNode, ratio),
    second: updateRatio(root.second, targetNode, ratio),
  };
}

/** 分割叶子节点 */
export function splitNode(
  root: AreaNode,
  id: string,
  direction: SplitDirection,
  newRatio: number = 0.5
): AreaNode {
  if (root.type === "leaf") {
    if (root.id === id) {
      const original = { ...root };
      const newNode = createLeaf(root.editorType);
      if (direction === "horizontal") {
        return createSplit("horizontal", newRatio, original, newNode);
      } else {
        return createSplit("vertical", newRatio, original, newNode);
      }
    }
    return root;
  }
  
  return {
    ...root,
    first: splitNode(root.first, id, direction, newRatio),
    second: splitNode(root.second, id, direction, newRatio),
  };
}

/** 删除叶子节点（合并到相邻节点） */
export function removeNode(root: AreaNode, id: string): AreaNode {
  const parent = findParent(root, id);
  if (!parent) return root; // 没有找到或根节点
  
  // 找到要删除的节点的兄弟节点
  const sibling = parent.first.type === "leaf" && parent.first.id === id
    ? parent.second
    : parent.first;
  
  // 用兄弟节点替换父节点
  return replaceNode(root, parent, sibling);
}

/** 替换节点 */
function replaceNode(root: AreaNode, target: AreaNode, replacement: AreaNode): AreaNode {
  if (root === target) return replacement;
  if (root.type === "leaf") return root;
  
  return {
    ...root,
    first: replaceNode(root.first, target, replacement),
    second: replaceNode(root.second, target, replacement),
  };
}

/** 获取所有叶子节点 */
export function getAllLeafs(root: AreaNode): LeafNode[] {
  if (root.type === "leaf") return [root];
  return [...getAllLeafs(root.first), ...getAllLeafs(root.second)];
}

/** 序列化布局 */
export function serializeLayout(root: AreaNode): string {
  return JSON.stringify(root);
}

/** 反序列化布局 */
export function deserializeLayout(json: string): AreaNode {
  return JSON.parse(json);
}
