// ═══════════════════════════════════════════════════════════════
// SpawnMenu.tsx - Shift+A 浮动 Prefab 选择菜单（Blender 风格）
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'preact/hooks';
import { prefabs, prefabIdToPath } from '../store/prefabs';
import type { Prefab, PrefabId } from '../data/Prefab';
import { getPrefabDisplayName } from '../data/Prefab';

interface SpawnMenuProps {
  onSelect: (prefabId: PrefabId) => void;
  onClose: () => void;
}

const TAG_COLORS: Record<string, string> = {
  environment: '#4a7c59',
  walls: '#8b7355',
  characters: '#d4574a',
  items: '#f4a742',
  system: '#666',
};

function getTagColor(tag?: string): string {
  return (tag && TAG_COLORS[tag]) || '#4a90d9';
}

export function SpawnMenu({ onSelect, onClose }: SpawnMenuProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 收集并排序所有 prefab
  const entries = useRef<Array<{ prefabId: PrefabId; prefab: Prefab; path: string }>>([]);
  entries.current = Array.from(prefabs.value.entries())
    .map(([prefabId, prefab]) => ({
      prefabId,
      prefab,
      path: prefabIdToPath.value.get(prefabId) || prefabId,
    }))
    .sort((a, b) => {
      const tagA = a.prefab.tags?.[0] ?? '';
      const tagB = b.prefab.tags?.[0] ?? '';
      if (tagA !== tagB) return tagA.localeCompare(tagB);
      return (a.prefab.name || a.prefabId).localeCompare(b.prefab.name || b.prefabId);
    });

  const filtered = entries.current.filter(({ prefab, prefabId, path }) => {
    const q = query.toLowerCase();
    const name = getPrefabDisplayName(prefab, prefabId).toLowerCase();
    return (
      name.includes(q) ||
      prefabId.toLowerCase().includes(q) ||
      path.toLowerCase().includes(q) ||
      (prefab.tags?.[0] ?? '').toLowerCase().includes(q)
    );
  });

  const safeIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1));

  // 自动聚焦搜索框
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 选中项变化时滚动到可视区域
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[safeIndex] as HTMLElement | undefined;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [safeIndex]);

  // 键盘导航（绑定到 window，但菜单打开时 ViewportCanvas 会忽略其他快捷键）
  const stateRef = useRef({
    filtered,
    safeIndex,
    onSelect,
    onClose,
    setSelectedIndex,
    setQuery,
  });
  stateRef.current = { filtered, safeIndex, onSelect, onClose, setSelectedIndex, setQuery };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { filtered, safeIndex, onSelect, onClose, setSelectedIndex, setQuery } = stateRef.current;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[safeIndex]) {
          onSelect(filtered[safeIndex].prefabId);
        }
        return;
      }

      // 单字符按键且没有 modifiers = 追加到搜索框（Blender 风格快速搜索）
      if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        document.activeElement !== inputRef.current
      ) {
        inputRef.current?.focus();
        // 让 input 自己接收这个字符
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSelect = (prefabId: PrefabId) => {
    onSelect(prefabId);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 280,
        maxHeight: 360,
        background: 'var(--bg-header)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        fontSize: 12,
        color: 'var(--text-primary)',
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* 搜索框 */}
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="搜索 Prefab..."
          value={query}
          onInput={(e) => {
            setQuery((e.target as HTMLInputElement).value);
            setSelectedIndex(0);
          }}
          style={{
            width: '100%',
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            color: 'var(--text-primary)',
            fontSize: 12,
            padding: '4px 8px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div
          style={{
            marginTop: 4,
            fontSize: 10,
            color: 'var(--text-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>{filtered.length} 个 Prefab</span>
          <span>↑↓ 选择 · Enter 放置 · Esc 关闭</span>
        </div>
      </div>

      {/* 列表 */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: 20,
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: 11,
          }}
        >
          {entries.current.length === 0
            ? '暂无 Prefab，请在 Content Browser 中创建'
            : '没有匹配的 Prefab'}
        </div>
      ) : (
        <div
          ref={listRef}
          style={{
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
          }}
        >
          {filtered.map(({ prefabId, prefab, path }, i) => {
            const tag = prefab.tags?.[0];
            const isSelected = i === safeIndex;
            const displayName = getPrefabDisplayName(prefab, prefabId);
            return (
              <div
                key={prefabId}
                onClick={() => handleSelect(prefabId)}
                onMouseEnter={() => setSelectedIndex(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--selection)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                }}
              >
                {/* Tag 色块 */}
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: getTagColor(tag),
                    flexShrink: 0,
                  }}
                />
                {/* 名称 */}
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: isSelected ? 'var(--text-bright)' : 'var(--text-primary)',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                  title={path}
                >
                  {displayName}
                </span>
                {/* Tag 标签 */}
                {tag && (
                  <span
                    style={{
                      fontSize: 9,
                      color: getTagColor(tag),
                      background: `${getTagColor(tag)}20`,
                      padding: '1px 5px',
                      borderRadius: 3,
                      flexShrink: 0,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {tag}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
