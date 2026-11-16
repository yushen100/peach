/* 搜索只选择候选；真正提交由云下载表单确认。 */
import { useEffect, useRef, useState } from 'react';
import { RiSearchLine } from '@remixicon/react';
import { spinnerHtml } from '@peach/legacy/ui';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { Select, SelectItem } from '@/components/base/select/select';
import { apiGet } from '../../api';
import { ErrorText, FieldLabel, Help } from '../settings/section';
import { useAction } from '../settings/use-action';
import { coverUrl } from '@peach/card-art';
import type { MediaPage } from '../catalog-grid/types';
import type { DownloadPrefill } from './cloud-download-dialog';
import { sameWorkCode } from './work-code';
import { composingKey } from '../components/ime';
import { codedText, serverLabelList } from '../../core/server-text';
import { joinList, t } from '../../i18n';
import { ScrapeSourceLabel } from '../components/source-label';
import { resourceSourceKey } from '../wants/resource-display';

interface Candidate {
  id: string; uri: string; name: string; size: number; seeders: number; origins: string[];
  resolution: number; codec: string; chinese: boolean; uncensored: boolean;
}
/** 搜索结果：`error`、`warnings` 是 zh-CN 原句，旁边的 code 与参数给当前语言。 */
interface Result {
  state: string; items: Candidate[]; error: string; error_code?: string; error_params?: Record<string, unknown>;
  warnings: string[]; warning_codes?: (string | null)[]; warning_params?: (Record<string, unknown> | null)[];
}

function SearchSpinner({ className }: { className?: string }) {
  return <span className={className} aria-hidden dangerouslySetInnerHTML={{ __html: spinnerHtml('') }} />;
}

function preferredGoal(reason: string | undefined): string {
  // i18n-exempt: 服务端给的升级原因原文，按原值判断
  if (['中字', '中文字幕'].includes(reason?.trim() ?? '')) return 'chinese';
  // i18n-exempt: 服务端给的升级原因原文，按原值判断
  if (['无码', '无码流出', '无码破解'].includes(reason?.trim() ?? '')) return 'uncensored';
  return 'quality';
}

