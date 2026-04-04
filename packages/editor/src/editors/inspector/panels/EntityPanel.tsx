import { useState } from "preact/hooks";
import { PanelShell } from "./PanelShell";
import { BUILTIN_ENTITY_DEFS, getEntityDef, isEntityLayer } from "../../../data/TileMap";
import type { EntityDef, EntityInstance } from "../../../data/TileMap";
import { activeEntityDefId, selectedEntityId, activeTool } from "../../../store/selection";
import { currentMap, activeLayer, activeLayerId } from "../../../store/project";
import { executeCommand } from "../../../store/history";
import { RemoveEntityCommand, SetEntityPropertyCommand } from "../../../commands/entity";
import { spriteAtlases, activeAtlasId } from "../../../store/atlas";

export function EntityPanel() {
  const layer = activeLayer.value;
  const isEntity = layer && isEntityLayer(layer);

  return (
    <PanelShell title="\u5b9e\u4f53" defaultOpen={true}>
      {/* EntityDef picker */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
          \u5b9e\u4f53\u7c7b\u578b (\u70b9\u51fb\u9009\u62e9\u540e\u5728\u89c6\u53e3\u653e\u7f6e)
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {BUILTIN_ENTITY_DEFS.map((def) => {
            const isActive = activeEntityDefId.value === def.id;
            return (
              <button
                key={def.id}
                onClick={() => {
                  activeEntityDefId.value = isActive ? null : def.id;
                  if (!isActive) activeTool.value = "entity";
                }}
                title={def.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  fontSize: 11,
                  border: isActive ? "1px solid var(--accent)" : "1px solid var(--border)",
                  borderRadius: 3,
                  background: isActive ? "var(--accent)" + "30" : "transparent",
                  color: isActive ? "var(--text-bright)" : "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                <span style={{ color: def.color }}>{def.icon}</span>
                {def.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected entity inspector */}
      <SelectedEntityInspector />
    </PanelShell>
  );
}

function SelectedEntityInspector() {
  const entId = selectedEntityId.value;
  if (!entId) return null;

  // Find the entity across all layers
  const map = currentMap.value;
  let foundEntity: EntityInstance | null = null;
  let foundLayerId: string | null = null;
  for (const layer of map.layers) {
    if (!isEntityLayer(layer)) continue;
    const ent = layer.entities.find((e) => e.id === entId);
    if (ent) {
      foundEntity = ent;
      foundLayerId = layer.id;
      break;
    }
  }

  if (!foundEntity || !foundLayerId) {
    return (
      <div style={{ fontSize: 10, color: "var(--text-secondary)", fontStyle: "italic" }}>
        \u672a\u9009\u4e2d\u5b9e\u4f53
      </div>
    );
  }

  const def = getEntityDef(foundEntity.defId);
  const entity = foundEntity;
  const layerId = foundLayerId;

  const fieldRow = (label: string, value: string, onChange: (v: string) => void) => (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
      <span style={{ fontSize: 10, color: "var(--text-secondary)", width: 36, flexShrink: 0 }}>
        {label}
      </span>
      <input
        type="text"
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        style={{
          flex: 1, fontSize: 11, height: 20, padding: "0 4px",
          border: "1px solid var(--border)", borderRadius: 2,
          background: "var(--bg-input)", color: "var(--text-bright)",
          outline: "none", minWidth: 0,
        }}
      />
    </div>
  );

  const numFieldRow = (label: string, value: number, onChange: (v: number) => void) => (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
      <span style={{ fontSize: 10, color: "var(--text-secondary)", width: 36, flexShrink: 0 }}>
        {label}
      </span>
      <input
        type="number"
        value={value}
        onInput={(e) => {
          const v = parseInt((e.target as HTMLInputElement).value);
          if (!isNaN(v)) onChange(v);
        }}
        style={{
          flex: 1, fontSize: 11, height: 20, padding: "0 4px",
          border: "1px solid var(--border)", borderRadius: 2,
          background: "var(--bg-input)", color: "var(--text-bright)",
          outline: "none", minWidth: 0,
        }}
      />
    </div>
  );

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-bright)" }}>
          <span style={{ color: def?.color ?? "#888" }}>{def?.icon ?? "?"}</span>{" "}
          {def?.name ?? entity.defId}
        </span>
        <button
          onClick={() => {
            executeCommand(new RemoveEntityCommand(layerId, entity.id));
            selectedEntityId.value = null;
          }}
          title="\u5220\u9664\u5b9e\u4f53"
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--text-secondary)", fontSize: 11, padding: "0 4px",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#e06060"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
        >
          \u2715
        </button>
      </div>

      {fieldRow("\u540d\u79f0", entity.name, (v) => {
        executeCommand(new SetEntityPropertyCommand(layerId, entity.id, "name", v, "\u91cd\u547d\u540d\u5b9e\u4f53"));
      })}

      {numFieldRow("X", entity.x, (v) => {
        executeCommand(new SetEntityPropertyCommand(layerId, entity.id, "x", v, "\u8bbe\u7f6e\u5b9e\u4f53 X"));
      })}

      {numFieldRow("Y", entity.y, (v) => {
        executeCommand(new SetEntityPropertyCommand(layerId, entity.id, "y", v, "\u8bbe\u7f6e\u5b9e\u4f53 Y"));
      })}

      {def?.shape === "rect" && def.resizable && (
        <>
          {numFieldRow("W", entity.width, (v) => {
            executeCommand(new SetEntityPropertyCommand(layerId, entity.id, "width", v, "\u8bbe\u7f6e\u5b9e\u4f53\u5bbd\u5ea6"));
          })}
          {numFieldRow("H", entity.height, (v) => {
            executeCommand(new SetEntityPropertyCommand(layerId, entity.id, "height", v, "\u8bbe\u7f6e\u5b9e\u4f53\u9ad8\u5ea6"));
          })}
        </>
      )}

      {/* Sprite frame override */}
      {def?.spriteAtlasId && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 2 }}>
            Sprite Frame
          </div>
          {fieldRow("Frame", entity.spriteFrameId ?? def.spriteFrameId ?? "", (v) => {
            executeCommand(new SetEntityPropertyCommand(layerId, entity.id, "spriteFrameId", v || undefined, "\u8bbe\u7f6e\u7cbe\u7075\u5e27"));
          })}
        </div>
      )}

      {/* Custom fields */}
      {def && def.fields.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 2 }}>
            \u81ea\u5b9a\u4e49\u5b57\u6bb5
          </div>
          {def.fields.map((field) => {
            const val = entity.fieldValues[field.id] ?? field.default;
            return fieldRow(field.label, String(val), (v) => {
              let parsed: string | number | boolean = v;
              if (field.type === "number") parsed = parseFloat(v) || 0;
              if (field.type === "bool") parsed = v === "true";
              const newFieldValues = { ...entity.fieldValues, [field.id]: parsed };
              executeCommand(
                new SetEntityPropertyCommand(layerId, entity.id, "fieldValues", newFieldValues, `\u8bbe\u7f6e ${field.label}`)
              );
            });
          })}
        </div>
      )}
    </div>
  );
}
