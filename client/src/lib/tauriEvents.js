import { listen as tauriListenRaw } from '@tauri-apps/api/event';

const IS_TAURI = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

export function tauriListen(eventName, callback) {
  if (!IS_TAURI) return () => {};

  let unlisten = null;
  let cancelled = false;

  tauriListenRaw(eventName, (event) => {
    callback(event.payload);
  }).then(fn => {
    if (cancelled) fn();
    else unlisten = fn;
  });

  return () => {
    cancelled = true;
    if (unlisten) unlisten();
  };
}

export { IS_TAURI };
