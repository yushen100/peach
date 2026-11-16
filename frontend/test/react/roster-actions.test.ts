import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiGet, apiSend } from '../../src/api';
import { rosterActions, type RosterKind } from '../../src/react/index/roster-actions';
import { queryClient } from '../../src/react/query';

vi.mock('../../src/api', () => ({ apiGet: vi.fn(), apiSend: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks() });

describe('名册资料批量删除', () => {
  it.each<RosterKind>(['performers', 'creators', 'studios', 'series', 'agencies'])(
    '%s 的普通和隐藏名册都提供不可撤销的资料删除', (kind) => {
      for (const hidden of [false, true]) {
        const action = rosterActions(kind, hidden).find((entry) => entry.key === 'delete');
        expect(action?.reversal).toBe('irreversible');
        expect(action?.danger).toBe(true);
      }
    });

  it.each(['profile', 'trash', 'purge'])('确认展示三个范围，%s 使用计划凭据和实际回执', async (mode) => {
    vi.mocked(apiGet).mockResolvedValue({ assets: 3, bytes: 1024, shared: 1, names: ['资料甲', '资料乙'], token: 'current-plan' });
    vi.mocked(apiSend).mockResolvedValue({ entity_ids: [1, 2], asset_ids: [10, 11], retained_entity_ids: [],
      mode, purged: mode === 'purge' ? 3 : 0, blocked: [], cleanup_pending: [], cache_blocked: [] });
    const refresh = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const action = rosterActions('performers', false).find((entry) => entry.key === 'delete')!;
    const items = [{ entity_id: 1, k: '资料甲', n: 2 }, { id: 2, k: '资料乙', n: 1 }];
    const confirmation = await action.confirm(items);
    expect(confirmation.items).toEqual(['资料甲', '资料乙']);
    expect(confirmation.body).toContain('3');
    expect(confirmation.choices?.map(choice => choice.key)).toEqual(['profile', 'trash', 'purge']);
    expect(await action.run(items, mode)).toBeUndefined();
    expect(apiSend).toHaveBeenCalledWith('/api/entity-batch',
      { operation: 'delete', mode, entity_ids: [1, 2], token: 'current-plan' }, 'POST');
    expect(refresh).toHaveBeenCalled();
    expect(action.receipt(items, {})).toContain('2');
  });

  it('永久删除的部分失败显示保留档案和文件原因', async () => {
    vi.mocked(apiSend).mockResolvedValue({ entity_ids: [], asset_ids: [], retained_entity_ids: [1],
      mode: 'purge', purged: 1, blocked: [{ path: 'blocked.mp4', reason: '磁盘离线' }],
      cleanup_pending: [], cache_blocked: [] });
    const refresh = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const action = rosterActions('performers', false).find(entry => entry.key === 'delete')!;
    await expect(action.run([{ entity_id: 1, k: '资料甲', n: 2 }], 'purge')).rejects.toThrow('blocked.mp4 — 磁盘离线');
    expect(refresh).toHaveBeenCalled();
  });

  it('删除失败时保留错误且不刷新为成功状态', async () => {
    vi.mocked(apiSend).mockRejectedValue(new Error('资料已变化'));
    const refresh = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const action = rosterActions('series', false).find((entry) => entry.key === 'delete')!;
    await expect(action.run([{ entity_id: 1, k: '系列', n: 1 }])).rejects.toThrow('资料已变化');
    expect(refresh).not.toHaveBeenCalled();
  });
});
