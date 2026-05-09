// ═══════════════════════════════════════════════════════════════
// PropertyField.tsx - 属性字段编辑器
// 根据属性类型渲染不同的输入控件
// ═══════════════════════════════════════════════════════════════

interface PropertyFieldProps {
  name: string;
  value: any;
  type: string;
  label?: string;
  constraints?: {
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
  };
  onChange: (value: any) => void;
}

export function PropertyField({
  name,
  value,
  type,
  label,
  constraints,
  onChange,
}: PropertyFieldProps) {
  const displayLabel = label || name;

  // number 类型
  if (type === "number") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <label
          style={{
            width: "80px",
            fontSize: "12px",
            color: "#999",
          }}
        >
          {displayLabel}
        </label>
        <input
          type="number"
          value={value ?? 0}
          min={constraints?.min}
          max={constraints?.max}
          step={constraints?.step ?? 1}
          onChange={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
          style={{
            flex: 1,
            background: "#2a2a2a",
            border: "1px solid #444",
            borderRadius: "3px",
            padding: "4px 8px",
            color: "#fff",
            fontSize: "12px",
          }}
        />
      </div>
    );
  }

  // string 类型
  if (type === "string") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <label
          style={{
            width: "80px",
            fontSize: "12px",
            color: "#999",
          }}
        >
          {displayLabel}
        </label>
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange((e.target as HTMLInputElement).value)}
          style={{
            flex: 1,
            background: "#2a2a2a",
            border: "1px solid #444",
            borderRadius: "3px",
            padding: "4px 8px",
            color: "#fff",
            fontSize: "12px",
          }}
        />
      </div>
    );
  }

  // color 类型
  if (type === "color") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <label
          style={{
            width: "80px",
            fontSize: "12px",
            color: "#999",
          }}
        >
          {displayLabel}
        </label>
        <input
          type="color"
          value={value ?? "#ffffff"}
          onChange={(e) => onChange((e.target as HTMLInputElement).value)}
          style={{
            width: "32px",
            height: "24px",
            padding: "0",
            border: "1px solid #444",
            borderRadius: "3px",
            cursor: "pointer",
          }}
        />
        <span style={{ fontSize: "11px", color: "#666" }}>{value}</span>
      </div>
    );
  }

  // boolean 类型
  if (type === "boolean") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <label
          style={{
            flex: 1,
            fontSize: "12px",
            color: "#999",
          }}
        >
          {displayLabel}
        </label>
        <input
          type="checkbox"
          checked={value ?? false}
          onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
          style={{
            width: "16px",
            height: "16px",
            cursor: "pointer",
          }}
        />
      </div>
    );
  }

  // asset 类型 —— 暂时用 string 输入框（后续可加文件选择器）
  if (type === "asset") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <label style={{ width: "80px", fontSize: "12px", color: "#999" }}>
          {displayLabel}
        </label>
        <input
          type="text"
          value={value ?? ""}
          placeholder="path/to/asset"
          onChange={(e) => onChange((e.target as HTMLInputElement).value)}
          style={{
            flex: 1,
            background: "#2a2a2a",
            border: "1px solid #444",
            borderRadius: "3px",
            padding: "4px 8px",
            color: "#fff",
            fontSize: "12px",
          }}
        />
      </div>
    );
  }

  // 数组 / object / vec2 —— 用 JSON textarea 编辑
  if (type === "string[]" || type === "number[]" || type === "object" || type === "vec2") {
    const json = Array.isArray(value) || typeof value === "object"
      ? JSON.stringify(value)
      : String(value ?? "");
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
        <label style={{ width: "80px", fontSize: "12px", color: "#999", paddingTop: "4px" }}>
          {displayLabel}
        </label>
        <textarea
          value={json}
          rows={2}
          onChange={(e) => {
            const text = (e.target as HTMLTextAreaElement).value;
            try {
              onChange(JSON.parse(text));
            } catch {
              onChange(text);
            }
          }}
          style={{
            flex: 1,
            background: "#2a2a2a",
            border: "1px solid #444",
            borderRadius: "3px",
            padding: "4px 8px",
            color: "#fff",
            fontSize: "12px",
            resize: "vertical",
            fontFamily: "monospace",
          }}
        />
      </div>
    );
  }

  // enum 类型
  if (type === "enum" && constraints?.options) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <label
          style={{
            width: "80px",
            fontSize: "12px",
            color: "#999",
          }}
        >
          {displayLabel}
        </label>
        <select
          value={value ?? ""}
          onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
          style={{
            flex: 1,
            background: "#2a2a2a",
            border: "1px solid #444",
            borderRadius: "3px",
            padding: "4px 8px",
            color: "#fff",
            fontSize: "12px",
          }}
        >
          {constraints.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // 默认：直接显示值（只读）
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
      <label
        style={{
          width: "80px",
          fontSize: "12px",
          color: "#999",
        }}
      >
        {displayLabel}
      </label>
      <span style={{ flex: 1, fontSize: "12px", color: "#666" }}>
        {String(value)}
      </span>
    </div>
  );
}
