/**
 * Scene Tree Editor - 场景树
 * 
 * 显示场景中所有实体的层级结构
 */

import { useState } from "preact/hooks";

interface TreeItemData {
  id: string;
  name: string;
  type: "entity" | "folder";
  children?: TreeItemData[];
  icon?: string;
}

// Mock data for now
const mockSceneData: TreeItemData[] = [
  {
    id: "root",
    name: "Root",
    type: "folder",
    icon: "🌳",
    children: [
      {
        id: "player",
        name: "Player",
        type: "entity",
        icon: "🎮",
      },
      {
        id: "ground",
        name: "Ground",
        type: "entity",
        icon: "⬜",
      },
      {
        id: "coins",
        name: "Coins",
        type: "folder",
        icon: "📁",
        children: [
          { id: "coin1", name: "Coin_1", type: "entity", icon: "🪙" },
          { id: "coin2", name: "Coin_2", type: "entity", icon: "🪙" },
          { id: "coin3", name: "Coin_3", type: "entity", icon: "🪙" },
        ],
      },
      {
        id: "enemies",
        name: "Enemies",
        type: "folder",
        icon: "📁",
        children: [
          { id: "enemy1", name: "Enemy_1", type: "entity", icon: "👾" },
          { id: "enemy2", name: "Enemy_2", type: "entity", icon: "👾" },
        ],
      },
    ],
  },
];

interface TreeItemProps {
  item: TreeItemData;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}

function TreeItem({ 
  item, 
  depth, 
  selectedId, 
  onSelect, 
  expandedIds, 
  onToggleExpand 
}: TreeItemProps) {
  const isExpanded = expandedIds.has(item.id);
  const hasChildren = item.children && item.children.length > 0;
  const isSelected = selectedId === item.id;

  return (
    <>
      <div
        class={`tree-item ${isSelected ? "selected" : ""}`}
        style={{ paddingLeft: `${4 + depth * 16}px` }}
        onClick={() => onSelect(item.id)}
      >
        <span 
          class="tree-item__arrow"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpand(item.id);
          }}
          style={{ 
            visibility: hasChildren ? "visible" : "hidden",
            transform: isExpanded ? "rotate(90deg)" : "none"
          }}
        >
          ▶
        </span>
        <span class="tree-item__icon">{item.icon || "📄"}</span>
        <span class="tree-item__label">{item.name}</span>
      </div>
      {isExpanded && item.children?.map((child) => (
        <TreeItem
          key={child.id}
          item={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          expandedIds={expandedIds}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </>
  );
}

export function SceneTreeEditor() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => 
    new Set(["root", "coins", "enemies"])
  );

  const handleToggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  return (
    <div style={{ padding: "4px 0" }}>
      {mockSceneData.map((item) => (
        <TreeItem
          key={item.id}
          item={item}
          depth={0}
          selectedId={selectedId}
          onSelect={setSelectedId}
          expandedIds={expandedIds}
          onToggleExpand={handleToggleExpand}
        />
      ))}
    </div>
  );
}
