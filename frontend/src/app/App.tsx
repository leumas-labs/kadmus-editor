import { useState, useRef, useCallback, useEffect } from "react";
import { ThemeProvider } from "@figma/astraui";
import { Sparkles } from "lucide-react";

// Types
import { LeftId, SelenaSession, OpenFile, CommandPaletteItem } from "../types";
import { connectToBackend, callBackend, onNotification } from "./rpc";

// Themes & Shared Palette
import { C, THEMES, ThemeName } from "../styles/theme";

// Mock Data
import { STREAM } from "../mocks";

// Components
import { Ic } from "./components/common";
import { CommandPalette } from "./components/CommandPalette";
import { EditorColumn } from "./components/EditorColumn";
import { SelenaSidebar } from "./components/SelenaSidebar";
import {
  RepoPanel,
  SearchPanel,
  DebugPanel,
  GitPanel,
  WikiPanel,
  ExtensionsPanel,
} from "./components/LeftPanels";
import { SettingsModal } from "./components/SettingsModal";

// ── resize utility ───────────────────────────────────────────────────
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

const RAIL = [
  { id: "repo",       icon: "files",             label: "Explorer" },
  { id: "search",     icon: "search",            label: "Search" },
  { id: "debug",      icon: "debug-alt",         label: "Run & Debug" },
  { id: "git",        icon: "source-control",    label: "Source Control" },
  { id: "extensions", icon: "extensions",        label: "Extensions" },
  { id: "wiki",       icon: "book",              label: "Wiki" },
] as const;

