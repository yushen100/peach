/* 高清版目标页：数据库里标记为「还该有更好一版」的那些作品。
 *
 * 一屏回答两件事：还欠多少部、每一部欠在哪里。所以卡片上除了标题就只有来源、时长、
 * 体积和判定原因——决定要不要去找更好一版，看的就是这几项。
 *
 * 番号标题与来源徽标由遗留层以 HTML 字符串传进来：它们是全站语义契约的唯一实现，
 * 在这里重写一份就会漂。时长、体积、来源名走 `src/core/index.ts` 同一套格式化口径，同理。
 *
 * 这一页是处理队列：每张卡直接带勾选框，顶上有「全选」，选中几部后底部条给「查找资源」，
 * 打开的是 JAV 页同一个批量查找面板。查找本身不写数据，下载由面板里各行自己确认。 */
import { useState } from 'react';
import { RiSparklingLine } from '@remixicon/react';
import { useQuery } from '@tanstack/react-query';

import { LOC, fmtDur, fmtSize } from '@peach/legacy/core';

import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';

import { errorMessage } from '../../api';
import { CloudDownloadDialog, type DownloadPrefill } from '../activity/cloud-download-dialog';
import type { QualityGoalsProps } from '../bundle';
import { cardClass } from '../components/card';
import { CollectionSummary } from '../components/collection-summary';
import { EmptyState } from '../components/empty-state';
import { Note } from '../components/note';
import { Page } from '../components/page';
import { enterPageSelection, exitPageSelection, usePageSelection } from '../components/page-selection';
import { SelectionDock } from '../components/selection-dock';
import { JavBatchResources } from '../jav/jav-batch-resources';
import type { Discovery } from '../jav/jav';
import {
  fetchQualityGoals, previewUrl, QUALITY_GOALS_KEY, type QualityGoal,
} from './quality-goals';
import { t } from '../../i18n';

/** 一部待升级的作品一张卡。 */
function GoalCard({ item, openItem, searchResources, javTitleHtml, javDisplayName, srcBadge, picked, onPick }: { item: QualityGoal }
  & Omit<QualityGoalsProps, 'toast'> & { searchResources(prefill: DownloadPrefill): void; picked: boolean; onPick(on: boolean): void }) {
  const open = () => openItem(item.id);
  return (
    <li data-goal-id={item.id} data-board-selected={picked || undefined}
      className={cardClass({ padding: 'none', className: 'flex flex-col gap-3 p-3' })}>
      <div className="flex min-w-0 gap-4">
        {/* 居中那句占位文字用 `inline-grid`：旧样式表里 `.grid` 是海报墙那条带列宽和
            间距的规则，排在 `peach-app.css` 后面会赢。这颗按钮是 flex 子项，行内格
            会被块级化，算出来仍是 `display:grid`。 */}
        <button type="button" onClick={open} aria-label={t('manage:hdUpgrades.openVideo', { title: javDisplayName(item) })}
          className="relative inline-grid w-card-cover shrink-0 self-start aspect-card-cover cursor-pointer place-items-center overflow-hidden rounded-2lg bg-media-placeholder">
          {/* 图片取不到时（onError 把 img 摘掉）露出来的就是这句。 */}
          <span className="text-caption-1-regular text-text-secondary">{t('manage:hdUpgrades.noPreview')}</span>
          <img src={previewUrl(item)} alt="" loading="lazy"
            onError={(event) => event.currentTarget.remove()}
            className="absolute inset-0 size-full object-contain" />
        </button>
        <div className="flex min-w-0 flex-col gap-1.5">
          {/* 标题从番号读起，长了折到第二行再截尾：中段截断会把番号和片名一起切掉。 */}
          <h3 className="text-headline-medium text-text-primary">
            <button type="button" onClick={open} title={javDisplayName(item)}
              className="line-clamp-2 w-full cursor-pointer text-left wrap-anywhere"
              dangerouslySetInnerHTML={{ __html: javTitleHtml(item) }} />
          </h3>
          <p className="flex flex-wrap items-center gap-2 text-body-2-regular text-text-secondary">
            {/* 插原始 HTML 要有个宿主元素，而来源徽标在遗留版本里是这个 flex 容器的直接
                子项。`contents` 让宿主从布局里消失，徽标的对齐与间距保持不变。 */}
            <span className="contents" dangerouslySetInnerHTML={{ __html: srcBadge(item.location, item.cost) }} />
            <span>{LOC[item.location] ?? item.location}</span>
            <span>{fmtDur(item.duration)}</span>
            <span>{Number(item.size) > 0 ? fmtSize(Number(item.size)) : t('manage:hdUpgrades.unknownSize')}</span>
          </p>
          {item.reason
            ? <p className="border-t border-separator-border pt-3 text-body-2-regular text-text-secondary wrap-anywhere">
                {item.reason}
              </p>
            : null}
        </div>
      </div>
      {/* 勾选框放在底栏左端：摆在封面前面会把标题和读数那一列挤窄，宽屏三列时读数折成好几行。 */}
      <footer className="flex flex-wrap items-center justify-end gap-2">
        {item.code ? <Checkbox slot={null} className="mr-auto" aria-label={t('manage:hdUpgrades.selectVideo', { title: javDisplayName(item) })}
          isSelected={picked} onChange={onPick} /> : null}
        {item.code ? <Button variant="secondary" size="small" onClick={() => searchResources({
          code: item.code!, title: javDisplayName(item), origin: `asset:${item.id}`, searchReason: item.reason || '',
          duration: item.duration, cover: previewUrl(item),
        })}>{t('manage:resourceSearch.searchTorrents')}</Button> : null}
        <Button variant="secondary" size="small" onClick={open}>{t('manage:hdUpgrades.viewEditions')}</Button>
      </footer>
    </li>
  );
}

