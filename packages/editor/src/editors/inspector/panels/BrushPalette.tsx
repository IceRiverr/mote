// ═══════════════════════════════════════════════════════════════
// BrushPalette.tsx - 笔刷选择面板
// ═══════════════════════════════════════════════════════════════

import { brushPattern, brushSize, targetLayer, setSinglePrefabBrush, setRectBrush, setCircleBrush, BRUSH_SIZES, LAYERS, activePrefabId } from "../../../store/brush";
import { prefabs, filteredPrefabs, prefabsByCategory, selectedCategory, searchQuery } from "../../../store/prefabs";

export function BrushPalette() {
  return (
    <div style={{
      padding: "8px",
      fontSize: "12px",
    }}>
      {/* 笔刷大小选择 */}
      <BrushSizeSelector />
      
      {/* 目标层选择 */}
      <LayerSelector />
      
      {/* 搜索框 */}
      <SearchBox />
      
      {/* 分类标签 */}
      <CategoryTabs />
      
      {/* Prefab 网格 */}
      <PrefabGrid />
      
      {/* 当前笔刷预览 */}
      <CurrentBrushPreview />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 笔刷大小选择
// ═══════════════════════════════════════════════════════════════

function BrushSizeSelector() {
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{
        fontSize: "11px",
        color: "var(--text-secondary)",
        marginBottom: "4px",
      }}>
        笔刷大小
      </div>
      <div style={{
        display: "flex",
        gap: "4px",
        flexWrap: "wrap",
      }}>
        {BRUSH_SIZES.map((size: number) => (
          <button
            key={size}
            onClick={() => {
              const currentPrefab = activePrefabId.value;
              if (currentPrefab) {
                setRectBrush(currentPrefab, size, size);
              }
              brushSize.value = size;
            }}
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
              fontSize: "11px",
              color: brushSize.value === size ? "#fff" : "var(--text)",
            }}
          >
            {size}×{size}
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
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{
        fontSize: "11px",
        color: "var(--text-secondary)",
        marginBottom: "4px",
      }}>
        绘制层
      </div>
      <select
        value={targetLayer.value}
        onChange={(e: Event) => targetLayer.value = parseInt((e.target as HTMLSelectElement).value)}
        style={{
          width: "100%",
          padding: "4px 8px",
          fontSize: "12px",
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
          borderRadius: "3px",
          color: "var(--text)",
          cursor: "pointer",
        }}
      >
        {LAYERS.map((layer: { id: number; label: string }) => (
          <option key={layer.id} value={layer.id}>
            {layer.label} (z:{layer.id})
          </option>
        ))}
      </select>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 搜索框
// ═══════════════════════════════════════════════════════════════

function SearchBox() {
  return (
    <div style={{ marginBottom: "12px" }}>
      <input
        type="text"
        placeholder="搜索..."
        value={searchQuery.value}
        onInput={(e: Event) => searchQuery.value = (e.target as HTMLInputElement).value}
        style={{
          width: "100%",
          padding: "4px 8px",
          fontSize: "12px",
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
          borderRadius: "3px",
          color: "var(--text)",
          outline: "none",
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 分类标签
// ═══════════════════════════════════════════════════════════════

function CategoryTabs() {
  const groups = prefabsByCategory.value;
  const categories = Array.from(groups.keys());
  
  return (
    <div style={{
      display: "flex",
      gap: "4px",
      marginBottom: "12px",
      flexWrap: "wrap",
    }}>
      <button
        onClick={() => selectedCategory.value = "all"}
        style={{
          padding: "2px 8px",
          fontSize: "11px",
          background: selectedCategory.value === "all" ? "var(--accent)" : "var(--bg-input)",
          border: "1px solid var(--border)",
          borderRadius: "3px",
          cursor: "pointer",
          color: selectedCategory.value === "all" ? "#fff" : "var(--text)",
        }}
      >
        全部
      </button>
      {categories.map((cat: string) => (
        <button
          key={cat}
          onClick={() => selectedCategory.value = cat}
          style={{
            padding: "2px 8px",
            fontSize: "11px",
            background: selectedCategory.value === cat ? "var(--accent)" : "var(--bg-input)",
            border: "1px solid var(--border)",
            borderRadius: "3px",
            cursor: "pointer",
            color: selectedCategory.value === cat ? "#fff" : "var(--text)",
            textTransform: "capitalize",
          }}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Prefab 网格
// ═══════════════════════════════════════════════════════════════

function PrefabGrid() {
  const prefabList = filteredPrefabs.value;
  
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "4px",
      maxHeight: "200px",
      overflowY: "auto",
    }}>
      {prefabList.map((prefab: { id: string; name: string; category: string }) => (
        <PrefabTile
          key={prefab.id}
          prefab={prefab}
          isActive={activePrefabId.value === prefab.id}
        />
      ))}
    </div>
  );
}

interface PrefabTileProps {
  prefab: { id: string; name: string; category: string };
  isActive: boolean;
}

function PrefabTile({ prefab, isActive }: PrefabTileProps) {
  return (
    <button
      onClick={() => setSinglePrefabBrush(prefab.id)}
      style={{
        aspectRatio: "1",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: isActive ? "var(--accent)" : "var(--bg-input)",
        border: `2px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "4px",
        cursor: "pointer",
        padding: "4px",
      }}
      title={prefab.name}
    >
      <div style={{
        width: "24px",
        height: "24px",
        background: getCategoryColor(prefab.category),
        borderRadius: "2px",
        marginBottom: "2px",
      }} />
      <span style={{
        fontSize: "9px",
        color: isActive ? "#fff" : "var(--text)",
        textAlign: "center",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: "100%",
      }}>
        {prefab.name}
      </span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// 当前笔刷预览
// ═══════════════════════════════════════════════════════════════

function CurrentBrushPreview() {
  const pattern = brushPattern.value;
  const currentPrefab = activePrefabId.value;
  
  if (!currentPrefab) {
    return (
      <div style={{
        marginTop: "12px",
        padding: "8px",
        background: "var(--bg-input)",
        borderRadius: "3px",
        textAlign: "center",
        color: "var(--text-secondary)",
        fontSize: "11px",
      }}>
        请选择一个 Prefab
      </div>
    );
  }
  
  return (
    <div style={{
      marginTop: "12px",
      padding: "8px",
      background: "var(--bg-input)",
      borderRadius: "3px",
    }}>
      <div style={{
        fontSize: "11px",
        color: "var(--text-secondary)",
        marginBottom: "4px",
      }}>
        当前笔刷
      </div>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(brushSize.value, 5)}, 1fr)`,
          gap: "1px",
        }}>
          {pattern.slice(0, 25).map((cell: { prefabId: string }, i: number) => (
            <div
              key={i}
              style={{
                width: "12px",
                height: "12px",
                background: cell.prefabId ? "var(--accent)" : "transparent",
                border: "1px solid var(--border)",
              }}
            />
          ))}
        </div>
        <div style={{
          fontSize: "11px",
          color: "var(--text)",
        }}>
          {pattern.length > 25 ? `+${pattern.length - 25} more` : `${pattern.length} 格`}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    environment: "#4a7c59",
    walls: "#8b7355",
    characters: "#d4574a",
    items: "#f4a742",
    system: "#666",
  };
  return colors[category] || "#4a90d9";
}

export default BrushPalette;
