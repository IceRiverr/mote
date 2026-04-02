import { useState } from "preact/hooks";
import type { ComponentChildren } from "preact";

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: ComponentChildren;
}

export function PanelShell({ title, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          height: 26,
          background: "var(--panel-header)",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          cursor: "pointer",
          fontWeight: 500,
          fontSize: 11,
          color: "var(--text-bright)",
        }}
      >
        <span style={{ marginRight: 6, fontSize: 9 }}>{open ? "▼" : "▶"}</span>
        {title}
      </div>
      {open && (
        <div style={{ padding: "6px 10px" }}>
          {children}
        </div>
      )}
    </div>
  );
}
