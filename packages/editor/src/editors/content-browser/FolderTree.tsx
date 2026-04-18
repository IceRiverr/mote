// ═══════════════════════════════════════════════════════════════
// FolderTree.tsx - Content Browser 左侧文件夹树
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback } from 'preact/hooks';
import { ContextMenu } from './ContextMenu';
import type { AssetNode } from '../../store/contentBrowser';
import {
  selectedFolderPath,
  createFolder,
  createPrefabFile,
  deleteAsset,
  renameAsset,
} from '../../store/contentBrowser';

interface FolderTreeProps {
  nodes: AssetNode[];
}

export function FolderTree({ nodes }: FolderTreeProps) {
  const [menuState, setMenuState] = useState<{
    x: number;
    y: number;
    node: AssetNode;
  } | null>(null);

  const closeMenu = useCallback(() => setMenuState(null), []);

  return (
    <div
      style={{ overflow: 'auto', height: '100%', padding: '4px 0' }}
      onClick={closeMenu}
    >
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          onContextMenu={(e, n) => {
            e.preventDefault();
            setMenuState({ x: e.clientX, y: e.clientY, node: n });
          }}
        />
      ))}

      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={buildFolderMenuItems(menuState.node)}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}

// ── TreeNode ───────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: AssetNode;
  depth: number;
  onContextMenu: (e: MouseEvent, node: AssetNode) => void;
}

function TreeNode({ node, depth, onContextMenu }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isFolder = node.type === 'folder';
  const isSelected = selectedFolderPath.value === node.path;

  const handleClick = useCallback(() => {
    if (isFolder) {
      setExpanded((v) => !v);
    }
    selectedFolderPath.value = node.path;
  }, [node.path, isFolder]);

  if (!isFolder) return null;

  const folderChildren = node.children?.filter((c) => c.type === 'folder') ?? [];

  return (
    <div>
      <div
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 24,
          paddingLeft: 6 + depth * 14,
          paddingRight: 6,
          gap: 4,
          cursor: 'pointer',
          background: isSelected
            ? 'var(--selection)'
            : 'transparent',
          borderLeft: isSelected
            ? '2px solid var(--accent)'
            : '2px solid transparent',
          userSelect: 'none',
          transition: 'background 0.1s',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            (e.currentTarget as HTMLDivElement).style.background =
              'rgba(255,255,255,0.04)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            (e.currentTarget as HTMLDivElement).style.background =
              'transparent';
          }
        }}
      >
        {/* 展开箭头 */}
        <span
          style={{
            width: 12,
            fontSize: 8,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            flexShrink: 0,
            opacity: folderChildren.length > 0 ? 1 : 0,
          }}
        >
          {expanded ? '▼' : '▶'}
        </span>

        {/* 图标 */}
        <span style={{ fontSize: 12, flexShrink: 0 }}>
          {expanded && folderChildren.length > 0 ? '📂' : '📁'}
        </span>

        {/* 名称 */}
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 11,
            color: isSelected
              ? 'var(--text-bright)'
              : 'var(--text-primary)',
          }}
        >
          {node.name}
        </span>
      </div>

      {/* 子文件夹 */}
      {expanded &&
        folderChildren.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            onContextMenu={onContextMenu}
          />
        ))}
    </div>
  );
}

// ── Context Menu Builder ───────────────────────────────────────────────────

function buildFolderMenuItems(
  node: AssetNode
): Array<{ label: string; action: () => void; danger?: boolean; separator?: boolean }> {
  return [
    {
      label: '📁 新建文件夹',
      action: () => {
        const name = prompt('文件夹名称:', 'New Folder');
        if (name) createFolder(node.path, name);
      },
    },
    {
      label: '📦 新建 Prefab',
      action: () => {
        const name = prompt('Prefab 名称:', 'New Prefab');
        if (name) createPrefabFile(node.path, name);
      },
    },
    { separator: true, label: '', action: () => {} },
    {
      label: '✏️ 重命名',
      action: () => {
        const newName = prompt('新名称:', node.name);
        if (newName && newName !== node.name) {
          renameAsset(node.path, newName);
        }
      },
    },
    {
      label: '🗑️ 删除',
      action: () => {
        if (confirm(`确定要删除文件夹 "${node.name}" 吗？`)) {
          deleteAsset(node.path);
        }
      },
      danger: true,
    },
  ];
}
