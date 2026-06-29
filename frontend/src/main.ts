import './style.css';
import * as monaco from 'monaco-editor';

// Configure Monaco Editor Workers for Vite
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  }
};

// Extract connection token from query parameter (passed by C++ loader window)
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('t') || '';

// Connection State
let socket: WebSocket;
let activeTabPath = '';
let terminalSessionId = -1;

const openTabs = new Map<string, { model: monaco.editor.ITextModel; name: string }>();

// JSON-RPC Request Tracker
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
// Monaco Editor Initialization
// -------------------------------------------------------------
let editor: monaco.editor.IStandaloneCodeEditor;

function initMonaco() {
  editor = monaco.editor.create(document.getElementById('editor-root')!, {
    value: '// Welcome to Kadmus Editor\n// Select a file in the explorer to edit.',
    language: 'plaintext',
    theme: 'vs-dark',
    automaticLayout: true,
    fontSize: 13,
    fontFamily: 'Fira Code, monospace',
    minimap: { enabled: true }
  });

  // Automatically save files on edit change
  editor.onDidChangeModelContent(() => {
    if (activeTabPath && openTabs.has(activeTabPath)) {
      const content = editor.getValue();
      // Send write request (Debounced or direct for simple testing)
      callBackend('fs_write', { path: activeTabPath, content });
    }
  });
}

// Helper to determine language by file extension
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
    case 'kd': return 'cpp'; // kdlang custom coloring mockup
    default: return 'plaintext';
  }
}

// -------------------------------------------------------------
// File Explorer View
// -------------------------------------------------------------
async function loadFileExplorer(path: string = '.') {
  const fileContainer = document.getElementById('explorer-files')!;
  fileContainer.innerHTML = '<div class="loading-label">Loading files...</div>';

  const items = await callBackend('fs_list', { path });
  if (items && Array.isArray(items)) {
    fileContainer.innerHTML = '';
    
    // Sort directories first
    items.sort((a: any, b: any) => (b.is_directory ? 1 : 0) - (a.is_directory ? 1 : 0));

    items.forEach((item: any) => {
      const row = document.createElement('div');
      row.className = 'node-label';
      
      const icon = item.is_directory ? '📁' : '📄';
      row.innerHTML = `<span style="margin-right: 6px;">${icon}</span><span class="file-name">${item.name}</span>`;
      
      if (!item.is_directory) {
        row.addEventListener('click', () => openFile(item.path, item.name));
      }
      
      fileContainer.appendChild(row);
    });
  }
}

