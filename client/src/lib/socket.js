import { io } from 'socket.io-client';

const IS_TAURI = typeof window !== 'undefined' && window.__TAURI_INTERNALS__;

let socket;

if (IS_TAURI) {
  // Tauri mode: use Tauri events instead of Socket.IO
  const listeners = new Map();
  let listenersReady = false;
  const pendingCallbacks = [];

  // Import and register Tauri event listeners
  import('@tauri-apps/api/event')
    .then(({ listen }) => {
      const events = [
        'task:created',
        'task:updated',
        'task:deleted',
        'task:usage',
        'task:log',
        'task:attachments',
        'task:attachmentDeleted',
        'project:created',
        'project:updated',
        'project:deleted',
        'snippet:created',
        'snippet:updated',
        'snippet:deleted',
        'template:created',
        'template:updated',
        'template:deleted',
        'role:created',
        'role:updated',
        'role:deleted',
        'plan:started',
        'plan:log',
        'plan:phase',
        'plan:progress',
        'plan:stats',
        'plan:completed',
        'plan:cancelled',
        'claude:finished',
        'claude:limits',
      ];
      for (const name of events) {
        listen(name, (event) => {
          const cbs = listeners.get(name);
          if (cbs) cbs.forEach((cb) => cb(event.payload));
        });
      }
      listenersReady = true;
    })
    .catch(console.error);

  socket = {
    connected: true,
    on(event, callback) {
      if (event === 'connect') {
        setTimeout(callback, 0);
        return;
      }
      if (event === 'disconnect') return;
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(callback);
    },
    off(event, callback) {
      const cbs = listeners.get(event);
      if (cbs) {
        if (callback) cbs.delete(callback);
        else listeners.delete(event);
      }
    },
    emit() {},
  };
} else {
  // Web mode: use Socket.IO
  const URL = import.meta.env.DEV ? 'http://localhost:4000' : '/';
  socket = io(URL, { autoConnect: true });
}

export { socket };