export function QualityGoalsPage({ toast, ...props }: QualityGoalsProps) {
  const [download, setDownload] = useState<DownloadPrefill | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  usePageSelection(() => setPicked(new Set()));
  const [resources, setResources] = useState<Discovery[] | null>(null);
  const goals = useQuery({ queryKey: QUALITY_GOALS_KEY, queryFn: ({ signal }) => fetchQualityGoals(signal) });
  const data = goals.data;
  if (!data) {
    return (
      <Page>
        <Note tone="error" title={t('manage:hdUpgrades.loadFailed')}>{goals.error ? errorMessage(goals.error) : t('manage:hdUpgrades.notFound')}</Note>
      </Page>
    );
  }
  const items = data.items || [];
  if (!items.length) {
    return (
      <Page>
        <EmptyState icon={RiSparklingLine} title={t('manage:hdUpgrades.emptyTitle')}>
          {t('manage:hdUpgrades.emptyBody')}
        </EmptyState>
      </Page>
    );
  }
  const selectable = items.filter((item) => item.code);
  const chosen = selectable.filter((item) => picked.has(item.id));
  const allPicked = selectable.length > 0 && chosen.length === selectable.length;
  const pick = (id: number, on: boolean) => { if (on) enterPageSelection(); setPicked((current) => {
    const next = new Set(current);
    if (on) next.add(id); else next.delete(id);
    return next;
  }) };
  return (
    <Page>
      {/* 总数取服务端的 `total` 而不是这一页的条数：`limit` 截断时两者不是一个数，
          而这一行要回答的是「一共还欠多少部」。 */}
      <CollectionSummary label={t('manage:hdUpgrades.summaryLabel')} figure={t('manage:hdUpgrades.videoCount', { count: Number(data.total || 0) })} flush />
      {selectable.length ? <div className="mb-4">
        <Checkbox size="sm" isSelected={allPicked} isIndeterminate={chosen.length > 0 && !allPicked}
          onChange={(on) => { if (on) enterPageSelection(); setPicked(on ? new Set(selectable.map((item) => item.id)) : new Set()) }}>{t('manage:hdUpgrades.selectAll')}</Checkbox>
      </div> : null}
      <ul className="card-grid-cover gap-5">
        {items.map((item) => <GoalCard key={item.id} item={item} {...props} searchResources={setDownload}
          picked={picked.has(item.id)} onPick={(on) => pick(item.id, on)} />)}
      </ul>
      <SelectionDock visible={chosen.length > 0} label={t('manage:hdUpgrades.dockLabel')} count={t('manage:hdUpgrades.selectedCount', { count: chosen.length })}
        actions={[]}>
        <Button size="small" variant="secondary" onClick={() => setResources(chosen.map((item) => ({ id: item.id, code: item.code!,
          title: props.javDisplayName(item), release_date: undefined }) as unknown as Discovery))}>{t('manage:resourceSearch.searchTorrents')}</Button>
        <Button size="small" variant="ghost" onClick={exitPageSelection}>{t('manage:hdUpgrades.clearSelection')}</Button>
      </SelectionDock>
      <JavBatchResources items={resources} close={() => setResources(null)} readOnly={false} receipt={toast} />
      {/* 列表只取前 200 部；总数比这多时说清楚这一页不是全部。 */}
      {Number(data.total || 0) > items.length
        ? <p className="mt-6 text-center text-caption-1-regular text-text-secondary">
            {t('manage:hdUpgrades.showingFirst', { shown: items.length.toLocaleString(), count: Number(data.total) })}
          </p>
        : null}
      <CloudDownloadDialog prefill={download} close={() => setDownload(null)} receipt={toast} />
    </Page>
  );
}
