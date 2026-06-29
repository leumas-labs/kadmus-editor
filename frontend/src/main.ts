import './style.css';
import * as monaco from 'monaco-editor';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

// Configure Monaco Editor Workers for Vite
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Lucide Icons Import
import { createIcons, Files, GitBranch, Blocks, Sparkles, Check } from 'lucide';

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  }
};

// Extract token
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('t') || '';

// Connection and UI states
let socket: WebSocket;
let activeTabPath = '';
let terminalSessionId = -1;
const openTabs = new Map<string, { model: monaco.editor.ITextModel; name: string }>();

// JSON-RPC Helpers
let nextId = 1;
const pendingRequests = new Map<number, (res: any) => void>();

function callBackend(method: string, params: any = {}): Promise<any> {
  return new Promise((resolve) => {
    const id = nextId++;
    pendingRequests.set(id, resolve);
    socket.send(JSON.stringify({ jsonrpc: '2.0', method, params, id }));
  });
}

// -------------------------------------------------------------
// Monaco Editor
// -------------------------------------------------------------
let editor: monaco.editor.IStandaloneCodeEditor;

function initMonaco() {
  editor = monaco.editor.create(document.getElementById('editor-root')!, {
    value: '// Bienvenue dans Kadmus Editor\n// Choisis un fichier dans le dossier de travail à gauche pour commencer.',
    language: 'plaintext',
    theme: 'vs-dark',
    automaticLayout: true,
    fontSize: 13,
    fontFamily: 'Fira Code, monospace',
    minimap: { enabled: true },
    scrollbar: {
      vertical: 'visible',
      horizontal: 'visible',
      useShadows: false,
      verticalScrollbarSize: 6,
      horizontalScrollbarSize: 6
    }
  });

  // Direct save on content edits
  editor.onDidChangeModelContent(() => {
    if (activeTabPath && openTabs.has(activeTabPath)) {
      const content = editor.getValue();
      callBackend('fs_write', { path: activeTabPath, content });
    }
  });
}

function getLanguageByExtension(filename: string): string {
  const ext = filename.split('.').pop() || '';
  switch (ext) {
    case 'cpp': case 'h': case 'hpp': return 'cpp';
    case 'js': return 'javascript';
    case 'ts': return 'typescript';
    case 'json': return 'json';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'md': return 'markdown';
    case 'txt': return 'plaintext';
    default: return 'plaintext';
  }
}

// -------------------------------------------------------------
// Interactive File Explorer Tree (Collapsible & Recursive)
// -------------------------------------------------------------
interface TreeNode {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
}

async function renderTree(parentPath: string, container: HTMLElement, indentLevel: number) {
  const items: TreeNode[] = await callBackend('fs_list', { path: parentPath });
  if (!items || !Array.isArray(items)) return;

  // Clear loading labels at root
  if (indentLevel === 0) {
    container.innerHTML = '';
  }

  // Sort: Folders first, then alphabetically
  items.sort((a, b) => {
    if (a.is_directory && !b.is_directory) return -1;
    if (!a.is_directory && b.is_directory) return 1;
    return a.name.localeCompare(b.name);
  });

  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'tree-node';
    
    // Inject indent spacers
    for (let i = 0; i < indentLevel; i++) {
      const spacer = document.createElement('span');
      spacer.className = 'tree-indent';
      row.appendChild(spacer);
    }

    // Add arrow indicator for directory
    const arrow = document.createElement('span');
    arrow.className = 'tree-arrow';
    if (item.is_directory) {
      arrow.innerHTML = '▶'; // Right arrow character
    } else {
      arrow.innerHTML = '&nbsp;'; // Non-breaking space for files to align
    }
    row.appendChild(arrow);

    // Icon
    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.innerHTML = item.is_directory ? '📁' : '📄';
    row.appendChild(icon);

    // Label
    const label = document.createElement('span');
    label.className = 'tree-label';
    label.innerText = item.name;
    row.appendChild(label);

    container.appendChild(row);

    if (item.is_directory) {
      const childContainer = document.createElement('div');
      childContainer.className = 'tree-children';
      childContainer.style.display = 'none';
      container.appendChild(childContainer);

      let loaded = false;
      row.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (childContainer.style.display === 'none') {
          childContainer.style.display = 'block';
          arrow.classList.add('open');
          if (!loaded) {
            await renderTree(item.path, childContainer, indentLevel + 1);
            loaded = true;
          }
        } else {
          childContainer.style.display = 'none';
          arrow.classList.remove('open');
        }
      });
    } else {
      // It's a file, clicking opens it
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.tree-node').forEach(node => node.classList.remove('active'));
        row.classList.add('active');
        openFile(item.path, item.name);
      });
    }
  });
}

