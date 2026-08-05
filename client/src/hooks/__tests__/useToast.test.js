import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../useToast';
import { TOAST_TIMEOUT_MS } from '../../lib/constants';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives every toast a unique id, even within the same millisecond', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('first', 'error');
      result.current.addToast('second', 'error');
      result.current.addToast('third', 'error');
    });

    const ids = result.current.toasts.map((t) => t.id);
    expect(result.current.toasts).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it('expires each toast independently instead of dropping same-tick siblings together', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('first');
    });
    act(() => {
      vi.advanceTimersByTime(TOAST_TIMEOUT_MS / 2);
      result.current.addToast('second');
    });

    // First toast's timer fires; the second was added later and must survive.
    act(() => {
      vi.advanceTimersByTime(TOAST_TIMEOUT_MS / 2);
    });
    expect(result.current.toasts.map((t) => t.message)).toEqual(['second']);

    act(() => {
      vi.advanceTimersByTime(TOAST_TIMEOUT_MS);
    });
    expect(result.current.toasts).toEqual([]);
  });

  it('defaults to the info type', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('hello');
    });

    expect(result.current.toasts[0]).toMatchObject({ message: 'hello', type: 'info' });
  });
});
