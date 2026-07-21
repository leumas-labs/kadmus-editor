import { useState, useEffect, useCallback } from "react";
import { C } from "../../styles/theme";
import { Ic, FileIcon, SectionLabel, PanelTitle } from "./common";
import { callBackend } from "../rpc";

interface FileNode {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
}

export function RealFileTree({
  parentPath = ".",
  depth = 0,
  activePath,
  onSelect
}: {
  parentPath?: string;
  depth?: number;
  activePath: string;
  onSelect: (path: string) => void;
}) {
  const [nodes, setNodes] = useState<FileNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchFiles() {
      const items = await callBackend('fs_list', { path: parentPath });
      if (items && Array.isArray(items)) {
        // Sort: directories first, then alphabetical
        items.sort((a: FileNode, b: FileNode) => {
          if (a.is_directory && !b.is_directory) return -1;
          if (!a.is_directory && b.is_directory) return 1;
          return a.name.localeCompare(b.name);
        });
        setNodes(items);
      }
    }
    fetchFiles();
  }, [parentPath]);

  const toggleDirectory = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <>
      {nodes.map(node => {
        const full = node.path.startsWith("./") ? node.path.substring(2) : node.path;
        const isActive = !node.is_directory && full === activePath;
        return (
          <div key={full}>
            <div
              onClick={() => node.is_directory ? toggleDirectory(full) : onSelect(full)}
              className="group"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                paddingLeft: 12 + depth * 12, paddingTop: 3, paddingBottom: 3, paddingRight: 8,
                background: isActive ? `${C.sienna}18` : "transparent",
                borderLeft: `2px solid ${isActive ? C.sienna : "transparent"}`,
                cursor: "pointer", userSelect: "none",
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = `${C.text}05`; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {node.is_directory ? (
                <Ic name={expanded.has(full) ? "chevron-down" : "chevron-right"}
                  size={11} color={C.muted} style={{ width: 11 }} />
              ) : (
                <FileIcon filename={node.name} size={14} />
              )}
              <span style={{
                fontFamily: node.is_directory ? "'Inter', sans-serif" : "'JetBrains Mono', monospace",
                fontSize: node.is_directory ? 12.5 : 12,
                color: isActive ? C.text : (node.is_directory ? C.text : C.muted),
                fontWeight: node.is_directory ? 500 : 400,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{node.name}</span>
            </div>
            {node.is_directory && expanded.has(full) && (
              <RealFileTree parentPath={full} depth={depth + 1}
                activePath={activePath} onSelect={onSelect} />
            )}
          </div>
        );
      })}
    </>
  );
}

// ── Individual Sidebar Panels ───────────────────────────────────────

