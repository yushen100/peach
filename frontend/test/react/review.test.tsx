/* 人工复核页的行为：分类是地址栏上的身份，分组筛选分页是这一刻的看法，判定只改缓存里
 * 那几行，以及只读数据库上这一页什么都不写。
 *
 * 外观（卡片底色、页签选中态）是设计决定，由 `frontend/e2e/design-*.test.ts` 读
 * `getComputedStyle` 断言；这里只看结构、文字与请求。 */
import { act } from 'react';
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import * as legacyUi from '@peach/legacy/ui';

import { queryClient } from '../../src/react/query';
import {
  commonReviewSources, fieldName, filterReviewRows, groupReviewRows, prefetchReview, REVIEW_DECISION_URL,
  REVIEW_KEY, REVIEW_PAGE_SIZE, REVIEW_URL, reviewGroupingOptions, settleReviewRows,
  reviewWindow, type ReviewCandidate, type ReviewData, type ReviewRow,
  type DecisionResult,
} from '../../src/react/review/review';
import { AUTO_LANDINGS_URL, type AutoLandingWrite } from '../../src/react/review/auto-landings';
import { ReviewPage } from '../../src/react/review/review-page';

import { actionOrder, choose, click, mountRoot, settle } from './render';

// 客户端是模块级的单例（所有 React 根共用一个），用例之间不清就互相喂数据。
afterEach(() => queryClient.clear());

/* Query 派发更新用的是它自己抓住的那个真 `setTimeout(0)`，假时钟推不动它：推完时钟
   断言到的还是上一帧的 DOM。用例里改成当场派发。 */
notifyManager.setScheduler((notify) => notify());

type Confirmation = Parameters<typeof legacyUi.confirmModal>[0];

/** 批量判定先弹确认：这里替人点主按钮，记下弹窗写了什么。 */
function acceptConfirm() {
  const asked: Confirmation[] = [];
  vi.spyOn(legacyUi, 'confirmModal').mockImplementation((async (options: Confirmation) => {
    asked.push(options);
    return { confirmed: true, result: await options.onConfirm?.() };
  }) as typeof legacyUi.confirmModal);
  return asked;
}

const candidate = (source: string, value: string): ReviewCandidate =>
  ({ candidate_key: `${source}:${value}`, source, display_value: value });

/** 一条元数据字段候选。`sources` 给几家就是几个候选，给一家就是单一来源。 */
const row = (at: number, sources: string[] = ['javdb', 'nfo']): ReviewRow => ({
  item_key: `row-${at}`,
  queue_order: at,
  field: 'title',
  field_label: '标题',
  query: `ABC-${at}`,
  candidates: sources.map((source) => candidate(source, `${source} 给的标题 ${at}`)),
});

/** 22 条多来源、3 条单一来源：够两页，也够两个分组。 */
const QUEUE: ReviewRow[] = [
  ...Array.from({ length: 22 }, (_, at) => row(at)),
  ...Array.from({ length: 3 }, (_, at) => row(100 + at, ['nfo'])),
];

const review = (over: Partial<ReviewData> = {}): ReviewData => ({
  sections: { metadata_fields: QUEUE, creator_tags: [] },
  counts: { metadata_fields: QUEUE.length, creator_tags: 0 },
  queues: { later: { sections: {}, counts: {} }, ignored: { sections: {}, counts: {} } },
  genre_tags: ['剧情'],
  ...over,
});

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

interface Plan {
  data?: ReviewData;
  /** 判定的回答：给一串就按顺序一条一条回（最后一条之后一直回它）。 */
  decisions?: DecisionResult[];
  /** 「自动写入的资料」列出的条目；缺省没有，那一块不出现。 */
  autoLandings?: AutoLandingWrite[];
}

