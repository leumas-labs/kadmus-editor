import { useState, useRef, useCallback, useEffect } from "react";
import { C } from "../../styles/theme";
import { FileIcon, Ic } from "./common";
import { OpenFile } from "../../types";
import { MonacoEditor } from "./MonacoEditor";
import { XtermTerminal } from "./XtermTerminal";
import { MarkdownPreview } from "./MarkdownPreview";

// ── Local resize helper for terminal height ───────────────────────────
function useResize(initial: number, min: number, max: number) {
  const [size, setSize] = useState(initial);
  const ref = useRef(size); ref.current = size;
  const start = useCallback((e: React.MouseEvent, axis: "x" | "y", sign: 1 | -1) => {
    e.preventDefault();
    const s = axis === "x" ? e.clientX : e.clientY;
    const startS = ref.current;
    const move = (ev: MouseEvent) => {
      const d = ((axis === "x" ? ev.clientX : ev.clientY) - s) * sign;
      setSize(Math.max(min, Math.min(max, startS + d)));
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }, [min, max]);
  return [size, start, setSize] as const;
}

export function EditorColumn({
  openFiles, activeFileIdx, setActiveFileIdx, showTerminal, onCloseTab, themeTrigger, settings
}: {
  openFiles: OpenFile[];
  activeFileIdx: number;
  setActiveFileIdx: (idx: number) => void;
  focusMode: boolean;
  showTerminal: boolean;
  onCloseTab: (path: string) => void;
  themeTrigger: number;
  settings?: any;
}) {
  const [termHeight, startResizeTerm] = useResize(200, 80, 600);
  const [showPreview, setShowPreview] = useState(false);
  const [editorContent, setEditorContent] = useState("");

  const activeFile = openFiles[activeFileIdx];
  const isMarkdown = activeFile?.name.toLowerCase().endsWith(".md") ?? false;

  // Auto-close preview if switching to non-markdown file
  useEffect(() => {
    if (!isMarkdown) {
      setShowPreview(false);
    }
  }, [isMarkdown]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.base, minWidth: 0 }}>
      {/* Tabs Bar */}
      <div style={{
        display: "flex", alignItems: "center", background: C.base,
        borderBottom: `1px solid ${C.line}`, height: 35,
      }}>
        {/* Scrollable Tabs */}
        <div style={{
          flex: 1, display: "flex", overflowX: "auto", height: "100%"
        }} className="sb-hide">
          {openFiles.map((f, i) => {
            const isActive = i === activeFileIdx;
            return (
              <div key={f.path}
                onClick={() => setActiveFileIdx(i)}
                className="group"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "0 14px", height: "100%", cursor: "pointer",
                  borderRight: `1px solid ${C.line}`,
                  background: isActive ? C.panel : "transparent",
                  borderTop: `2px solid ${isActive ? C.sienna : "transparent"}`,
                  position: "relative",
                }}
                onMouseEnter={e => {
                  const closeBtn = (e.currentTarget as HTMLElement).querySelector('.codicon-close');
                  if (closeBtn) (closeBtn as HTMLElement).style.opacity = '1';
                }}
                onMouseLeave={e => {
                  const closeBtn = (e.currentTarget as HTMLElement).querySelector('.codicon-close');
                  if (closeBtn) (closeBtn as HTMLElement).style.opacity = '0';
                }}
              >
                <FileIcon filename={f.name} size={14} />
                <span style={{
                  fontSize: 13, color: isActive ? C.text : C.muted,
                  fontFamily: "'Inter', sans-serif", fontWeight: isActive ? 600 : 400,
                }}>{f.name}</span>
                <span 
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onCloseTab(f.path);
                  }}
                  style={{ display: 'flex', alignItems: 'center' }}
                >
                  <Ic 
                    name="close" 
                    size={12} 
                    color={C.subtle} 
                    style={{ opacity: 0, transition: 'opacity 0.15s' }}
                  />
                </span>
              </div>
            );
          })}
        </div>

        {/* Editor Group Actions */}
        {isMarkdown && (
          <div style={{ display: "flex", alignItems: "center", paddingRight: 8, height: "100%" }}>
            <button
              onClick={() => setShowPreview(p => !p)}
              title={showPreview ? "Close Preview" : "Open Preview to the Side"}
              style={{
                width: 26, height: 26, borderRadius: 5,
                background: showPreview ? `${C.sienna}18` : "transparent",
                border: `1px solid ${showPreview ? C.sienna : "transparent"}`,
                color: showPreview ? C.sienna : C.muted,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Ic name="split-horizontal" size={13} color={showPreview ? C.sienna : C.muted} />
            </button>
          </div>
        )}
      </div>

      {/* Breadcrumbs */}
      <div style={{
        height: 22, display: "flex", alignItems: "center", gap: 6,
        padding: "0 16px", borderBottom: `1px solid ${C.line}`,
        background: C.base,
      }}>
        <Ic name="folder" size={11} color={C.subtle} />
        <span style={{ fontSize: 15, color: C.subtle, fontFamily: "'JetBrains Mono', monospace" }}>
          {openFiles[activeFileIdx]?.breadcrumb}
        </span>
        <Ic name="chevron-right" size={10} color={C.faint} />
        <span style={{ fontSize: 15, color: C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
          {openFiles[activeFileIdx]?.name}
        </span>
      </div>

      {/* Editor content */}
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "row", overflow: "hidden" }}>
          {/* Editor Workspace */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            {openFiles[activeFileIdx] ? (
              <MonacoEditor 
                activePath={openFiles[activeFileIdx].path} 
                themeTrigger={themeTrigger} 
                onContentChange={setEditorContent}
                settings={settings}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.muted }}>
                No file open
              </div>
            )}
          </div>

          {/* Markdown Preview pane */}
          {showPreview && isMarkdown && (
            <>
              {/* Divider */}
              <div style={{ width: 1, background: C.line, flexShrink: 0 }} />
              <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                <MarkdownPreview content={editorContent} />
              </div>
            </>
          )}
        </div>

        {/* Terminal Resizer */}
        {showTerminal && (
          <div 
            style={{ 
              height: 4, 
              cursor: "row-resize", 
              background: C.line, 
              flexShrink: 0,
              transition: "background 0.15s" 
            }}
            onMouseEnter={e => e.currentTarget.style.background = `${C.sienna}80`}
            onMouseLeave={e => e.currentTarget.style.background = C.line}
            onMouseDown={e => startResizeTerm(e, "y", -1)}
          />
        )}

        {/* Conditionally render terminal */}
        {showTerminal && <XtermTerminal height={termHeight} themeTrigger={themeTrigger} />}
      </div>
    </div>
  );
}
