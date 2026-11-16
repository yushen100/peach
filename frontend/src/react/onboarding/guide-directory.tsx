import { useState, type ReactNode } from 'react';
import type { RemixiconComponentType } from '@remixicon/react';
import { RiArrowRightSLine, RiBookmarkLine, RiCompass3Line, RiFolderLine, RiSearchLine, RiPlayCircleLine, RiSettings3Line, RiPaletteLine, RiRssLine, RiDatabase2Line, RiUser3Line, RiFilmLine, RiBarChartLine, RiDownloadCloudLine, RiSmartphoneLine, RiToolsLine, RiEyeLine, RiPulseLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { InputBase, TextField } from '@/components/base/input/input';
import { cx } from '@/utils/cx';
import { GUIDE_CHAPTERS, GUIDE_TOPICS, type GuideChapter } from '../../onboarding/guide-catalog';
import { guideChapterComplete, type GuideProgress } from '../../onboarding/guide-state';
import { RiCheckboxCircleLine } from '@remixicon/react';
import { Disclosure } from '../settings/section';
import { EmptyState } from '../components/empty-state';
import { t } from '../../i18n';

type Glyph = RemixiconComponentType;
const ICONS: Record<string, Glyph> = {
  browse: RiSearchLine, collect: RiBookmarkLine, watch: RiPlayCircleLine, manage: RiFolderLine,
  experience: RiPaletteLine, discovery: RiRssLine, storage: RiDatabase2Line, system: RiSettings3Line,
};
const CHAPTER_ICONS: Record<string, Glyph> = {
  basics: RiCompass3Line, 'find-play': RiSearchLine, entities: RiUser3Line, jav: RiFilmLine,
  save: RiBookmarkLine, follow: RiRssLine, insights: RiBarChartLine, viewing: RiPlayCircleLine,
  devices: RiSmartphoneLine, external: RiDownloadCloudLine, maintenance: RiToolsLine,
  appearance: RiPaletteLine, playback: RiPlayCircleLine, content: RiEyeLine,
  'search-settings': RiSearchLine, 'jav-settings': RiFilmLine, subscriptions: RiRssLine,
  library: RiDatabase2Line, downloads: RiDownloadCloudLine, network: RiSmartphoneLine,
  'app-maintenance': RiToolsLine, diagnostics: RiPulseLine,
};
export function ChapterIcon({ chapter, className = 'size-5' }: { chapter: string; className?: string }) {
  const Icon = CHAPTER_ICONS[chapter] || RiCompass3Line;
  return <Icon aria-hidden className={cx(className, 'shrink-0')} />;
}

/** 三条学习路径共用同一标题、图标和行动区。不套卡面：教程窗口底色就是 `--ground`，
 *  填充卡和它同色，只剩一圈看不见的内边距把内容推离页签和搜索框的左缘。
 *  上下各让出一截，和页签、下方搜索框分开；行动键一律靠左，三个页签同一位置。 */
export function GuideBanner({ icon: Icon, title, description, children, completed = false }: {
  icon: Glyph; title: string; description: string; children: ReactNode; completed?: boolean;
}) {
  return <section data-guide-banner="" data-guide-completed={completed || undefined} className="flex min-w-0 flex-col gap-4 pt-3 pb-4" aria-label={title}>
    <div className="flex items-start gap-3"><span className="peach-guide-topic-icon"><Icon aria-hidden className="size-5" /></span><div className="flex min-w-0 flex-col gap-1"><h3 className="text-title-2-medium text-text-primary">{title}</h3><p className="text-body-2-regular text-text-secondary">{description}</p></div></div>
    <div className="flex flex-wrap items-center gap-3">{children}</div>
  </section>;
}

function ChapterRow({ chapter, progress, loading, start }: {
  chapter: GuideChapter; progress: GuideProgress; loading: boolean; start(chapter: GuideChapter, resume: boolean): void;
}) {
  const completed = guideChapterComplete(progress, chapter);
  const resume = !completed && Boolean(progress.chapters[chapter.id]);
  return <button type="button" disabled={loading} data-guide-completed={completed || undefined} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left outline-none hover:bg-background-tertiary-default focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-wait" onClick={() => start(chapter, resume)}>
    <span className="peach-guide-topic-icon"><ChapterIcon chapter={chapter.id} /></span>
    <span className="flex min-w-0 flex-1 flex-col gap-1"><strong className="text-body-medium text-text-primary">{chapter.title}</strong><span className="text-body-2-regular text-text-secondary">{chapter.summary}</span></span>
    {completed ? <CompletedLabel /> : <span className="shrink-0 text-caption-1-regular tabular-nums text-text-secondary">{t(resume ? 'onboarding:guideDirectory.resumeStepCount' : 'onboarding:guideDirectory.stepCount', { count: chapter.steps.length })}</span>}
    <RiArrowRightSLine aria-hidden className="size-(--icon-inline) shrink-0 text-text-secondary" />
  </button>;
}

function CompletedLabel() {
  return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-notification-success-background px-2 py-1 text-caption-1-medium text-notification-success-foreground"><RiCheckboxCircleLine aria-hidden className="size-4" /><span data-copy-key="guide.chapter.completed">{t('onboarding:shared.completed')}</span></span>;
}

export function GuideDirectory({ kind, query, setQuery, context, progress, loading, start }: {
  kind: GuideChapter['kind']; query: string; setQuery(value: string): void; context: GuideChapter; progress: GuideProgress; loading: boolean;
  start(chapter: GuideChapter, resume: boolean): void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const quick = GUIDE_CHAPTERS.find(item => item.id === (kind === 'interface' ? 'basics' : 'appearance'))!;
  const completed = guideChapterComplete(progress, quick);
  const resume = !completed && Boolean(progress.chapters[quick.id]);
  const search = query.trim().toLowerCase();
  const matches = GUIDE_CHAPTERS.filter(item => item.kind === kind && `${item.title} ${item.summary} ${item.steps.map(step => `${step.title} ${step.body} ${(step.details || []).flat().join(' ')}`).join(' ')}`.toLowerCase().includes(search));
  return <div className="flex flex-col gap-4">
    <GuideBanner completed={completed} icon={kind === 'interface' ? RiCompass3Line : RiSettings3Line} title={kind === 'interface' ? t('onboarding:guideDirectory.interfaceTitle') : t('onboarding:guideDirectory.settingsTitle')} description={kind === 'interface' ? t('onboarding:guideDirectory.interfaceSummary', { count: quick.steps.length }) : t('onboarding:guideDirectory.settingsSummary')}>
      <Button variant={completed ? 'secondary' : 'primary'} disabled={loading} onClick={() => start(quick, resume)}><span data-copy-key={`guide.${kind}.${loading ? 'loading' : completed ? 'replay' : resume ? 'resume' : 'start'}`}>{loading ? t('onboarding:guideDirectory.preparing') : completed ? t('onboarding:guideDirectory.replay') : kind === 'interface' ? resume ? t('onboarding:guideDirectory.resumeQuickTour') : t('onboarding:guideDirectory.startQuickTour') : resume ? t('onboarding:guideDirectory.resumeSettingsTour') : t('onboarding:guideDirectory.learnSettings')}</span></Button>
      {completed ? <CompletedLabel /> : null}
    </GuideBanner>
    <TextField aria-label={t('onboarding:guideDirectory.searchLabel')} value={query} onChange={setQuery}><InputBase type="search" placeholder={kind === 'settings' ? t('onboarding:guideDirectory.searchSettings') : t('onboarding:guideDirectory.searchFeatures')} leadingIcon={RiSearchLine} /></TextField>
    {!search ? <>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-body-medium text-text-primary">{t('onboarding:guideDirectory.byTopic')}</h3>
        {context.kind === kind && context.id !== 'basics' ? <Button variant="ghost" size="small" disabled={loading} onClick={() => start(context, false)}>{t('onboarding:guideDirectory.currentPageTour', { title: context.title })}</Button> : null}
      </div>
      <div className="peach-guide-topics">{GUIDE_TOPICS.filter(topic => topic.kind === kind).map(topic => {
        const Icon = ICONS[topic.id];
        return <div key={topic.id} data-guide-topic={topic.id} className="peach-guide-topic">
          <Disclosure trailing isOpen={expanded === topic.id} onOpenChange={open => setExpanded(open ? topic.id : null)} summary={<span className="flex min-w-0 items-center gap-3"><span className="peach-guide-topic-icon"><Icon aria-hidden className="size-5" /></span><span className="flex min-w-0 flex-col gap-1"><span className="text-body-medium text-text-primary">{topic.title}</span><span className="text-body-2-regular text-text-secondary">{topic.summary}</span></span></span>}>
            <div className="peach-guide-topic-chapters">{topic.chapters.map(id => <ChapterRow key={id} chapter={GUIDE_CHAPTERS.find(item => item.id === id)!} progress={progress} loading={loading} start={start} />)}</div>
          </Disclosure>
        </div>;
      })}</div>
    </> : matches.length ? <div className="peach-guide-chapters">{matches.map(item => <ChapterRow key={item.id} chapter={item} progress={progress} loading={loading} start={start} />)}</div>
      : <EmptyState icon={RiSearchLine} title={t('onboarding:guideDirectory.noMatches')} size="compact">{t('onboarding:guideDirectory.noMatchesHint')}</EmptyState>}
  </div>;
}
