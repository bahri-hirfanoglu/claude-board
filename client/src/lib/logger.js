/**
 * Global error logging bridge.
 *
 * Forwards uncaught errors, unhandled promise rejections, and a wrapped
 * `console.error` into the Rust `tauri-plugin-log` sink so they land in the
 * same rotating file as backend logs. When a user hits a bug and sends us
 * their log directory, both sides of the app are captured in one place.
 *
 * Falls back to a no-op in web/dev mode (non-Tauri) so the UI still works
 * outside the desktop shell.
 */

const IS_TAURI = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

let backend = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

let installed = false;

function safeStringify(value) {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\n${value.stack || '(no stack)'}`;
  }
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function joinArgs(args) {
  return args.map(safeStringify).join(' ');
}

export const logger = {
  info: (...args) => backend.info(joinArgs(args)),
  warn: (...args) => backend.warn(joinArgs(args)),
  error: (...args) => backend.error(joinArgs(args)),
  debug: (...args) => backend.debug(joinArgs(args)),
};

/**
 * Install global handlers. Idempotent — safe to call multiple times.
 * Must be called early (before app render) so we don't miss boot errors.
 */
export async function installGlobalErrorHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  if (IS_TAURI) {
    try {
      const plugin = await import('@tauri-apps/plugin-log');
      backend = {
        info: (m) => plugin.info(m).catch(() => {}),
        warn: (m) => plugin.warn(m).catch(() => {}),
        error: (m) => plugin.error(m).catch(() => {}),
        debug: (m) => plugin.debug(m).catch(() => {}),
      };
    } catch (e) {
      // Plugin import failed — keep no-op sinks but warn once to console.
      console.warn('[logger] tauri-plugin-log not available:', e);
    }
  }

  // Uncaught synchronous errors
  window.addEventListener('error', (event) => {
    const message = event?.error
      ? safeStringify(event.error)
      : `${event?.message || 'Unknown error'} @ ${event?.filename || '?'}:${event?.lineno || 0}`;
    backend.error(`[frontend] uncaught: ${message}`);
  });

  // Unhandled Promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    backend.error(`[frontend] unhandled promise rejection: ${safeStringify(reason)}`);
  });

  // Mirror console.error into the backend log so existing call sites benefit
  // without needing a codebase-wide rewrite. console.error continues to print
  // to the devtools console as well.
  const origError = window.console?.error?.bind(window.console);
  if (origError) {
    window.console.error = (...args) => {
      try {
        backend.error(`[console.error] ${joinArgs(args)}`);
      } catch {
        // never let logging break the app
      }
      origError(...args);
    };
  }

  // Confirm wiring is live. Shows up in the log file on every boot so we can
  // tell whether the user is on a build that has logging enabled.
  backend.info('[frontend] global error handlers installed');
}
