import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../api', () => ({ api: { listModels: vi.fn() } }));

const { api } = await import('../api');
const { useModels, refreshModels, getModelCosts, findModel } = await import('../useModels');

describe('useModels', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.listModels.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serves the backend list once it arrives', async () => {
    api.listModels.mockResolvedValue([{ value: 'opus-5', label: 'Opus 5', source: 'upstream' }]);
    await refreshModels();

    const { result } = renderHook(() => useModels());
    await waitFor(() => expect(result.current.models[0].value).toBe('opus-5'));
  });

  it('falls back to the built-in aliases when the backend call fails', async () => {
    api.listModels.mockRejectedValue(new Error('no backend'));
    await refreshModels();

    const { result } = renderHook(() => useModels());
    await waitFor(() => expect(result.current.models.length).toBeGreaterThan(0));
    expect(result.current.models.map((m) => m.value)).toEqual(['haiku', 'sonnet', 'opus']);
  });

  it('shares one in-flight request across concurrent callers', async () => {
    api.listModels.mockResolvedValue([{ value: 'sonnet', label: 'Sonnet', source: 'upstream' }]);
    await refreshModels();
    api.listModels.mockClear();

    renderHook(() => useModels());
    renderHook(() => useModels());
    expect(api.listModels).not.toHaveBeenCalled();
  });

  it('reads costs off the resolved list', () => {
    const models = [{ value: 'opus', input_cost_per_mtok: 5, output_cost_per_mtok: 25 }];
    expect(getModelCosts('opus', models)).toEqual({ input: 5, output: 25 });
    expect(getModelCosts('nope', models)).toBeNull();
    expect(findModel('opus', models).value).toBe('opus');
  });
});
