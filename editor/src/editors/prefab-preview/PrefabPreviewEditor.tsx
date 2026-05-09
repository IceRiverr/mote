// ═══════════════════════════════════════════════════════════════
// PrefabEditor.tsx — Prefab 可编辑面板（由 PrefabPreviewEditor 升级）
// ═══════════════════════════════════════════════════════════════

import { useState } from 'preact/hooks';
import { registerEditor } from '../registry';
import { previewedPrefabPath } from '../../store/contentBrowser';
import { getPrefab, prefabs } from '../../store/prefabs';
import { editingPrefab, createDraft, discardDraft, resetDraft, hasDraftChanges } from '../../store/prefabEditor';
import {
  EditPrefabPropertyCommand,
  AddPrefabComponentCommand,
  RemovePrefabComponentCommand,
  SavePrefabCommand,
} from '../../commands/prefab-commands';
import { executeCommand } from '../../store/history';
import { spawnPrefab } from '../../store/scene';
import { ComponentPanel } from '../../components/inspector/ComponentPanel';
import type { Prefab } from '../../data/Prefab';
import { derivePrefabId, getPrefabDisplayName, PREFAB_KIND } from '../../data/Prefab';
import { PrefabThumbnail } from './PrefabThumbnail';
import { getComponentSchema, editableComponentNames } from '../../store/schema';
import type { ComponentSchema } from '../../store/schema';

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

// ═══════════════════════════════════════════════════════════════
// Schema 获取（与 EntityInspector 共用同一套机制）
// ═══════════════════════════════════════════════════════════════

/**
 * 获取组件 schema：优先从 engine 动态 schema，缺失字段回退 legacy
 */
function getSchema(name: string): ComponentSchema | undefined {
  return getComponentSchema(name) ?? undefined;
}

/**
 * 从 schema 提取默认值对象
 */
function getDefaultsFromSchema(schema?: ComponentSchema): Record<string, any> {
  if (!schema) return {};
  const defaults: Record<string, any> = {};
  for (const [k, prop] of Object.entries(schema.properties)) {
    defaults[k] = prop.default;
  }
  return defaults;
}

