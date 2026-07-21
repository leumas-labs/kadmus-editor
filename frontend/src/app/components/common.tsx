import { getIconForFile } from 'vscode-icons-js';
import { C } from '../../styles/theme';

export function Ic({ name, size = 19, color, style, className }: {
  name: string; size?: number; color?: string; style?: React.CSSProperties; className?: string;
}) {
  return (
    <i className={`codicon codicon-${name} ${className || ''}`}
      style={{ fontSize: size, color, lineHeight: 1, display: "inline-flex",
        alignItems: "center", justifyContent: "center", flexShrink: 0, ...style }} />
  );
}

export function FileIcon({ filename, size = 16 }: {
  filename: string; size?: number; color?: string;
}) {
  const iconName = getIconForFile(filename);
  return (
    <img
      src={new URL(`../../assets/icons/${iconName}`, import.meta.url).href}
      alt={filename}
      style={{ width: size, height: size, display: "block", flexShrink: 0 }}
    />
  );
}

export function SectionLabel({ children, dim = false }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <span style={{
      fontFamily: "'Inter', sans-serif",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: dim ? C.subtle : C.muted,
    }}>{children}</span>
  );
}

export function PanelTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: 13, fontWeight: 600,
        color: C.text, letterSpacing: "-0.01em",
      }}>{children}</div>
      {sub && (
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 11, color: C.muted, marginTop: 1,
        }}>{sub}</div>
      )}
    </div>
  );
}
