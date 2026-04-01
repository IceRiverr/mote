import { h, type ComponentChildren } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { useEditor } from '../../hooks/useEditor.js';
import type { EntityInfo } from '../../types/editor.js';

interface TreeNodeProps {
  entity: EntityInfo;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (id: number, e: MouseEvent) => void;
  onToggleExpand: (id: number) => void;
}

function TreeNode({ entity, depth, isSelected, isExpanded, onSelect, onToggleExpand }: TreeNodeProps) {
  const hasChildren = entity.children.length > 0;
  
  const handleClick = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    onSelect(entity.id, e);
  }, [entity.id, onSelect]);

  const handleToggle = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(entity.id);
  }, [entity.id, onToggleExpand]);

  return (
    <div
      class={`scene-tree__node ${isSelected ? 'scene-tree__node--selected' : ''}`}
      style={{
        paddingLeft: `${depth * 16 + 8}px`,
        display: 'flex',
        alignItems: 'center',
        height: '24px',
        cursor: 'pointer',
        userSelect: 'none',
        backgroundColor: isSelected ? 'var(--color-accent)' : 'transparent',
        color: isSelected ? '#fff' : 'var(--color-text-primary)',
      }}
      onClick={handleClick}
    >
      {/* Expand/Collapse Icon */}
      <span
        class="scene-tree__expand-icon"
        style={{
          width: '16px',
          height: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          visibility: hasChildren ? 'visible' : 'hidden',
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s ease',
          fontSize: '10px',
        }}
        onClick={handleToggle}
      >
        ▶
      </span>

      {/* Entity Icon */}
      <span style={{ marginRight: '6px', fontSize: '12px' }}>
        {entity.children.length > 0 ? '📁' : '📄'}
      </span>

      {/* Entity Name */}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {entity.name}
      </span>

      {/* Component Count */}
      {entity.components.length > 0 && (
        <span style={{ 
          fontSize: '10px', 
          opacity: 0.6,
          marginLeft: '4px',
        }}>
          ({entity.components.length})
        </span>
      )}
    </div>
  );
}

interface SceneTreePanelProps {
  /** 面板标题 */
  title?: string;
  /** 是否浮动模式（不显示标题栏） */
  isFloating?: boolean;
  /** 顶部工具栏内容（仅在 docked 模式下使用） */
  header?: ComponentChildren;
  /** 实体过滤器 */
  filter?: string;
  /** 点击浮动按钮 */
  onFloat?: () => void;
}

/**
 * SceneTreePanel - 场景树面板
 * 
 * 显示场景中的所有实体，支持层级展开/折叠、选中操作。
 * 支持浮动和停靠两种模式。
 */
export function SceneTreePanel({ 
  title = 'Hierarchy',
  isFloating = false,
  header, 
  filter,
  onFloat 
}: SceneTreePanelProps) {
  const { bridge, selection } = useEditor();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // 获取所有实体
  const entities = bridge.getEntities();

  // 构建实体查找表
  const entityMap = new Map(entities.map(e => [e.id, e]));

  // 获取根实体（无父实体）
  const rootEntities = entities.filter(e => e.parentId === null);

  // 处理选择
  const handleSelect = useCallback((id: number, e: MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click: 切换选中
      selection.toggleSelect(id);
    } else if (e.shiftKey) {
      // Shift+Click: 范围选择
      selection.selectRange(id, entities);
    } else {
      // 普通点击: 单选
      selection.select(id);
    }
  }, [selection, entities]);

  // 处理展开/折叠
  const handleToggleExpand = useCallback((id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 递归渲染实体树
  const renderTree = (entityList: EntityInfo[], depth: number): h.JSX.Element[] => {
    const result: h.JSX.Element[] = [];

    for (const entity of entityList) {
      // 过滤检查
      if (filter && !entity.name.toLowerCase().includes(filter.toLowerCase())) {
        continue;
      }

      const isSelected = selection.isSelected(entity.id);
      const isExpanded = expanded.has(entity.id);

      result.push(
        <TreeNode
          key={entity.id}
          entity={entity}
          depth={depth}
          isSelected={isSelected}
          isExpanded={isExpanded}
          onSelect={handleSelect}
          onToggleExpand={handleToggleExpand}
        />
      );

      // 递归渲染子实体
      if (isExpanded && entity.children.length > 0) {
        const children = entity.children
          .map(id => entityMap.get(id))
          .filter((e): e is EntityInfo => e !== undefined);
        result.push(...renderTree(children, depth + 1));
      }
    }

    return result;
  };

  // 浮动模式：只渲染内容，不渲染标题栏
  if (isFloating) {
    return (
      <div style={floatingStyles.container}>
        {entities.length === 0 ? (
          <div style={floatingStyles.empty}>
            No entities in scene
          </div>
        ) : (
          renderTree(rootEntities, 0)
        )}
      </div>
    );
  }

  // 停靠模式：渲染标题栏和内容
  return (
    <div class="scene-tree-panel" style={panelStyles.container}>
      {/* Header */}
      <div style={panelStyles.header}>
        {header || (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>
              {title}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', opacity: 0.6 }}>
                {entities.length} entities
              </span>
              {onFloat && (
                <button
                  onClick={onFloat}
                  style={{
                    padding: '2px 6px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                  title="Float"
                >
                  ⧉
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tree */}
      <div style={panelStyles.tree}>
        {entities.length === 0 ? (
          <div style={panelStyles.empty}>
            No entities in scene
          </div>
        ) : (
          renderTree(rootEntities, 0)
        )}
      </div>
    </div>
  );
}

const panelStyles: Record<string, h.JSX.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg-tertiary)',
    flexShrink: 0,
  },
  tree: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 0',
  },
  empty: {
    padding: '20px',
    textAlign: 'center',
    color: 'var(--color-text-muted)',
    fontSize: '12px',
  },
};

const floatingStyles: Record<string, h.JSX.CSSProperties> = {
  container: {
    height: '100%',
    overflow: 'auto',
    padding: '4px 0',
  },
  empty: {
    padding: '20px',
    textAlign: 'center',
    color: 'var(--color-text-muted)',
    fontSize: '12px',
  },
};