export function RepoPanel({ activePath, onSelect }: {
  expanded: Set<string>; onToggle: (n: string) => void;
  activePath: string; onSelect: (n: string) => void;
}) {
  return (
    <>
      <div style={{ padding: "14px 16px 10px" }}>
        <PanelTitle sub="signal-core · main">Explorer</PanelTitle>
      </div>
      <div style={{ padding: "0 12px 8px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 5,
        }}>
          <Ic name="search" size={11} color={C.subtle} />
          <input placeholder="Filter files…"
            style={{
              flex: 1, background: "transparent", outline: "none", border: "none",
              color: C.text, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
            }} />
        </div>
      </div>
      <div className="sb" style={{ flex: 1, overflowY: "auto", paddingTop: 2 }}>
        <RealFileTree activePath={activePath} onSelect={onSelect} />
      </div>
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.line}`, background: C.panel }}>
        <SectionLabel dim>This session</SectionLabel>
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5 }}>
          {[
            { label: "Files loaded dynamically",     color: C.ink   },
            { label: "Git connected natively",      color: C.rust  },
            { label: "PTY shell synchronized", color: C.sage  },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: s.color }} />
              <span style={{ fontSize: 11, color: C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function SearchPanel() {
  const results = [
    { file: "src/core/signal.ts",   line: 19, ctx: "subscribers.", match: "add", after: "(fn)" },
    { file: "src/core/effect.ts",   line: 7,  ctx: "handlers.",    match: "add", after: "(cleanup)" },
    { file: "src/runtime/queue.ts", line: 24, ctx: "tasks.",       match: "add", after: "(job)" },
  ];
  return (
    <>
      <div style={{ padding: "14px 16px 10px" }}>
        <PanelTitle sub="Across signal-core">Search</PanelTitle>
      </div>
      <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
          background: C.panel, border: `1px solid ${C.sienna}50`, borderRadius: 5,
          boxShadow: `0 0 0 2px ${C.sienna}15`,
        }}>
          <Ic name="search" size={12} color={C.sienna} />
          <input defaultValue="add" placeholder="Search text…"
            style={{
              flex: 1, background: "transparent", outline: "none", border: "none",
              color: C.text, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
              caretColor: C.sienna,
            }} />
          <span style={{ fontSize: 11, color: C.subtle,
            fontFamily: "'JetBrains Mono', monospace" }}>3 hits</span>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
          background: "transparent", border: `1px solid ${C.line}`, borderRadius: 5,
        }}>
          <Ic name="replace" size={11} color={C.subtle} />
          <input placeholder="Replace with…"
            style={{
              flex: 1, background: "transparent", outline: "none", border: "none",
              color: C.text, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
            }} />
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
          {[
            { l: "Aa", t: "Match case" },
            { l: "W",  t: "Whole word" },
            { l: ".*", t: "Regex"      },
          ].map(f => (
            <button key={f.l} title={f.t}
              style={{
                fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                padding: "2px 6px", borderRadius: 4,
                background: C.panel, border: `1px solid ${C.line}`,
                color: C.muted, cursor: "pointer",
              }}>{f.l}</button>
          ))}
        </div>
      </div>

      <div className="sb" style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "0 14px 6px" }}>
          <SectionLabel dim>Matches</SectionLabel>
        </div>
        {results.map((r, i) => (
          <div key={i} style={{ padding: "5px 14px 5px 12px", cursor: "pointer" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${C.text}05`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.ink }} />
              <span style={{ fontSize: 12, color: C.text,
                fontFamily: "'JetBrains Mono', monospace" }}>{r.file}</span>
              <span style={{ fontSize: 11, color: C.subtle,
                fontFamily: "'JetBrains Mono', monospace" }}>:{r.line}</span>
            </div>
            <div style={{
              fontSize: 11.5, color: C.muted, fontFamily: "'JetBrains Mono', monospace",
              paddingLeft: 10, whiteSpace: "pre", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {r.ctx}<span style={{
                background: `${C.sienna}30`, color: C.text,
                padding: "0 2px", borderRadius: 2, fontWeight: 600,
              }}>{r.match}</span>{r.after}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function DebugPanel() {
  return (
    <>
      <div style={{ padding: "14px 16px 10px" }}>
        <PanelTitle sub="No active session">Debug</PanelTitle>
      </div>
      <div style={{ padding: "0 12px 10px" }}>
        <button style={{
          width: "100%", padding: "7px 10px", borderRadius: 5,
          background: `${C.sage}18`, border: `1px solid ${C.sage}40`,
          color: C.sage, fontSize: 12, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          cursor: "pointer", fontFamily: "'Inter', sans-serif",
        }}>
          <Ic name="debug-start" size={12} color={C.sage} />
          Start · vitest test/signal.test.ts
        </button>
      </div>

      <div className="sb" style={{ flex: 1, overflowY: "auto" }}>
        {/* Breakpoints */}
        <div style={{ padding: "0 14px 6px" }}>
          <SectionLabel dim>Breakpoints</SectionLabel>
        </div>
        {[
          { file: "signal.ts",       line: 11, enabled: true  },
          { file: "signal.ts",       line: 19, enabled: true  },
          { file: "signal.test.ts",  line: 24, enabled: false },
        ].map((bp, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "4px 14px 4px 12px",
          }}>
            <span style={{
              width: 9, height: 9, borderRadius: "50%",
              background: bp.enabled ? C.rose : "transparent",
              border: `1.5px solid ${bp.enabled ? C.rose : C.faint}`,
            }} />
            <span style={{ flex: 1, fontSize: 12, color: bp.enabled ? C.text : C.subtle,
              fontFamily: "'JetBrains Mono', monospace" }}>
              {bp.file}<span style={{ color: C.subtle }}>:{bp.line}</span>
            </span>
          </div>
        ))}

        {/* Call stack */}
        <div style={{ padding: "14px 14px 6px" }}>
          <SectionLabel dim>Call stack</SectionLabel>
        </div>
        {[
          { name: "signal.set",   loc: "signal.ts:11" },
          { name: "effect.track", loc: "effect.ts:22" },
          { name: "<anonymous>",  loc: "signal.test.ts:17" },
        ].map((f, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "4px 14px 4px 12px",
            borderLeft: i === 0 ? `2px solid ${C.sienna}` : "2px solid transparent",
            background: i === 0 ? `${C.sienna}12` : "transparent",
          }}>
            <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
              color: i === 0 ? C.sienna : C.muted, fontWeight: i === 0 ? 500 : 400 }}>
              {f.name}
            </span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: C.subtle,
              fontFamily: "'JetBrains Mono', monospace" }}>{f.loc}</span>
          </div>
        ))}

        {/* Variables */}
        <div style={{ padding: "14px 14px 6px" }}>
          <SectionLabel dim>Variables</SectionLabel>
        </div>
        {[
          { k: "value",       t: "number",       v: "42",           col: C.rust  },
          { k: "next",        t: "number",       v: "43",           col: C.rust  },
          { k: "subscribers", t: "Set<Fn>",      v: "Set(3)",       col: C.ink   },
          { k: "fn",          t: "() => void",   v: "ƒ (0x1a3f8c)", col: C.amber },
        ].map((v, i) => (
          <div key={i} style={{ padding: "3px 14px 3px 12px",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5 }}>
            <span style={{ color: C.text }}>{v.k}</span>
            <span style={{ color: C.subtle }}>: </span>
            <span style={{ color: v.col }}>{v.t}</span>
            <span style={{ color: C.subtle }}> = </span>
            <span style={{ color: C.text }}>{v.v}</span>
          </div>
        ))}
      </div>
    </>
  );
}

