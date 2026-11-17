import { MEDIA_SOURCE_ICONS } from '@peach/legacy/ui';
import { SourceMark } from '../settings/section';
import { SiteMark } from './site-mark';

const sourceLocation = (source: string) => source.startsWith('clouddrive:') ? source.split(':')[1]! : source;
const sourceIcons = Object.fromEntries(Object.entries(MEDIA_SOURCE_ICONS).map(([source, mark]) => [source,
  function ProviderIcon({ className }: { className?: string }) {
    return <span className={className}><SourceMark mark={mark} /></span>;
  },
] as const));
function CloudIcon({ className }: { className?: string }) {
  return <span className={className}><SourceMark mark="database" /></span>;
}
export const providerIcon = (source: string) => sourceIcons[sourceLocation(source)] ?? CloudIcon;

export function SiteIcon({ site }: { site: string }) {
  return site === 'javdb' || site === 'dmm' ? <SiteMark source={site} />
    : <SiteMark domain={site === 'missav' ? 'missav.com' : site} />;
}

/** 站点标识经本站缓存读取。javdb 与 dmm 是采集来源，用随应用提供的站标；文字放不下时截断，
 *  不压到后面的外链图标上。 */
export function SiteLabel({ site, label }: { site: string; label: string }) {
  return <span className="inline-flex min-w-0 items-center gap-1.5">
    <SiteIcon site={site} />
    <span className="min-w-0 truncate">{label}</span>
  </span>;
}

/** 采集来源（`scraping_access.SOURCES` 的键）带站标的站名；取不到站标退回地球图标。 */
export function ScrapeSourceLabel({ source, label }: { source: string; label: string }) {
  return <span className="inline-flex min-w-0 items-center gap-1.5">
    <SiteMark source={source} />
    <span className="min-w-0 truncate">{label}</span>
  </span>;
}

/** 网盘与本地来源共用已登记的标识。 */
export function SourceLabel({ source, label }: { source: string; label: string }) {
  const location = sourceLocation(source);
  return <span className="inline-flex min-w-0 items-center gap-1.5">
    <SourceMark mark={MEDIA_SOURCE_ICONS[location] || (location === 'local' ? 'hard-drive' : 'database')} />
    <span className="min-w-0 truncate">{label}</span>
  </span>;
}
