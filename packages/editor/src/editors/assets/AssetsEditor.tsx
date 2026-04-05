import { signal } from "@preact/signals";
import { useState, useCallback } from "preact/hooks";
import { registerEditor } from "../registry";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AssetEntry {
  id: string;
  name: string;
  path: string;
  type:
    | "image"
    | "spritesheet"
    | "entity"
    | "scene"
    | "script"
    | "folder"
    | "unknown";
  children?: AssetEntry[];
}

// ── State ──────────────────────────────────────────────────────────────────

export const assetTree = signal<AssetEntry[]>([
  {
    id: "assets",
    name: "assets",
    path: "assets/",
    type: "folder",
    children: [
      {
        id: "images",
        name: "images",
        path: "assets/images/",
        type: "folder",
        children: [],
      },
      {
        id: "sprites",
        name: "sprites",
        path: "assets/sprites/",
        type: "folder",
        children: [],
      },
      {
        id: "entities",
        name: "entities",
        path: "assets/entities/",
        type: "folder",
        children: [],
      },
      {
        id: "maps",
        name: "maps",
        path: "assets/maps/",
        type: "folder",
        children: [],
      },
    ],
  },
  {
    id: "scripts",
    name: "scripts",
    path: "scripts/",
    type: "folder",
    children: [],
  },
]);

const selectedAssetId = signal<string | null>(null);
const searchQuery = signal("");

// ── Helpers ────────────────────────────────────────────────────────────────

function getTypeIcon(type: AssetEntry["type"]): string {
  switch (type) {
    case "image":
      return "🖼";
    case "spritesheet":
      return "🎨";
    case "entity":
      return "🧩";
    case "scene":
      return "🗺";
    case "script":
      return "📜";
    case "folder":
      return "📁";
    default:
      return "📄";
  }
}

function filterTree(
  entries: AssetEntry[],
  query: string
): AssetEntry[] {
  if (!query) return entries;
  const lq = query.toLowerCase();
  const result: AssetEntry[] = [];
  for (const entry of entries) {
    if (entry.type === "folder" && entry.children) {
      const filteredChildren = filterTree(entry.children, query);
      if (filteredChildren.length > 0) {
        result.push({ ...entry, children: filteredChildren });
      } else if (entry.name.toLowerCase().includes(lq)) {
        result.push(entry);
      }
    } else {
      if (entry.name.toLowerCase().includes(lq)) {
        result.push(entry);
      }
    }
  }
  return result;
}

// ── Context Menu ───────────────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  entry: AssetEntry;
}

