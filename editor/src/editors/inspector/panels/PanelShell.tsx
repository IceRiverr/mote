import { useState } from "preact/hooks";
import type { ComponentChildren, VNode } from "preact";

interface Props {
  title: string;
  defaultOpen?: boolean;
  /** Optional element rendered at the right side of the header bar */
  headerRight?: VNode | null;
  children: ComponentChildren;
}

export function PanelShell({
  title,
  defaultOpen = true,
  headerRight,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <div
        style={{
          height: 26,
          background: "var(--panel-header)",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          fontWeight: 500,
          fontSize: 11,
          color: "var(--text-bright)",
        }}
      >
        <div
          onClick={() => setOpen(!open)}
          style={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <span style={{ marginRight: 6, fontSize: 9 }}>
            {open ? "\u25BC" : "\u25B6"}
          </span>
          {title}
        </div>
        {headerRight && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: "flex", alignItems: "center" }}
          >
            {headerRight}
          </div>
        )}
      </div>
      {open && <div style={{ padding: "6px 10px" }}>{children}</div>}
    </div>
  );
}
