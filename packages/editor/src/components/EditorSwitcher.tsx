import { layoutTree } from "../store/layout";
import { setEditorType } from "../layout/tree";
import { getAllEditors } from "../editors/registry";

interface Props {
  areaId: string;
  current: string;
}

export function EditorSwitcher({ areaId, current }: Props) {
  const editors = getAllEditors();

  return (
    <select
      value={current}
      onChange={(e) => {
        const newType = (e.target as HTMLSelectElement).value;
        layoutTree.value = setEditorType(layoutTree.value, areaId, newType);
      }}
      style={{
        background: "transparent",
        border: "none",
        color: "var(--text-secondary)",
        fontSize: 11,
        cursor: "pointer",
        outline: "none",
      }}
    >
      {editors.map((ed) => (
        <option key={ed.id} value={ed.id}>
          {ed.icon} {ed.name}
        </option>
      ))}
    </select>
  );
}
