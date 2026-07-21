import { C } from "../../styles/theme";
import { Ic } from "./common";
import { CommandPaletteItem } from "../../types";

export function CommandPalette({ open, onClose, items }: {
  open: boolean;
  onClose: () => void;
  items: CommandPaletteItem[];
}) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: `${C.base}b0`, backdropFilter: "blur(8px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: "16vh",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 620, background: C.panel,
        border: `1px solid ${C.line}`, borderRadius: 12,
        boxShadow: `0 32px 80px ${C.base}, 0 0 0 1px ${C.sienna}18`,
        overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px", borderBottom: `1px solid ${C.line}`,
        }}>
          <Ic name="search" size={16} color={C.muted} />
          <input autoFocus placeholder="Search files, symbols, commands, ask Kadmus…"
            style={{
              flex: 1, background: "transparent", outline: "none", border: "none",
              color: C.text, fontSize: 19, fontFamily: "'Inter', sans-serif",
              caretColor: C.sienna,
            }} />
          <span style={{
            fontSize: 15, color: C.subtle, fontFamily: "'JetBrains Mono', monospace",
            padding: "2px 6px", borderRadius: 3,
            border: `1px solid ${C.line}`, background: C.surface,
          }}>esc</span>
        </div>
        <div style={{ padding: "8px 0", maxHeight: 380, overflowY: "auto" }}>
          {items.map((item, i) => (
            <button key={i} onClick={() => { item.onSelect(); onClose(); }} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "8px 16px", cursor: "pointer",
              background: i === 0 ? `${C.sienna}12` : "transparent",
              width: "100%", border: "none", textAlign: "left",
            }}>
              <Ic name={item.icon} size={14} color={i === 0 ? C.sienna : C.muted} />
              <span style={{ flex: 1, fontSize: 18, color: C.text, fontFamily: "'Inter', sans-serif" }}>
                {item.label}
              </span>
              <span style={{ fontSize: 15, color: C.subtle,
                fontFamily: "'JetBrains Mono', monospace" }}>{item.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