async function openFile(path: string, name: string) {
  if (openTabs.has(path)) {
    const tabInfo = openTabs.get(path)!;
    editor.setModel(tabInfo.model);
    activeTabPath = path;
    updateTabsUI();
    return;
  }

  const content = await callBackend('fs_read', { path });
  const lang = getLanguageByExtension(name);
  const model = monaco.editor.createModel(content, lang);

  openTabs.set(path, { model, name });
  editor.setModel(model);
  activeTabPath = path;
  
  updateTabsUI();
}

function updateTabsUI() {
  const tabBar = document.getElementById('tab-bar')!;
  tabBar.innerHTML = '';

  openTabs.forEach((tabInfo, path) => {
    const tab = document.createElement('div');
    tab.className = `tab ${path === activeTabPath ? 'active' : ''}`;
    tab.innerHTML = `
      <span>${tabInfo.name}</span>
      <span class="tab-close">×</span>
    `;

    tab.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('tab-close')) return;
      editor.setModel(tabInfo.model);
      activeTabPath = path;
      updateTabsUI();
    });

    tab.querySelector('.tab-close')!.addEventListener('click', (e) => {
      e.stopPropagation();
      openTabs.delete(path);
      if (activeTabPath === path) {
        if (openTabs.size > 0) {
          const firstKey = openTabs.keys().next().value!;
          activeTabPath = firstKey;
          editor.setModel(openTabs.get(firstKey)!.model);
        } else {
          activeTabPath = '';
          editor.setModel(monaco.editor.createModel('// Bienvenue dans Kadmus Editor\n// Choisis un fichier dans le dossier de travail à gauche.', 'plaintext'));
        }
      }
      updateTabsUI();
    });

    tabBar.appendChild(tab);
  });
}

// -------------------------------------------------------------
// xterm.js Terminal Emulator
// -------------------------------------------------------------
let term: Terminal;
let fitAddon: FitAddon;

async function initTerminal() {
  term = new Terminal({
    theme: {
      background: '#0a0a0c',
      foreground: '#c9ccd3',
      cursor: '#a855f7',
      black: '#121214',
      red: '#ef4444',
      green: '#10b981',
      yellow: '#f59e0b',
      blue: '#3b82f6',
      magenta: '#8b5cf6',
      cyan: '#06b6d4',
      white: '#f4f4f5'
    },
    fontFamily: 'Fira Code, monospace',
    fontSize: 12,
    cursorBlink: true,
    allowProposedApi: true
  });

  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);

  const container = document.getElementById('terminal-container')!;
  term.open(container);
  fitAddon.fit();

  // Resize listener
  window.addEventListener('resize', () => {
    try {
      fitAddon.fit();
    } catch (e) {}
  });

  // Pipe terminal keyboard events to PTY backend
  term.onData((data) => {
    if (terminalSessionId >= 0) {
      callBackend('term_write', { id: terminalSessionId, data });
    }
  });

  // Spawn session
  const sessionId = await callBackend('term_create', { shell: 'bash' });
  if (sessionId !== undefined && sessionId >= 0) {
    terminalSessionId = sessionId;
  } else {
    term.writeln('Failed to spawn terminal process on C++ backend.');
  }
}

// -------------------------------------------------------------
// Git Pane Integration
// -------------------------------------------------------------
async function loadGitStatus() {
  const list = document.getElementById('git-files-list')!;
  list.innerHTML = '<div class="loading-label">Scanning repository modifications...</div>';

  const files = await callBackend('git_status', { repo_path: '.' });
  if (files && Array.isArray(files)) {
    list.innerHTML = '';
    if (files.length === 0) {
      list.innerHTML = '<div class="empty-state">No changes detected</div>';
      return;
    }

    files.forEach((file: any) => {
      const row = document.createElement('div');
      row.className = 'git-file-row';
      row.innerHTML = `
        <span style="font-family: monospace;">${file.path}</span>
        <span class="git-status-badge ${file.status}">${file.status}</span>
      `;
      row.addEventListener('click', async () => {
        // Stage file on click
        await callBackend('git_stage', { repo_path: '.', file_path: file.path });
        loadGitStatus();
      });
      list.appendChild(row);
    });
  }
}

// -------------------------------------------------------------
// Extensions Integration
// -------------------------------------------------------------
async function loadExtensions() {
  const list = document.getElementById('extensions-list')!;
  list.innerHTML = '<div class="loading-label">Loading extensions...</div>';

  const exts = await callBackend('extension_list');
  if (exts && Array.isArray(exts)) {
    list.innerHTML = '';
    if (exts.length === 0) {
      list.innerHTML = '<div class="empty-state">No extensions installed</div>';
      return;
    }

    exts.forEach((ext: any) => {
      const item = document.createElement('div');
      item.className = 'ext-item';
      item.innerHTML = `
        <div class="ext-name">${ext.name}</div>
        <div class="ext-id-ver">ID: ${ext.id} | Ver: ${ext.version}</div>
      `;
      list.appendChild(item);
    });
  }
}

