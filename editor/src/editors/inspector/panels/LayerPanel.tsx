// ═══════════════════════════════════════════════════════════════
// LayerPanel.tsx - 层管理面板
// ═══════════════════════════════════════════════════════════════

import { signal, computed } from "@preact/signals";
import { targetLayer, LAYERS, getLayerById } from "../../../store/brush";
import { currentScene } from "../../../store/scene";
import { prefabs } from "../../../store/prefabs";

// ═══════════════════════════════════════════════════════════════
// 层显隐状态（独立于数据，纯编辑器状态）
// ═══════════════════════════════════════════════════════════════

function createDefaultVisibility(): Record<number, boolean> {
  const visibility: Record<number, boolean> = {};
  for (const layer of LAYERS) {
    visibility[layer.id] = true;
  }
  return visibility;
}

export const layerVisibility = signal<Record<number, boolean>>(createDefaultVisibility());

// ═══════════════════════════════════════════════════════════════
// 计算属性
// ═══════════════════════════════════════════════════════════════

/** 每个层的实体计数 */
export const layerEntityCounts = computed(() => {
  const scene = currentScene.value;
  const counts: Record<number, number> = {};
  
  // 初始化所有层为 0
  for (const layer of LAYERS) {
    counts[layer.id] = 0;
  }
  
  if (!scene) return counts;
  
  // 统计每个层的实体数
  for (const entity of scene.entities) {
    const prefab = prefabs.value.get(entity.prefab);
    const layer = prefab?.components?.Sprite?.layer ?? 0;
    counts[layer] = (counts[layer] ?? 0) + 1;
  }
  
  return counts;
});

// ═══════════════════════════════════════════════════════════════
// 操作
// ═══════════════════════════════════════════════════════════════

export function toggleLayerVisibility(layerId: number): void {
  layerVisibility.value = {
    ...layerVisibility.value,
    [layerId]: !layerVisibility.value[layerId],
  };
}

export function setLayerVisibility(layerId: number, visible: boolean): void {
  layerVisibility.value = {
    ...layerVisibility.value,
    [layerId]: visible,
  };
}

export function selectLayer(layerId: number): void {
  targetLayer.value = layerId;
}

export function isLayerVisible(layerId: number): boolean {
  return layerVisibility.value[layerId] !== false;
}

// ═══════════════════════════════════════════════════════════════
// 组件
// ═══════════════════════════════════════════════════════════════

export function LayerPanel() {
  const counts = layerEntityCounts.value;
  
  return (
    <div style={{
      padding: "8px",
      fontSize: "12px",
    }}>
      <div style={{
        fontWeight: "bold",
        marginBottom: "8px",
        color: "var(--text)",
      }}>
        层管理
      </div>
      
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "2px",
      }}>
        {LAYERS.map(layer => {
          const isActive = targetLayer.value === layer.id;
          const isVisible = isLayerVisible(layer.id);
          const count = counts[layer.id] ?? 0;
          
          return (
            <LayerItem
              key={layer.id}
              layer={layer}
              isActive={isActive}
              isVisible={isVisible}
              count={count}
            />
          );
        })}
      </div>
      
      {/* 层说明 */}
      <div style={{
        marginTop: "12px",
        paddingTop: "8px",
        borderTop: "1px solid var(--border)",
        fontSize: "10px",
        color: "var(--text-secondary)",
      }}>
        <div>💡 点击层名称切换当前层</div>
        <div>💡 点击眼睛切换显示/隐藏</div>
      </div>
    </div>
  );
}

interface LayerItemProps {
  layer: { id: number; name: string; label: string; color: string };
  isActive: boolean;
  isVisible: boolean;
  count: number;
}

function LayerItem({ layer, isActive, isVisible, count }: LayerItemProps) {
  return (
    <div
      onClick={() => selectLayer(layer.id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "4px 8px",
        borderRadius: "3px",
        cursor: "pointer",
        background: isActive ? "var(--accent)" : "transparent",
        opacity: isVisible ? 1 : 0.5,
        transition: "background 0.15s, opacity 0.15s",
      }}
      onMouseEnter={(e: MouseEvent) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.background = "var(--hover)";
        }
      }}
      onMouseLeave={(e: MouseEvent) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }
      }}
    >
      {/* 显隐切换按钮 */}
      <button
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          toggleLayerVisibility(layer.id);
        }}
        style={{
          width: "18px",
          height: "18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "12px",
          color: isVisible ? "var(--text)" : "var(--text-secondary)",
          padding: 0,
        }}
        title={isVisible ? "点击隐藏" : "点击显示"}
      >
        {isVisible ? "👁" : "🚫"}
      </button>
      
      {/* 层颜色指示器 */}
      <div
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "2px",
          background: layer.color,
          flexShrink: 0,
        }}
      />
      
      {/* 层名称 */}
      <span style={{
        flex: 1,
        color: isActive ? "#fff" : "var(--text)",
        fontWeight: isActive ? 600 : 400,
      }}>
        {layer.label}
      </span>
      
      {/* 实体计数 */}
      {count > 0 && (
        <span style={{
          fontSize: "10px",
          color: isActive ? "rgba(255,255,255,0.7)" : "var(--text-secondary)",
          background: isActive ? "rgba(255,255,255,0.2)" : "var(--bg-input)",
          padding: "1px 5px",
          borderRadius: "10px",
          minWidth: "20px",
          textAlign: "center",
        }}>
          {count}
        </span>
      )}
      
      {/* 层索引提示 */}
      <span style={{
        fontSize: "10px",
        color: isActive ? "rgba(255,255,255,0.5)" : "var(--text-secondary)",
        fontFamily: "monospace",
      }}>
        z:{layer.id}
      </span>
    </div>
  );
}

export default LayerPanel;
