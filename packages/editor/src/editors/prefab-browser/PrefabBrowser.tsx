// ═══════════════════════════════════════════════════════════════
// PrefabBrowser.tsx - Prefab 浏览器主组件
// ═══════════════════════════════════════════════════════════════

import { useEffect } from "preact/hooks";
import { SearchBar } from "./SearchBar";
import { PrefabCategory } from "./PrefabCategory";
import {
  prefabsByTag,
  allTags,
  selectedTag,
  loadBuiltinPrefabs,
} from "../../store/prefabs";

export function PrefabBrowser() {
  // 初始化时加载内置 Prefab
  useEffect(() => {
    loadBuiltinPrefabs();
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#1e1e1e",
        color: "#fff",
        fontSize: "13px",
      }}
    >
      {/* 标题栏 */}
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid #333",
          fontWeight: 600,
          fontSize: "13px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>Prefab 浏览器</span>
        <button
          onClick={() => {
            // TODO: 创建新 Prefab
            console.log("Create new prefab");
          }}
          style={{
            background: "#4a90d9",
            border: "none",
            color: "#fff",
            padding: "4px 10px",
            borderRadius: "3px",
            fontSize: "11px",
            cursor: "pointer",
          }}
        >
          + 新建
        </button>
      </div>

      {/* 搜索栏 */}
      <SearchBar />

      {/* tag 过滤器 */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          padding: "8px 12px",
          borderBottom: "1px solid #333",
          overflowX: "auto",
        }}
      >
        {allTags.value.map((tag) => (
          <button
            key={tag}
            onClick={() => {
              selectedTag.value = tag;
            }}
            style={{
              background: selectedTag.value === tag ? "#4a90d9" : "#2a2a2a",
              border: "none",
              color: selectedTag.value === tag ? "#fff" : "#999",
              padding: "4px 10px",
              borderRadius: "3px",
              fontSize: "11px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              textTransform: tag === "all" ? "none" : "capitalize",
            }}
          >
            {tag === "all" ? "全部" : tag}
          </button>
        ))}
      </div>

      {/* Prefab 列表 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {selectedTag.value === "all" ? (
          // 显示所有 tag 分组
          Array.from(prefabsByTag.value.entries()).map(
            ([tag, entries]) => (
              <PrefabCategory
                key={tag}
                name={tag}
                entries={entries}
              />
            )
          )
        ) : (
          // 只显示选中 tag
          <PrefabCategory
            name={selectedTag.value}
            entries={
              prefabsByTag.value.get(selectedTag.value) || []
            }
            defaultExpanded={true}
          />
        )}
      </div>

      {/* 底部状态栏 */}
      <div
        style={{
          padding: "6px 12px",
          borderTop: "1px solid #333",
          fontSize: "11px",
          color: "#666",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>拖拽到场景使用</span>
        <span>
          {Array.from(prefabsByTag.value.values()).flat().length} 个
          Prefab
        </span>
      </div>
    </div>
  );
}
