// ═══════════════════════════════════════════════════════════════
// ComponentPanel.tsx - 组件属性面板
// ═══════════════════════════════════════════════════════════════

import { useState } from "preact/hooks";
import { PropertyField } from "./PropertyField";

interface ComponentPanelProps {
  name: string;
  displayName?: string;
  data: Record<string, any>;
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
  onChange: (data: Record<string, any>) => void;
  removable?: boolean;
  onRemove?: () => void;
}

export function ComponentPanel({
  name,
  displayName,
  data,
  schema,
  onChange,
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
            return (
              <PropertyField
                key={key}
                name={key}
                value={value}
                type={propSchema?.type || "string"}
                label={propSchema?.label}
                constraints={propSchema?.constraints}
                onChange={(newValue) => {
                  onChange({ ...data, [key]: newValue });
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