function ContextMenu({
  state,
  onClose,
}: {
  state: ContextMenuState;
  onClose: () => void;
}) {
  const menuItems = [
    { label: "📥 导入文件...", action: () => onClose() },
    { label: "✏️ 重命名", action: () => { handleRename(state.entry); onClose(); } },
    { label: "🗑️ 删除", action: () => { handleDelete(state.entry); onClose(); }, danger: true },
  ];

  // Add type-specific items
  if (
    state.entry.type === "spritesheet" ||
    state.entry.type === "image"
  ) {
    menuItems.splice(1, 0, {
      label: "🎨 在 Sprite Editor 中打开",
      action: () => onClose(),
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        top: state.y,
        left: state.x,
        zIndex: 10000,
        background: "var(--bg-header)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "4px 0",
        minWidth: 180,
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
      }}
      onMouseLeave={onClose}
    >
      {menuItems.map((item, i) => (
        <div
          key={i}
          onClick={(e) => {
            e.stopPropagation();
            item.action();
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "var(--selection)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
          style={{
            padding: "5px 12px",
            fontSize: 11,
            cursor: "pointer",
            color: (item as any).danger
              ? "var(--danger)"
              : "var(--text-primary)",
            whiteSpace: "nowrap",
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}

function handleRename(entry: AssetEntry) {
  const newName = prompt("重命名:", entry.name);
  if (!newName || newName === entry.name) return;
  function renameInTree(nodes: AssetEntry[]): AssetEntry[] {
    return nodes.map((n) => {
      if (n.id === entry.id) {
        return { ...n, name: newName! };
      }
      if (n.children) {
        return { ...n, children: renameInTree(n.children) };
      }
      return n;
    });
  }
  assetTree.value = renameInTree(assetTree.value);
}

function handleDelete(entry: AssetEntry) {
  if (!confirm(`确定要删除 "${entry.name}" 吗？`)) return;
  function removeFromTree(nodes: AssetEntry[]): AssetEntry[] {
    return nodes
      .filter((n) => n.id !== entry.id)
      .map((n) => {
        if (n.children) {
          return { ...n, children: removeFromTree(n.children) };
        }
        return n;
      });
  }
  assetTree.value = removeFromTree(assetTree.value);
  if (selectedAssetId.value === entry.id) {
    selectedAssetId.value = null;
  }
}

// ── Tree Node ──────────────────────────────────────────────────────────────

function TreeNode({
  entry,
  depth,
  onContextMenu,
}: {
  entry: AssetEntry;
  depth: number;
  onContextMenu: (e: MouseEvent, entry: AssetEntry) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isFolder = entry.type === "folder";
  const isSelected = selectedAssetId.value === entry.id;
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback(() => {
    if (isFolder) {
      setExpanded((v) => !v);
    }
    selectedAssetId.value = entry.id;
  }, [entry.id, isFolder]);

  const handleDblClick = useCallback(() => {
    if (!isFolder) {
      // Double-click: would navigate based on type
      // For now, just select
      selectedAssetId.value = entry.id;
    }
  }, [entry.id, isFolder]);

  const handleCtxMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(e, entry);
    },
    [entry, onContextMenu]
  );

  return (
    <div>
      <div
        onClick={handleClick}
        onDblClick={handleDblClick}
        onContextMenu={handleCtxMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          height: 26,
          paddingLeft: 8 + depth * 16,
          paddingRight: 8,
          gap: 4,
          cursor: "pointer",
          background: isSelected
            ? "var(--selection)"
            : hovered
            ? "rgba(255,255,255,0.04)"
            : "transparent",
          borderLeft: isSelected
            ? "2px solid var(--accent)"
            : "2px solid transparent",
          userSelect: "none",
          transition: "background 0.1s",
        }}
      >
        {/* Expand arrow */}
        <span
          style={{
            width: 14,
            fontSize: 9,
            color: "var(--text-secondary)",
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          {isFolder && entry.children
            ? expanded
              ? "▼"
              : "▶"
            : ""}
        </span>

        {/* Icon */}
        <span style={{ fontSize: 12, flexShrink: 0 }}>
          {isFolder && expanded ? "📂" : getTypeIcon(entry.type)}
        </span>

        {/* Name */}
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 11,
            color: isSelected
              ? "var(--text-bright)"
              : "var(--text-primary)",
          }}
        >
          {entry.name}
        </span>
      </div>

      {/* Children */}
      {isFolder && expanded && entry.children && (
        <div>
          {entry.children.map((child) => (
            <TreeNode
              key={child.id}
              entry={child}
              depth={depth + 1}
              onContextMenu={onContextMenu}
            />
          ))}
          {entry.children.length === 0 && (
            <div
              style={{
                paddingLeft: 8 + (depth + 1) * 16,
                height: 22,
                display: "flex",
                alignItems: "center",
                fontSize: 10,
                color: "var(--text-secondary)",
                fontStyle: "italic",
              }}
            >
              (空)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

function AssetsEditor({ areaId }: { areaId: string }) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(
    null
  );

  const query = searchQuery.value;
  const tree = query
    ? filterTree(assetTree.value, query)
    : assetTree.value;

  const handleContextMenu = useCallback(
    (e: MouseEvent, entry: AssetEntry) => {
      setContextMenu({ x: e.clientX, y: e.clientY, entry });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
      onClick={closeContextMenu}
    >
      {/* Header */}
      <div
        style={{
          height: 32,
          background: "var(--panel-header)",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          gap: 6,
          flexShrink: 0,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span style={{ fontSize: 12 }}>📦</span>
        <span
          style={{
            fontWeight: 600,
            fontSize: 11,
            color: "var(--text-bright)",
          }}
        >
          资源
        </span>
        <div style={{ flex: 1 }} />
        <button
          title="导入文件"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: 13,
            padding: "0 4px",
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color =
              "var(--text-bright)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color =
              "var(--text-secondary)";
          }}
        >
          ＋
        </button>
      </div>

      {/* Search */}
      <div
        style={{
          padding: "6px 8px",
          flexShrink: 0,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            padding: "0 6px",
            height: 24,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "var(--text-secondary)",
              marginRight: 4,
            }}
          >
            🔍
          </span>
          <input
            type="text"
            placeholder="搜索资源..."
            value={searchQuery.value}
            onInput={(e) => {
              searchQuery.value = (e.target as HTMLInputElement).value;
            }}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: 11,
              height: 22,
              padding: 0,
            }}
          />
          {query && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                searchQuery.value = "";
              }}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-secondary)",
                fontSize: 10,
                padding: "0 2px",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* File Tree */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {tree.length === 0 ? (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: 11,
            }}
          >
            {query ? "未找到匹配的资源" : "暂无资源"}
          </div>
        ) : (
          tree.map((entry) => (
            <TreeNode
              key={entry.id}
              entry={entry}
              depth={0}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          height: 22,
          borderTop: "1px solid var(--border)",
          background: "var(--bg-header)",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          fontSize: 10,
          color: "var(--text-secondary)",
          flexShrink: 0,
          gap: 8,
        }}
      >
        {selectedAssetId.value ? (
          <span>
            已选:{" "}
            <span style={{ color: "var(--text-primary)" }}>
              {selectedAssetId.value}
            </span>
          </span>
        ) : (
          <span>未选择资源</span>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu state={contextMenu} onClose={closeContextMenu} />
      )}
    </div>
  );
}

registerEditor({
  id: "assets",
  name: "资源",
  icon: "📦",
  component: AssetsEditor,
});

export { AssetsEditor };
