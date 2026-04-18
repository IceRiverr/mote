// ═══════════════════════════════════════════════════════════════
// ContextMenu.tsx - 通用右键菜单
// ═══════════════════════════════════════════════════════════════

interface MenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 10000,
        background: 'var(--bg-header)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '4px 0',
        minWidth: 180,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
      onMouseLeave={onClose}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div
            key={i}
            style={{
              height: 1,
              background: 'var(--border)',
              margin: '4px 0',
            }}
          />
        ) : (
          <div
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              item.action();
              onClose();
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--selection)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
            style={{
              padding: '5px 12px',
              fontSize: 11,
              cursor: 'pointer',
              color: item.danger ? 'var(--danger)' : 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </div>
        )
      )}
    </div>
  );
}