async function openFile(path: string, name: string) {
  // Check if already open
  if (openTabs.has(path)) {
    const tabInfo = openTabs.get(path)!;
    editor.setModel(tabInfo.model);
    activeTabPath = path;
    updateTabsUI();
    return;
  }

  // Load content
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
      <span class="tab-close" id="close-${path.replace(/[^a-zA-Z0-9]/g, '_')}">×</span>
    `;

    // Click to activate
    tab.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('tab-close')) return; // Avoid click collision with close button
      editor.setModel(tabInfo.model);
      activeTabPath = path;
      updateTabsUI();
    });

    // Click to close
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
          editor.setModel(monaco.editor.createModel('// Open a file to start editing.', 'plaintext'));
        }
      }
      updateTabsUI();
    });

    tabBar.appendChild(tab);
  });
}

// -------------------------------------------------------------
// Terminal Integration
// -------------------------------------------------------------
async function initTerminal() {
  const termOutput = document.getElementById('terminal-output')!;
  termOutput.innerHTML = 'Connecting to POSIX Terminal...';

  // Create PTY session on C++ backend
  const sessionId = await callBackend('term_create', { shell: 'zsh' });
  if (sessionId !== undefined && sessionId >= 0) {
    terminalSessionId = sessionId;
    termOutput.innerHTML = 'Terminal connected.\n';
  } else {
    termOutput.innerHTML = 'Failed to spawn PTY session on backend.';
  }

  // Handle stdin
  const stdin = document.getElementById('terminal-stdin')! as HTMLInputElement;
  stdin.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && terminalSessionId >= 0) {
      const cmd = stdin.value + '\n';
      stdin.value = '';
      callBackend('term_write', { id: terminalSessionId, data: cmd });
    }
  });
}

// -------------------------------------------------------------
// Git Integration
// -------------------------------------------------------------
async function loadGitStatus() {
  const list = document.getElementById('git-files-list')!;
  list.innerHTML = '<div class="loading-label">Reading repo changes...</div>';

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
      row.addEventListener('click', () => {
        // Stage the file
        callBackend('git_stage', { repo_path: '.', file_path: file.path }).then(() => {
          loadGitStatus(); // Refresh status list
        });
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
// AI Agent Chat Integration
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
// Active Views Navigation (Sidebar Panels toggle)
// -------------------------------------------------------------
function initViewNavigation() {
  const buttons = ['explorer', 'git', 'extensions'];
  
  buttons.forEach(view => {
    const btn = document.getElementById(`btn-${view}`)!;
    btn.addEventListener('click', () => {
      // Toggle active states
      buttons.forEach(v => {
        document.getElementById(`btn-${v}`)!.classList.remove('active');
        document.getElementById(`${v}-view`)!.classList.add('hidden');
      });

      btn.classList.add('active');
      document.getElementById(`${view}-view`)!.classList.remove('hidden');
      
      const title = document.getElementById('sidebar-title')!;
      title.innerText = view.toUpperCase();

      // Refresh target views dynamically
      if (view === 'git') loadGitStatus();
      if (view === 'extensions') loadExtensions();
    });
  });

  // AI Agent toggle (Collapses/opens right sidebar)
  const aiBtn = document.getElementById('btn-agent')!;
  const aiPanel = document.getElementById('ai-panel')!;
  aiBtn.addEventListener('click', () => {
    aiBtn.classList.toggle('active');
    aiPanel.classList.toggle('collapsed');
  });

  // Git Commit hook
  document.getElementById('git-commit-btn')!.addEventListener('click', triggerGitCommit);
  document.getElementById('git-message')!.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) triggerGitCommit();
  });

  // Extension Install hook
  document.getElementById('ext-install-btn')!.addEventListener('click', async () => {
    const input = document.getElementById('ext-search-input')! as HTMLInputElement;
    const path = input.value.trim();
    if (path) {
      input.value = '';
      const success = await callBackend('extension_install', { vsix_path: path });
      if (success) {
        loadExtensions();
      } else {
        alert('Failed to install VSIX extension package.');
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
    console.log('Connected to C++ Backend Server.');
    
    // Initialize UI
    initMonaco();
    initTerminal();
    initAgent();
    initViewNavigation();
    
    // Initial loads
    loadFileExplorer();
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    // 1. Check if it's a response to a pending request
    if (msg.id !== undefined && pendingRequests.has(msg.id)) {
      const resolve = pendingRequests.get(msg.id)!;
      pendingRequests.delete(msg.id);
      
      if (msg.error) {
        console.error('API Error:', msg.error.message);
        resolve(undefined);
      } else {
        resolve(msg.result);
      }
    }
    // 2. Check if it's an async notification
    else if (msg.method === 'term_output') {
      const termOutput = document.getElementById('terminal-output')!;
      termOutput.innerHTML += msg.params.data;
      const termBody = document.getElementById('terminal-body')!;
      termBody.scrollTop = termBody.scrollHeight;
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
    console.warn('Disconnected from C++ Backend.');
    const termOutput = document.getElementById('terminal-output')!;
    termOutput.innerHTML += '\n*** Connection lost. Please reload the editor window. ***\n';
  };

  socket.onerror = (err) => {
    console.error('WebSocket Error:', err);
  };
}

// Start connection
connectToBackend();