function serve(plan: Plan = {}) {
  const decisions = [...(plan.decisions ?? [{ ok: true }])];
  const fetcher = vi.fn(async (input: string, _init?: RequestInit) => {
    const url = String(input);
    if (url === REVIEW_DECISION_URL) {
      return ok(decisions.length > 1 ? decisions.shift()! : decisions[0]!);
    }
    if (url.startsWith(AUTO_LANDINGS_URL)) return ok({ items: plan.autoLandings ?? [] });
    if (url.startsWith(REVIEW_URL)) return ok(plan.data ?? review());
    throw new Error(`没有安排这个端点：${url}`);
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

type Props = Parameters<typeof ReviewPage>[0];

const shellProps = (over: Partial<Props> = {}): Props => ({
  category: '',
  route: vi.fn(),
  openItem: vi.fn(),
  openEntity: vi.fn(),
  revealSource: vi.fn(async () => ''),
  toast: vi.fn(),
  readOnly: false,
  readOnlyMessage: '本机当前只能浏览',
  writerUrl: '',
  ...over,
});

/** 走完真实的首屏路径：只取队列，然后挂载。 */
async function open(plan: Plan = {}, over: Partial<Props> = {}) {
  const fetcher = serve(plan);
  const props = shellProps(over);
  await prefetchReview(new AbortController().signal).catch(() => {});
  const mounted = await mountRoot(
    <QueryClientProvider client={queryClient}><ReviewPage {...props} /></QueryClientProvider>);
  await settle();
  return { fetcher, props, ...mounted };
}

const cards = (root: ParentNode) => [...root.querySelectorAll('[data-review-key]')];
const keys = (root: ParentNode) => cards(root).map((card) => card.getAttribute('data-review-key'));
const boxOf = (root: ParentNode, at: number) =>
  cards(root)[at]?.querySelector<HTMLInputElement>('input[type="checkbox"]');
const buttonIn = (root: ParentNode, name: string) =>
  [...root.querySelectorAll('button')].find((button) => button.textContent?.trim() === name) ?? null;
const tabNamed = (root: ParentNode, name: string) =>
  [...root.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent?.startsWith(name)) ?? null;
const stateNamed = (root: ParentNode, name: string) =>
  [...root.querySelectorAll('[aria-label="复核状态"] button')].find(button => button.textContent?.startsWith(name)) ?? null;
const statusText = (root: ParentNode) =>
  [...root.querySelectorAll('[role="status"]')].map((node) => node.textContent?.trim());

it('展开来源依据不选择候选，也不提交资料判定', async () => {
  const entry = row(1);
  entry.candidates![0]!.catalog_evidence = { runtime: { display_value: '120 分钟' } };
  const { host, fetcher } = await open({ data: review({ sections: { metadata_fields: [entry] } }) });
  const card = cards(host)[0]!;
  const toggle = card.querySelector('button[aria-label="展开 javdb 的来源依据"]')!;
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  await click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect([...card.querySelectorAll<HTMLInputElement>('input[type="radio"]')].every(input => !input.checked)).toBe(true);
  expect(fetcher.mock.calls.some(([url]) => url === REVIEW_DECISION_URL)).toBe(false);
  expect(card.textContent).toContain('120 分钟');
});

it('当前值独立显示人工归属，不混入旧说明中的维护实现细节', async () => {
  const entry = { ...row(1), current_value: '用户整理的标题', current_owner: 'user:manual',
    evidence: '旧说明里的维护脚本名称', videos: 1 };
  const { host } = await open({ data: review({ sections: { metadata_fields: [entry] } }) });
  const current = cards(host)[0]!.querySelector('[aria-label="当前信息"]')!;
  expect(current.textContent).toContain('用户整理的标题');
  expect(current.textContent).toContain('人工确认');
  expect(current.textContent).not.toContain('旧说明里的维护脚本名称');
});

it('标题只标出不同文字，保留共同内容和原始候选值', async () => {
  const before = '共同开头，旧的内容；共同结尾 😀';
  const after = '共同开头，新的内容；共同结尾 😀';
  const entry = { ...row(1, ['nfo']), current_value: before,
    candidates: [candidate('nfo', after)] };
  const { host, fetcher } = await open({ data: review({ sections: { metadata_fields: [entry] } }) });
  const card = cards(host)[0]!;
  const current = card.querySelector('[aria-label="当前信息"]')!;
  expect(current.textContent).toContain(before);
  expect(card.textContent).toContain(after);
  expect([...card.querySelectorAll('mark')].map(mark => mark.textContent)).toEqual(['旧', '新']);
  await click(buttonIn(card, '通过'));
  const request = fetcher.mock.calls.find(([url]) => url === REVIEW_DECISION_URL)!;
  expect(JSON.parse(request[1]!.body as string)).toMatchObject({ candidate_key: entry.candidates[0]!.candidate_key });
});

it('来源依据只对照同名字段，不把演员与标题当作差异', async () => {
  const entry = { ...row(1), field: 'performers', field_label: '演员', current_value: '演员甲',
    candidates: ['javdb', 'nfo'].map((source, at) => ({ ...candidate(source, '演员甲'),
      catalog_evidence: { title: { display_value: `共同开头，${at ? '新的' : '旧的'}内容；共同结尾` } } })) };
  const { host } = await open({ data: review({ sections: { metadata_fields: [entry] } }) });
  const card = cards(host)[0]!;
  const trigger = card.querySelector('button[aria-label="展开 javdb 的来源依据"]')!;
  await click(trigger);
  const panel = document.getElementById(trigger.getAttribute('aria-controls')!)!;
  expect(panel.textContent).toContain('共同开头，旧的内容；共同结尾');
  expect([...panel.querySelectorAll('mark')].map(mark => mark.textContent)).toEqual(['旧']);
  expect(card.querySelector('[aria-label="当前信息"]')!.querySelectorAll('mark')).toHaveLength(0);
});

it('资料字段独立于来源分组筛选，并在全队列计数后重新分页', async () => {
  const entries = [...QUEUE, ...[201, 202].map(at => ({ ...row(at), field: 'performers', field_label: '演员' }))];
  const { host } = await open({ data: review({ sections: { metadata_fields: entries } }) });
  await click(buttonIn(host, '下一页'));
  await choose(host.querySelector('button[aria-label="筛选资料字段"]'), '演员 · 2');
  expect(keys(host)).toEqual(['row-201', 'row-202']);
  expect(buttonIn(host, '下一页')).toBeNull();
  await choose(host.querySelector('button[aria-label="筛选分组方式"]'), '按来源');
  expect(keys(host)).toEqual(['row-201', 'row-202']);
  await choose(host.querySelector('button[aria-label="筛选资料字段"]'), '标题 · 25');
  expect(cards(host)).toHaveLength(REVIEW_PAGE_SIZE);
  expect(keys(host)[0]).toBe('row-0');
});
/** Note 按语气落在 `note`／`status`／`alert` 三种角色上。 */
const noteText = (root: ParentNode) =>
  [...root.querySelectorAll('[role="note"], [role="status"], [role="alert"]')]
    .map((node) => node.textContent);
const queueOf = () => queryClient.getQueryData<ReviewData>(REVIEW_KEY)!;

/** Shift 要从触发勾选的那一下事件里取：按下先于变更。 */
const pickRange = (box: Element | null | undefined) => act(async () => {
  if (!box) throw new Error('勾选框没有画出来');
  box.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, shiftKey: true }));
  (box as HTMLInputElement).click();
});