export function ResourceSearch({ initialCode, reason, choose, onSearch, onWork }: {
  initialCode: string; reason?: string; choose(uri: string, code: string): void;
  onSearch?(code: string): void; onWork?(work: DownloadPrefill | null): void;
}) {
  const [code, setCode] = useState(initialCode);
  const [goal, setGoal] = useState(() => preferredGoal(reason));
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [searched, setSearched] = useState('');
  const [selected, setSelected] = useState('');
  const action = useAction();
  const metadataRequest = useRef<AbortController | null>(null);
  useEffect(() => () => metadataRequest.current?.abort(), []);
  const search = () => {
    if (!code.trim() || action.busy) return;
    const query = new URLSearchParams({ code: code.trim(), goal });
    if (min) query.set('min_size', String(Math.round(Number(min) * 1024 ** 3)));
    if (max) query.set('max_size', String(Math.round(Number(max) * 1024 ** 3)));
    setResult(null);
    setSelected('');
    const requested = code.trim();
    onSearch?.(requested);
    metadataRequest.current?.abort();
    void action.run('search', (signal) => apiGet<Result>(`/api/resources/search?${query}`, signal), (next) => {
      setResult(next);
      setSearched(requested);
    });
    if (onWork) {
      const controller = new AbortController();
      metadataRequest.current = controller;
      void apiGet<MediaPage>(`/api/items?jav=1&q=${encodeURIComponent(requested)}&limit=10`, controller.signal).then(page => {
        if (controller.signal.aborted) return;
        const item = (page.items || []).find(row => sameWorkCode(row.code, requested));
        onWork(item ? { code: item.code, title: String(item.catalog_title || item.name || ''), performers: item.performers ? joinList(item.performers) : undefined,
          release_date: String(item.release_date || ''), duration: item.duration, studio: item.studio,
          cover: item.has_cover ? coverUrl(item, true) : '', origin: `asset:${item.id}` } : null);
      }, () => { if (!controller.signal.aborted) onWork(null) });
    }
  };
  return (
    <section aria-label={t('manage:resourceSearch.searchTorrents')} aria-busy={Boolean(action.busy)} className="flex min-w-0 flex-col gap-4">
      {reason ? <Help>{t('manage:resourceSearch.goal', { reason })}</Help> : null}
      <Input label={t('manage:resourceSearch.byCode')} value={code} maxLength={80} placeholder={t('manage:resourceSearch.placeholder')} enterKeyHint="search"
        leadingIcon={action.busy ? SearchSpinner : RiSearchLine}
        isReadOnly={Boolean(action.busy)} aria-busy={Boolean(action.busy)} onChange={setCode} onKeyDown={(event) => {
          if (event.key === 'Enter' && !composingKey(event.nativeEvent)) { event.preventDefault(); search() }
        }} />
      <div className="flex flex-col gap-1">
        <FieldLabel>{t('manage:resourceSearch.prefer')}</FieldLabel>
        <Select aria-label={t('manage:resourceSearch.prefer')} selectedKey={goal} isDisabled={Boolean(action.busy)}
          onSelectionChange={(key) => { if (key !== null) setGoal(String(key)) }}>
          <SelectItem id="quality">{t('manage:resourceSearch.hd')}</SelectItem><SelectItem id="chinese">{t('manage:shared.chineseSubs')}</SelectItem>
          <SelectItem id="uncensored">{t('manage:shared.uncensored')}</SelectItem>
        </Select>
      </div>
      <div className="flex gap-3 max-sm:flex-col">
        <Input label={t('manage:resourceSearch.minSize')} inputMode="decimal" value={min} onChange={setMin} />
        <Input label={t('manage:resourceSearch.maxSize')} inputMode="decimal" value={max} onChange={setMax} />
      </div>
      {action.busy ? <Help role="status">{t('manage:resourceSearch.searching')}</Help> : null}
      {action.error ? <ErrorText>{action.error}</ErrorText> : null}
      {result?.error ? <Help role="status">{codedText(result, 'error')}</Help> : null}
      {result?.state === 'ready' && !result.items.length ? <Help role="status">{t('manage:resourceSearch.noResults')}</Help> : null}
      {result ? serverLabelList(result.warnings, result.warning_codes, result.warning_params)
        .map((warning) => <Help key={warning}>{warning}</Help>) : null}
      {result?.items.length ? <ul className="flex min-w-0 flex-col gap-4">
        {result.items.map((item) => <li key={item.id} className="flex min-w-0 flex-col gap-2 border-t border-separator-border pt-4">
          <p className="break-words text-body-2-medium text-text-primary">{item.name}</p>
          <Help>{[item.size > 0 ? `${(item.size / 1024 ** 3).toFixed(2)} GiB` : t('manage:resourceSearch.sizeNotFound'), item.seeders >= 0 ? t('manage:resourceSearch.seeders', { count: item.seeders }) : t('manage:resourceSearch.seedersNotFound'),
            item.resolution ? `${item.resolution}p` : '', item.codec, item.chinese ? t('manage:shared.chineseSubs') : '',
            item.uncensored ? t('manage:shared.uncensored') : ''].filter(Boolean).join(' · ')}
            {item.origins.map(origin => <span key={origin} className="inline-flex items-center gap-1.5"> · <ScrapeSourceLabel source={resourceSourceKey(origin)} label={origin} /></span>)}</Help>
          <div><Button type="button" variant="secondary" onClick={() => {
            choose(item.uri, searched); setSelected(item.id);
          }}>{selected === item.id ? t('manage:resourceSearch.magnetFilled') : t('manage:resourceSearch.useTorrent')}</Button></div>
        </li>)}
      </ul> : null}
    </section>
  );
}