function PrefabEditor({ areaId }: { areaId: string }) {
  const rawPath = previewedPrefabPath.value;
  // Content Browser 传入的 path 带 "assets/" 前缀，统一转为相对路径
  const relativePath = rawPath?.startsWith('assets/') ? rawPath.slice(7) : rawPath ?? '';
  const draftState = editingPrefab.value;
  const [showAddComponent, setShowAddComponent] = useState(false);

  // 当 path 变化时，自动创建/切换 draft
  if (relativePath && (!draftState || draftState.path !== relativePath)) {
    const prefabId = derivePrefabId(relativePath);
    const prefab = getPrefab(prefabId);
    if (prefab) {
      createDraft(prefabId, relativePath, prefab);
    }
  }

  // 如果没有 path 或 draft，显示空状态
  const current = editingPrefab.value;
  if (!relativePath || !current) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: 12,
          gap: 8,
          padding: 20,
        }}
      >
        <span style={{ fontSize: 32, opacity: 0.3 }}>📦</span>
        <span>请在 Content Browser 中双击 Prefab 进行编辑</span>
      </div>
    );
  }

  const prefab = current.draft;
  const prefabId = current.prefabId;
  const tag = prefab.tags?.[0];
  const componentEntries = Object.entries(prefab.components);
  const dirty = hasDraftChanges();

  // 处理元信息编辑
  const handleMetaChange = (prop: string, value: any) => {
    executeCommand(new EditPrefabPropertyCommand('__meta__', prop, value));
  };

  // 处理组件属性编辑
  const handleComponentChange = (
    componentName: string,
    _data: Record<string, any>,
    propertyName: string,
    newValue: any
  ) => {
    executeCommand(new EditPrefabPropertyCommand(componentName, propertyName, newValue));
  };

  // 添加组件
  const handleAddComponent = (compName: string) => {
    const schema = getSchema(compName);
    const defaults = getDefaultsFromSchema(schema);
    executeCommand(new AddPrefabComponentCommand(compName, defaults));
    setShowAddComponent(false);
  };

  // 删除组件
  const handleRemoveComponent = (compName: string) => {
    executeCommand(new RemovePrefabComponentCommand(compName));
  };

  // 保存
  const handleSave = async () => {
    await executeCommand(new SavePrefabCommand(prefabId, current.path));
  };

  // 重置
  const handleReset = () => {
    resetDraft();
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        padding: 10,
        gap: 8,
        fontSize: 12,
        color: 'var(--text-primary)',
      }}
    >
      {/* 缩略图 + 基础信息 */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 64,
            height: 64,
            minWidth: 64,
            background: '#2a2a2a',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}
        >
          <PrefabThumbnail prefab={prefab} size={60} />
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Name 输入 */}
          <input
            type="text"
            value={prefab.name || ''}
            onChange={(e) => handleMetaChange('name', (e.target as HTMLInputElement).value)}
            placeholder="Prefab 名称"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-bright)',
              background: 'transparent',
              border: '1px solid transparent',
              borderBottom: '1px solid #444',
              borderRadius: 2,
              padding: '2px 4px',
              outline: 'none',
              lineHeight: 1.3,
            }}
            onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = '#4a90d9'; }}
            onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'transparent'; (e.target as HTMLInputElement).style.borderBottomColor = '#444'; }}
          />
          <div style={{ color: 'var(--text-secondary)', fontSize: 10, fontFamily: 'monospace' }}>
            {prefabId}
          </div>
          {tag && (
            <span
              style={{
                display: 'inline-flex',
                alignSelf: 'flex-start',
                fontSize: 9,
                color: getTagColor(tag),
                background: `${getTagColor(tag)}18`,
                padding: '1px 5px',
                borderRadius: 3,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginTop: 2,
              }}
            >
              {tag}
            </span>
          )}
        </div>
      </div>

      {/* Tags 输入 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Tags:</span>
        <input
          type="text"
          value={prefab.tags?.join(', ') || ''}
          onChange={(e) => {
            const raw = (e.target as HTMLInputElement).value;
            const tags = raw.split(',').map(t => t.trim()).filter(Boolean);
            handleMetaChange('tags', tags.length > 0 ? tags : undefined);
          }}
          placeholder="逗号分隔"
          style={{
            flex: 1,
            fontSize: 11,
            background: '#2a2a2a',
            border: '1px solid #333',
            borderRadius: 3,
            padding: '3px 6px',
            color: '#fff',
            outline: 'none',
          }}
        />
      </div>

      {/* 路径 */}
      <div
        style={{
          color: 'var(--text-secondary)',
          fontSize: 9,
          wordBreak: 'break-all',
          opacity: 0.6,
          fontFamily: 'monospace',
          lineHeight: 1.4,
        }}
      >
        {rawPath}
      </div>

      {/* 保存 / 重置 */}
      {dirty && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '6px',
              background: '#4a90d9',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            💾 保存
          </button>
          <button
            onClick={handleReset}
            style={{
              flex: 1,
              padding: '6px',
              background: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: 4,
              color: '#999',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            🔄 重置
          </button>
        </div>
      )}

      {/* 分隔线 */}
      <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

      {/* 组件列表 */}
      <div style={{ fontWeight: 600, fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>
        组件 ({componentEntries.length})
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {componentEntries.map(([name, data]) => (
          <ComponentPanel
            key={name}
            name={name}
            displayName={getSchema(name)?.displayName ?? name}
            data={data as any}
            schema={getSchema(name)}
            onChange={(newData, prop, val) => handleComponentChange(name, newData, prop, val)}
            removable={name !== 'Transform'}
            onRemove={() => handleRemoveComponent(name)}
          />
        ))}
      </div>

      {/* 添加组件 */}
      <button
        onClick={() => setShowAddComponent(true)}
        style={{
          width: '100%',
          padding: '8px',
          background: '#2a2a2a',
          border: '1px dashed #444',
          borderRadius: '4px',
          color: '#999',
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        + 添加组件
      </button>

      {showAddComponent && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '8px',
            padding: '16px',
            zIndex: 1000,
          }}
        >
          <div style={{ marginBottom: '12px', fontWeight: 600 }}>添加组件</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '40vh', overflow: 'auto' }}>
            {editableComponentNames.value
              .filter(c => c !== 'Transform' && !prefab.components[c])
              .map((comp) => (
                <button
                  key={comp}
                  onClick={() => handleAddComponent(comp)}
                  style={{
                    padding: '8px 12px',
                    background: '#333',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {getSchema(comp)?.displayName ?? comp}
                </button>
              ))}
          </div>
          <button
            onClick={() => setShowAddComponent(false)}
            style={{
              marginTop: '12px',
              width: '100%',
              padding: '8px',
              background: 'transparent',
              border: '1px solid #444',
              borderRadius: '4px',
              color: '#999',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
        </div>
      )}

      {/* 底部间距 */}
      <div style={{ height: 8 }} />

      {/* 实例化按钮 */}
      <button
        onClick={() => {
          spawnPrefab(prefabId, 320, 240);
        }}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: '#4a7c59',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          flexShrink: 0,
        }}
      >
        🎯 实例化到场景 (320, 240)
      </button>
    </div>
  );
}

registerEditor({
  id: 'prefab-preview',
  name: 'Prefab 编辑器',
  icon: '📦',
  component: PrefabEditor,
});

export { PrefabEditor };