it('分组、筛选与分页各按整条队列算，不是按屏幕上这一批', () => {
  expect(reviewGroupingOptions(QUEUE, true).map(([key]) => key)).toEqual(['candidates', 'source', 'field']);
  const groups = groupReviewRows(QUEUE, 'candidates');
  expect(groups.map((group) => [group.title, group.rows.length]))
    .toEqual([['需选择来源', 22], ['单一来源', 3]]);
  expect(filterReviewRows(QUEUE, 'candidates', 'single')).toHaveLength(3);
  expect(reviewWindow(QUEUE, 1).rows).toHaveLength(REVIEW_PAGE_SIZE);
  expect(reviewWindow(QUEUE, 2)).toMatchObject({ page: 2, pages: 2 });
  // 越界的页码收回到最后一页，不画一张空列表。
  expect(reviewWindow(QUEUE, 9).page).toBe(2);
  // 同一来源在一行里给了两个值时，「统一选 javdb」没有唯一答案。
  expect(commonReviewSources(QUEUE.slice(0, 2))).toEqual(['javdb', 'nfo']);
  expect(commonReviewSources([row(0, ['nfo', 'nfo'])])).toEqual([]);
});

it('一页只画二十张，翻页换的是哪二十行', async () => {
  const { host } = await open();
  expect(cards(host)).toHaveLength(REVIEW_PAGE_SIZE);
  await click(buttonIn(host, '下一页'));
  expect(keys(host)).toEqual(['row-20', 'row-21', 'row-100', 'row-101', 'row-102']);
});

