// ═══════════════════════════════════════════════════════════════
// SpriteEditorProperties.tsx — Blender-style N-Panel (Properties panel)
// Shows properties of selected frame(s), replaces right-click menu
// ═══════════════════════════════════════════════════════════════

import { useState } from 'preact/hooks';
import {
  activeSpriteSheet,
  selectedFrameIds,
  activeFrame,
  setFrameTags,
  propertiesPanelVisible,
} from './state';
import { getFileSystem } from '../../fs/FileSystem';
import { OpenProjectDialog } from '../../components/OpenProjectDialog';
import { GeneratePrefabDialog } from './GeneratePrefabDialog';

// ── Generate Prefab Button ───────────────────────────────────

function GeneratePrefabButton() {
  const sheet = activeSpriteSheet.value;
  const selected = selectedFrameIds.value;
  const [showDialog, setShowDialog] = useState(false);
  const [showOpenProjectDialog, setShowOpenProjectDialog] = useState(false);

  if (!sheet || selected.length === 0) return null;

  const selectedFrames = selected.map((frameId) => ({
    name: frameId,
    ...sheet.frames[frameId],
  }));

  return (
    <>
      <button
        onClick={async () => {
          const fs = getFileSystem();
          if (!fs.hasRoot()) {
            setShowOpenProjectDialog(true);
            return;
          }
          setShowDialog(true);
        }}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: 'rgba(74, 144, 217, 0.2)',
          border: '1px solid rgba(74, 144, 217, 0.5)',
          borderRadius: 4,
          color: '#4a90d9',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 'bold',
          marginTop: 8,
        }}
      >
        ➕ 生成 {selected.length} 个 Prefab
      </button>

      {showDialog && (
        <GeneratePrefabDialog
          frames={selectedFrames}
          atlas={{
            id: sheet.id,
            name: sheet.name,
            image: sheet.image,
            jsonPath: sheet.jsonPath || `${sheet.name}.mote-sprite.json`,
            frames: selectedFrames,
          }}
          onClose={() => setShowDialog(false)}
          onGenerated={(count) => {
            alert(`成功生成 ${count} 个 Prefab`);
          }}
        />
      )}

      {showOpenProjectDialog && (
        <OpenProjectDialog
          onClose={() => setShowOpenProjectDialog(false)}
          onOpened={() => {
            setShowOpenProjectDialog(false);
            setShowDialog(true);
          }}
        />
      )}
    </>
  );
}

// ── Section Header ────────────────────────────────────────────

function SectionHeader({ title, expanded, onToggle }: { title: string; expanded: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 0',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 'bold',
        color: 'var(--text-primary)',
        borderBottom: '1px solid var(--border)',
        marginBottom: 8,
      }}
    >
      <span style={{
        transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 0.15s ease',
        fontSize: 10,
      }}>▶</span>
      {title}
    </div>
  );
}

// ── Frame Info Section ───────────────────────────────────────

function FrameInfoSection() {
  const sheet = activeSpriteSheet.value;
  const selected = selectedFrameIds.value;
  const frame = activeFrame.value;

  if (!sheet) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
        未选择图集
      </div>
    );
  }

  if (selected.length === 0) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
        在画布中选择帧以查看属性
      </div>
    );
  }

  if (selected.length > 1) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
          多选：{selected.length} 帧
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
          {selected.slice(0, 5).join(', ')}
          {selected.length > 5 && ` ...等${selected.length - 5}个`}
        </div>
      </div>
    );
  }

  // Single selection
  if (!frame) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text-bright)' }}>
          {frame.id}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
          {frame.frame.w}×{frame.frame.h}
        </span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
        位置：({frame.frame.x}, {frame.frame.y})
      </div>
    </div>
  );
}

// ── Tags Section ─────────────────────────────────────────────

function TagsSection() {
  const [expanded, setExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  
  const sheet = activeSpriteSheet.value;
  const selected = selectedFrameIds.value;
  const frame = activeFrame.value;

  if (!sheet || selected.length === 0) return null;

  // Get tags from first selected frame (for multi-select, this shows first frame's tags)
  const currentTags = frame?.frame.tags ?? [];

  const handleCommit = () => {
    const newTags = inputValue
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    
    selected.forEach(frameId => {
      setFrameTags(sheet.id, frameId, newTags);
    });
    setIsEditing(false);
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = currentTags.filter(t => t !== tagToRemove);
    selected.forEach(frameId => {
      setFrameTags(sheet.id, frameId, newTags);
    });
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <SectionHeader
        title="标签"
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
      
      {expanded && (
        <div>
          {/* Tag display */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {currentTags.length === 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                无标签
              </span>
            )}
            {currentTags.map((tag) => (
              <span
                key={tag}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 6px',
                  background: 'var(--bg-input)',
                  borderRadius: 3,
                  fontSize: 10,
                  color: 'var(--text-primary)',
                }}
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    fontSize: 10,
                    padding: 0,
                    lineHeight: 1,
                  }}
                  title="移除标签"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          {/* Edit input */}
          {isEditing ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="text"
                value={inputValue}
                onInput={(e) => setInputValue((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommit();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                placeholder="tag1, tag2, tag3"
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: 11,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  color: 'var(--text-bright)',
                  outline: 'none',
                }}
                autoFocus
              />
              <button
                onClick={handleCommit}
                style={{
                  padding: '4px 8px',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 3,
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                ✓
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setInputValue(currentTags.join(', '));
                setIsEditing(true);
              }}
              style={{
                padding: '4px 8px',
                background: 'transparent',
                border: '1px dashed var(--border)',
                borderRadius: 3,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: 11,
                width: '100%',
                textAlign: 'left',
              }}
            >
              + 编辑标签
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Properties Panel ─────────────────────────────────────────

export function SpriteEditorProperties() {
  if (!propertiesPanelVisible.value) return null;

  return (
    <div
      style={{
        width: 200,
        minWidth: 200,
        maxWidth: 200,
        background: 'var(--bg-sidebar)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-primary)' }}>
          属性
        </span>
        <button
          onClick={() => {
            propertiesPanelVisible.value = false;
          }}
          title="隐藏属性面板 (N)"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: 12,
            padding: '2px 4px',
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 12px 12px',
        }}
      >
        <FrameInfoSection />
        <TagsSection />
        <GeneratePrefabButton />
      </div>
    </div>
  );
}

// ── Toggle Button (shown when panel is hidden) ───────────────

export function PropertiesToggleButton() {
  if (propertiesPanelVisible.value) return null;

  return (
    <button
      onClick={() => {
        propertiesPanelVisible.value = true;
      }}
      title="显示属性面板 (N)"
      style={{
        position: 'absolute',
        right: 8,
        top: 8,
        width: 28,
        height: 28,
        background: 'var(--bg-sidebar)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        fontSize: 12,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      ◀
    </button>
  );
}
