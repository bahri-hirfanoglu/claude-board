import { listen as tauriListenRaw } from '@tauri-apps/api/event';

const IS_TAURI = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

export function tauriListen(eventName, callback) {
  if (!IS_TAURI) return () => {};

  let unlisten = null;
  let cancelled = false;

  tauriListenRaw(eventName, (event) => {
    if (cancelled) return;
    callback(event.payload);
  }).then((fn) => {
    if (cancelled) fn();
    else unlisten = fn;
  });

  return () => {
    cancelled = true;
    if (unlisten) unlisten();
  };
}

const IS_MACOS = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);

export { IS_TAURI, IS_MACOS };
