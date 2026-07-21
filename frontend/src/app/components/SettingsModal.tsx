import { useState, useEffect } from "react";
import { C } from "../../styles/theme";
import { Ic } from "./common";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: any;
  onSettingsUpdate: (newSettings: any) => void;
}

export function SettingsModal({ isOpen, onClose, settings, onSettingsUpdate }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"appearance" | "editor" | "linter" | "terminal" | "json">("appearance");
  const [localSettings, setLocalSettings] = useState<any>(null);
  const [jsonText, setJsonText] = useState("");

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
      setJsonText(JSON.stringify(settings, null, 2));
    }
  }, [settings, isOpen]);

  if (!isOpen || !localSettings) return null;

  const updateField = (section: string, field: string, value: any) => {
    const updated = {
      ...localSettings,
      [section]: {
        ...(localSettings[section] || {}),
        [field]: value
      }
    };
    setLocalSettings(updated);
    setJsonText(JSON.stringify(updated, null, 2));
    onSettingsUpdate(updated);
  };

  const handleJsonSave = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setLocalSettings(parsed);
      onSettingsUpdate(parsed);
    } catch (e) {
      alert("Invalid JSON format");
    }
  };

  const tabs = [
    { id: "appearance", label: "Appearance", icon: "symbol-color" },
    { id: "editor", label: "Editor", icon: "editor-layout" },
    { id: "linter", label: "Python Linter", icon: "beaker" },
    { id: "terminal", label: "Terminal", icon: "terminal" },
    { id: "json", label: "Raw JSON", icon: "json" },
  ] as const;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 10000,
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        width: 680, height: 460, background: C.surface,
        border: `1px solid ${C.line}`, borderRadius: 8,
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
      }}>
        {/* Header */}
        <div style={{
          height: 45, padding: "0 16px", display: "flex",
          alignItems: "center", justifyContent: "space-between",
          borderBottom: `1px solid ${C.line}`, background: C.base
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: "'Inter', sans-serif" }}>
            Preferences & Settings
          </span>
          <button 
            onClick={onClose}
            style={{
              background: "transparent", border: "none", color: C.muted,
              cursor: "pointer", display: "flex", alignItems: "center"
            }}
          >
            <Ic name="close" size={14} />
          </button>
        </div>

        {/* Inner Content */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* Left Navigation */}
          <div style={{
            width: 180, borderRight: `1px solid ${C.line}`,
            background: C.base, padding: "8px 0",
            display: "flex", flexDirection: "column", gap: 2
          }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 16px", border: "none", textAlign: "left",
                  fontSize: 13, cursor: "pointer",
                  background: activeTab === tab.id ? `${C.sienna}15` : "transparent",
                  color: activeTab === tab.id ? C.sienna : C.muted,
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                <Ic name={tab.icon} size={13} color={activeTab === tab.id ? C.sienna : C.muted} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Right Pane */}
          <div style={{ flex: 1, padding: 20, overflowY: "auto", background: C.panel }}>
            
            {activeTab === "appearance" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: 13, color: C.text }}>Color Theme</h4>
                  <select 
                    value={localSettings.theme?.name || "azure"}
                    onChange={e => updateField("theme", "name", e.target.value)}
                    style={{
                      width: "100%", padding: "6px 10px", borderRadius: 4,
                      background: C.base, border: `1px solid ${C.line}`,
                      color: C.text, outline: "none", fontSize: 13
                    }}
                  >
                    <option value="azure">Azure (Default)</option>
                    <option value="espresso">Espresso (Warm)</option>
                    <option value="cobalt">Cobalt (Vibrant)</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h4 style={{ margin: "0 0 2px 0", fontSize: 13, color: C.text }}>Window Transparency</h4>
                    <span style={{ fontSize: 11, color: C.muted }}>Enable glassmorphism window backing</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={localSettings.theme?.transparency ?? true}
                    onChange={e => updateField("theme", "transparency", e.target.checked)}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                </div>
              </div>
            )}

            {activeTab === "editor" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 6px 0", fontSize: 13, color: C.text }}>Font Size</h4>
                    <input 
                      type="number"
                      value={localSettings.editor?.fontSize || 14}
                      onChange={e => updateField("editor", "fontSize", parseInt(e.target.value) || 12)}
                      style={{
                        width: "100%", padding: "6px 10px", borderRadius: 4,
                        background: C.base, border: `1px solid ${C.line}`,
                        color: C.text, outline: "none", fontSize: 13, boxSizing: "border-box"
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 6px 0", fontSize: 13, color: C.text }}>Tab Size</h4>
                    <input 
                      type="number"
                      value={localSettings.editor?.tabSize || 4}
                      onChange={e => updateField("editor", "tabSize", parseInt(e.target.value) || 4)}
                      style={{
                        width: "100%", padding: "6px 10px", borderRadius: 4,
                        background: C.base, border: `1px solid ${C.line}`,
                        color: C.text, outline: "none", fontSize: 13, boxSizing: "border-box"
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h4 style={{ margin: "0 0 2px 0", fontSize: 13, color: C.text }}>Insert Spaces</h4>
                    <span style={{ fontSize: 11, color: C.muted }}>Convert tab characters to spaces</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={localSettings.editor?.insertSpaces ?? true}
                    onChange={e => updateField("editor", "insertSpaces", e.target.checked)}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h4 style={{ margin: "0 0 2px 0", fontSize: 13, color: C.text }}>Minimap</h4>
                    <span style={{ fontSize: 11, color: C.muted }}>Render vertical minimap on right side</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={localSettings.editor?.minimap?.visible ?? true}
                    onChange={e => {
                      const updated = {
                        ...localSettings,
                        editor: {
                          ...(localSettings.editor || {}),
                          minimap: {
                            visible: e.target.checked
                          }
                        }
                      };
                      setLocalSettings(updated);
                      setJsonText(JSON.stringify(updated, null, 2));
                      onSettingsUpdate(updated);
                    }}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                </div>
              </div>
            )}

            {activeTab === "linter" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h4 style={{ margin: "0 0 2px 0", fontSize: 13, color: C.text }}>Python Linting</h4>
                    <span style={{ fontSize: 11, color: C.muted }}>Enable static analysis for Python files</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={localSettings.linter?.python?.enabled ?? true}
                    onChange={e => {
                      const updated = {
                        ...localSettings,
                        linter: {
                          ...(localSettings.linter || {}),
                          python: {
                            ...(localSettings.linter?.python || {}),
                            enabled: e.target.checked
                          }
                        }
                      };
                      setLocalSettings(updated);
                      setJsonText(JSON.stringify(updated, null, 2));
                      onSettingsUpdate(updated);
                    }}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                </div>

                <div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: 13, color: C.text }}>Linter Provider</h4>
                  <select 
                    value={localSettings.linter?.python?.provider || "ruff"}
                    onChange={e => {
                      const updated = {
                        ...localSettings,
                        linter: {
                          ...(localSettings.linter || {}),
                          python: {
                            ...(localSettings.linter?.python || {}),
                            provider: e.target.value
                          }
                        }
                      };
                      setLocalSettings(updated);
                      setJsonText(JSON.stringify(updated, null, 2));
                      onSettingsUpdate(updated);
                    }}
                    style={{
                      width: "100%", padding: "6px 10px", borderRadius: 4,
                      background: C.base, border: `1px solid ${C.line}`,
                      color: C.text, outline: "none", fontSize: 13
                    }}
                  >
                    <option value="ruff">Ruff (Fast Rust-based Linter)</option>
                    <option value="none">None</option>
                  </select>
                </div>

                <div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: 13, color: C.text }}>Ruff Binary Path</h4>
                  <input 
                    type="text"
                    placeholder="e.g. /usr/bin/ruff or pip global path"
                    value={localSettings.linter?.python?.path || ""}
                    onChange={e => {
                      const updated = {
                        ...localSettings,
                        linter: {
                          ...(localSettings.linter || {}),
                          python: {
                            ...(localSettings.linter?.python || {}),
                            path: e.target.value
                          }
                        }
                      };
                      setLocalSettings(updated);
                      setJsonText(JSON.stringify(updated, null, 2));
                      onSettingsUpdate(updated);
                    }}
                    style={{
                      width: "100%", padding: "6px 10px", borderRadius: 4,
                      background: C.base, border: `1px solid ${C.line}`,
                      color: C.text, outline: "none", fontSize: 13, boxSizing: "border-box"
                    }}
                  />
                  <span style={{ fontSize: 11, color: C.muted, marginTop: 4, display: "block" }}>
                    Leave blank to use the global 'ruff' binary in system PATH.
                  </span>
                </div>
              </div>
            )}

            {activeTab === "terminal" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: 13, color: C.text }}>Shell Path</h4>
                  <input 
                    type="text"
                    value={localSettings.terminal?.shell || "/bin/bash"}
                    onChange={e => updateField("terminal", "shell", e.target.value)}
                    style={{
                      width: "100%", padding: "6px 10px", borderRadius: 4,
                      background: C.base, border: `1px solid ${C.line}`,
                      color: C.text, outline: "none", fontSize: 13, boxSizing: "border-box"
                    }}
                  />
                </div>

                <div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: 13, color: C.text }}>Font Size (px)</h4>
                  <input 
                    type="number"
                    value={localSettings.terminal?.fontSize || 12}
                    onChange={e => updateField("terminal", "fontSize", parseInt(e.target.value) || 12)}
                    style={{
                      width: "100%", padding: "6px 10px", borderRadius: 4,
                      background: C.base, border: `1px solid ${C.line}`,
                      color: C.text, outline: "none", fontSize: 13, boxSizing: "border-box"
                    }}
                  />
                </div>
              </div>
            )}

            {activeTab === "json" && (
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <textarea
                    value={jsonText}
                    onChange={e => setJsonText(e.target.value)}
                    style={{
                      flex: 1, width: "100%", height: 260, fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12, background: C.base, color: C.text,
                      border: `1px solid ${C.line}`, borderRadius: 4, padding: 10,
                      outline: "none", resize: "none"
                    }}
                  />
                </div>
                <button
                  onClick={handleJsonSave}
                  style={{
                    marginTop: 10, alignSelf: "flex-end", padding: "6px 14px",
                    background: C.sienna, color: C.base, border: "none",
                    borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 600,
                    fontFamily: "'Inter', sans-serif"
                  }}
                >
                  Save JSON
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
