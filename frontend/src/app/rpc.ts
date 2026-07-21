// extract token
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('t') || '';

let socket: WebSocket | null = null;
let nextId = 1;
const pendingRequests = new Map<number, (res: any) => void>();

// Event handlers
type NotificationHandler = (params: any) => void;
const notificationHandlers = new Map<string, Set<NotificationHandler>>();

export function connectToBackend(onOpen?: () => void, onClose?: () => void) {
  socket = new WebSocket(`ws://localhost:9888/?t=${token}`);

  socket.onopen = () => {
    console.log('WebSocket connection established.');
    if (onOpen) onOpen();
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
    } else if (msg.method) {
      // Async notifications
      const handlers = notificationHandlers.get(msg.method);
      if (handlers) {
        handlers.forEach(handler => handler(msg.params));
      }
    }
  };

  socket.onclose = () => {
    console.warn('WebSocket connection closed.');
    if (onClose) onClose();
  };

  socket.onerror = (err) => {
    console.error('WebSocket Error:', err);
  };
}

export function callBackend(method: string, params: any = {}): Promise<any> {
  return new Promise((resolve) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn(`Cannot call ${method}: WebSocket is not open.`);
      resolve(undefined);
      return;
    }
    const id = nextId++;
    pendingRequests.set(id, resolve);
    socket.send(JSON.stringify({ jsonrpc: '2.0', method, params, id }));
  });
}

export function onNotification(method: string, handler: NotificationHandler) {
  if (!notificationHandlers.has(method)) {
    notificationHandlers.set(method, new Set());
  }
  notificationHandlers.get(method)!.add(handler);

  // Return unsubscribe function
  return () => {
    const handlers = notificationHandlers.get(method);
    if (handlers) {
      handlers.delete(handler);
    }
  };
}
