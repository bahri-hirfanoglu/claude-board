import { useState, useEffect } from 'react';
import { api } from './api';

/**
 * Probe a directory to learn whether it's a git repo, debounced on the path.
 * Returns: { status: { isRepo, hasRemote, currentBranch, pathExists } | null, loading, error, refresh }
 */
export function useGitRepoStatus(path, { debounceMs = 350, enabled = true } = {}) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!enabled || !path || !path.trim()) {
      setStatus(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.checkGitRepo(path.trim());
        if (cancelled) return;
        // Backend uses snake_case; Tauri converts but the camelCase result depends on serde.
        // We normalize to camelCase here.
        const normalized = res
          ? {
              isRepo: !!(res.is_repo ?? res.isRepo),
              hasRemote: !!(res.has_remote ?? res.hasRemote),
              currentBranch: res.current_branch ?? res.currentBranch ?? null,
              pathExists: !!(res.path_exists ?? res.pathExists),
              detectedProvider: res.detected_provider ?? res.detectedProvider ?? 'unknown',
            }
          : null;
        setStatus(normalized);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setStatus(null);
        setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [path, debounceMs, enabled, refreshTick]);

  return { status, loading, error, refresh: () => setRefreshTick((n) => n + 1) };
}
