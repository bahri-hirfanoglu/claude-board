import { listen as tauriListenRaw } from '@tauri-apps/api/event';
import { logger } from './logger';

const IS_TAURI = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

/**
 * Subscribes to a Tauri event and returns a cleanup function.
 *
 * Tauri's unlisten helper is hostile in two ways this wraps:
 *
 * - `listen()` resolves with its unlisten function before Rust has necessarily
 *   evaluated the script that registers the event id. The helper dereferences
 *   `listeners[eventId].handlerId` without guarding the id (tauri 2.11,
 *   `src/event/mod.rs`), so unlistening that early throws a TypeError — and it
 *   throws *before* awaiting `plugin:event|unlisten`, so the Rust-side listener
 *   is left behind. React StrictMode's mount/unmount/mount makes this the
 *   common case in development.
 * - The helper is not idempotent, so a cleanup invoked twice throws.
 *
 * Cleanup is therefore best-effort: try, retry once on the next macrotask by
 * which point registration has normally arrived, then give up at debug level.
 * A listener that outlives its unregister call is inert regardless, because
 * `cancelled` gates the callback.
 */
export function tauriListen(eventName, callback) {
  if (!IS_TAURI) return () => {};

  let unlisten = null;
  let cancelled = false;

  const release = (fn, retry = true) => {
    const onFailure = (e) => {
      if (retry) setTimeout(() => release(fn, false), 0);
      else logger.debug(`[tauriListen] could not unlisten ${eventName}: ${e}`);
    };
    try {
      const result = fn();
      if (result && typeof result.then === 'function') result.catch(onFailure);
    } catch (e) {
      onFailure(e);
    }
  };

  tauriListenRaw(eventName, (event) => {
    if (cancelled) return;
    callback(event.payload);
  })
    .then((fn) => {
      if (cancelled) release(fn);
      else unlisten = fn;
    })
    .catch((e) => logger.debug(`[tauriListen] could not listen to ${eventName}: ${e}`));

  return () => {
    cancelled = true;
    const fn = unlisten;
    unlisten = null; // Never hand the same unlisten to Tauri twice.
    if (fn) release(fn);
  };
}

const IS_MACOS = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);

export { IS_TAURI, IS_MACOS };
