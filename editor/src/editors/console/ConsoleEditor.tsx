import { signal } from "@preact/signals";
import { useRef, useEffect, useState, useCallback } from "preact/hooks";
import { registerEditor } from "../registry";

// ── Types & State ──────────────────────────────────────────────────────────

export interface LogEntry {
  id: number;
  level: "info" | "warn" | "error";
  message: string;
  timestamp: number;
}

export const consoleLogs = signal<LogEntry[]>([]);

let logId = 0;

export function consoleLog(message: string) {
  consoleLogs.value = [
    ...consoleLogs.value,
    { id: ++logId, level: "info", message, timestamp: Date.now() },
  ];
}

export function consoleWarn(message: string) {
  consoleLogs.value = [
    ...consoleLogs.value,
    { id: ++logId, level: "warn", message, timestamp: Date.now() },
  ];
}

export function consoleError(message: string) {
  consoleLogs.value = [
    ...consoleLogs.value,
    { id: ++logId, level: "error", message, timestamp: Date.now() },
  ];
}

export function clearConsole() {
  consoleLogs.value = [];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

function getLevelStyle(level: LogEntry["level"]): {
  color: string;
  bg: string;
  badge: string;
  badgeColor: string;
} {
  switch (level) {
    case "info":
      return {
        color: "var(--text-secondary)",
        bg: "transparent",
        badge: "INFO",
        badgeColor: "var(--text-secondary)",
      };
    case "warn":
      return {
        color: "#e0c060",
        bg: "rgba(224,192,96,0.06)",
        badge: "WARN",
        badgeColor: "#e0c060",
      };
    case "error":
      return {
        color: "#e06060",
        bg: "rgba(224,96,96,0.08)",
        badge: "ERR",
        badgeColor: "#e06060",
      };
  }
}

// ── Log Entry Component ────────────────────────────────────────────────────

function LogRow({ entry }: { entry: LogEntry }) {
  const style = getLevelStyle(entry.level);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        padding: "3px 8px",
        borderBottom: "1px solid rgba(255,255,255,0.03)",
        background: style.bg,
        gap: 8,
        minHeight: 22,
        fontSize: 11,
        lineHeight: "16px",
      }}
    >
      {/* Timestamp */}
      <span
        style={{
          color: "var(--text-secondary)",
          fontSize: 10,
          flexShrink: 0,
          width: 80,
          fontFamily: "monospace",
          opacity: 0.7,
        }}
      >
        {formatTime(entry.timestamp)}
      </span>

      {/* Level badge */}
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: style.badgeColor,
          flexShrink: 0,
          width: 32,
          textAlign: "center",
          opacity: 0.9,
        }}
      >
        {style.badge}
      </span>

      {/* Message */}
      <span
        style={{
          flex: 1,
          color: style.color,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          fontFamily: "monospace",
          fontSize: 11,
        }}
      >
        {entry.message}
      </span>
    </div>
  );
}

// ── Filter Button ──────────────────────────────────────────────────────────

function FilterButton({
  label,
  active,
  color,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  count: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: active
          ? "rgba(255,255,255,0.1)"
          : "transparent",
        border: active
          ? `1px solid ${color}`
          : "1px solid transparent",
        borderRadius: 3,
        cursor: "pointer",
        color: active ? color : "var(--text-secondary)",
        fontSize: 10,
        padding: "1px 6px",
        lineHeight: "16px",
        opacity: hovered ? 1 : active ? 0.9 : 0.6,
        transition: "opacity 0.1s, background 0.1s",
        display: "flex",
        alignItems: "center",
        gap: 3,
      }}
    >
      {label}
      {count > 0 && (
        <span
          style={{
            fontSize: 9,
            background: color,
            color: "#1e1e1e",
            borderRadius: 6,
            padding: "0 4px",
            lineHeight: "14px",
            fontWeight: 600,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

function ConsoleEditor({ areaId }: { areaId: string }) {
  const [showInfo, setShowInfo] = useState(true);
  const [showWarn, setShowWarn] = useState(true);
  const [showError, setShowError] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const logs = consoleLogs.value;

  // Counts per level
  const infoCount = logs.filter((l) => l.level === "info").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;
  const errorCount = logs.filter((l) => l.level === "error").length;

  // Filtered logs
  const filteredLogs = logs.filter((entry) => {
    if (entry.level === "info" && !showInfo) return false;
    if (entry.level === "warn" && !showWarn) return false;
    if (entry.level === "error" && !showError) return false;
    return true;
  });

  // Auto-scroll to bottom on new log entries
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs.length]);

  const handleClear = useCallback(() => {
    clearConsole();
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 32,
          background: "var(--panel-header)",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          gap: 6,
          flexShrink: 0,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span style={{ fontSize: 12 }}>📋</span>
        <span
          style={{
            fontWeight: 600,
            fontSize: 11,
            color: "var(--text-bright)",
          }}
        >
          控制台
        </span>

        <div style={{ flex: 1 }} />

        {/* Level filters */}
        <FilterButton
          label="I"
          active={showInfo}
          color="var(--text-secondary)"
          count={infoCount}
          onClick={() => setShowInfo((v) => !v)}
        />
        <FilterButton
          label="W"
          active={showWarn}
          color="#e0c060"
          count={warnCount}
          onClick={() => setShowWarn((v) => !v)}
        />
        <FilterButton
          label="E"
          active={showError}
          color="#e06060"
          count={errorCount}
          onClick={() => setShowError((v) => !v)}
        />

        {/* Clear button */}
        <button
          onClick={handleClear}
          title="清空控制台"
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 3,
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: 10,
            padding: "1px 6px",
            lineHeight: "16px",
            marginLeft: 4,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color =
              "var(--text-bright)";
            (e.currentTarget as HTMLElement).style.borderColor =
              "var(--text-secondary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color =
              "var(--text-secondary)";
            (e.currentTarget as HTMLElement).style.borderColor =
              "var(--border)";
          }}
        >
          🗑 清空
        </button>
      </div>

      {/* Log list */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: "auto",
          fontFamily: "monospace",
        }}
      >
        {filteredLogs.length === 0 ? (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: 11,
            }}
          >
            {logs.length === 0
              ? "暂无日志输出"
              : "没有匹配当前过滤条件的日志"}
          </div>
        ) : (
          filteredLogs.map((entry) => (
            <LogRow key={entry.id} entry={entry} />
          ))
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          height: 22,
          borderTop: "1px solid var(--border)",
          background: "var(--bg-header)",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          fontSize: 10,
          color: "var(--text-secondary)",
          flexShrink: 0,
          gap: 8,
        }}
      >
        <span>
          {filteredLogs.length} / {logs.length} 条日志
        </span>
      </div>
    </div>
  );
}

registerEditor({
  id: "console",
  name: "控制台",
  icon: "📋",
  component: ConsoleEditor,
});

export { ConsoleEditor };