it('筛掉一个分组之后回到第一页', async () => {
  const { host } = await open();
  await choose(host.querySelector('button[aria-label="筛选当前分类"]'), '单一来源 · 3');
  expect(keys(host)).toEqual(['row-100', 'row-101', 'row-102']);
  expect(buttonIn(host, '下一页')).toBeNull();
});

it('切换每页数量回到第一页并保留已选候选', async () => {
  const { host } = await open();
  await click(boxOf(host, 0));
  await click(buttonIn(host, '下一页'));
  await choose(host.querySelector('[data-table-pagination] button[aria-haspopup="listbox"]'), '每页 10 条');
  expect(cards(host)).toHaveLength(10);
  expect(keys(host)[0]).toBe('row-0');
  expect(statusText(host)).toContain('已选 1 项');
  await choose(host.querySelector('[data-table-pagination] button[aria-haspopup="listbox"]'), '每页 50 条');
  expect(cards(host)).toHaveLength(QUEUE.length);
  expect(buttonIn(host, '下一页')).toBeNull();
});

it('分类进地址栏，换一条队列就把手里的选择放下', async () => {
  const { host, props } = await open();
  expect(host.querySelector('[data-selection-dock]')).toBeNull();
  await click(boxOf(host, 0));
  expect(statusText(host)).toContain('已选 1 项');
  expect(host.querySelector('[data-selection-dock]')).not.toBeNull();
  await click(tabNamed(host, '创作者标签'));
  expect(props.route).toHaveBeenCalledWith({ category: 'creator_tags', queue: '' });
  expect(statusText(host)).not.toContain('已选 1 项');
  expect(host.querySelector('[data-selection-dock]')).toBeNull();
  // 默认那一档不写进地址栏。
  await click(tabNamed(host, '元数据字段'));
  expect(props.route).toHaveBeenLastCalledWith({ category: '', queue: '' });
});

it('Shift 选一段，翻页之后手里还是同一批', async () => {
  const { host } = await open();
  await click(boxOf(host, 1));
  await pickRange(boxOf(host, 4));
  expect(statusText(host)).toContain('已选 4 项');
  await click(buttonIn(host, '下一页'));
  // 上一页勾的那几条不在屏幕上，但仍在手里。
  expect(boxOf(host, 0)?.checked).toBe(false);
  await click(boxOf(host, 0));
  expect(statusText(host)).toContain('已选 5 项');
});

it('判过的行从缓存里摘掉并同步计数，不为一次判定重取整条队列', async () => {
  const { host, fetcher, props } = await open();
  const reads = () => fetcher.mock.calls.filter(([url]) => String(url) === REVIEW_URL).length;
  expect(reads()).toBe(1);
  await click(buttonIn(cards(host)[0]!, '通过'));
  await settle();
  expect(props.toast).toHaveBeenCalledWith('已通过资料');
  expect(queueOf().sections.metadata_fields).toHaveLength(QUEUE.length - 1);
  expect(queueOf().counts.metadata_fields).toBe(QUEUE.length - 1);
  expect(keys(host)).not.toContain('row-0');
  expect(reads()).toBe(1);
});

it('服务端拒绝这次判定时说出原因，那一行留在屏幕上', async () => {
  const { host, props } = await open({ decisions: [{ ok: false, error: '字段已有值' }] });
  await click(buttonIn(cards(host)[0]!, '通过'));
  await settle();
  expect(cards(host)[0]?.textContent).toContain('字段已有值');
  expect(props.toast).not.toHaveBeenCalled();
  expect(queueOf().sections.metadata_fields).toHaveLength(QUEUE.length);
});

it('批量判定先确认，成功的摘掉，没写成的留下来等重试', async () => {
  const asked = acceptConfirm();
  const { host, props } = await open({
    decisions: [{ ok: true }, { ok: false, error: '来源已失效' }, { ok: true }],
  });
  await choose(host.querySelector('button[aria-label="筛选当前分类"]'), '单一来源 · 3');
  await click(buttonIn(host, '全选当前分类'));
  expect(statusText(host)).toContain('已选 3 项');
  expect(actionOrder(buttonIn(host, '通过所选')!.parentElement).filter((name) => name.endsWith('所选') || name === '取消选择'))
    .toEqual(['忽略所选', '稍后处理所选', '通过所选', '取消选择']);
  await click(buttonIn(host, '通过所选'));
  await settle();
  // 通过写进真相字段，撤不回：弹窗写明，回执不带撤销。
  expect(asked[0]?.body).toBe('将通过选中的 3 项，按所选来源写入资料。不能撤销。');
  expect(props.toast).toHaveBeenCalledWith('已通过 2 项，1 项未完成');
  expect(queueOf().sections.metadata_fields).toHaveLength(QUEUE.length - 2);
  expect(keys(host)).toEqual(['row-101']);
  expect(cards(host)[0]?.textContent).toContain('来源已失效');
});

