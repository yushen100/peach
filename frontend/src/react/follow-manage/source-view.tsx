/* 一条关注来源在屏幕上的那几格：站标、头像、状态徽章、来源名。
 *
 * 创作者卡片、表格视图和别名清单读的是同一份，所以这几格摆在这里而不是各画一次：
 * 同一条来源在两种视图里的状态写法一旦分开写，就会出现同一行在卡片里说「未检查」、
 * 在表格里说「正常」。 */
import { useLayoutEffect, useRef, useState } from 'react';
import { RiExternalLinkLine } from '@remixicon/react';

import { Chip } from '@/components/base/badges/chip';
import { Button } from '@/components/base/buttons/button';

import { MarkImage } from '../components/site-mark';

import {
  authorAvatar, authorInitial, errorHeadline, isBroken, sourceIconUrl, statusText,
  type FollowSource,
} from './follow-manage';
import { t } from '../../i18n';

/** 关注来源的站标，尺寸与回退和采集来源站标同一枚；站名由旁边的文字或外层的读屏文字说。 */
export function SourceIcon({ provider }: { provider: string }) {
  return <MarkImage src={sourceIconUrl(provider)} />;
}

/** 创作者圆标：官方来源的头像优先，归档来源回退，都取不到就用首字母。
 *
 * 首字母取自创作者名而不是某条来源的标签——那会切出「初」「一」这类和创作者无关的字。 */
export function AuthorAvatar({ group, name }: { group: FollowSource[]; name: string }) {
  const { src, fallback } = authorAvatar(group);
  const [at, setAt] = useState(0);
  const chain = [src, fallback].filter(Boolean);
  const current = chain[at];
  if (!current) {
    return (
      <span title={t('follow:sourceView.noAvatar')}
        className="inline-grid size-8 shrink-0 place-items-center rounded-full bg-media-placeholder text-caption-1-semibold text-text-secondary">
        {authorInitial(name)}
      </span>
    );
  }
  return (
    <img src={current} alt="" width={32} height={32} loading="lazy" referrerPolicy="no-referrer"
      onError={() => setAt(at + 1)}
      className="size-8 shrink-0 rounded-full bg-media-placeholder object-cover" />
  );
}

/** 状态徽章。三档颜色对应三件事：要处理的、正常的、还没有结论的。 */
export function StatusBadge({ source }: { source: FollowSource }) {
  const color = !source.enabled || source.history_exhausted ? 'gray' : isBroken(source) ? 'rose'
    : source.enabled && source.last_status === 'ok' ? 'lime'
    : source.enabled ? 'yellow' : 'gray';
  return <Chip variant="caption" color={color}>{statusText(source)}</Chip>;
}

/** 来源名连到站上的原页面，名字后跟外链字形。新标签页不继承这一页的会话，来源地址也不带走 Peach 自己的地址。 */
export function SourceLink({ source }: { source: FollowSource }) {
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer" title={t('follow:sourceView.openSource')}
      className="max-w-full min-w-0 self-start text-body-medium wrap-anywhere text-text-primary underline-offset-2 hover:underline">
      {source.label}
      <RiExternalLinkLine aria-hidden className="size-(--icon-inline) shrink-0" />
    </a>
  );
}

/** 一条报错：列表里只露一行（`errorHeadline`），放不下就截断；多于这一行或被截了时给「查看详情」原地展开全文。
 *  来源的上次检查、JAV 入库的刮削失败都用它，后端常回整页 HTML 或整段 traceback。 */
export function ErrorLine({ text, prefix = '', tone = 'error' }: { text: string; prefix?: string; tone?: 'error' | 'muted' }) {
  const line = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);
  const head = errorHeadline(text);
  useLayoutEffect(() => {
    const node = line.current;
    if (!node || open) return undefined;
    const measure = () => setCut(node.scrollWidth > node.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [head, open]);
  const more = cut || head !== String(text || '').trim();
  return (
    <span className="flex min-w-0 max-w-full flex-col items-start gap-0.5">
      <small ref={line} data-error-line=""
        className={`max-w-full text-caption-1-regular ${tone === 'error' ? 'text-text-error-primary' : 'text-text-secondary'} ${open ? 'whitespace-pre-line wrap-anywhere' : 'block truncate'}`}>
        {prefix}{open ? text : head}
      </small>
      {more ? (
        <Button variant="ghost" size="small" data-error-line-toggle="" data-error-details-toggle="" aria-expanded={open} className="-ml-2"
          onClick={() => setOpen(!open)}>
          {open ? t('follow:sourceView.hideDetails') : t('follow:sourceView.showDetails')}
        </Button>
      ) : null}
    </span>
  );
}
