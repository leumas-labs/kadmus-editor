import { C } from "../../styles/theme";
import { Ic } from "./common";
import { Block, SelenaSession } from "../../types";

function BlockLabel({ label, color, time }: { label: string; color: string; time: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: 15, fontWeight: 700, letterSpacing: "0.14em",
        textTransform: "uppercase", color,
      }}>{label}</span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 15, color: C.subtle,
      }}>{time}</span>
    </div>
  );
}

function StreamBlock({ b }: { b: Block }) {
  const dot = (color: string, icon?: string) => (
    <div style={{
      position: "absolute", left: 20, top: 14, width: 14, height: 14,
      borderRadius: "50%", background: color,
      boxShadow: `0 0 0 3px ${C.base}, 0 0 10px ${color}50`,
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2,
    }}>
      {icon && <Ic name={icon} size={8} color={C.base} />}
    </div>
  );

  const wrap: React.CSSProperties = { position: "relative", paddingLeft: 52, paddingRight: 20, paddingBottom: 22 };

  switch (b.kind) {
    case "ai": {
      const isUser = b.role === "user";
      return (
        <div style={wrap}>
          {dot(isUser ? C.ink : C.sienna)}
          <BlockLabel
            label={isUser ? "You asked" : "Selena"}
            color={isUser ? C.ink : C.sienna}
            time={b.time} />
          <div style={{
            fontSize: 18, color: C.text, lineHeight: 1.6,
            fontFamily: "'Inter', sans-serif", fontWeight: 400,
          }}>{b.body}</div>

          {b.diff && (
            <div style={{
              marginTop: 12, borderRadius: 6, overflow: "hidden",
              background: C.panel, border: `1px solid ${C.line}`,
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "6px 12px", background: C.surface,
                borderBottom: `1px solid ${C.line}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Ic name="diff" size={10} color={C.muted} />
                  <span style={{ fontSize: 15, color: C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                    src/core/signal.ts
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 15, color: C.sage, fontFamily: "'JetBrains Mono', monospace" }}>+2</span>
                  <span style={{ fontSize: 15, color: C.rose, fontFamily: "'JetBrains Mono', monospace" }}>−1</span>
                </div>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, lineHeight: 1.75 }}>
                {b.diff.map((d, i) => (
                  <div key={i} style={{
                    padding: "0 12px",
                    background: d.op === "+" ? `${C.sage}12` : d.op === "-" ? `${C.rose}12` : "transparent",
                    color: d.op === "+" ? C.sage : d.op === "-" ? C.rose : C.muted,
                    borderLeft: `2px solid ${d.op === "+" ? C.sage : d.op === "-" ? C.rose : "transparent"}`,
                    whiteSpace: "pre",
                  }}>
                    <span style={{ display: "inline-block", width: 12, color: C.subtle }}>{d.op}</span>
                    {d.text}
                  </div>
                ))}
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                background: C.surface, borderTop: `1px solid ${C.line}`,
              }}>
                <button style={{
                  padding: "4px 12px", borderRadius: 5, fontSize: 11,
                  background: C.sienna, color: C.base, fontWeight: 500,
                  border: "none", cursor: "pointer", fontFamily: "'Inter', sans-serif",
                }}>Apply</button>
                <button style={{
                  padding: "4px 12px", borderRadius: 5, fontSize: 11,
                  background: "transparent", color: C.muted,
                  border: `1px solid ${C.line}`, cursor: "pointer", fontFamily: "'Inter', sans-serif",
                }}>Discard</button>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 15, color: C.subtle, fontFamily: "'JetBrains Mono', monospace" }}>⌘⏎</span>
              </div>
            </div>
          )}
        </div>
      );
    }

    case "shell": {
      const statusColor = b.status === "ok" ? C.sage : b.status === "fail" ? C.rose : C.amber;
      return (
        <div style={wrap}>
          {dot(statusColor)}
          <BlockLabel label="Ran" color={C.muted} time={b.time} />

          <div style={{ borderRadius: 6, overflow: "hidden", border: `1px solid ${C.line}` }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
              background: C.panel, borderBottom: `1px solid ${C.line}`,
            }}>
              <span style={{
                color: C.sienna, fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600, fontSize: 17,
              }}>›</span>
              <code style={{
                flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 16.5,
                color: C.text, letterSpacing: "0.01em",
              }}>{b.cmd}</code>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor }} />
                  <span style={{ fontSize: 15, color: statusColor,
                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.08em" }}>{b.status}</span>
                </span>
                <span style={{ fontSize: 15, color: C.subtle, fontFamily: "'JetBrains Mono', monospace" }}>
                  {b.ms}ms
                </span>
                <Ic name="copy" size={11} color={C.subtle} />
              </div>
            </div>
            <div style={{
              background: `${C.base}80`, padding: "8px 12px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, lineHeight: 1.7, color: C.muted,
            }}>
              {b.output.map((line, i) => (
                <div key={i} style={{ whiteSpace: "pre" }}>
                  {line.includes("✓") ? (
                    <><span style={{ color: C.sage }}>{line.split("(")[0]}</span>
                      <span>({line.split("(")[1]}</span></>
                  ) : line.includes("passed") ? (
                    <span style={{ color: C.sage }}>{line}</span>
                  ) : line}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case "git": return (
      <div style={wrap}>
        {dot(C.rust, "git-commit")}
        <BlockLabel label="Committed" color={C.rust} time={b.time} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <code style={{ color: C.rust, fontFamily: "'JetBrains Mono', monospace", fontSize: 16 }}>{b.hash}</code>
          <span style={{ color: C.text, fontSize: 18, fontFamily: "'Inter', sans-serif" }}>{b.msg}</span>
        </div>
        <div style={{ fontSize: 16, color: C.subtle, marginTop: 4, fontFamily: "'Inter', sans-serif" }}>
          {b.files} files changed
        </div>
      </div>
    );

    case "lsp": return (
      <div style={wrap}>
        {dot(C.amber, "warning")}
        <BlockLabel label="Compiler noted" color={C.amber} time={b.time} />
        <div style={{ color: C.text, fontSize: 18, fontFamily: "'Inter', sans-serif" }}>{b.msg}</div>
        <code style={{ display: "inline-block", marginTop: 4,
          fontFamily: "'JetBrains Mono', monospace", fontSize: 15.5, color: C.subtle }}>
          {b.file}:{b.line}
        </code>
      </div>
    );

    case "task": return (
      <div style={wrap}>
        {dot(b.state === "done" ? C.sage : C.muted, b.state === "done" ? "check" : undefined)}
        <BlockLabel
          label={b.state === "done" ? "Task complete" : "Task"}
          color={C.sage} time={b.time} />
        <div style={{
          color: C.text, fontSize: 18, fontFamily: "'Inter', sans-serif",
          textDecoration: b.state === "done" ? "line-through" : "none",
          textDecorationColor: C.faint,
        }}>{b.title}</div>
      </div>
    );
  }
}

export function SelenaSidebar({
  rightW, setRightW, selenaSessions, activeSessionId, setActiveSessionId,
  addSession, closeSession, aiInput, setAiInput, handleSendAiInput, composerRef
}: {
  rightW: number;
  setRightW: (w: number) => void;
  selenaSessions: SelenaSession[];
  activeSessionId: string;
  setActiveSessionId: (id: string) => void;
  addSession: () => void;
  closeSession: (id: string, e: React.MouseEvent) => void;
  aiInput: string;
  setAiInput: (val: string) => void;
  handleSendAiInput: () => void;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <aside style={{
      width: rightW, background: C.base,
      borderLeft: `1px solid ${C.line}`,
      display: "flex", flexDirection: "column",
      flexShrink: 0, overflow: "hidden",
    }}>

      {/* Session Tab strip */}
      <div style={{
        display: "flex",
        alignItems: "center",
        background: C.base,
        borderBottom: `1px solid ${C.line}`,
        height: 35,
        flexShrink: 0,
        justifyContent: "space-between",
      }}>
        {/* Left: Tab list + Add button */}
        <div style={{ display: "flex", alignItems: "center", height: "100%", overflowX: "auto" }} className="sb-hide">
          {selenaSessions.map((session, idx) => {
            const isActive = session.id === activeSessionId;
            return (
              <div key={session.id}
                className="group"
                onClick={() => setActiveSessionId(session.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 14px",
                  height: "100%",
                  cursor: "pointer",
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
                <span style={{
                  fontSize: 13,
                  color: isActive ? C.text : C.muted,
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: isActive ? 600 : 400,
                }}>
                  {(() => {
                    const firstUserMsg = session.blocks.find(b => b.kind === "ai" && b.role === "user");
                    if (firstUserMsg && 'body' in firstUserMsg) {
                      const bodyText = firstUserMsg.body;
                      return bodyText.length > 16 ? bodyText.slice(0, 16) + "..." : bodyText;
                    } 
                    return `Selena ${idx + 1}`;
                  })()}
                </span>
                <span
                  onClick={(e: React.MouseEvent) => closeSession(session.id, e)}
                  style={{ display: 'flex', alignItems: 'center' }}
                >
                  <Ic
                    name="close"
                    size={11}
                    color={C.subtle}
                    style={{ opacity: 0, transition: 'opacity 0.15s' }}
                  />
                </span>
              </div>
            );
          })}
          <button
            onClick={addSession}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: "100%",
              border: "none",
              background: "transparent",
              color: C.muted,
              cursor: "pointer",
              borderRight: `1px solid ${C.line}`,
            }}
            title="New Session"
          >
            <Ic name="add" size={14} color={C.muted} />
          </button>
        </div>

        {/* Right: Utility icons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 10 }}>
          <button
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: C.muted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
            }}
            title="History"
          >
            <Ic name="history" size={14} color={C.muted} />
          </button>
          <button
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: C.muted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
            }}
            title="More Options"
          >
            <Ic name="ellipsis" size={14} color={C.muted} />
          </button>
          <button
            onClick={() => setRightW(0)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: C.muted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
            }}
            title="Close Panel"
          >
            <Ic name="close" size={14} color={C.muted} />
          </button>
        </div>
      </div>

      {/* Main Content Area: timeline blocks or empty state */}
      {(() => {
        const activeSession = selenaSessions.find(s => s.id === activeSessionId) || selenaSessions[0];
        if (activeSession.blocks.length > 0) {
          return (
            <div className="sb" style={{
              flex: 1, overflowY: "auto",
              position: "relative", paddingTop: 20,
              background: C.panel,
            }}>
              <div style={{
                position: "absolute", left: 27, top: 24, bottom: 24,
                width: 1,
                background: `linear-gradient(to bottom, ${C.line}, ${C.sienna}40, ${C.line})`,
              }} />
              {activeSession.blocks.map((b, i) => <StreamBlock key={i} b={b} />)}
            </div>
          );
        } else {
          return (
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 24px",
              textAlign: "center",
              background: C.panel,
            }}>
              <div style={{
                width: 90,
                height: 90,
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <img
                  src={new URL("../../imports/icon_transparent.png", import.meta.url).href}
                  alt="Selena Logo"
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    opacity: 0.9,
                    filter: "drop-shadow(0px 4px 12px rgba(107, 163, 224, 0.2))"
                  }}
                />
              </div>

              <div style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 20,
                fontWeight: 600,
                color: C.text,
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}>
                Selena Code
                <span style={{ display: "inline-flex", gap: 3 }}>
                  <kbd style={{
                    border: `1px solid ${C.line}`,
                    background: C.surface,
                    padding: "2px 5px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 600,
                    color: C.muted,
                    fontFamily: "'Inter', sans-serif"
                  }}>Ctrl</kbd>
                  <kbd style={{
                    border: `1px solid ${C.line}`,
                    background: C.surface,
                    padding: "2px 5px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 600,
                    color: C.muted,
                    fontFamily: "'Inter', sans-serif"
                  }}>Shift</kbd>
                  <kbd style={{
                    border: `1px solid ${C.line}`,
                    background: C.surface,
                    padding: "2px 5px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 600,
                    color: C.muted,
                    fontFamily: "'Inter', sans-serif"
                  }}>;</kbd>
                </span>
              </div>

              <div style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13.5,
                color: C.muted,
                lineHeight: 1.5,
                maxWidth: 260,
              }}>
                Kick off a new project. Make changes across your entire codebase.
              </div>
            </div>
          );
        }
      })()}

      {/* Composer */}
      <div style={{
        borderTop: `1px solid ${C.line}`,
        padding: "14px 16px 12px 16px",
        background: C.panel,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>
        <div style={{
          background: C.base,
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          padding: "10px 12px 8px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <textarea
              ref={composerRef}
              rows={2}
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendAiInput();
                }
              }}
              placeholder="Ask Selena..."
              style={{
                flex: 1,
                background: "transparent",
                outline: "none",
                border: "none",
                resize: "none",
                color: C.text,
                fontSize: 13.5,
                fontFamily: "'Inter', sans-serif",
                lineHeight: 1.5,
                caretColor: C.sienna,
              }}
            />
          </div>

          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 6,
            borderTop: `1px solid ${C.line}40`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button style={{
                background: "transparent", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: C.muted, padding: 4, borderRadius: 4,
                transition: "background 0.15s",
              }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.surface}
                 onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                <Ic name="add" size={14} color={C.muted} />
              </button>

              <button style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 6,
                background: C.surface, border: `1px solid ${C.line}`,
                fontSize: 12, color: C.muted,
                fontFamily: "'Inter', sans-serif", cursor: "pointer",
                transition: "border-color 0.15s",
              }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${C.sienna}50`}
                 onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = C.line}>
                <Ic name="code" size={11} color={C.muted} />
                <span>Code</span>
                <Ic name="chevron-down" size={10} color={C.subtle} />
              </button>

              <button style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 6,
                background: C.surface, border: `1px solid ${C.line}`,
                fontSize: 12, color: C.muted,
                fontFamily: "'Inter', sans-serif", cursor: "pointer",
                transition: "border-color 0.15s",
              }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${C.sienna}50`}
                 onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = C.line}>
                <span>SWE-1.6 Slow</span>
                <Ic name="chevron-down" size={10} color={C.subtle} />
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 4 }}>
                <img src={new URL("../../imports/icon_transparent.png", import.meta.url).href}
                  alt="Selena" style={{ width: 14, height: 14, opacity: 0.7 }} />
                <span style={{ fontSize: 12, color: C.subtle, fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                  Selena
                </span>
              </div>

              <button style={{
                background: "transparent", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: C.muted, padding: 4, borderRadius: 4,
              }}>
                <Ic name="mic" size={14} color={C.muted} />
              </button>

              <button
                onClick={handleSendAiInput}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: aiInput.trim()
                    ? `linear-gradient(180deg, ${C.sienna}, ${C.rust})`
                    : `${C.sienna}25`,
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "opacity 0.15s",
                }}
                disabled={!aiInput.trim()}
              >
                <Ic name="arrow-up" size={13}
                  color={aiInput.trim() ? C.base : C.muted} />
              </button>
            </div>
          </div>
        </div>

        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 12,
          padding: "0 4px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Ic name="device-desktop" size={11} color={C.subtle} />
            <span style={{ fontSize: 12, color: C.subtle, fontFamily: "'Inter', sans-serif" }}>Local</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Ic name="folder" size={11} color={C.subtle} />
            <span style={{ fontSize: 12, color: C.subtle, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>
              Kadmus Editor Interface De...
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