// -------------------------------------------------------------
// Agent Panel
// -------------------------------------------------------------
function initAgent() {
  const input = document.getElementById('ai-input')! as HTMLInputElement;
  const messages = document.getElementById('ai-messages')!;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim() !== '') {
      const text = input.value;
      input.value = '';

      // User Bubble
      const userBubble = document.createElement('div');
      userBubble.className = 'msg user';
      userBubble.innerHTML = `<span class="author">You</span><p>${text}</p>`;
      messages.appendChild(userBubble);
      messages.scrollTop = messages.scrollHeight;

      // Ask AI Backend
      callBackend('agent_send', { session_id: 'local_sess', message: text });
    }
  });
}

// -------------------------------------------------------------
// Sidebar Panel Navigation Toggle Hooks
// -------------------------------------------------------------
function initViewNavigation() {
  const buttons = ['explorer', 'git', 'extensions'];
  
  buttons.forEach(view => {
    const btn = document.getElementById(`btn-${view}`)!;
    btn.addEventListener('click', () => {
      buttons.forEach(v => {
        document.getElementById(`btn-${v}`)!.classList.remove('active');
        document.getElementById(`${v}-view`)!.classList.add('hidden');
      });

      btn.classList.add('active');
      document.getElementById(`${view}-view`)!.classList.remove('hidden');
      
      const title = document.getElementById('sidebar-title')!;
      title.innerText = view.toUpperCase();

      if (view === 'git') loadGitStatus();
      if (view === 'extensions') loadExtensions();
    });
  });

  const aiBtn = document.getElementById('btn-agent')!;
  const aiPanel = document.getElementById('ai-panel')!;
  aiBtn.addEventListener('click', () => {
    aiBtn.classList.toggle('active');
    aiPanel.classList.toggle('collapsed');
  });

  // Git Commit buttons
  document.getElementById('git-commit-btn')!.addEventListener('click', triggerGitCommit);
  document.getElementById('git-message')!.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) triggerGitCommit();
  });

  // VSIX installer buttons
  document.getElementById('ext-install-btn')!.addEventListener('click', async () => {
    const input = document.getElementById('ext-search-input')! as HTMLInputElement;
    const path = input.value.trim();
    if (path) {
      input.value = '';
      const success = await callBackend('extension_install', { vsix_path: path });
      if (success) {
        loadExtensions();
      } else {
        alert('Failed to install VSIX.');
      }
    }
  });
}

async function triggerGitCommit() {
  const input = document.getElementById('git-message')! as HTMLInputElement;
  const message = input.value.trim();
  if (message) {
    input.value = '';
    const success = await callBackend('git_commit', {
      repo_path: '.',
      message,
      author_name: 'Samuel Yevi',
      author_email: 'samuel@leumas-labs.com'
    });
    if (success) {
      loadGitStatus();
    } else {
      alert('Commit failed. Ensure changes are staged first.');
    }
  }
}

// -------------------------------------------------------------
// WebSocket Connection
// -------------------------------------------------------------
function connectToBackend() {
  socket = new WebSocket(`ws://localhost:9888/?t=${token}`);

  socket.onopen = () => {
    console.log('WebSocket connection established.');
    
    // Initialize Monaco, terminal and UI loops
    initMonaco();
    initTerminal();
    initAgent();
    initViewNavigation();
    
    // Render recursive Tree Explorer starting at workspace root
    renderTree('.', document.getElementById('explorer-files')!, 0);

    // Initial Lucide Icons Injection
    createIcons({
      icons: { Files, GitBranch, Blocks, Sparkles, Check }
    });
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.id !== undefined && pendingRequests.has(msg.id)) {
      const resolve = pendingRequests.get(msg.id)!;
      pendingRequests.delete(msg.id);
      
      if (msg.error) {
        console.error('JSON-RPC Error response:', msg.error.message);
        resolve(undefined);
      } else {
        resolve(msg.result);
      }
    }
    // Async signals
    else if (msg.method === 'term_output') {
      if (term) {
        term.write(msg.params.data);
      }
    }
    else if (msg.method === 'agent_reply') {
      const messages = document.getElementById('ai-messages')!;
      const bubble = document.createElement('div');
      bubble.className = 'msg bot';
      bubble.innerHTML = `<span class="author">Kadmus AI</span><p>${msg.params.message}</p>`;
      messages.appendChild(bubble);
      messages.scrollTop = messages.scrollHeight;
    }
  };

  socket.onclose = () => {
    console.warn('WebSocket connection closed.');
    if (term) {
      term.writeln('\r\n*** Connection with C++ backend lost. Please restart the server. ***');
    }
  };

  socket.onerror = (err) => {
    console.error('WebSocket Error:', err);
  };
}

// Boot connection
connectToBackend();
