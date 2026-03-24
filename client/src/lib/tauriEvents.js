const IS_TAURI = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

// Cache the listen function so we don't re-import on every call
let listenFn = null;
let listenReady = false;
const pending = [];

if (IS_TAURI) {
  import('@tauri-apps/api/event').then(({ listen }) => {
    listenFn = listen;
    listenReady = true;
    pending.forEach(fn => fn());
    pending.length = 0;
  }).catch(() => {});
}

export function tauriListen(eventName, callback) {
  if (!IS_TAURI) return () => {};

  let unlisten = null;
  let cancelled = false;

  const setup = () => {
    if (cancelled) return;
    listenFn(eventName, (event) => {
      callback(event.payload);
    }).then(fn => {
      if (cancelled) fn();
      else unlisten = fn;
    });
  };

  if (listenReady) setup();
  else pending.push(setup);

  return () => {
    cancelled = true;
    if (unlisten) unlisten();
  };
}

export { IS_TAURI };