interface GitFileChange {
  path: string;
  status: string; // "U", "M", "A", "D"
}

export function GitPanel() {
  const [changes, setChanges] = useState<GitFileChange[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFocusFocused, setIsFocusFocused] = useState(false);

  const fetchGitStatus = useCallback(async () => {
    setIsRefreshing(true);
    const files = await callBackend('git_status', { repo_path: '.' });
    if (files && Array.isArray(files)) {
      setChanges(files);
    }
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    fetchGitStatus();
  }, [fetchGitStatus]);

  const handleStageFile = async (path: string) => {
    await callBackend('git_stage', { repo_path: '.', file_path: path });
    fetchGitStatus();
  };

  const handleStageAll = async () => {
    for (const f of changes) {
      await callBackend('git_stage', { repo_path: '.', file_path: f.path });
    }
    fetchGitStatus();
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    setIsCommitting(true);
    const success = await callBackend('git_commit', {
      repo_path: '.',
      message: commitMessage,
      author_name: 'Samuel Yevi',
      author_email: 'samuel@leumas-labs.com'
    });
    setIsCommitting(false);
    if (success) {
      setCommitMessage("");
      fetchGitStatus();
    } else {
      alert("Commit failed. Make sure changes are staged first!");
    }
  };

  return (
    <>
      {/* ── Panel Header with Title and Quick Action Buttons ── */}
      <div style={{
        padding: "14px 16px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <PanelTitle sub="signal-core · workspace">Source Control</PanelTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <button
            title="Refresh Git Status"
            onClick={fetchGitStatus}
            style={{
              width: 22, height: 22, borderRadius: 4,
              background: "transparent", border: "none", color: C.muted,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = C.text)}
            onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
          >
            <Ic name="refresh" size={12} color={C.muted} className={isRefreshing ? "spin" : ""} />
          </button>
          {changes.length > 0 && (
            <button
              title="Stage All Changes"
              onClick={handleStageAll}
              style={{
                width: 22, height: 22, borderRadius: 4,
                background: "transparent", border: "none", color: C.muted,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = C.text)}
              onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
            >
              <Ic name="add" size={12} color={C.muted} />
            </button>
          )}
        </div>
      </div>

      {/* ── Commit Message Input Box & Actions ── */}
      <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{
          position: "relative",
          borderRadius: 6,
          border: `1px solid ${isFocusFocused ? `${C.sienna}80` : C.line}`,
          boxShadow: isFocusFocused ? `0 0 0 3px ${C.sienna}15` : "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
          background: C.panel,
          padding: "6px 8px",
        }}>
          <textarea
            rows={3}
            placeholder="Commit message (Ctrl+Enter to commit)…"
            value={commitMessage}
            onFocus={() => setIsFocusFocused(true)}
            onBlur={() => setIsFocusFocused(false)}
            onChange={e => setCommitMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handleCommit();
              }
            }}
            style={{
              width: "100%", background: "transparent", border: "none",
              outline: "none", color: C.text, fontSize: 12.5,
              fontFamily: "'Inter', sans-serif", resize: "none",
              caretColor: C.sienna, boxSizing: "border-box",
              lineHeight: "1.4",
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
            <span style={{ fontSize: 10, color: C.subtle, fontFamily: "'JetBrains Mono', monospace" }}>
              ⌘↵
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => handleCommit()}
          disabled={isCommitting || !commitMessage.trim()}
          style={{
            width: "100%", padding: "7px 10px", borderRadius: 5,
            background: isCommitting || !commitMessage.trim() ? `${C.line}` : C.sienna,
            color: isCommitting || !commitMessage.trim() ? C.muted : C.base,
            fontSize: 12, fontWeight: 600,
            border: "none", cursor: pointerCursor(isCommitting || !commitMessage.trim()),
            fontFamily: "'Inter', sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "all 0.15s",
            opacity: (isCommitting || !commitMessage.trim()) ? 0.7 : 1,
          }}
        >
          <Ic name="check" size={12} color={isCommitting || !commitMessage.trim() ? C.muted : C.base} />
          {isCommitting ? "Committing..." : "Commit changes"}
        </button>
      </div>

      {/* ── Changes List or Sleek Empty State ── */}
      <div className="sb" style={{ flex: 1, overflowY: "auto" }}>
        <div style={{
          padding: "0 14px 6px",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <SectionLabel dim>Modified & Untracked Files</SectionLabel>
          <span style={{
            fontSize: 11, fontWeight: 600, color: changes.length > 0 ? C.amber : C.subtle,
            fontFamily: "'JetBrains Mono', monospace",
            padding: "1px 6px", borderRadius: 10,
            background: changes.length > 0 ? `${C.amber}18` : "transparent",
            border: changes.length > 0 ? `1px solid ${C.amber}30` : "none"
          }}>
            {changes.length}
          </span>
        </div>

        {changes.length === 0 ? (
          <div style={{
            margin: "12px 12px", padding: "24px 16px",
            background: `${C.panel}60`, border: `1px dashed ${C.line}`,
            borderRadius: 8, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center"
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: `${C.sage}15`, border: `1px solid ${C.sage}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: C.sage
            }}>
              <Ic name="check" size={16} color={C.sage} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "'Inter', sans-serif" }}>
                No changes detected
              </div>
              <div style={{ fontSize: 11, color: C.subtle, marginTop: 2, fontFamily: "'Inter', sans-serif" }}>
                Working tree is clean. All modifications are committed.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "0 6px" }}>
            {changes.map((f, i) => {
              const filename = f.path.split('/').pop() || f.path;
              const dir = f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf('/')) : '';
              
              let badgeColor = C.amber;
              let badgeBg = `${C.amber}18`;
              let badgeBorder = `${C.amber}35`;

              if (f.status === "U") {
                badgeColor = C.sage;
                badgeBg = `${C.sage}18`;
                badgeBorder = `${C.sage}35`;
              } else if (f.status === "A") {
                badgeColor = C.ink;
                badgeBg = `${C.ink}18`;
                badgeBorder = `${C.ink}35`;
              } else if (f.status === "D") {
                badgeColor = C.rose;
                badgeBg = `${C.rose}18`;
                badgeBorder = `${C.rose}35`;
              }

              return (
                <div
                  key={i}
                  className="group"
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 8px", borderRadius: 5,
                    cursor: "pointer", transition: "background 0.12s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${C.text}08`)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Status Badge */}
                  <span style={{
                    width: 16, height: 16, borderRadius: 4,
                    background: badgeBg, border: `1px solid ${badgeBorder}`,
                    color: badgeColor,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                    flexShrink: 0,
                  }}>{f.status}</span>

                  {/* File Label & Path */}
                  <div style={{ flex: 1, overflow: "hidden", display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{
                      fontSize: 12.5, color: C.text, fontWeight: 500,
                      fontFamily: "'JetBrains Mono', monospace",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                    }}>
                      {filename}
                    </span>
                    {dir && (
                      <span style={{
                        fontSize: 10.5, color: C.subtle,
                        fontFamily: "'JetBrains Mono', monospace",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                      }}>
                        {dir}
                      </span>
                    )}
                  </div>

                  {/* Quick Stage Action Button */}
                  <button
                    title="Stage File"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStageFile(f.path);
                    }}
                    style={{
                      padding: "2px 6px", borderRadius: 4,
                      background: "transparent", border: `1px solid ${C.line}`,
                      color: C.muted, fontSize: 10, fontWeight: 600,
                      cursor: "pointer", fontFamily: "'Inter', sans-serif",
                      display: "flex", alignItems: "center", gap: 3,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = `${C.sienna}18`;
                      e.currentTarget.style.borderColor = `${C.sienna}50`;
                      e.currentTarget.style.color = C.sienna;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.borderColor = C.line;
                      e.currentTarget.style.color = C.muted;
                    }}
                  >
                    <Ic name="add" size={10} />
                    Stage
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function pointerCursor(disabled: boolean) {
  return disabled ? "default" : "pointer";
}

export function WikiPanel() {
  const docs = [
    { title: "Architecture overview", read: true,  time: "2d" },
    { title: "Signals: mental model", read: true,  time: "5d" },
    { title: "Effect scheduling",      read: false, time: "1w" },
    { title: "Batching & priorities",  read: false, time: "1w" },
    { title: "Public API contract",    read: false, time: "2w" },
  ];
  const notes = [
    { title: "Why we ditched proxies",       author: "M", when: "yesterday" },
    { title: "Meeting: reactivity roadmap",  author: "A", when: "Fri" },
    { title: "Perf: 10× improvement plan",   author: "you", when: "Mon" },
  ];
  return (
    <>
      <div style={{ padding: "14px 16px 10px" }}>
        <PanelTitle sub="Project knowledge & notes">Wiki</PanelTitle>
      </div>

      <div style={{ padding: "0 12px 10px" }}>
        <button style={{
          width: "100%", padding: "5px 8px", borderRadius: 5,
          background: "transparent", border: `1px dashed ${C.line}`,
          color: C.muted, fontSize: 12,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          cursor: "pointer", fontFamily: "'Inter', sans-serif",
        }}>
          <Ic name="add" size={11} color={C.muted} />
          New page
        </button>
      </div>

      <div className="sb" style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "0 14px 6px" }}>
          <SectionLabel dim>Documentation</SectionLabel>
        </div>
        {docs.map((d, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "5px 14px 5px 12px", cursor: "pointer", borderLeft: "2px solid transparent",
          }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = `${C.text}05`;
              (e.currentTarget as HTMLElement).style.borderLeftColor = `${C.sienna}80`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.borderLeftColor = "transparent";
            }}>
            <Ic name={d.read ? "book" : "circle-large-outline"} size={12}
              color={d.read ? C.muted : C.sienna} />
            <span style={{ flex: 1, fontSize: 12.5,
              color: d.read ? C.muted : C.text,
              fontFamily: "'Inter', sans-serif" }}>{d.title}</span>
            <span style={{ fontSize: 11, color: C.subtle,
              fontFamily: "'JetBrains Mono', monospace" }}>{d.time}</span>
          </div>
        ))}

        <div style={{ padding: "14px 14px 6px" }}>
          <SectionLabel dim>Team notes</SectionLabel>
        </div>
        {notes.map((nt, i) => (
          <div key={i} style={{ padding: "6px 14px 6px 12px", cursor: "pointer" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${C.text}05`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <div style={{ fontSize: 12.5, color: C.text,
              fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>{nt.title}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span style={{
                width: 13, height: 13, borderRadius: "50%",
                background: nt.author === "M" ? `${C.ink}25` : nt.author === "A" ? `${C.sage}25` : `${C.sienna}25`,
                color: nt.author === "M" ? C.ink : nt.author === "A" ? C.sage : C.sienna,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 9.5, fontWeight: 600, fontFamily: "'Inter', sans-serif",
              }}>{nt.author === "you" ? "Y" : nt.author}</span>
              <span style={{ fontSize: 11, color: C.subtle,
                fontFamily: "'Inter', sans-serif" }}>
                {nt.author} · {nt.when}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  path: string;
}

export function ExtensionsPanel() {
  const [exts, setExts] = useState<ExtensionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [vsixPath, setVsixPath] = useState("");
  const [installing, setInstalling] = useState(false);

  const fetchExtensions = useCallback(async () => {
    setLoading(true);
    const list = await callBackend('extension_list');
    if (list && Array.isArray(list)) {
      setExts(list);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchExtensions();
  }, [fetchExtensions]);

  const handleInstall = async () => {
    if (!vsixPath.trim()) return;
    setInstalling(true);
    const success = await callBackend('extension_install', { vsix_path: vsixPath });
    setInstalling(false);
    if (success) {
      setVsixPath("");
      fetchExtensions();
    } else {
      alert("Extension installation failed. Check the file path!");
    }
  };

  return (
    <>
      <div style={{ padding: "14px 16px 10px" }}>
        <PanelTitle sub="Local Extension Registry">Extensions</PanelTitle>
      </div>

      <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 5,
        }}>
          <input 
            placeholder="VSIX absolute path…"
            value={vsixPath}
            onChange={e => setVsixPath(e.target.value)}
            style={{
              flex: 1, background: "transparent", outline: "none", border: "none",
              color: C.text, fontSize: 12, fontFamily: "'Inter', sans-serif",
            }} 
          />
        </div>
        <button
          onClick={handleInstall}
          disabled={installing || !vsixPath.trim()}
          style={{
            width: "100%", padding: "6px", borderRadius: 5,
            background: C.sienna, color: C.base, fontSize: 12, fontWeight: 600,
            border: "none", cursor: (installing || !vsixPath.trim()) ? "default" : "pointer",
            fontFamily: "'Inter', sans-serif",
            opacity: (installing || !vsixPath.trim()) ? 0.6 : 1,
          }}
        >
          {installing ? "Installing..." : "Install from VSIX"}
        </button>
      </div>

      <div className="sb" style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "0 14px 6px" }}>
          <SectionLabel dim>Installed ({exts.length})</SectionLabel>
        </div>
        {loading ? (
          <div style={{ padding: "16px", textAlign: "center", color: C.subtle, fontSize: 12 }}>
            Scanning extensions...
          </div>
        ) : exts.length === 0 ? (
          <div style={{ padding: "16px", textAlign: "center", color: C.subtle, fontSize: 12 }}>
            No extensions installed
          </div>
        ) : (
          exts.map((ext) => (
            <div key={ext.id} style={{
              padding: "8px 14px", borderBottom: `1px solid ${C.line}`,
              display: "flex", flexDirection: "column", gap: 2
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{ext.name}</div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                ID: {ext.id} · v{ext.version}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
