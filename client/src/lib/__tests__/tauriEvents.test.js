import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const listenMock = vi.fn();
vi.mock('@tauri-apps/api/event', () => ({ listen: (...args) => listenMock(...args) }));

/**
 * Failures are asserted through `logger.debug` rather than by watching for
 * unhandled rejections: Node's `unhandledRejection` does not fire reliably for
 * promises created inside a microtask under this test environment, so such an
 * assertion would pass whether or not the bug were present.
 */
const debugMock = vi.fn();
vi.mock('../logger', () => ({ logger: { debug: (...args) => debugMock(...args) } }));

/** Imports tauriEvents fresh, with IS_TAURI resolving to `enabled`. */
async function loadModule(enabled) {
  vi.resetModules();
  if (enabled) window.__TAURI_INTERNALS__ = {};
  else delete window.__TAURI_INTERNALS__;
  return import('../tauriEvents');
}

/** Lets pending promise callbacks and `ticks` macrotasks run. */
async function flush(ticks = 1) {
  for (let i = 0; i < ticks; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** The TypeError Tauri throws when the event id is not registered yet. */
const notRegistered = () => new TypeError("undefined is not an object (evaluating 'listeners[eventId].handlerId')");

describe('tauriListen', () => {
  beforeEach(() => {
    listenMock.mockReset();
    debugMock.mockReset();
  });

  afterEach(() => {
    delete window.__TAURI_INTERNALS__;
  });

  it('returns a no-op outside Tauri and never calls listen', async () => {
    const { tauriListen } = await loadModule(false);
    const stop = tauriListen('task:updated', () => {});
    expect(() => stop()).not.toThrow();
    expect(listenMock).not.toHaveBeenCalled();
  });

  it('unlistens once when cancelled before registration resolves', async () => {
    const unlisten = vi.fn(async () => {});
    listenMock.mockReturnValue(Promise.resolve(unlisten));

    const { tauriListen } = await loadModule(true);
    const stop = tauriListen('task:updated', () => {});
    stop(); // cancel while the listen promise is still pending
    await flush();

    expect(unlisten).toHaveBeenCalledTimes(1);
    expect(debugMock).not.toHaveBeenCalled();
  });

  it('unlistens only once even if the caller invokes cleanup repeatedly', async () => {
    const unlisten = vi.fn(async () => {});
    listenMock.mockReturnValue(Promise.resolve(unlisten));

    const { tauriListen } = await loadModule(true);
    const stop = tauriListen('task:updated', () => {});
    await flush();
    stop();
    stop();
    stop();
    await flush();

    // Tauri's unregister is not idempotent, so a second call would throw.
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it('retries an unlisten that fired before registration landed', async () => {
    // Fails once — as it does when the event id is not yet registered — then
    // succeeds, which is what releases the Rust-side listener.
    const unlisten = vi.fn().mockRejectedValueOnce(notRegistered()).mockResolvedValueOnce(undefined);
    listenMock.mockReturnValue(Promise.resolve(unlisten));

    const { tauriListen } = await loadModule(true);
    const stop = tauriListen('task:updated', () => {});
    stop();
    await flush(3);

    expect(unlisten).toHaveBeenCalledTimes(2);
    expect(debugMock).not.toHaveBeenCalled();
  });

  it('gives up quietly when the retry also fails', async () => {
    const unlisten = vi.fn(async () => {
      throw notRegistered();
    });
    listenMock.mockReturnValue(Promise.resolve(unlisten));

    const { tauriListen } = await loadModule(true);
    const stop = tauriListen('task:updated', () => {});
    stop();
    await flush(3);

    expect(unlisten).toHaveBeenCalledTimes(2);
    expect(debugMock).toHaveBeenCalledTimes(1);
    expect(String(debugMock.mock.calls[0][0])).toContain('task:updated');
  });

  it('survives an unlisten that throws synchronously', async () => {
    const unlisten = vi.fn(() => {
      throw notRegistered();
    });
    listenMock.mockReturnValue(Promise.resolve(unlisten));

    const { tauriListen } = await loadModule(true);
    const stop = tauriListen('task:updated', () => {});
    await flush();
    expect(() => stop()).not.toThrow();
    await flush(3);

    expect(unlisten).toHaveBeenCalledTimes(2);
  });

  it('handles a rejected listen promise instead of leaving it unhandled', async () => {
    listenMock.mockReturnValue(Promise.reject(new Error('event.listen not allowed')));

    const { tauriListen } = await loadModule(true);
    const stop = tauriListen('task:updated', () => {});
    await flush();
    expect(() => stop()).not.toThrow();
    await flush();

    expect(debugMock).toHaveBeenCalledTimes(1);
    expect(String(debugMock.mock.calls[0][0])).toContain('task:updated');
  });

  it('stops delivering payloads to the callback after cancellation', async () => {
    let emit;
    const unlisten = vi.fn(async () => {});
    listenMock.mockImplementation((_name, handler) => {
      emit = handler;
      return Promise.resolve(unlisten);
    });

    const { tauriListen } = await loadModule(true);
    const received = [];
    const stop = tauriListen('task:updated', (payload) => received.push(payload));
    await flush();

    emit({ payload: 'before' });
    stop();
    emit({ payload: 'after' });

    expect(received).toEqual(['before']);
  });
});