const sameAssetRows = (): ReviewRow[] => [0, 1, 2].map((at) => ({
  ...row(at, ['javdb']), asset_id: 6, asset_path: '/media/ABC-123.mp4',
  asset_mutation_revision: at === 2 ? 0 : 1,
}));
const receipt = (before: number, after: number): DecisionResult =>
  ({ ok: true, asset_revisions: { '6': { before, after } } });
const sentDecisions = (fetcher: ReturnType<typeof serve>) => fetcher.mock.calls
  .filter(([url]) => url === REVIEW_DECISION_URL)
  .map((call) => JSON.parse((call[1] as RequestInit).body as string));

it('逐项通过使用同资产最近一次批准的版本，已过期的候选保持原版本', async () => {
  const { host, fetcher } = await open({
    data: review({ sections: { metadata_fields: sameAssetRows() } }),
    decisions: [receipt(1, 4), receipt(4, 5)],
  });
  await click(buttonIn(cards(host)[0]!, '通过'));
  await settle();
  expect(queueOf().sections.metadata_fields?.map((item) => item.asset_mutation_revision)).toEqual([4, 0]);
  await click(buttonIn(cards(host)[0]!, '通过'));
  await settle();
  expect(sentDecisions(fetcher).map((body) => body.expected_revision)).toEqual([1, 4]);
});

it('批量通过逐条沿用服务端版本回执，并保留其他写入造成的冲突', async () => {
  acceptConfirm();
  const { host, fetcher } = await open({
    data: review({ sections: { metadata_fields: sameAssetRows() } }),
    decisions: [receipt(1, 4), receipt(4, 5), { ok: false, error: '资产资料已更改' }],
  });
  await click(buttonIn(host, '全选本页'));
  await click(buttonIn(host, '通过所选'));
  await settle();
  expect(sentDecisions(fetcher).map((body) => body.expected_revision)).toEqual([1, 4, 0]);
  expect(keys(host)).toEqual(['row-2']);
  expect(cards(host)[0]?.textContent).toContain('资产资料已更改');
});

it('多来源候选没选来源就批量通过时先说清楚，不替人按下判断', async () => {
  const { host } = await open();
  await click(buttonIn(host, '全选本页'));
  await click(buttonIn(host, '通过所选'));
  await settle();
  expect(statusText(host)).toContain('请先为所选资料选择要采用的来源。');
  expect(queueOf().sections.metadata_fields).toHaveLength(QUEUE.length);
});

it('只读数据库上判定与批量都不给点', async () => {
  const { host, fetcher } = await open(
    { data: review({ mirror: { state: 'live' } }) },
    { readOnly: true, writerUrl: 'https://writer.example/review' });
  // 只读：队列与自动写入批次各读一次，一个写请求都不发。
  expect(fetcher.mock.calls.map(([url]) => String(url)).sort()).toEqual([REVIEW_URL, AUTO_LANDINGS_URL]);
  expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
  expect(noteText(host).join()).toContain('正在显示写入端的实时复核队列');
  expect(host.querySelector('a[href="https://writer.example/review"]')).toBeTruthy();
  // 勾选与批量操作整条都不出现：没有可写的东西，工具条只是一排点不动的按钮。
  expect(boxOf(host, 0)).toBeFalsy();
  expect(buttonIn(host, '全选本页')).toBeNull();
  for (const name of ['通过', '忽略', '稍后处理']) {
    expect(buttonIn(cards(host)[0]!, name)).toHaveProperty('disabled', true);
  }
});

it('打开复核页只读队列，不再触发自动落库写操作', async () => {
  const { fetcher } = await open();
  // 读两样：复核队列与「自动写入的资料」的批次列表；都是 GET。
  expect(fetcher.mock.calls.map(([url]) => String(url)).sort()).toEqual([REVIEW_URL, AUTO_LANDINGS_URL]);
  expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
});

