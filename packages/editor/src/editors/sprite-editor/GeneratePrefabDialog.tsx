// ═══════════════════════════════════════════════════════════════
// GeneratePrefabDialog.tsx - 从 Sprite Frame 批量生成 Prefab
// ═══════════════════════════════════════════════════════════════

import { useState } from 'preact/hooks';
import { getPrefabFS } from '../../fs/PrefabFS';
import type { FrameData } from '../../data/SpriteSheet';

interface SpriteAtlasInfo {
  id: string;
  name: string;
  image: string;
  frames: FrameData[];
}

interface GeneratePrefabDialogProps {
  frames: FrameData[];
  atlas: SpriteAtlasInfo;
  onClose: () => void;
  onGenerated?: (count: number) => void;
}

export function GeneratePrefabDialog({
  frames,
  atlas,
  onClose,
  onGenerated,
}: GeneratePrefabDialogProps) {
  const [prefix, setPrefix] = useState(atlas.name);
  const [category, setCategory] = useState('environment');
  const [autoCollider, setAutoCollider] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [preview, setPreview] = useState<string[]>([]);

  // 生成预览
  const generatePreview = () => {
    const names: string[] = [];
    frames.forEach((_, index) => {
      const num = (index + 1).toString().padStart(2, '0');
      names.push(`${prefix}_${num}`);
    });
    setPreview(names);
  };

  // 执行生成
  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const prefabFS = getPrefabFS();
      await prefabFS.initialize();

      // 手动生成 Prefab
      let successCount = 0;
      
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const num = (i + 1).toString().padStart(2, '0');
        const prefabId = `${prefix}_${num}`;
        
        // 检查是否已存在
        if (prefabFS.has(prefabId)) {
          console.warn(`Prefab ${prefabId} already exists, skipping`);
          continue;
        }

        // 构建组件
        const components: Record<string, any> = {
          Transform: {
            x: 0,
            y: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          Sprite: {
            atlas: atlas.id,
            frame: frame.id,
            layer: 0,
            tint: '#ffffff',
            flipX: false,
            flipY: false,
            alpha: 1,
            visible: true,
          },
        };

        // 添加碰撞体（如果 frame 有定义且用户选择启用）
        if (autoCollider && frame.collider && frame.collider.length > 0) {
          components.Collider = {
            shapes: frame.collider,
            isTrigger: false,
            material: 'default',
            layer: 1,
            mask: 0xFFFFFFFF,
          };
        }

        // 创建 Prefab
        const prefab = {
          id: prefabId,
          name: prefabId,
          category,
          components,
        };

        // 保存
        const success = await prefabFS.save(prefab, category);
        if (success) successCount++;
      }

      onGenerated?.(successCount);
      onClose();
    } catch (err) {
      console.error('Failed to generate prefabs:', err);
      alert('生成失败: ' + (err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const categories = [
    { id: 'environment', name: '环境' },
    { id: 'characters', name: '角色' },
    { id: 'items', name: '物品' },
    { id: 'effects', name: '特效' },
    { id: 'ui', name: 'UI' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 480,
          maxHeight: '80vh',
          background: '#2a2a2a',
          borderRadius: 8,
          border: '1px solid #444',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 头部 */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #444',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              color: '#fff',
            }}
          >
            生成 Prefab
          </h2>
          <p
            style={{
              margin: '8px 0 0 0',
              fontSize: 13,
              color: '#888',
            }}
          >
            从选中的 {frames.length} 个 Sprite Frame 生成 Prefab
          </p>
        </div>

        {/* 内容 */}
        <div
          style={{
            padding: 20,
            overflowY: 'auto',
          }}
        >
          {/* 前缀 */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: '#aaa',
                marginBottom: 8,
                textTransform: 'uppercase',
              }}
            >
              ID 前缀
            </label>
            <input
              type="text"
              value={prefix}
              onInput={(e) => setPrefix((e.target as HTMLInputElement).value)}
              placeholder="例如: wall, grass, tree"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 14,
                background: '#1a1a1a',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#fff',
                outline: 'none',
              }}
            />
            <p
              style={{
                margin: '6px 0 0 0',
                fontSize: 12,
                color: '#666',
              }}
            >
              生成的 Prefab ID 格式: {prefix}_01, {prefix}_02...
            </p>
          </div>

          {/* 分类 */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: '#aaa',
                marginBottom: 8,
                textTransform: 'uppercase',
              }}
            >
              分类
            </label>
            <select
              value={category}
              onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 14,
                background: '#1a1a1a',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#fff',
                outline: 'none',
              }}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* 自动碰撞体 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              padding: 12,
              background: '#1a1a1a',
              borderRadius: 4,
            }}
          >
            <input
              type="checkbox"
              id="auto-collider"
              checked={autoCollider}
              onChange={(e) => setAutoCollider((e.target as HTMLInputElement).checked)}
              style={{
                width: 18,
                height: 18,
                cursor: 'pointer',
              }}
            />
            <label
              htmlFor="auto-collider"
              style={{
                fontSize: 14,
                color: '#e0e0e0',
                cursor: 'pointer',
              }}
            >
              自动添加碰撞体（如果 Sprite Frame 有定义）
            </label>
          </div>

          {/* 预览 */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#aaa',
                  textTransform: 'uppercase',
                }}
              >
                预览
              </label>
              <button
                onClick={generatePreview}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  background: '#333',
                  border: '1px solid #444',
                  borderRadius: 4,
                  color: '#aaa',
                  cursor: 'pointer',
                }}
              >
                刷新预览
              </button>
            </div>

            {preview.length > 0 ? (
              <div
                style={{
                  maxHeight: 150,
                  overflowY: 'auto',
                  background: '#1a1a1a',
                  borderRadius: 4,
                  padding: 8,
                }}
              >
                {preview.map((name, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '4px 8px',
                      fontSize: 13,
                      color: '#888',
                      fontFamily: 'monospace',
                    }}
                  >
                    {name}
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: 20,
                  textAlign: 'center',
                  color: '#666',
                  fontSize: 13,
                  background: '#1a1a1a',
                  borderRadius: 4,
                }}
              >
                点击"刷新预览"查看生成的 Prefab 名称
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #444',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
          }}
        >
          <button
            onClick={onClose}
            disabled={isGenerating}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              background: 'transparent',
              border: '1px solid #444',
              borderRadius: 4,
              color: '#aaa',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prefix.trim()}
            style={{
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              background: '#4a90d9',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              cursor: isGenerating || !prefix.trim() ? 'not-allowed' : 'pointer',
              opacity: isGenerating || !prefix.trim() ? 0.6 : 1,
            }}
          >
            {isGenerating ? '生成中...' : `生成 ${frames.length} 个 Prefab`}
          </button>
        </div>
      </div>
    </div>
  );
}
