const IS_TAURI = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

export function tauriListen(eventName, callback) {
  if (!IS_TAURI) return () => {};

  let unlisten = null;
  let cancelled = false;

  // Use @tauri-apps/api dynamically
  import('@tauri-apps/api/event').then(({ listen }) => {
    if (cancelled) return;
    listen(eventName, (event) => {
      callback(event.payload);
    }).then(fn => {
      if (cancelled) fn();
      else unlisten = fn;
    });
  }).catch(() => {
    // Fallback: poll-free, just skip events if API unavailable
  });

  return () => {
    cancelled = true;
    if (unlisten) unlisten();
  };
}

export { IS_TAURI };
