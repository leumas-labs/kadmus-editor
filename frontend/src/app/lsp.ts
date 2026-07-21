import { callBackend, onNotification } from "./rpc";
import * as monaco from "monaco-editor";

// Keep track of initialized servers
const initializedServers = new Set<string>();
const documentVersions = new Map<string, number>();
const notificationListeners = new Map<string, Set<(msg: any) => void>>();

// Helper to convert filesystem absolute paths to file:// URIs
function pathToUri(path: string): string {
  if (path.startsWith("file://")) return path;
  const formatted = path.startsWith("/") ? path : "/" + path;
  return `file://${formatted}`;
}

function uriToPath(uri: string): string {
  if (uri.startsWith("file://")) {
    return uri.substring(7);
  }
  return uri;
}

export async function ensureLspInitialized(language: string): Promise<void> {
  if (initializedServers.has(language)) return;

  // 1. Tell backend to spin up the LSP server
  const success = await callBackend("lsp_initialize", { language });
  if (!success) {
    console.warn(`[LSP] Failed to initialize backend server for ${language}`);
    return;
  }

  // 2. Perform LSP initialize handshake
  const initId = Math.floor(Math.random() * 1000000);
  
  // Register a temporary listener to await the initialize response
  const responsePromise = new Promise<void>((resolve) => {
    const unsub = onNotification("lsp_notification", (params: any) => {
      if (params.language === language && params.message?.id === initId) {
        unsub();
        resolve();
      }
    });
    // Timeout fallback after 3 seconds
    setTimeout(() => {
      unsub();
      resolve();
    }, 3000);
  });

  // Send initialize request
  await callBackend("lsp_send", {
    language,
    message: {
      jsonrpc: "2.0",
      id: initId,
      method: "initialize",
      params: {
        processId: null,
        rootUri: "file:///",
        capabilities: {
          textDocument: {
            publishDiagnostics: {
              relatedInformation: true
            }
          }
        }
      }
    }
  });

  // Wait for response
  await responsePromise;

  // Send initialized notification
  await callBackend("lsp_send", {
    language,
    message: {
      jsonrpc: "2.0",
      method: "initialized",
      params: {}
    }
  });

  initializedServers.add(language);
  console.log(`[LSP] Server for ${language} fully initialized and handshake completed.`);
}

// Global listener for LSP notifications
onNotification("lsp_notification", (params: any) => {
  const { language, message } = params;
  if (!language || !message) return;

  // Handle diagnostics directly
  if (message.method === "textDocument/publishDiagnostics") {
    const uri = message.params?.uri;
    const diagnostics = message.params?.diagnostics || [];
    if (uri) {
      const path = uriToPath(uri);
      const model = monaco.editor.getModels().find(m => m.uri.path === path || m.uri.toString() === uri);
      if (model) {
        const markers = diagnostics.map((d: any) => {
          let severity = monaco.MarkerSeverity.Error;
          if (d.severity === 2) severity = monaco.MarkerSeverity.Warning;
          else if (d.severity === 3) severity = monaco.MarkerSeverity.Info;
          else if (d.severity === 4) severity = monaco.MarkerSeverity.Hint;

          return {
            startLineNumber: d.range.start.line + 1,
            startColumn: d.range.start.character + 1,
            endLineNumber: d.range.end.line + 1,
            endColumn: d.range.end.character + 1,
            message: `${d.code ? `[${d.code}] ` : ""}${d.message}`,
            severity: severity,
            source: d.source || "Ruff",
          };
        });
        monaco.editor.setModelMarkers(model, "lsp-linter", markers);
      }
    }
  }

  // Forward to custom listeners if any
  const listeners = notificationListeners.get(language);
  if (listeners) {
    listeners.forEach(cb => cb(message));
  }
});

export async function lspDocOpen(language: string, path: string, content: string) {
  await ensureLspInitialized(language);
  const uri = pathToUri(path);
  documentVersions.set(uri, 1);

  await callBackend("lsp_send", {
    language,
    message: {
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri,
          languageId: language,
          version: 1,
          text: content
        }
      }
    }
  });
}

export async function lspDocChange(language: string, path: string, content: string) {
  const uri = pathToUri(path);
  const nextVer = (documentVersions.get(uri) || 1) + 1;
  documentVersions.set(uri, nextVer);

  await callBackend("lsp_send", {
    language,
    message: {
      jsonrpc: "2.0",
      method: "textDocument/didChange",
      params: {
        textDocument: {
          uri,
          version: nextVer
        },
        contentChanges: [
          {
            text: content
          }
        ]
      }
    }
  });
}

export async function lspDocClose(language: string, path: string) {
  const uri = pathToUri(path);
  documentVersions.delete(uri);

  await callBackend("lsp_send", {
    language,
    message: {
      jsonrpc: "2.0",
      method: "textDocument/didClose",
      params: {
        textDocument: {
          uri
        }
      }
    }
  });
}
