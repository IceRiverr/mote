// ═══════════════════════════════════════════════════════════════
// EntityInspector.tsx - 实体属性检查器主组件
// ═══════════════════════════════════════════════════════════════

import { useState } from "preact/hooks";
import { singleSelectedEntity, updateEntity } from "../../store/scene";
import { prefabs, getPrefab } from "../../store/prefabs";
import { ComponentPanel } from "./ComponentPanel";

// 模拟的组件 Schema（实际应从 component-schemas.json 加载）
const COMPONENT_SCHEMAS: Record<string, any> = {
  Transform: {
    properties: {
      x: { type: "number", label: "X", constraints: { step: 1 } },
      y: { type: "number", label: "Y", constraints: { step: 1 } },
      rotation: { type: "number", label: "旋转", constraints: { step: 15 } },
      scaleX: { type: "number", label: "缩放 X", constraints: { step: 0.1 } },
      scaleY: { type: "number", label: "缩放 Y", constraints: { step: 0.1 } },
    },
  },
  Sprite: {
    properties: {
      atlas: { type: "string", label: "图集" },
      frame: { type: "string", label: "帧" },
      layer: { type: "number", label: "层级", constraints: { step: 1 } },
      tint: { type: "color", label: "染色" },
      flipX: { type: "boolean", label: "水平翻转" },
      flipY: { type: "boolean", label: "垂直翻转" },
      alpha: { type: "number", label: "透明度", constraints: { min: 0, max: 1, step: 0.1 } },
      visible: { type: "boolean", label: "可见" },
    },
  },
  Collider: {
    properties: {
      isTrigger: { type: "boolean", label: "触发器" },
      material: { type: "string", label: "材质" },
      layer: { type: "number", label: "层级", constraints: { step: 1 } },
    },
  },
};

export function EntityInspector() {
  const entity = singleSelectedEntity.value;
  const [showAddComponent, setShowAddComponent] = useState(false);

  if (!entity) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          color: "#666",
          fontSize: "13px",
        }}
      >
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>📦</div>
        <div>选择 Entity 查看属性</div>
        <div style={{ marginTop: "8px", fontSize: "11px" }}>
          在场景中点击或框选 Entity
        </div>
      </div>
    );
  }

  const prefab = getPrefab(entity.prefab);
  if (!prefab) {
    return (
      <div style={{ padding: "20px", color: "#d4574a" }}>
        错误：找不到 Prefab "{entity.prefab}"
      </div>
    );
  }

  // 合并 Prefab 组件和 Entity overrides
  const mergedComponents = { ...prefab.components, ...entity.overrides };

  const handleComponentChange = (componentName: string, data: any) => {
    const newOverrides = {
      ...entity.overrides,
      [componentName]: data,
    };
    updateEntity(entity.id, { overrides: newOverrides });
  };

  return (
    <div style={{ padding: "12px" }}>
      {/* Entity 信息头 */}
      <div
        style={{
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: "1px solid #333",
        }}
      >
        <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
          {entity.name || prefab.name}
        </div>
        <div style={{ fontSize: "11px", color: "#666" }}>
          <div>ID: {entity.id}</div>
          <div>Prefab: {entity.prefab}</div>
          <div>
            位置: ({Math.round(entity.x)}, {Math.round(entity.y)})
          </div>
        </div>
      </div>

      {/* 组件列表 */}
      {Object.entries(mergedComponents).map(([name, data]) => (
        <ComponentPanel
          key={name}
          name={name}
          displayName={name}
          data={data as any}
          schema={COMPONENT_SCHEMAS[name]}
          onChange={(newData) => handleComponentChange(name, newData)}
          removable={name !== "Transform"} // Transform 不可移除
          onRemove={() => {
            // TODO: 移除组件
            console.log("Remove component", name);
          }}
        />
      ))}

      {/* 添加组件按钮 */}
      <button
        onClick={() => setShowAddComponent(true)}
        style={{
          width: "100%",
          padding: "8px",
          background: "#2a2a2a",
          border: "1px dashed #444",
          borderRadius: "4px",
          color: "#999",
          fontSize: "12px",
          cursor: "pointer",
          marginTop: "8px",
        }}
      >
        + 添加组件
      </button>

      {/* TODO: 添加组件弹窗 */}
      {showAddComponent && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "#2a2a2a",
            border: "1px solid #444",
            borderRadius: "8px",
            padding: "16px",
            zIndex: 1000,
          }}
        >
          <div style={{ marginBottom: "12px", fontWeight: 600 }}>
            添加组件
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {["Camera", "Rigidbody"].map((comp) => (
              <button
                key={comp}
                onClick={() => {
                  // TODO: 添加组件
                  setShowAddComponent(false);
                }}
                style={{
                  padding: "8px 12px",
                  background: "#333",
                  border: "none",
                  borderRadius: "4px",
                  color: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {comp}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAddComponent(false)}
            style={{
              marginTop: "12px",
              width: "100%",
              padding: "8px",
              background: "transparent",
              border: "1px solid #444",
              borderRadius: "4px",
              color: "#999",
              cursor: "pointer",
            }}
          >
            取消
          </button>
        </div>
      )}
    </div>
  );
}
