import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import { callBackend } from "../rpc";
import { C } from "../../styles/theme";
import { lspDocOpen, lspDocChange, lspDocClose } from "../lsp";

interface MonacoEditorProps {
  activePath: string;
  themeTrigger: number;
  onContentChange?: (content: string) => void;
  settings?: any;
}

export function MonacoEditor({ activePath, themeTrigger, onContentChange, settings }: MonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelsRef = useRef<Map<string, monaco.editor.ITextModel>>(new Map());

  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  // Initialize Editor
  useEffect(() => {
    if (!containerRef.current) return;

    // Define initial theme
    monaco.editor.defineTheme('kadmus-theme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: C.sienna.substring(1) },
        { token: 'type', foreground: C.ink.substring(1) },
        { token: 'function', foreground: C.amber.substring(1) },
        { token: 'string', foreground: C.sage.substring(1) },
        { token: 'comment', foreground: C.muted.substring(1) },
      ],
      colors: {
        'editor.background': C.base,
        'editor.foreground': C.text,
        'editorLineNumber.foreground': C.subtle,
        'editorLineNumber.activeForeground': C.sienna,
        'editor.lineHighlightBackground': `${C.line}40`,
        'editor.selectionBackground': `${C.sky}30`,
        'minimap.background': C.base,
      }
    });

    const editor = monaco.editor.create(containerRef.current, {
      value: '// Bienvenue dans Kadmus Editor\n// Choisis un fichier dans le dossier de travail à gauche pour commencer.',
      language: 'plaintext',
      theme: 'kadmus-theme',
      automaticLayout: true,
      fontSize: 14,
      fontFamily: 'Fira Code, Monaco, monospace',
      minimap: { enabled: true },
      scrollbar: {
        vertical: 'visible',
        horizontal: 'visible',
        useShadows: false,
        verticalScrollbarSize: 6,
        horizontalScrollbarSize: 6
      }
    });

    editorRef.current = editor;

    // Direct save on content edits
    const changeSubscription = editor.onDidChangeModelContent(() => {
      const model = editor.getModel();
      if (!model) return;

      // Find path matching this model
      let activeModelPath: string | null = null;
      for (const [path, m] of modelsRef.current.entries()) {
        if (m === model) {
          activeModelPath = path;
          break;
        }
      }

      if (activeModelPath) {
        const content = model.getValue();
        callBackend('fs_write', { path: activeModelPath, content });
        if (onContentChangeRef.current) {
          onContentChangeRef.current(content);
        }

        // Keep LSP server in sync
        const filename = activeModelPath.split('/').pop() || '';
        const lang = getLanguageByExtension(filename);
        if (lang === 'python') {
          lspDocChange('python', activeModelPath, content);
        }
      }
    });

    return () => {
      changeSubscription.dispose();
      editor.dispose();
      // Dispose models and close them in LSP
      modelsRef.current.forEach((model, path) => {
        const filename = path.split('/').pop() || '';
        const lang = getLanguageByExtension(filename);
        if (lang === 'python') {
          lspDocClose('python', path);
        }
        model.dispose();
      });
      modelsRef.current.clear();
    };
  }, []);

  // Handle activePath change
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activePath) return;

    const models = modelsRef.current;

    async function loadFile() {
      const currentEditor = editorRef.current;
      if (!currentEditor) return;

      if (models.has(activePath)) {
        const model = models.get(activePath)!;
        currentEditor.setModel(model);
        if (onContentChangeRef.current) {
          onContentChangeRef.current(model.getValue());
        }
        return;
      }

      // Fetch file content
      const content = await callBackend('fs_read', { path: activePath });
      if (content === undefined) return; // Error or traversal blocked

      const filename = activePath.split('/').pop() || '';
      const lang = getLanguageByExtension(filename);
      const model = monaco.editor.createModel(content, lang);

      models.set(activePath, model);
      currentEditor.setModel(model);
      if (onContentChangeRef.current) {
        onContentChangeRef.current(content);
      }
      if (lang === 'python') {
        lspDocOpen('python', activePath, content);
      }
    }

    loadFile();
  }, [activePath]);

  // Handle dynamic theme updates
  useEffect(() => {
    if (editorRef.current) {
      monaco.editor.defineTheme('kadmus-theme', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: C.sienna.substring(1) },
          { token: 'type', foreground: C.ink.substring(1) },
          { token: 'function', foreground: C.amber.substring(1) },
          { token: 'string', foreground: C.sage.substring(1) },
          { token: 'comment', foreground: C.muted.substring(1) },
        ],
        colors: {
          'editor.background': C.base,
          'editor.foreground': C.text,
          'editorLineNumber.foreground': C.subtle,
          'editorLineNumber.activeForeground': C.sienna,
          'editor.lineHighlightBackground': `${C.line}40`,
          'editor.selectionBackground': `${C.sky}30`,
          'minimap.background': C.base,
        }
      });
      monaco.editor.setTheme('kadmus-theme');
    }
  }, [themeTrigger]);

  // Handle dynamic editor settings updates
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !settings) return;

    editor.updateOptions({
      fontSize: settings.editor?.fontSize || 14,
      tabSize: settings.editor?.tabSize || 4,
      insertSpaces: settings.editor?.insertSpaces ?? true,
      minimap: {
        enabled: settings.editor?.minimap?.visible ?? true
      }
    });

    // Also update current model if present
    const model = editor.getModel();
    if (model) {
      model.updateOptions({
        tabSize: settings.editor?.tabSize || 4,
        insertSpaces: settings.editor?.insertSpaces ?? true
      });
    }
  }, [settings]);

  return (
    <div ref={containerRef} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }} />
  );
}

function getLanguageByExtension(filename: string): string {
  const ext = filename.split('.').pop() || '';
  switch (ext) {
    case 'cpp': case 'h': case 'hpp': return 'cpp';
    case 'js': return 'javascript';
    case 'ts': return 'typescript';
    case 'tsx': return 'typescript';
    case 'json': return 'json';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'md': return 'markdown';
    case 'txt': return 'plaintext';
    default: return 'plaintext';
  }
}
