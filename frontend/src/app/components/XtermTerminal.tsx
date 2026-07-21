import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { C } from "../../styles/theme";
import { callBackend, onNotification } from "../rpc";
import { Plus, X, Terminal as TerminalIcon } from "lucide-react";

interface TerminalInstance {
  id: string;
  name: string;
  sessionId: number;
  term: Terminal;
  fitAddon: FitAddon;
}

export function XtermTerminal({ height, themeTrigger }: { height: number; themeTrigger: number }) {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  
  const terminalsRef = useRef<TerminalInstance[]>([]);
  terminalsRef.current = terminals;

  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Subscribe to backend term_output notifications globally
  useEffect(() => {
    const unsubscribe = onNotification('term_output', (params: any) => {
      const match = terminalsRef.current.find(t => t.sessionId === params.id);
      if (match) {
        match.term.write(params.data);
      }
    });
    return () => {
      unsubscribe();
      // Cleanup all terminals on unmount
      terminalsRef.current.forEach(t => {
        if (t.sessionId >= 0) {
          callBackend('term_close', { id: t.sessionId });
        }
        t.term.dispose();
      });
    };
  }, []);

  // Helper to spawn a new terminal tab
  const spawnTerminal = async () => {
    const termId = Math.random().toString(36).substring(7);
    
    const term = new Terminal({
      theme: {
        background: C.base,
        foreground: C.text,
        cursor: C.sienna,
        black: C.panel,
        red: C.rose,
        green: C.sage,
        yellow: C.amber,
        blue: C.sky,
        magenta: C.ink,
        cyan: C.sky,
        white: C.text
      },
      fontFamily: 'Fira Code, Monaco, monospace',
      fontSize: 12,
      cursorBlink: true,
      allowProposedApi: true
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // Listen to keystrokes and send them to the backend PTY session
    term.onData((data) => {
      const currentInstance = terminalsRef.current.find(t => t.id === termId);
      if (currentInstance && currentInstance.sessionId >= 0) {
        callBackend('term_write', { id: currentInstance.sessionId, data });
      }
    });

    // Create a tab name
    const termNumber = terminalsRef.current.length + 1;
    const name = `bash (${termNumber})`;

    const newInstance: TerminalInstance = {
      id: termId,
      name,
      sessionId: -1,
      term,
      fitAddon
    };

    setTerminals(prev => [...prev, newInstance]);
    setActiveId(termId);

    // Call C++ to spawn PTY
    const sessionId = await callBackend('term_create', { shell: 'bash' });
    if (sessionId !== undefined && sessionId >= 0) {
      // Update state with sessionId
      setTerminals(prev => prev.map(t => t.id === termId ? { ...t, sessionId } : t));
      
      // Wait for DOM to register the container, then open and fit
      setTimeout(() => {
        const el = containerRefs.current.get(termId);
        if (el) {
          term.open(el);
          try {
            fitAddon.fit();
            callBackend('term_resize', { id: sessionId, cols: term.cols, rows: term.rows });
          } catch (e) {}
        }
      }, 50);
    } else {
      term.writeln('Failed to spawn terminal process on C++ backend.');
    }
  };

  // Create initial terminal on mount
  useEffect(() => {
    if (terminals.length === 0) {
      spawnTerminal();
    }
  }, []);

  // Handle closing a terminal tab
  const closeTerminal = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const match = terminals.find(t => t.id === id);
    if (!match) return;

    // Call backend to close session
    if (match.sessionId >= 0) {
      await callBackend('term_close', { id: match.sessionId });
    }

    match.term.dispose();
    containerRefs.current.delete(id);

    const remaining = terminals.filter(t => t.id !== id);
    setTerminals(remaining);

    // If we closed the active terminal, switch active tab
    if (activeId === id && remaining.length > 0) {
      setActiveId(remaining[remaining.length - 1].id);
    }
  };

  // Refit terminal size when active tab or panel height changes
  useEffect(() => {
    const activeTerm = terminals.find(t => t.id === activeId);
    if (activeTerm) {
      setTimeout(() => {
        try {
          activeTerm.fitAddon.fit();
          if (activeTerm.sessionId >= 0) {
            callBackend('term_resize', {
              id: activeTerm.sessionId,
              cols: activeTerm.term.cols,
              rows: activeTerm.term.rows
            });
          }
        } catch (e) {}
      }, 50);
    }
  }, [activeId, height]);

  // Handle ResizeObserver on active tab element
  useEffect(() => {
    const activeTerm = terminals.find(t => t.id === activeId);
    if (!activeTerm) return;

    const el = containerRefs.current.get(activeId);
    if (!el) return;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          activeTerm.fitAddon.fit();
          if (activeTerm.sessionId >= 0) {
            callBackend('term_resize', {
              id: activeTerm.sessionId,
              cols: activeTerm.term.cols,
              rows: activeTerm.term.rows
            });
          }
        } catch (e) {}
      });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [activeId, terminals]);

  // Update theme dynamically
  useEffect(() => {
    terminals.forEach(t => {
      t.term.options.theme = {
        background: C.base,
        foreground: C.text,
        cursor: C.sienna,
        black: C.panel,
        red: C.rose,
        green: C.sage,
        yellow: C.amber,
        blue: C.sky,
        magenta: C.ink,
        cyan: C.sky,
        white: C.text
      };
    });
  }, [themeTrigger, terminals]);

  return (
    <div style={{
      height: height,
      background: C.base,
      borderTop: `1px solid ${C.line}`,
      display: "flex",
      flexDirection: "column",
      flexShrink: 0
    }}>
      {/* Terminal panel header with tabs */}
      <div style={{
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 8px 0 16px",
        background: C.panel,
        borderBottom: `1px solid ${C.line}`,
        userSelect: "none"
      }}>
        {/* Left: Tab List */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, height: "100%", overflowX: "auto" }}>
          <span style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            color: C.muted,
            marginRight: 12,
            fontFamily: "'Inter', sans-serif"
          }}>TERMINALS</span>
          
          {terminals.map((t) => {
            const isActive = t.id === activeId;
            return (
              <div
                key={t.id}
                onClick={() => setActiveId(t.id)}
                style={{
                  height: 24,
                  padding: "0 8px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  fontFamily: "'Inter', sans-serif",
                  color: isActive ? C.text : C.muted,
                  background: isActive ? C.base : "transparent",
                  border: isActive ? `1px solid ${C.line}` : "1px solid transparent",
                  borderBottomColor: isActive ? C.base : "transparent",
                  borderRadius: "4px 4px 0 0",
                  cursor: "pointer",
                  position: "relative",
                  top: 4,
                  zIndex: isActive ? 2 : 1,
                  transition: "background 0.15s, color 0.15s"
                }}
              >
                <TerminalIcon size={10} style={{ color: isActive ? C.sienna : C.muted }} />
                <span>{t.name}</span>
                {terminals.length > 1 && (
                  <X
                    size={10}
                    onClick={(e) => closeTerminal(t.id, e)}
                    style={{
                      padding: 2,
                      borderRadius: "50%",
                      color: C.muted,
                      transition: "background 0.15s, color 0.15s"
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = C.line;
                      e.currentTarget.style.color = C.text;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = C.muted;
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={spawnTerminal}
            style={{
              background: "transparent",
              border: "none",
              color: C.muted,
              cursor: "pointer",
              padding: 4,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s, color 0.15s"
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = C.line;
              e.currentTarget.style.color = C.text;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = C.muted;
            }}
            title="Create New Terminal"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Terminal containers */}
      <div style={{ flex: 1, padding: "8px 8px 8px 16px", overflow: "hidden", position: "relative" }}>
        {terminals.map((t) => (
          <div
            key={t.id}
            ref={(el) => {
              if (el) containerRefs.current.set(t.id, el);
            }}
            style={{
              height: "100%",
              width: "100%",
              display: t.id === activeId ? "block" : "none"
            }}
          />
        ))}
      </div>
    </div>
  );
}
