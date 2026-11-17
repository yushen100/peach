import { useState } from 'react';
import { RiBuildingLine, RiGlobalLine } from '@remixicon/react';
import { siteMarkUrl } from '@peach/legacy/core';

const MARK = 'size-(--icon-inline) shrink-0';

/** 站标图片：行内档尺寸、方角，没登记或取不到时换成同尺寸的地球。采集来源与关注来源共用这一枚。 */
export function MarkImage({ src }: { src: string }) {
  const [failed, setFailed] = useState('');
  if (!src || failed === src) return <RiGlobalLine aria-hidden className={MARK} />;
  return <img src={src} alt="" width={16} height={16} loading="lazy" onError={() => setFailed(src)}
    className={`${MARK} rounded-none object-contain`} />;
}

/** 采集来源的站标由本站缓存或随应用提供的静态资源承载。 */
export function SiteMark({ source, linkId, domain }: { source: string; linkId?: never; domain?: never }
  | { linkId: number | undefined; source?: never; domain?: never }
  | { domain: string; source?: never; linkId?: never }) {
  if (source === 'makers') return <RiBuildingLine aria-hidden className={MARK} />;
  if (domain) return <MarkImage src={siteMarkUrl({ domain })} />;
  if (linkId === undefined && !source) return <MarkImage src="" />;
  const bundled = source && ['javten', 'fc2ppvdb', 'avwikidb', 'minnano-av', 'github'].includes(source);
  return <MarkImage src={linkId !== undefined ? `/link-mark?id=${linkId}` : bundled ? `/site-icon/${source}.png` : siteMarkUrl({ source: source! })} />;
}