it('稍后处理切换独立队列，刷新地址可还原且恢复保持原排序', async () => {
  const { host, props } = await open();
  await click(buttonIn(cards(host)[1]!, '稍后处理'));
  await settle();
  expect(queueOf().counts.metadata_fields).toBe(24);
  expect(queueOf().queues.later.counts.metadata_fields).toBe(1);
  await click(stateNamed(host, '稍后处理'));
  expect(props.route).toHaveBeenLastCalledWith({ category: '', queue: 'later' });
  expect(keys(host)).toEqual(['row-1']);
  expect(buttonIn(cards(host)[0]!, '恢复待处理')).toBeTruthy();
  await click(buttonIn(cards(host)[0]!, '恢复待处理'));
  await settle();
  expect(queueOf().queues.later.counts.metadata_fields).toBe(0);
  expect(queueOf().sections.metadata_fields?.slice(0, 3).map(row => row.item_key))
    .toEqual(['row-0', 'row-1', 'row-2']);
  await click(stateNamed(host, '待处理'));
  expect(keys(host).slice(0, 3)).toEqual(['row-0', 'row-1', 'row-2']);
});

it('已忽略通过链接打开，只提供恢复，跨状态清空选择', async () => {
  const data = review({ queues: {
    later: { sections: {}, counts: {} },
    ignored: { sections: { metadata_fields: [{ ...row(7), decision: 'rejected' }] },
      counts: { metadata_fields: 1 } },
  } });
  const { host, props } = await open({ data }, { queue: 'ignored' });
  expect(keys(host)).toEqual(['row-7']);
  expect(buttonIn(cards(host)[0]!, '通过')).toBeNull();
  expect(buttonIn(cards(host)[0]!, '恢复待处理')).toBeTruthy();
  await click(boxOf(host, 0));
  expect(buttonIn(host, '恢复所选')).toBeTruthy();
  expect(buttonIn(host, '通过所选')).toBeNull();
  await click(stateNamed(host, '待处理'));
  expect(props.route).toHaveBeenLastCalledWith({ category: '', queue: '' });
  expect(host.querySelector('[data-selection-dock]')).toBeNull();
});

it('空分类仍可在筛选浮窗切换状态，只读时保留筛选并隐藏全选', async () => {
  const { host, props } = await open({ data: review({
    sections: { metadata_fields: [] }, counts: { metadata_fields: 0 },
  }) }, { readOnly: true });
  const filter = host.querySelector('[aria-label="复核筛选"]');
  expect(filter?.querySelector('[aria-label="复核状态"]')).toBeTruthy();
  expect(buttonIn(filter!, '全选本页')).toBeNull();
  await click(stateNamed(filter!, '已忽略'));
  expect(props.route).toHaveBeenLastCalledWith({ category: '', queue: 'ignored' });
  expect(host.textContent).toContain('此分类没有已忽略项目');
  expect(filter?.querySelector('[aria-label="复核状态"]')).toBeTruthy();
});

it('批量状态移动只采用成功项，失败行和其他类别保持不变', () => {
  queryClient.setQueryData(REVIEW_KEY, review());
  settleReviewRows('metadata_fields', ['row-1', 'row-2'], 'rejected');
  const data = queueOf();
  expect(data.counts.metadata_fields).toBe(23);
  expect(data.queues.ignored.sections.metadata_fields?.map(row => row.item_key))
    .toEqual(['row-1', 'row-2']);
  expect(data.sections.metadata_fields?.some(row => row.item_key === 'row-0')).toBe(true);
  expect(data.sections.creator_tags).toEqual([]);
  settleReviewRows('metadata_fields', ['row-1'], 'restore');
  expect(queueOf().queues.ignored.counts.metadata_fields).toBe(1);
  expect(queueOf().counts.metadata_fields).toBe(24);
});

