import type { EditorType } from "../core/area-tree.js";
import { EDITOR_TYPES } from "../core/area-tree.js";

interface AreaHeaderProps {
  editorType: EditorType;
  onChangeType: (type: EditorType) => void;
}

export function AreaHeader({ editorType, onChangeType }: AreaHeaderProps) {
  const current = EDITOR_TYPES.find((e) => e.type === editorType);

  return (
    <div class="area-header">
      <select
        class="editor-selector"
        value={editorType}
        onChange={(e) => onChangeType((e.target as HTMLSelectElement).value as EditorType)}
      >
        {EDITOR_TYPES.map(({ type, label, icon }) => (
          <option key={type} value={type}>
            {icon} {label}
          </option>
        ))}
      </select>
      <div class="area-header__tools">
        {/* Editor-specific tools can be added here based on editorType */}
        {editorType === "viewport" && (
          <>
            <button class="tool-button" title="Translate (W)">Move</button>
            <button class="tool-button" title="Rotate (E)">Rotate</button>
            <button class="tool-button" title="Scale (R)">Scale</button>
          </>
        )}
      </div>
    </div>
  );
}
