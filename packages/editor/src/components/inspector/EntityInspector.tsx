// ═══════════════════════════════════════════════════════════════
// EntityInspector.tsx - 实体属性检查器（v2，属性级 override 追踪）
// ═══════════════════════════════════════════════════════════════

import { useState } from "preact/hooks";
import { singleSelectedEntity, updateEntity } from "../../store/scene";
import { prefabs, getPrefab, getPrefabPath } from "../../store/prefabs";
import { ComponentPanel } from "./ComponentPanel";
import { resolveEntityComponents } from "../../data/Scene";
import { rebuildOverrides } from "../../utils/override-utils";
import {
  ApplyOverridesToPrefabCommand,
  RevertToPrefabCommand,
  SaveEntityAsPrefabCommand,
} from "../../commands/entity-prefab-commands";
import { executeCommand } from "../../store/history";
import { previewedPrefabPath } from "../../store/contentBrowser";
import { layoutTree } from "../../store/layout";
import { openEditorForResource } from "../../layout/tree";

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
  const [showSaveAsPrefab, setShowSaveAsPrefab] = useState(false);
  const [saveAsPath, setSaveAsPath] = useState('');

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

  // 计算 merged 组件数据（Prefab + overrides）
  const mergedComponents = resolveEntityComponents(entity, prefab);

  // 计算每个属性的 override 状态
  const getOverrideStatus = (componentName: string): Record<string, boolean> => {
    const status: Record<string, boolean> = {};
    const overrides = entity.overrides?.[componentName];
    if (!overrides) return status;
    for (const key of Object.keys(overrides)) {
      status[key] = true;
    }
    return status;
  };

  // 处理 Transform 直接修改
  const handleTransformChange = (_data: Record<string, any>, prop: string, value: any) => {
    updateEntity(entity.id, {
      transform: {
        ...entity.transform,
        [prop]: value,
      },
    });
  };

  // 处理 name 修改
  const handleNameChange = (newName: string) => {
    updateEntity(entity.id, { name: newName.trim() || entity.prefab });
  };

  // 处理非 Transform 组件的属性级 override
  const handleComponentChange = (
    componentName: string,
    _data: Record<string, any>,
    propertyName: string,
    newValue: any
  ) => {
    const newOverrides = rebuildOverrides(prefab, entity, componentName, propertyName, newValue);
    updateEntity(entity.id, { overrides: newOverrides });
  };

  // Revert All
  const handleRevertAll = () => {
    executeCommand(new RevertToPrefabCommand(entity));
  };

  // Apply All
  const handleApplyAll = () => {
    executeCommand(new ApplyOverridesToPrefabCommand(entity));
  };

  // 打开 Prefab 编辑器
  const handleOpenPrefab = () => {
    const path = getPrefabPath(entity.prefab);
    if (path) {
      previewedPrefabPath.value = path;
      const result = openEditorForResource(layoutTree.value, 'inspector', 'prefab-preview');
      layoutTree.value = result.layout;
    }
  };

  // 保存为 Prefab
  const handleSaveAsPrefab = () => {
    setSaveAsPath(`${entity.prefab}_variant.mote-prefab.json`);
    setShowSaveAsPrefab(true);
  };

  const handleConfirmSaveAsPrefab = () => {
    if (!saveAsPath.trim()) return;
    const prefabId = saveAsPath.replace(/\.mote-prefab\.json$/, '');
    executeCommand(new SaveEntityAsPrefabCommand(entity, prefabId, saveAsPath.trim()));
    setShowSaveAsPrefab(false);
    // 自动打开 Prefab Editor
    previewedPrefabPath.value = saveAsPath.trim();
    const result = openEditorForResource(layoutTree.value, 'inspector', 'prefab-preview');
    layoutTree.value = result.layout;
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
        {/* 可编辑的 name */}
        <input
          type="text"
          value={entity.name}
          onChange={(e) => handleNameChange((e.target as HTMLInputElement).value)}
          style={{
            width: "100%",
            fontSize: "14px",
            fontWeight: 600,
            marginBottom: "4px",
            background: "transparent",
            border: "1px solid transparent",
            borderRadius: "3px",
            color: "#fff",
            padding: "2px 4px",
            outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.borderColor = "#444";
            (e.target as HTMLInputElement).style.background = "#1a1a1a";
          }}
          onBlur={(e) => {
            (e.target as HTMLInputElement).style.borderColor = "transparent";
            (e.target as HTMLInputElement).style.background = "transparent";
          }}
        />
        <div style={{ fontSize: "11px", color: "#666" }}>
          <div>Prefab: {entity.prefab}</div>
          <div>
            位置: ({Math.round(entity.transform.x)}, {Math.round(entity.transform.y)})
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
          <button
            onClick={handleOpenPrefab}
            style={{
              flex: 1,
              padding: "4px 8px",
              fontSize: "11px",
              background: "#2a2a2a",
              border: "1px solid #444",
              borderRadius: "3px",
              color: "#999",
              cursor: "pointer",
            }}
          >
            打开 Prefab
          </button>
          <button
            onClick={handleSaveAsPrefab}
            style={{
              flex: 1,
              padding: "4px 8px",
              fontSize: "11px",
              background: "#2a2a2a",
              border: "1px solid #444",
              borderRadius: "3px",
              color: "#999",
              cursor: "pointer",
            }}
          >
            保存为 Prefab
          </button>
        </div>
      </div>

      {/* Transform（独立字段，非 override） */}
      <ComponentPanel
        name="Transform"
        displayName="Transform"
        data={entity.transform}
        schema={COMPONENT_SCHEMAS.Transform}
        onChange={handleTransformChange}
        isOverride={false}
        removable={false}
      />

      {/* 其他组件列表 */}
      {Object.entries(mergedComponents)
        .filter(([name]) => name !== "Transform")
        .map(([name, data]) => {
          const overrideStatus = getOverrideStatus(name);
          const hasOverrides = Object.keys(overrideStatus).length > 0;
          return (
            <ComponentPanel
              key={name}
              name={name}
              displayName={name}
              data={data as any}
              overrideStatus={overrideStatus}
              schema={COMPONENT_SCHEMAS[name]}
              onChange={(newData, prop, val) =>
                handleComponentChange(name, newData, prop, val)
              }
              isOverride={hasOverrides}
              removable={true}
              onRemove={() => {
                // 删除该组件的 override
                const newOverrides = entity.overrides
                  ? { ...entity.overrides }
                  : {};
                delete newOverrides[name];
                updateEntity(entity.id, {
                  overrides:
                    Object.keys(newOverrides).length > 0
                      ? newOverrides
                      : undefined,
                });
              }}
            />
          );
        })}

      {/* Apply / Revert 按钮 */}
      {entity.overrides && Object.keys(entity.overrides).length > 0 && (
        <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
          <button
            onClick={handleApplyAll}
            style={{
              flex: 1,
              padding: "6px",
              fontSize: "11px",
              background: "#4a7c59",
              border: "none",
              borderRadius: "3px",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Apply All
          </button>
          <button
            onClick={handleRevertAll}
            style={{
              flex: 1,
              padding: "6px",
              fontSize: "11px",
              background: "#d4574a",
              border: "none",
              borderRadius: "3px",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Revert All
          </button>
        </div>
      )}

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

      {/* 添加组件弹窗 */}
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

      {/* 保存为 Prefab 弹窗 */}
      {showSaveAsPrefab && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "#2a2a2a",
            border: "1px solid #444",
            borderRadius: "8px",
            padding: "20px",
            zIndex: 1000,
            minWidth: 320,
          }}
        >
          <div style={{ marginBottom: "12px", fontWeight: 600 }}>
            保存为 Prefab
          </div>
          <div style={{ marginBottom: "12px", fontSize: "11px", color: "#888" }}>
            将当前实体的 Transform 和 Overrides 合并为新 Prefab
          </div>
          <input
            type="text"
            value={saveAsPath}
            onChange={(e) => setSaveAsPath((e.target as HTMLInputElement).value)}
            placeholder="path/to/name.mote-prefab.json"
            style={{
              width: "100%",
              padding: "8px 10px",
              background: "#1a1a1a",
              border: "1px solid #444",
              borderRadius: "4px",
              color: "#fff",
              fontSize: "12px",
              outline: "none",
              marginBottom: "12px",
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setShowSaveAsPrefab(false)}
              style={{
                flex: 1,
                padding: "8px",
                background: "transparent",
                border: "1px solid #444",
                borderRadius: "4px",
                color: "#999",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              取消
            </button>
            <button
              onClick={handleConfirmSaveAsPrefab}
              style={{
                flex: 1,
                padding: "8px",
                background: "#4a90d9",
                border: "none",
                borderRadius: "4px",
                color: "#fff",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
