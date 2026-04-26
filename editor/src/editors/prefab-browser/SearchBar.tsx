// ═══════════════════════════════════════════════════════════════
// SearchBar.tsx - 搜索栏组件
// ═══════════════════════════════════════════════════════════════

import { searchQuery } from "../../store/prefabs";

interface SearchBarProps {
  placeholder?: string;
}

export function SearchBar({ placeholder = "搜索 Prefab..." }: SearchBarProps) {
  return (
    <div
      style={{
        padding: "8px 12px",
        borderBottom: "1px solid #333",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "#2a2a2a",
          borderRadius: "4px",
          padding: "6px 10px",
        }}
      >
        <span style={{ color: "#666", fontSize: "14px" }}>🔍</span>
        <input
          type="text"
          value={searchQuery.value}
          onInput={(e) => {
            searchQuery.value = (e.target as HTMLInputElement).value;
          }}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            color: "#fff",
            fontSize: "13px",
            outline: "none",
          }}
        />
        {searchQuery.value && (
          <button
            onClick={() => {
              searchQuery.value = "";
            }}
            style={{
              background: "none",
              border: "none",
              color: "#666",
              cursor: "pointer",
              fontSize: "12px",
              padding: "0",
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
