// ═══════════════════════════════════════════════════════════════
// BrushPalette.tsx - 简化的笔刷配置面板
// 只显示当前选中的 Prefab 和笔刷参数配置
// Prefab 选择统一到 PrefabBrowser
// ═══════════════════════════════════════════════════════════════

import { brushPattern, brushSize, targetLayer, activePrefabId, BRUSH_SIZES, LAYERS } from "../../../store/brush";
import { getPrefab } from "../../../store/prefabs";
import { activeTool } from "../../../store/selection";

export function BrushPalette() {
  const currentPrefab = activePrefabId.value;
  const prefab = currentPrefab ? getPrefab(currentPrefab) : null;
  const tool = activeTool.value;

  // 如果没有选中 Prefab 且不是橡皮工具，显示提示
  if (!prefab && tool !== "eraser") {
    return (
      <div style={{
        padding: "16px",
        textAlign: "center",
        color: "var(--text-secondary)",
        fontSize: "12px",
      }}>
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>✏️</div>
        <div style={{ marginBottom: "8px" }}>未选择笔刷</div>
        <div style={{ fontSize: "11px", opacity: 0.7 }}>
          请在 <strong>Prefab 浏览器</strong> 中点击一个 Prefab
        </div>
        <div style={{ 
          marginTop: "12px", 
          padding: "8px 12px", 
          background: "var(--bg-input)",
          borderRadius: "4px",
          fontSize: "11px",
        }}>
          💡 按 <kbd style={{
            background: "var(--bg-panel)",
            padding: "2px 6px",
            borderRadius: "3px",
            fontFamily: "monospace",
          }}>B</kbd> 切换到笔刷模式
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: "12px",
      fontSize: "12px",
    }}>
      {/* 当前笔刷信息 */}
      <CurrentBrushInfo />
      
      {/* 笔刷大小 */}
      <BrushSizeSelector />
      
      {/* 目标层 */}
      <LayerSelector />
      
      {/* 操作提示 */}
      <div style={{
        marginTop: "12px",
        padding: "8px",
        background: "var(--bg-input)",
        borderRadius: "4px",
        fontSize: "10px",
        color: "var(--text-secondary)",
      }}>
        <div>💡 左键点击绘制</div>
        <div>💡 拖拽连续绘制</div>
        <div>💡 换 Prefab 去浏览器点击</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 当前笔刷信息
// ═══════════════════════════════════════════════════════════════

function CurrentBrushInfo() {
  const currentPrefab = activePrefabId.value;
  const prefab = currentPrefab ? getPrefab(currentPrefab) : null;
  const tool = activeTool.value;
  const pattern = brushPattern.value;

  // 橡皮擦模式
  if (tool === "eraser") {
    return (
      <div style={{
        padding: "12px",
        background: "rgba(212, 87, 74, 0.1)",
        borderRadius: "6px",
        marginBottom: "12px",
        border: "1px solid rgba(212, 87, 74, 0.3)",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "4px",
        }}>
          <span style={{ fontSize: "16px" }}>🧹</span>
          <span style={{
            fontWeight: 600,
            color: "#d4574a",
          }}>
            橡皮擦
          </span>
        </div>
        <div style={{
          fontSize: "11px",
          color: "var(--text-secondary)",
        }}>
          {brushSize.value}×{brushSize.value} 范围擦除
        </div>
      </div>
    );
  }

  // 填充模式
  if (tool === "fill") {
    return (
      <div style={{
        padding: "12px",
        background: "rgba(74, 144, 217, 0.1)",
        borderRadius: "6px",
        marginBottom: "12px",
        border: "1px solid rgba(74, 144, 217, 0.3)",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "4px",
        }}>
          <span style={{ fontSize: "16px" }}>🪣</span>
          <span style={{
            fontWeight: 600,
            color: "var(--accent)",
          }}>
            填充工具
          </span>
        </div>
        <div style={{
          fontSize: "11px",
          color: "var(--text-secondary)",
        }}>
          {prefab 
            ? `填充为: ${prefab.name}`
            : "请先选择 Prefab"
          }
        </div>
      </div>
    );
  }

  // 笔刷模式
  if (!prefab) return null;

  return (
    <div style={{
      padding: "12px",
      background: "rgba(74, 144, 217, 0.1)",
      borderRadius: "6px",
      marginBottom: "12px",
      border: "1px solid rgba(74, 144, 217, 0.3)",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}>
        {/* 笔刷预览 */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(brushSize.value, 4)}, 1fr)`,
          gap: "1px",
          background: "var(--bg-input)",
          padding: "4px",
          borderRadius: "4px",
        }}>
          {pattern.slice(0, 16).map((cell: { prefabId: string }, i: number) => (
            <div
              key={i}
              style={{
                width: "10px",
                height: "10px",
                background: cell.prefabId ? "var(--accent)" : "transparent",
                borderRadius: "1px",
              }}
            />
          ))}
        </div>

        {/* Prefab 信息 */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontWeight: 600,
            color: "var(--text)",
            marginBottom: "2px",
          }}>
            {prefab.name}
          </div>
          <div style={{
            fontSize: "10px",
            color: "var(--text-secondary)",
          }}>
            {pattern.length > 1 ? `${pattern.length} 格` : "单格"} · 
            {prefab.tags?.[0] ?? ''}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 笔刷大小选择
// ═══════════════════════════════════════════════════════════════

function BrushSizeSelector() {
  const tool = activeTool.value;
  const isEraser = tool === "eraser";

  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{
        fontSize: "11px",
        color: "var(--text-secondary)",
        marginBottom: "6px",
        display: "flex",
        justifyContent: "space-between",
      }}>
        <span>{isEraser ? "擦除范围" : "笔刷大小"}</span>
        <span style={{ fontFamily: "monospace" }}>
          {brushSize.value}×{brushSize.value}
        </span>
      </div>
      <div style={{
        display: "flex",
        gap: "3px",
        flexWrap: "wrap",
      }}>
        {BRUSH_SIZES.slice(0, 6).map((size: number) => (
          <button
            key={size}
            onClick={() => brushSize.value = size}
            style={{
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: brushSize.value === size ? "var(--accent)" : "var(--bg-input)",
              border: "1px solid var(--border)",
              borderRadius: "3px",
              cursor: "pointer",
              fontSize: "10px",
              color: brushSize.value === size ? "#fff" : "var(--text)",
            }}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 目标层选择
// ═══════════════════════════════════════════════════════════════

function LayerSelector() {
  const currentLayer = LAYERS.find(l => l.id === targetLayer.value);

  return (
    <div>
      <div style={{
        fontSize: "11px",
        color: "var(--text-secondary)",
        marginBottom: "6px",
      }}>
        绘制到层
      </div>
      
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "3px",
      }}>
        {LAYERS.filter(l => l.id >= 0 && l.id <= 50).map(layer => (
          <button
            key={layer.id}
            onClick={() => targetLayer.value = layer.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 8px",
              background: targetLayer.value === layer.id ? "var(--accent)" : "var(--bg-input)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "11px",
              color: targetLayer.value === layer.id ? "#fff" : "var(--text)",
              textAlign: "left",
            }}
          >
            <div style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: layer.color,
              flexShrink: 0,
            }} />
            <span style={{ flex: 1 }}>{layer.label}</span>
            {targetLayer.value === layer.id && (
              <span style={{ fontSize: "10px", opacity: 0.8 }}>✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default BrushPalette;
