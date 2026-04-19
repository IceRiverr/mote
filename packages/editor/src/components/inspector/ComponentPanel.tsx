// ═══════════════════════════════════════════════════════════════
// ComponentPanel.tsx - 组件属性面板（v2，支持 override 视觉标记）
// ═══════════════════════════════════════════════════════════════

import { useState } from "preact/hooks";
import { PropertyField } from "./PropertyField";

export interface ComponentPanelProps {
  name: string;
  displayName?: string;
  data: Record<string, any>;
  /** 每个属性是否处于 override 状态 */
  overrideStatus?: Record<string, boolean>;
  schema?: {
    properties?: Record<string, {
      type: string;
      default: any;
      label?: string;
      constraints?: {
        min?: number;
        max?: number;
        step?: number;
        options?: string[];
      };
    }>;
  };
  onChange: (data: Record<string, any>, propertyName: string, newValue: any) => void;
  /** 整组件是否都是 override（用于组件级边框样式） */
  isOverride?: boolean;
  removable?: boolean;
  onRemove?: () => void;
}

export function ComponentPanel({
  name,
  displayName,
  data,
  overrideStatus,
  schema,
  onChange,
  isOverride = false,
  removable = true,
  onRemove,
}: ComponentPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const properties = schema?.properties || {};

  return (
    <div
      style={{
        marginBottom: "8px",
        border: "1px solid #333",
        borderRadius: "4px",
        overflow: "hidden",
        borderLeft: isOverride ? "2px solid #4a90d9" : undefined,
      }}
    >
      {/* 标题栏 */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          background: "#2a2a2a",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span
          style={{
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
            fontSize: "10px",
          }}
        >
          ▶
        </span>
        <span style={{ flex: 1, fontSize: "13px", fontWeight: 600 }}>
          {displayName || name}
        </span>
        {isOverride && (
          <span
            style={{
              fontSize: "9px",
              color: "#4a90d9",
              background: "rgba(74,144,217,0.15)",
              padding: "1px 5px",
              borderRadius: 3,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            override
          </span>
        )}
        {removable && onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            style={{
              background: "none",
              border: "none",
              color: "#d4574a",
              cursor: "pointer",
              fontSize: "12px",
              padding: "2px 6px",
            }}
            title="移除组件"
          >
            ✕
          </button>
        )}
      </div>

      {/* 属性列表 */}
      {expanded && (
        <div style={{ padding: "12px" }}>
          {Object.entries(data).map(([key, value]) => {
            const propSchema = properties[key];
            const propIsOverride = overrideStatus?.[key] ?? false;
            return (
              <div
                key={key}
                style={{
                  borderLeft: propIsOverride ? "2px solid #4a90d9" : "2px solid transparent",
                  paddingLeft: propIsOverride ? "8px" : "10px",
                  marginLeft: "-10px",
                  marginBottom: "4px",
                }}
                title={propIsOverride ? "覆盖自 Prefab 默认值" : undefined}
              >
                <PropertyField
                  name={key}
                  value={value}
                  type={propSchema?.type || "string"}
                  label={propSchema?.label}
                  constraints={propSchema?.constraints}
                  onChange={(newValue) => {
                    onChange({ ...data, [key]: newValue }, key, newValue);
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
