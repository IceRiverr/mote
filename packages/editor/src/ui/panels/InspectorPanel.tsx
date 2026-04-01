import { h, type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { useEditor } from '../../hooks/useEditor.js';

interface FieldEditorProps {
  label: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'object';
  onChange: (value: unknown) => void;
}

function FieldEditor({ label, value, type, onChange }: FieldEditorProps) {
  const handleChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (type === 'boolean') {
      onChange(target.checked);
    } else if (type === 'number') {
      onChange(parseFloat(target.value));
    } else {
      onChange(target.value);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
      <label style={{ width: '80px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
        {label}
      </label>
      {type === 'boolean' ? (
        <input
          type="checkbox"
          checked={value as boolean}
          onChange={handleChange}
          style={{ cursor: 'pointer' }}
        />
      ) : type === 'object' ? (
        <input
          type="text"
          value={JSON.stringify(value)}
          readOnly
          style={{
            flex: 1,
            backgroundColor: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
            color: 'var(--color-text-muted)',
            fontSize: '11px',
            fontFamily: 'monospace',
          }}
        />
      ) : (
        <input
          type={type === 'number' ? 'number' : 'text'}
          value={value as string | number}
          onChange={handleChange}
          style={{
            flex: 1,
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
            color: 'var(--color-text-primary)',
            fontSize: '11px',
          }}
        />
      )}
    </div>
  );
}

interface ComponentEditorProps {
  entityId: number;
  componentType: string;
  data: Record<string, unknown>;
}

function ComponentEditor({ entityId, componentType, data }: ComponentEditorProps) {
  const { bridge } = useEditor();
  const [isExpanded, setIsExpanded] = useState(true);

  const handleFieldChange = (field: string, value: unknown) => {
    bridge.setComponentField(entityId, componentType, field, value);
  };

  const handleRemove = () => {
    bridge.removeComponent(entityId, componentType);
  };

  return (
    <div
      style={{
        marginBottom: '12px',
        backgroundColor: 'var(--color-bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: 'var(--color-bg-hover)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span
          style={{
            marginRight: '6px',
            fontSize: '10px',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          ▶
        </span>
        <span style={{ flex: 1, fontWeight: 600, fontSize: '12px' }}>
          {componentType}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
          style={{
            padding: '2px 8px',
            fontSize: '10px',
            backgroundColor: 'var(--color-error)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Remove
        </button>
      </div>

      {/* Fields */}
      {isExpanded && (
        <div style={{ padding: '12px' }}>
          {Object.entries(data).map(([field, value]) => (
            <FieldEditor
              key={field}
              label={field}
              value={value}
              type={typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : typeof value === 'object' ? 'object' : 'string'}
              onChange={(v) => handleFieldChange(field, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface InspectorPanelProps {
  /** 面板标题 */
  title?: string;
  /** 是否浮动模式（不显示标题栏） */
  isFloating?: boolean;
  /** 顶部工具栏内容（仅在 docked 模式下使用） */
  header?: ComponentChildren;
  /** 点击浮动按钮 */
  onFloat?: () => void;
}

/**
 * InspectorPanel - 属性面板
 *
 * 显示和编辑选中实体的组件属性。
 * 支持浮动和停靠两种模式。
 */
export function InspectorPanel({ title = 'Inspector', isFloating = false, header, onFloat }: InspectorPanelProps) {
  const { bridge, selection } = useEditor();
  const primaryId = selection.primary;

  // 渲染内容
  const renderContent = () => {
    if (primaryId === null) {
      return (
        <div style={floatingStyles.empty}>
          Select an entity to edit
        </div>
      );
    }

    const entity = bridge.getEntities().find((e) => e.id === primaryId);
    const components = bridge.getComponents(primaryId);

    if (!entity) {
      return <div style={floatingStyles.empty}>Entity not found</div>;
    }

    if (Object.entries(components).length === 0) {
      return <div style={floatingStyles.empty}>No components</div>;
    }

    return Object.entries(components).map(([type, data]) => (
      <ComponentEditor
        key={type}
        entityId={primaryId}
        componentType={type}
        data={data as Record<string, unknown>}
      />
    ));
  };

  // 浮动模式：只渲染内容
  if (isFloating) {
    return (
      <div style={floatingStyles.container}>
        {renderContent()}
      </div>
    );
  }

  // 停靠模式
  const entity = primaryId !== null ? bridge.getEntities().find((e) => e.id === primaryId) : null;

  return (
    <div style={panelStyles.container}>
      {/* Header */}
      <div style={panelStyles.header}>
        {header || (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>
                {title}
              </span>
              {entity && (
                <span
                  style={{
                    marginLeft: '8px',
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {entity.name} (ID: {entity.id})
                </span>
              )}
            </div>
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
        )}
      </div>

      {/* Components */}
      <div style={panelStyles.content}>
        {renderContent()}
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
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '12px',
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
    padding: '12px',
  },
  empty: {
    padding: '20px',
    textAlign: 'center',
    color: 'var(--color-text-muted)',
    fontSize: '12px',
  },
};
