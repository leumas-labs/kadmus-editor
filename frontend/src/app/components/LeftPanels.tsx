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
                fontSize: node.is_directory ? 17 : 16.5,
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
      <div style={{ padding: "18px 16px 12px" }}>
        <PanelTitle sub="signal-core · main">Repository</PanelTitle>
      </div>
      <div style={{ padding: "0 12px 8px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6,
        }}>
          <Ic name="search" size={11} color={C.subtle} />
          <input placeholder="Filter files…"
            style={{
              flex: 1, background: "transparent", outline: "none", border: "none",
              color: C.text, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
            }} />
        </div>
      </div>
      <div className="sb" style={{ flex: 1, overflowY: "auto", paddingTop: 2 }}>
        <RealFileTree activePath={activePath} onSelect={onSelect} />
      </div>
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.line}`, background: C.panel }}>
        <SectionLabel dim>This session</SectionLabel>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { label: "Files loaded dynamically",     color: C.ink   },
            { label: "Git connected natively",      color: C.rust  },
            { label: "PTY shell synchronized", color: C.sage  },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
      <div style={{ padding: "18px 16px 12px" }}>
        <PanelTitle sub="Across signal-core">Search</PanelTitle>
      </div>
      <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
          background: C.panel, border: `1px solid ${C.sienna}40`, borderRadius: 6,
          boxShadow: `0 0 0 3px ${C.sienna}10`,
        }}>
          <Ic name="search" size={12} color={C.sienna} />
          <input defaultValue="add" placeholder="Search text…"
            style={{
              flex: 1, background: "transparent", outline: "none", border: "none",
              color: C.text, fontSize: 17, fontFamily: "'JetBrains Mono', monospace",
              caretColor: C.sienna,
            }} />
          <span style={{ fontSize: 15, color: C.subtle,
            fontFamily: "'JetBrains Mono', monospace" }}>3 hits</span>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
          background: "transparent", border: `1px solid ${C.line}`, borderRadius: 6,
        }}>
          <Ic name="replace" size={11} color={C.subtle} />
          <input placeholder="Replace with…"
            style={{
              flex: 1, background: "transparent", outline: "none", border: "none",
              color: C.text, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
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
                fontSize: 15, fontFamily: "'JetBrains Mono', monospace",
                padding: "2px 8px", borderRadius: 4,
                background: C.panel, border: `1px solid ${C.line}`,
                color: C.muted, cursor: "pointer",
              }}>{f.l}</button>
          ))}
        </div>
      </div>

      <div className="sb" style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "0 16px 8px" }}>
          <SectionLabel dim>Matches</SectionLabel>
        </div>
        {results.map((r, i) => (
          <div key={i} style={{ padding: "6px 16px 6px 12px", cursor: "pointer" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${C.text}05`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.ink }} />
              <span style={{ fontSize: 11, color: C.text,
                fontFamily: "'JetBrains Mono', monospace" }}>{r.file}</span>
              <span style={{ fontSize: 15, color: C.subtle,
                fontFamily: "'JetBrains Mono', monospace" }}>:{r.line}</span>
            </div>
            <div style={{
              fontSize: 11, color: C.muted, fontFamily: "'JetBrains Mono', monospace",
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
      <div style={{ padding: "18px 16px 12px" }}>
        <PanelTitle sub="No active session">Debug</PanelTitle>
      </div>
      <div style={{ padding: "0 12px 12px" }}>
        <button style={{
          width: "100%", padding: "8px", borderRadius: 6,
          background: `${C.sage}18`, border: `1px solid ${C.sage}40`,
          color: C.sage, fontSize: 17, fontWeight: 500,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          cursor: "pointer", fontFamily: "'Inter', sans-serif",
        }}>
          <Ic name="debug-start" size={12} color={C.sage} />
          Start · vitest test/signal.test.ts
        </button>
      </div>

      <div className="sb" style={{ flex: 1, overflowY: "auto" }}>
        {/* Breakpoints */}
        <div style={{ padding: "0 16px 8px" }}>
          <SectionLabel dim>Breakpoints</SectionLabel>
        </div>
        {[
          { file: "signal.ts",       line: 11, enabled: true  },
          { file: "signal.ts",       line: 19, enabled: true  },
          { file: "signal.test.ts",  line: 24, enabled: false },
        ].map((bp, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "4px 16px 4px 12px",
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: "50%",
              background: bp.enabled ? C.rose : "transparent",
              border: `1.5px solid ${bp.enabled ? C.rose : C.faint}`,
            }} />
            <span style={{ flex: 1, fontSize: 11, color: bp.enabled ? C.text : C.subtle,
              fontFamily: "'JetBrains Mono', monospace" }}>
              {bp.file}<span style={{ color: C.subtle }}>:{bp.line}</span>
            </span>
          </div>
        ))}

        {/* Call stack */}
        <div style={{ padding: "16px 16px 8px" }}>
          <SectionLabel dim>Call stack</SectionLabel>
        </div>
        {[
          { name: "signal.set",   loc: "signal.ts:11" },
          { name: "effect.track", loc: "effect.ts:22" },
          { name: "<anonymous>",  loc: "signal.test.ts:17" },
        ].map((f, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "4px 16px 4px 12px",
            borderLeft: i === 0 ? `2px solid ${C.sienna}` : "2px solid transparent",
            background: i === 0 ? `${C.sienna}12` : "transparent",
          }}>
            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
              color: i === 0 ? C.sienna : C.muted, fontWeight: i === 0 ? 500 : 400 }}>
              {f.name}
            </span>
            <span style={{ marginLeft: "auto", fontSize: 15, color: C.subtle,
              fontFamily: "'JetBrains Mono', monospace" }}>{f.loc}</span>
          </div>
        ))}

        {/* Variables */}
        <div style={{ padding: "16px 16px 8px" }}>
          <SectionLabel dim>Variables</SectionLabel>
        </div>
        {[
          { k: "value",       t: "number",       v: "42",           col: C.rust  },
          { k: "next",        t: "number",       v: "43",           col: C.rust  },
          { k: "subscribers", t: "Set<Fn>",      v: "Set(3)",       col: C.ink   },
          { k: "fn",          t: "() => void",   v: "ƒ (0x1a3f8c)", col: C.amber },
        ].map((v, i) => (
          <div key={i} style={{ padding: "3px 16px 3px 12px",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
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

  const fetchGitStatus = useCallback(async () => {
    const files = await callBackend('git_status', { repo_path: '.' });
    if (files && Array.isArray(files)) {
      setChanges(files);
    }
  }, []);

  useEffect(() => {
    fetchGitStatus();
  }, [fetchGitStatus]);

  const handleStageFile = async (path: string) => {
    await callBackend('git_stage', { repo_path: '.', file_path: path });
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
      <div style={{ padding: "18px 16px 12px" }}>
        <PanelTitle sub="signal-core · workspace">Source Control</PanelTitle>
      </div>

      <div style={{ padding: "0 12px 12px" }}>
        <textarea
          rows={3}
          placeholder="Commit message…"
          value={commitMessage}
          onChange={e => setCommitMessage(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && e.ctrlKey) {
              handleCommit();
            }
          }}
          style={{
            width: "100%", background: C.panel, border: `1px solid ${C.line}`,
            borderRadius: 6, padding: "8px 10px", outline: "none",
            color: C.text, fontSize: 17, fontFamily: "'Inter', sans-serif",
            resize: "none", caretColor: C.sienna,
          }}
        />
        <button
          onClick={handleCommit}
          disabled={isCommitting || !commitMessage.trim()}
          style={{
            width: "100%", marginTop: 6, padding: "6px", borderRadius: 5,
            background: C.sienna, color: C.base, fontSize: 17, fontWeight: 500,
            border: "none", cursor: pointerCursor(isCommitting || !commitMessage.trim()),
            fontFamily: "'Inter', sans-serif",
            opacity: (isCommitting || !commitMessage.trim()) ? 0.6 : 1,
          }}
        >
          {isCommitting ? "Committing..." : "Commit changes"}
        </button>
      </div>

      <div className="sb" style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "0 16px 8px",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <SectionLabel dim>Modified & Untracked Files</SectionLabel>
          <span style={{ fontSize: 15, color: C.amber,
            fontFamily: "'JetBrains Mono', monospace" }}>{changes.length}</span>
        </div>
        {changes.length === 0 ? (
          <div style={{ padding: "16px", textAlign: "center", color: C.subtle, fontSize: 12 }}>
            No changes detected
          </div>
        ) : (
          changes.map((f, i) => (
            <div
              key={i}
              onClick={() => handleStageFile(f.path)}
              title="Click to stage file"
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "5px 16px 5px 12px", cursor: "pointer",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `${C.text}05`}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              <span style={{
                width: 14, height: 14, borderRadius: 3,
                background: f.status === "U" ? `${C.sage}20` : f.status === "A" ? `${C.ink}20` : `${C.amber}20`,
                color: f.status === "U" ? C.sage : f.status === "A" ? C.ink : C.amber,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
              }}>{f.status}</span>
              <span style={{ flex: 1, fontSize: 16, color: C.text,
                fontFamily: "'JetBrains Mono', monospace",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.path}
              </span>
              <span style={{ fontSize: 12, color: C.subtle }}>Stage</span>
            </div>
          ))
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
      <div style={{ padding: "18px 16px 12px" }}>
        <PanelTitle sub="Project knowledge & notes">Wiki</PanelTitle>
      </div>

      <div style={{ padding: "0 12px 12px" }}>
        <button style={{
          width: "100%", padding: "6px 10px", borderRadius: 6,
          background: "transparent", border: `1px dashed ${C.line}`,
          color: C.muted, fontSize: 11,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          cursor: "pointer", fontFamily: "'Inter', sans-serif",
        }}>
          <Ic name="add" size={11} color={C.muted} />
          New page
        </button>
      </div>

      <div className="sb" style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "0 16px 8px" }}>
          <SectionLabel dim>Documentation</SectionLabel>
        </div>
        {docs.map((d, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "6px 16px 6px 14px", cursor: "pointer", borderLeft: "2px solid transparent",
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
            <span style={{ flex: 1, fontSize: 17,
              color: d.read ? C.muted : C.text,
              fontFamily: "'Inter', sans-serif" }}>{d.title}</span>
            <span style={{ fontSize: 15, color: C.subtle,
              fontFamily: "'JetBrains Mono', monospace" }}>{d.time}</span>
          </div>
        ))}

        <div style={{ padding: "16px 16px 8px" }}>
          <SectionLabel dim>Team notes</SectionLabel>
        </div>
        {notes.map((nt, i) => (
          <div key={i} style={{ padding: "8px 16px 8px 14px", cursor: "pointer" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${C.text}05`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <div style={{ fontSize: 17, color: C.text,
              fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>{nt.title}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
              <span style={{
                width: 14, height: 14, borderRadius: "50%",
                background: nt.author === "M" ? `${C.ink}25` : nt.author === "A" ? `${C.sage}25` : `${C.sienna}25`,
                color: nt.author === "M" ? C.ink : nt.author === "A" ? C.sage : C.sienna,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 600, fontFamily: "'Inter', sans-serif",
              }}>{nt.author === "you" ? "Y" : nt.author}</span>
              <span style={{ fontSize: 15, color: C.subtle,
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
      <div style={{ padding: "18px 16px 12px" }}>
        <PanelTitle sub="Local Extension Registry">Extensions</PanelTitle>
      </div>

      <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6,
        }}>
          <input 
            placeholder="VSIX absolute path…"
            value={vsixPath}
            onChange={e => setVsixPath(e.target.value)}
            style={{
              flex: 1, background: "transparent", outline: "none", border: "none",
              color: C.text, fontSize: 11, fontFamily: "'Inter', sans-serif",
            }} 
          />
        </div>
        <button
          onClick={handleInstall}
          disabled={installing || !vsixPath.trim()}
          style={{
            width: "100%", padding: "6px", borderRadius: 5,
            background: C.sienna, color: C.base, fontSize: 13, fontWeight: 500,
            border: "none", cursor: (installing || !vsixPath.trim()) ? "default" : "pointer",
            fontFamily: "'Inter', sans-serif",
            opacity: (installing || !vsixPath.trim()) ? 0.6 : 1,
          }}
        >
          {installing ? "Installing..." : "Install from VSIX"}
        </button>
      </div>

      <div className="sb" style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "0 16px 8px" }}>
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
              padding: "10px 16px", borderBottom: `1px solid ${C.line}`,
              display: "flex", flexDirection: "column", gap: 3
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{ext.name}</div>
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
