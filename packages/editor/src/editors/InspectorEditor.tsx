/**
 * Inspector Editor - 属性检查器
 * 
 * 显示和编辑选中实体的组件属性
 */

import { useState } from "preact/hooks";
import { CollapsibleSection } from "../components/CollapsibleSection.js";

interface PropertyFieldProps {
  label: string;
  value: string | number;
  type?: "text" | "number" | "vec2" | "color";
  onChange?: (value: string | number) => void;
}

function PropertyField({ label, value, type = "text", onChange }: PropertyFieldProps) {
  if (type === "vec2") {
    const [x, y] = (value as string).split(",").map(v => parseFloat(v.trim()) || 0);
    return (
      <div class="property-row">
        <span class="property-row__label">{label}</span>
        <div class="property-row__value">
          <input 
            type="number" 
            value={x} 
            step="0.1"
            style={{ width: "60px" }}
          />
          <input 
            type="number" 
            value={y} 
            step="0.1"
            style={{ width: "60px" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div class="property-row">
      <span class="property-row__label">{label}</span>
      <input
        class="property-row__value"
        type={type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) => onChange?.((e.target as HTMLInputElement).value)}
      />
    </div>
  );
}

export function InspectorEditor() {
  // Mock selected entity data
  const [entityData, setEntityData] = useState({
    name: "Player",
    position: "100, 200",
    rotation: 0,
    scale: "1, 1",
    sprite: "player_idle_0",
    visible: true,
  });

  return (
    <div style={{ overflow: "auto", height: "100%" }}>
      <CollapsibleSection title="Transform" defaultOpen={true}>
        <PropertyField label="Position" value={entityData.position} type="vec2" />
        <PropertyField label="Rotation" value={entityData.rotation} type="number" />
        <PropertyField label="Scale" value={entityData.scale} type="vec2" />
      </CollapsibleSection>

      <CollapsibleSection title="Sprite" defaultOpen={true}>
        <PropertyField label="Sprite" value={entityData.sprite} />
        <div class="property-row">
          <span class="property-row__label">Visible</span>
          <input 
            type="checkbox" 
            checked={entityData.visible}
            onChange={(e) => setEntityData({ 
              ...entityData, 
              visible: (e.target as HTMLInputElement).checked 
            })}
          />
        </div>
        <PropertyField label="Color" value="#ffffff" type="color" />
        <PropertyField label="Alpha" value={1} type="number" />
      </CollapsibleSection>

      <CollapsibleSection title="Physics" defaultOpen={false}>
        <PropertyField label="Body Type" value="Dynamic" />
        <PropertyField label="Mass" value={1} type="number" />
        <PropertyField label="Friction" value={0.3} type="number" />
        <PropertyField label="Restitution" value={0.1} type="number" />
      </CollapsibleSection>

      <CollapsibleSection title="Scripts" defaultOpen={false}>
        <div style={{ padding: "8px", color: "var(--text-secondary)" }}>
          No scripts attached
        </div>
        <button class="tool-button" style={{ width: "100%", marginTop: "4px" }}>
          + Add Script
        </button>
      </CollapsibleSection>
    </div>
  );
}
