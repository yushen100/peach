/* 各页面的进度轮询：要查时读失败按连续失败次数退避，成功回到常规间隔，不查时照旧不查。 */
import { describe, expect, it, vi } from 'vitest';

import { backoffMs } from '../../src/polling';
import { backgroundIssuesInterval } from '../../src/react/activity/background-issues';
import { choicesInterval } from '../../src/react/avatar-picker/avatar-picker';
import { exportInterval } from '../../src/react/diagnostics/scraping-export';
import { schedulePollInterval } from '../../src/react/settings-panel/settings-data';
import { waitForNewVersion } from '../../src/react/settings/docker-update';
import { repairsInterval } from '../../src/react/settings/repair-center';
import { magnetsInterval } from '../../src/react/wants/want-magnets';
import { wantsInterval } from '../../src/react/wants/wants';

type Interval = (query: never) => number | false;
const at = (interval: Interval, state: object) => interval({ state } as never);

/** 每一处：[名字, 间隔函数, 在跑的数据, 常规间隔, 停了的数据]。 */
const SITES: [string, Interval, object, number, object | null][] = [
  ['想要清单取资料', wantsInterval as Interval, { scraping: true }, 3000, { scraping: false }],
  ['想要清单查资源', wantsInterval as Interval, { searching: true }, 10_000, { searching: false }],
  ['磁链搜索', magnetsInterval as Interval, { state: 'busy' }, 3000, { state: 'ready' }],
  ['换头像候选索引', choicesInterval as Interval, { index_refreshing: true }, 1000, { index_refreshing: false }],
  ['诊断导出', exportInterval as Interval, { status: 'running' }, 1000, { status: 'complete' }],
  ['修复中心', repairsInterval as Interval, { items: [{ state: 'running' }] }, 2000, { items: [{ state: 'done' }] }],
  ['追更与订阅调度', schedulePollInterval as Interval, { running: true }, 3000, { running: false }],
  ['后台问题', backgroundIssuesInterval as Interval, { issues: [] }, 30_000, null],
];

describe('页面进度轮询的失败退避', () => {
  it.each(SITES)('%s：读失败退避，成功回到常规间隔', (_name, interval, running, regular, stopped) => {
    expect(at(interval, { data: running, status: 'success' })).toBe(regular);
    expect(at(interval, { data: running, status: 'error', errorUpdateCount: 1 })).toBe(backoffMs(1));
    expect(at(interval, { data: running, status: 'error', errorUpdateCount: 3 })).toBe(backoffMs(3));
    if (stopped) expect(at(interval, { data: stopped, status: 'success' })).toBe(false);
  });
});

describe('Docker 更新等待新版本', () => {
  it('连不上时按退避放慢，读到新版本就停', async () => {
    const waits: number[] = [];
    const replies: (Error | string)[] = [new Error('down'), new Error('down'), '0.58.0', '0.59.0'];
    const read = vi.fn(async () => {
      const reply = replies.shift()!;
      if (reply instanceof Error) throw reply;
      return { runtime: { version: reply } };
    });
    const result = await waitForNewVersion('0.58.0', new AbortController().signal, {
      limitMs: 60_000, read, pause: async (ms) => { waits.push(ms) },
    });
    expect(result).toEqual({ state: 'done', version: '0.59.0' });
    expect(waits).toEqual([3000, backoffMs(1), backoffMs(2), 3000]);
  });

  it('跑满期限还是旧版本就报告未完成，中止时什么也不报', async () => {
    const read = async () => ({ runtime: { version: '0.58.0' } });
    const pause = () => new Promise<void>((resolve) => { setTimeout(resolve, 5) });
    expect(await waitForNewVersion('0.58.0', new AbortController().signal, { limitMs: 1, read, pause }))
      .toEqual({ state: 'timeout' });
    const controller = new AbortController();
    controller.abort();
    expect(await waitForNewVersion('0.58.0', controller.signal, { limitMs: 60_000, read, pause })).toBeNull();
  });
});