export default function App() {
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set(["src", "src/core"]));
  const [showTerminal, setShowTerminal] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [gitBranch,   setGitBranch]   = useState("main");
  const [activePath,  setActivePath]  = useState("README.md");
  const [aiInput,     setAiInput]     = useState("");
  const [showCmd,     setShowCmd]     = useState(false);
  const [focusMode,   setFocusMode]   = useState(false);
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(true);
  const [selenaSessions, setSelenaSessions] = useState<SelenaSession[]>([
    { id: "session-1", name: "Selena", blocks: STREAM },
    { id: "session-2", name: "Selena", blocks: [] },
  ]);
  const [activeSessionId, setActiveSessionId] = useState("session-1");
  const [leftPanel,   setLeftPanel]   = useState<LeftId>("repo");
  const [openFiles, setOpenFiles]   = useState<OpenFile[]>([
    { path: "README.md", name: "README.md", breadcrumb: ".", ext: "md" },
  ]);
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const handleOpenFile = useCallback((path: string) => {
    setActivePath(path);
    const name = path.split('/').pop() || '';
    const breadcrumb = path.split('/').slice(0, -1).join('/') || '.';
    const ext = name.split('.').pop() || '';

    setOpenFiles(prev => {
      const idx = prev.findIndex(f => f.path === path);
      if (idx >= 0) {
        setActiveFileIdx(idx);
        return prev;
      } else {
        const newFile: OpenFile = { path, name, breadcrumb, ext };
        setActiveFileIdx(prev.length);
        return [...prev, newFile];
      }
    });
  }, []);

  const handleCloseFile = useCallback((path: string) => {
    setOpenFiles(prev => {
      const next = prev.filter(f => f.path !== path);
      if (next.length === 0) {
        setActiveFileIdx(0);
      } else {
        const activeFile = prev[activeFileIdx];
        if (activeFile && activeFile.path === path) {
          setActiveFileIdx(0);
        } else if (activeFile) {
          const newIdx = next.findIndex(f => f.path === activeFile.path);
          setActiveFileIdx(newIdx >= 0 ? newIdx : 0);
        }
      }
      return next;
    });
  }, [activeFileIdx]);

  const [leftW,  startLeft]  = useResize(248, 0, 268);
  const [rightW, startRight, setRightW] = useResize(378, 0, 640);

  const [themeTrigger, setThemeTrigger] = useState(0);
  const [currentThemeName, setCurrentThemeName] = useState<ThemeName>('azure');
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  const activeSessionIdRef = useRef(activeSessionId);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    connectToBackend(
      () => {
        setIsConnected(true);
        callBackend('git_branch', { repo_path: '.' }).then(branch => {
          if (branch) setGitBranch(branch);
        });
        callBackend('settings_get', {}).then((retrievedSettings: any) => {
          if (retrievedSettings) {
            setSettings(retrievedSettings);
            if (retrievedSettings.theme?.name) {
              selectTheme(retrievedSettings.theme.name, false);
            }
          }
        });
      },
      () => setIsConnected(false)
    );

    const unsubscribe = onNotification('agent_reply', (params: any) => {
      const replySessionId = params.session_id || 'session-1';
      setSelenaSessions(prev => prev.map(s => {
        const isMatch = s.id === replySessionId || (replySessionId === 'local_sess' && s.id === activeSessionIdRef.current);
        if (isMatch) {
          return {
            ...s,
            blocks: [
              ...s.blocks,
              {
                kind: "ai",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                role: "kadmus",
                body: params.message
              }
            ]
          };
        }
        return s;
      }));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const selectTheme = useCallback((themeName: ThemeName, updateSettingsOnServer = true) => {
    setCurrentThemeName(themeName);
    Object.assign(C, THEMES[themeName]);
    
    const root = document.documentElement;
    const themeColors = THEMES[themeName];
    root.style.setProperty('--background', themeColors.base);
    root.style.setProperty('--foreground', themeColors.text);
    root.style.setProperty('--card', themeColors.panel);
    root.style.setProperty('--card-foreground', themeColors.text);
    root.style.setProperty('--popover', themeColors.surface);
    root.style.setProperty('--popover-foreground', themeColors.text);
    root.style.setProperty('--primary', themeColors.sienna);
    root.style.setProperty('--primary-foreground', themeColors.base);
    root.style.setProperty('--secondary', themeColors.surface);
    root.style.setProperty('--secondary-foreground', themeColors.text);
    root.style.setProperty('--border', themeColors.line);
    root.style.setProperty('--input', themeColors.panel);
    root.style.setProperty('--ring', themeColors.sienna);
    
    setThemeTrigger(v => v + 1);

    if (updateSettingsOnServer) {
      setSettings((prev: any) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          theme: {
            ...(prev.theme || {}),
            name: themeName
          }
        };
        callBackend('settings_set', { settings: updated });
        return updated;
      });
    }
  }, []);

  const onSettingsUpdate = useCallback((newSettings: any) => {
    setSettings(newSettings);
    callBackend('settings_set', { settings: newSettings });
    if (newSettings.theme?.name && newSettings.theme.name !== currentThemeName) {
      selectTheme(newSettings.theme.name, false);
    }
  }, [currentThemeName, selectTheme]);

  const addSession = useCallback(() => {
    const newId = `session-${Date.now()}`;
    setSelenaSessions(prev => [
      ...prev,
      { id: newId, name: "Selena", blocks: [] }
    ]);
    setActiveSessionId(newId);
  }, []);

  const closeSession = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelenaSessions(prev => {
      if (prev.length <= 1) {
        const fallbackId = `session-${Date.now()}`;
        setActiveSessionId(fallbackId);
        return [{ id: fallbackId, name: "Selena", blocks: [] }];
      }
      const idx = prev.findIndex(s => s.id === id);
      const nextSessions = prev.filter(s => s.id !== id);
      if (activeSessionId === id) {
        const nextActiveIdx = Math.max(0, idx - 1);
        setActiveSessionId(nextSessions[nextActiveIdx].id);
      }
      return nextSessions;
    });
  }, [activeSessionId]);

  const handleSendAiInput = useCallback(() => {
    if (!aiInput.trim()) return;
    const userMsg = aiInput;
    setAiInput("");

    setSelenaSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          blocks: [
            ...s.blocks,
            { kind: "ai", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), role: "user", body: userMsg }
          ]
        };
      }
      return s;
    }));

    callBackend('agent_send', { session_id: activeSessionId, message: userMsg });
  }, [aiInput, activeSessionId]);

  // Sync background on load/theme trigger
  useEffect(() => {
    document.body.style.background = "transparent";
  }, [themeTrigger]);

  const toggleFocusMode = useCallback(() => setFocusMode(f => !f), []);
  const toggleLeftSidebar = useCallback(() => setLeftSidebarVisible(v => !v), []);

  const openSelenaSession = useCallback(() => {
    if (focusMode) setFocusMode(false);
    if (rightW <= 48) setRightW(378);
    setSelenaSessions(prev => {
      const empty = prev.find(s => s.blocks.length === 0);
      if (empty) {
        setActiveSessionId(empty.id);
        return prev;
      } else {
        const newId = `session-${Date.now()}`;
        setActiveSessionId(newId);
        return [...prev, { id: newId, name: "Selena", blocks: [] }];
      }
    });
  }, [focusMode, rightW, setRightW]);

  const commandItems: CommandPaletteItem[] = [
    { icon: "search", label: "Go to file…", hint: "⌘P", onSelect: () => setLeftPanel("repo") },
    { icon: "symbol-method", label: "Go to symbol in workspace", hint: "⌘T", onSelect: () => setLeftPanel("search") },
    { icon: "sparkle", label: "Ask Kadmus about selection", hint: "⌘L", onSelect: () => setLeftPanel("wiki") },
    { icon: "diff", label: "Show diff since main", hint: "⌘D", onSelect: () => setLeftPanel("git") },
    { icon: "terminal", label: "Run command…", hint: "⌘⇧R", onSelect: () => setShowCmd(true) },
    { icon: "eye", label: "Toggle Focus Mode", hint: "⌘⇧F", onSelect: toggleFocusMode },
    { icon: "sidebar-collapse", label: "Toggle Left Sidebar", hint: "⌘B", onSelect: toggleLeftSidebar },
  ];

  const toggle = (name: string) => setExpanded(prev => {
    const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n;
  });

  const leftPanelCollapsed = leftW <= 36;
  const rightSidebarCollapsed = rightW <= 48;

  const isDragZoneActiveRef = useRef(false);

  const handleMouseMoveTopbar = useCallback((e: React.MouseEvent) => {
    const isDraggable = !(e.target as HTMLElement).closest('.no-drag');
    if (isDraggable !== isDragZoneActiveRef.current) {
      isDragZoneActiveRef.current = isDraggable;
      callBackend('set_drag_zone', { active: isDraggable });
    }
  }, []);

  const handleMouseLeaveTopbar = useCallback(() => {
    if (isDragZoneActiveRef.current) {
      isDragZoneActiveRef.current = false;
      callBackend('set_drag_zone', { active: false });
    }
  }, []);

  if (!isConnected) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "100vh", background: C.base, color: C.text,
        fontFamily: "'Inter', sans-serif", gap: 16
      }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}>Connecting to Kadmus C++ Backend...</div>
        <div style={{ fontSize: 14, color: C.muted }}>Waiting for secure WebSocket handshake on port 9888</div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <div style={{
        display: "flex", flexDirection: "column", height: "100vh",
        background: C.panel, color: C.text, overflow: "hidden",
        borderRadius: 12, border: `1px solid ${C.line}`, boxSizing: "border-box"
      }}>
        {/* Style block for global rules */}
        <style>{`
          .sb::-webkit-scrollbar{width:6px;height:6px}
          .sb::-webkit-scrollbar-track{background:transparent}
          .sb::-webkit-scrollbar-thumb{background:${C.hair};border-radius:3px}
          .sb::-webkit-scrollbar-thumb:hover{background:${C.faint}}
          .nosb::-webkit-scrollbar{display:none}
          .nosb{scrollbar-width:none}
          .sb-hide::-webkit-scrollbar{display:none}
          .sb-hide{scrollbar-width:none}
          @keyframes blink{0%,100%{background:transparent}50%{background:${C.sienna}}}
          .blink{animation:blink 1.15s step-end infinite}
          @keyframes pulse-dot{0%,100%{opacity:0.4}50%{opacity:1}}
          .pulse{animation:pulse-dot 2s ease-in-out infinite}
          @keyframes ghost{0%,100%{opacity:0.35}50%{opacity:0.6}}
          .ghost{animation:ghost 2.4s ease-in-out infinite}
          input::placeholder,textarea::placeholder{color:${C.subtle}}
          .rh-x{cursor:col-resize;width:4px;flex-shrink:0;transition:background 0.15s}
          .rh-x:hover,.rh-x:active{background:${C.sienna}40 !important}
          .group:hover .codicon-close{opacity:1 !important}
          .selena-cta{
            width: 34px;
            overflow: hidden;
            white-space: nowrap;
            transition: width 0.2s ease, background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
          }
          .selena-cta:hover,.selena-cta:focus-visible{width: 184px; transform: translateY(-1px)}
          .selena-cta:hover .selena-cta-label,.selena-cta:focus-visible .selena-cta-label{opacity: 1; transform: translateX(0)}
          .selena-cta-label{opacity: 0; transform: translateX(-4px); transition: opacity 0.15s ease, transform 0.15s ease}

          .window-controls .win-ctrl-sub {
            opacity: 0;
            max-width: 0;
            margin-left: 0;
            overflow: hidden;
            pointer-events: none;
          }
          .window-controls:hover .win-ctrl-sub {
            opacity: 1;
            max-width: 22px;
            margin-left: 2px;
            pointer-events: auto;
          }
          .window-controls .win-ctrl:hover {
            background: rgba(255, 255, 255, 0.08);
            color: ${C.text};
          }
        `}</style>

        {/* ── TOP BAR ── */}
        <div 
          onMouseMove={handleMouseMoveTopbar}
          onMouseLeave={handleMouseLeaveTopbar}
          style={{
            display: "flex", alignItems: "center", flexShrink: 0,
            height: 30, background: C.base, borderBottom: `1px solid ${C.line}`,
            padding: "0 12px", gap: 8, userSelect: "none"
          }}
        >
          {/* Brand with 'K inside circle' Copyright-like SVG */}
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0, paddingLeft: 4, color: C.sienna }} className="no-drag">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
              <text x="12" y="16" fontFamily="'Inter', sans-serif" fontWeight="800" fontSize="12" fill="currentColor" textAnchor="middle">K</text>
            </svg>
          </div>

          {/* Search / Command trigger */}
          <div style={{ flex: 1, minWidth: 120, display: "flex", justifyContent: "center" }} className="no-drag">
            <button
              onClick={() => setShowCmd(true)}
              style={{
                width: "100%", maxWidth: 320,
                display: "flex", alignItems: "center", gap: 6,
                padding: "2px 8px", borderRadius: 5,
                background: C.panel, border: `1px solid ${C.line}`,
                cursor: "pointer", transition: "all 0.15s",
                fontFamily: "'Inter', sans-serif",
                height: 22,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = `${C.sienna}50`;
                (e.currentTarget as HTMLElement).style.background = C.surface;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = C.line;
                (e.currentTarget as HTMLElement).style.background = C.panel;
              }}>
              <Ic name="search" size={10} color={C.muted} />
              <span style={{ fontSize: 13, color: C.muted, flex: 1, textAlign: "left" }}>
                Jump to file, symbol, or ask Kadmus…
              </span>
              <span style={{
                fontSize: 11, color: C.subtle, fontFamily: "'JetBrains Mono', monospace",
                padding: "0 3px", borderRadius: 3,
                background: C.base, border: `1px solid ${C.line}`,
              }}>⌘K</span>
            </button>
          </div>

          {/* Presence */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }} className="no-drag">
            {[
              { i: "A", c: C.sage,   at: "signal.ts:14" },
              { i: "M", c: C.ink,    at: "queue.ts:8"   },
            ].map((p, i) => (
              <div key={i} title={`${p.i} · ${p.at}`}
                style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: `${p.c}22`, border: `1.2px solid ${p.c}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 600, color: p.c,
                  marginLeft: i > 0 ? -4 : 0, cursor: "pointer",
                }}>{p.i}</div>
            ))}
            <button style={{
              width: 18, height: 18, borderRadius: "50%",
              background: "transparent", border: `1.2px dashed ${C.line}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: C.subtle, cursor: "pointer", marginLeft: -4,
            }}>
              <Ic name="add" size={9} />
            </button>
          </div>

          {/* Talk with Selena Sparkle button */}
          <button
            title="Talk with Selena"
            aria-label="Talk with Selena"
            onClick={openSelenaSession}
            style={{
              height: 18,
              display: "flex", alignItems: "center", gap: 4,
              padding: 0,
              background: "transparent",
              border: "none",
              color: C.sage,
              cursor: "pointer",
              flexShrink: 0,
              fontFamily: "'Inter', sans-serif",
            }}
            className="selena-cta no-drag"
          >
            <Sparkles size={12} strokeWidth={2.5} aria-hidden="true" focusable="false" style={{ flexShrink: 0, display: "block" }} />
            <span className="selena-cta-label" style={{ fontSize: 12, fontWeight: 600, color: C.sage }}>
              Talk with Selena
            </span>
          </button>

          <div style={{ width: 1, height: 12, background: C.line }} className="no-drag" />

          {/* Project Branch indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }} className="no-drag">
            <Ic name="git-branch" size={10} color={C.muted} />
            <span style={{
              fontSize: 13, color: C.text,
              fontFamily: "'JetBrains Mono', monospace",
            }}>{gitBranch}</span>
            <span style={{
              fontSize: 12, color: C.rust,
              fontFamily: "'JetBrains Mono', monospace",
            }}>↑1</span>
            <div style={{ width: 1, height: 12, background: C.line }} />
            <span style={{ width: 4, height: 4, borderRadius: "50%",
              background: C.amber }} className="pulse" />
          </div>

          {/* Terminal quick toggle */}
          <button title="Toggle Terminal ⌃`"
            onClick={() => setShowTerminal(v => !v)}
            style={{
              width: 24, height: 24, borderRadius: 5,
              background: showTerminal ? `${C.sienna}18` : "transparent",
              border: `1px solid ${showTerminal ? C.sienna : C.line}`,
              color: showTerminal ? C.sienna : C.muted,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
            }}
            className="no-drag"
          >
            <Ic name="terminal" size={12} color={showTerminal ? C.sienna : C.muted} />
          </button>

          {/* Run/Build */}
          <button title="Run Project ⌘R" 
            style={{
              padding: "0 8px", borderRadius: 5,
              background: C.sage, color: C.base,
              border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              flexShrink: 0,
              display: "flex", alignItems: "center", gap: 4,
              height: 24,
            }}
            className="no-drag"
          >
            <Ic name="play" size={9} color={C.base} />
            Run
          </button>

          {/* Account */}
          <button title="Account" style={{
            width: 24, height: 24, borderRadius: 5,
            background: "transparent",
            border: `1px solid ${C.line}`,
            color: C.muted,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
          className="no-drag"
          >
            <Ic name="account" size={11} />
          </button>

          {/* Settings / Theme selector dropdown */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }} className="no-drag">
            <button title="Settings ⌘,"
              onClick={() => setShowSettingsDropdown(v => !v)}
              style={{
                width: 24, height: 24, borderRadius: 5,
                background: "transparent",
                border: `1px solid ${C.line}`,
                color: C.muted,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
              }}
            >
              <Ic name="settings-gear" size={12} />
            </button>
            
            {showSettingsDropdown && (
              <div style={{
                position: "absolute", right: 0, top: 30, zIndex: 1000,
                background: C.surface, border: `1px solid ${C.line}`,
                borderRadius: 6, padding: 4, width: 180,
                boxShadow: `0 4px 12px ${C.base}80`,
              }}>
                <div style={{ padding: "6px 8px", fontSize: 11, color: C.subtle, fontWeight: 600, textTransform: "uppercase" }}>Color Theme</div>
                {[
                  { id: "azure", label: "Azure (Default)" },
                  { id: "espresso", label: "Espresso (Warm)" },
                  { id: "cobalt", label: "Cobalt (Vibrant)" }
                ].map(theme => (
                  <button key={theme.id}
                    onClick={() => { selectTheme(theme.id as ThemeName); setShowSettingsDropdown(false); }}
                    style={{
                      width: "100%", padding: "6px 8px", borderRadius: 4,
                      background: currentThemeName === theme.id ? `${C.sienna}15` : "transparent",
                      color: currentThemeName === theme.id ? C.sienna : C.text,
                      border: "none", cursor: "pointer", textAlign: "left", fontSize: 13,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                  >
                    {theme.label}
                    {currentThemeName === theme.id && <Ic name="check" size={12} color={C.sienna} />}
                  </button>
                ))}
                <div style={{ height: 1, background: C.line, margin: "4px 0" }} />
                <button
                  onClick={() => { setShowSettingsModal(true); setShowSettingsDropdown(false); }}
                  style={{
                    width: "100%", padding: "6px 8px", borderRadius: 4,
                    background: "transparent", color: C.text,
                    border: "none", cursor: "pointer", textAlign: "left", fontSize: 13,
                    display: "flex", alignItems: "center", gap: 6
                  }}
                >
                  <Ic name="settings" size={12} color={C.muted} />
                  <span>Settings...</span>
                </button>
              </div>
            )}
          </div>

          <div style={{ width: 1, height: 12, background: C.line }} className="no-drag" />

          {/* Window Controls (soft_design reveal effect) */}
          <div className="window-controls no-drag" style={{ display: "flex", alignItems: "center", position: "relative", flexShrink: 0 }}>
            <button 
              onClick={() => callBackend('window_minimize')}
              className="win-ctrl win-ctrl-sub" 
              title="Minimize"
              style={{
                width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: "none", cursor: "pointer", color: C.muted, borderRadius: 4,
                transition: "opacity 0.12s, max-width 0.18s, margin-left 0.18s",
              }}
            >
              <svg viewBox="0 0 10 10" width="10" height="10"><rect x="1.5" y="4.5" width="7" height="1" fill="currentColor"/></svg>
            </button>
            <button 
              onClick={() => callBackend('window_maximize')}
              className="win-ctrl win-ctrl-sub" 
              title="Maximize"
              style={{
                width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: "none", cursor: "pointer", color: C.muted, borderRadius: 4,
                transition: "opacity 0.12s, max-width 0.18s, margin-left 0.18s",
              }}
            >
              <svg viewBox="0 0 10 10" width="10" height="10"><rect x="2" y="2" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1"/></svg>
            </button>
            <button 
              onClick={() => callBackend('window_close')}
              className="win-ctrl win-ctrl--close" 
              title="Close"
              style={{
                width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: "none", cursor: "pointer", color: C.muted, borderRadius: 4,
                transition: "all 0.12s"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "#e5484d";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = C.muted;
              }}
            >
              <svg viewBox="0 0 10 10" width="10" height="10">
                <line x1="2" y1="2" x2="8" y2="8" stroke="currentColor" stroke-width="1.2"/>
                <line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" stroke-width="1.2"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── MAIN WORKSPACE AREA ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ── Left rail + panel ── */}
          {!focusMode && leftSidebarVisible && (
            <>
              {/* ── Left rail ── */}
              <div style={{
                width: 56, background: C.base,
                borderRight: `1px solid ${C.line}`,
                display: "flex", flexDirection: "column",
                alignItems: "center", padding: "10px 0", gap: 4,
                flexShrink: 0,
              }}>
                {RAIL.map(it => {
                  const isActive = leftPanel === it.id;
                  return (
                    <button key={it.id} title={it.label}
                      onClick={() => setLeftPanel(it.id)}
                      style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: isActive ? `${C.sienna}18` : "transparent",
                        color: isActive ? C.sienna : C.muted,
                        border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        position: "relative", transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = `${C.text}06`; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <Ic name={it.icon} size={20} color={isActive ? C.sienna : C.muted} />
                      {isActive && (
                        <span style={{
                          position: "absolute", left: 0, top: 12, bottom: 12,
                          width: 2, background: C.sienna, borderRadius: "0 4px 4px 0",
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ── Left sidebar panel ── */}
              {!leftPanelCollapsed && (
                <div style={{
                  width: leftW, background: C.surface,
                  borderRight: `1px solid ${C.line}`,
                  display: "flex", flexDirection: "column",
                  flexShrink: 0,
                }}>
                  {(() => {
                    switch (leftPanel) {
                      case "repo":       return <RepoPanel expanded={expanded} onToggle={toggle} activePath={activePath} onSelect={handleOpenFile} />;
                      case "search":     return <SearchPanel />;
                      case "debug":      return <DebugPanel />;
                      case "git":        return <GitPanel />;
                      case "extensions": return <ExtensionsPanel />;
                      case "wiki":       return <WikiPanel />;
                      default:           return null;
                    }
                  })()}
                </div>
              )}

              {/* ── Left panel drag resizer ── */}
              <div className="rh-x" style={{ background: C.line }}
                title={leftPanelCollapsed ? "Drag to show sidebar" : "Drag to resize sidebar"}
                onMouseDown={e => startLeft(e, "x", 1)} />
            </>
          )}

          {/* ── Central Code Editor Column ── */}
          <EditorColumn
            openFiles={openFiles}
            activeFileIdx={activeFileIdx}
            setActiveFileIdx={setActiveFileIdx}
            focusMode={focusMode}
            showTerminal={showTerminal}
            onCloseTab={handleCloseFile}
            themeTrigger={themeTrigger}
            settings={settings}
          />

          {/* ── Selena Chat Panel ── */}
          {!focusMode && (
            <>
              {/* Right panel drag resizer */}
              <div className="rh-x" style={{ background: C.line }}
                title={rightSidebarCollapsed ? "Drag to show sidebar" : "Drag to resize sidebar"}
                onMouseDown={e => startRight(e, "x", -1)} />

              {!rightSidebarCollapsed && (
                <SelenaSidebar
                  rightW={rightW}
                  setRightW={setRightW}
                  selenaSessions={selenaSessions}
                  activeSessionId={activeSessionId}
                  setActiveSessionId={setActiveSessionId}
                  addSession={addSession}
                  closeSession={closeSession}
                  aiInput={aiInput}
                  setAiInput={setAiInput}
                  handleSendAiInput={handleSendAiInput}
                  composerRef={composerRef}
                />
              )}
            </>
          )}
        </div>

        {/* ── Global Command Palette Overlay ── */}
        <CommandPalette open={showCmd} onClose={() => setShowCmd(false)} items={commandItems} />

        {/* ── Settings Modal ── */}
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          settings={settings}
          onSettingsUpdate={onSettingsUpdate}
        />
      </div>
    </ThemeProvider>
  );
}