it('批量稍后处理失败的行留在待处理，成功行进入独立队列', async () => {
  acceptConfirm();
  const rows = [row(0, ['nfo']), row(1, ['nfo']), row(2, ['nfo'])];
  const { host, props } = await open({
    data: review({ sections: { metadata_fields: rows }, counts: { metadata_fields: 3 } }),
    decisions: [{ ok: true }, { ok: false, error: '候选已变更' }, { ok: true }],
  });
  await click(buttonIn(host, '全选本页'));
  await click(buttonIn(host, '稍后处理所选'));
  await settle();
  expect(props.toast).toHaveBeenCalledWith('已移至稍后处理 2 项，1 项未完成', { undo: expect.any(Function) });
  expect(keys(host)).toEqual(['row-1']);
  expect(cards(host)[0]?.textContent).toContain('候选已变更');
  expect(queueOf().counts.metadata_fields).toBe(1);
  expect(queueOf().queues.later.counts.metadata_fields).toBe(2);
  await click(stateNamed(host, '稍后处理'));
  expect(keys(host)).toEqual(['row-0', 'row-2']);
  expect(host.querySelector('[data-selection-dock]')).toBeNull();
});

it('队列读取失败时说读取失败、给重试键，和空队列分得开；重试成功后画出队列', async () => {
  let fail = true;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    if (!String(input).startsWith(REVIEW_URL)) throw new Error(`没有安排这个端点：${String(input)}`);
    return fail
      ? { ok: false, status: 500, json: async () => ({ message: '复核队列查询出错' }) }
      : ok(review());
  }));
  await prefetchReview(new AbortController().signal).catch(() => {});
  const { host } = await mountRoot(
    <QueryClientProvider client={queryClient}><ReviewPage {...shellProps()} /></QueryClientProvider>);
  await settle();
  expect(host.textContent).toContain('复核队列读取失败');
  expect(host.textContent).not.toContain('此分类没有待复核项目');
  fail = false;
  await click(buttonIn(host, '立即重试'));
  await settle();
  expect(host.textContent).not.toContain('复核队列读取失败');
  expect(cards(host)).toHaveLength(REVIEW_PAGE_SIZE);
});

it('没有可采纳候选的卡仍可忽略或稍后处理，通过键不可用', async () => {
  const empty: ReviewRow = { ...row(7), candidates: [] };
  const { host } = await open({ data: review({ sections: { metadata_fields: [empty], creator_tags: [] } }) });
  const footer = cards(host)[0]!.querySelector('footer')!;
  expect([...footer.querySelectorAll('button')].map((button) => button.textContent?.trim()))
    .toEqual(['忽略', '稍后处理', '不可通过']);
});

const WRITES: AutoLandingWrite[] = [
  { item_key: 'DASS-468:release_date', rule: 'adr-0139-official-replaces-verified', label: '官方来源一致，覆盖原值',
    batch: 'adr-0139-official-replaces-verified@20261104T141053', at: 1793772653, field: '发行日期',
    value: '2024-09-10', previous: ['2024-09-06'], tags: [], assets: 1,
    asset_id: 7, code: 'DASS-468', name: '某部作品的标题', preview_url: '' },
  { item_key: 'ROYD-083:tags', rule: 'adr-0139-verified-tags-union', label: '补上来源多给的标签',
    batch: 'auto:metadata-tags@20261104T141053', at: 1793772653, field: '标签',
    value: '痴女、姐弟', previous: [], tags: ['痴女', '姐弟'], assets: 1,
    asset_id: 8, code: 'ROYD-083', name: '另一部作品', preview_url: '' },
];

it('元数据字段下逐条列出自动写入：作品、写了什么、原来是什么，只读端也能浏览', async () => {
  const { host } = await open({ autoLandings: WRITES }, { readOnly: true });
  const section = host.querySelector('[aria-labelledby="auto-landings-title"]')!;
  const text = section.textContent ?? '';
  for (const expected of ['自动写入的资料', 'DASS-468', '某部作品的标题', '发行日期：2024-09-10', '原为 「2024-09-06」',
    'ROYD-083', '标签：痴女、姐弟', '原有标签保留']) expect(text).toContain(expected);
});

it('没有自动写入时不出现那一块', async () => {
  const { host } = await open();
  expect(host.querySelector('[aria-labelledby="auto-landings-title"]')).toBeNull();
});

it('候选表的字段名按字段 id 取当前语言，登记之外的字段照原样显示脚本写的名字', () => {
  expect(fieldName({ ...row(1), field: 'performers', field_label: '出演' })).toBe('演员');
  expect(fieldName({ ...row(1), field: 'director', field_label: '导演' })).toBe('导演');
  expect(fieldName({ ...row(1), field: 'runtime', field_label: '' })).toBe('runtime');
});
