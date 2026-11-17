import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/utils/cx';
import { PillTabList } from './pill-tabs';
import { useHorizontalScroller } from './use-horizontal-scroller';
import './section-toc.css';

export interface TocEntry {
  id: string;
  label: string;
  icon?: ReactNode;
}

/** 单页目录沿用管理页的导航外观，链接和滚动位置指向仍挂载的正文分区。 */
export function SectionToc({ label, entries, children }: {
  label: string; entries: readonly TocEntry[]; children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const scrollRef = useHorizontalScroller<HTMLElement>();
  const [active, setActive] = useState(entries[0]?.id ?? '');
  const ids = JSON.stringify(entries.map(entry => entry.id));

  useEffect(() => {
    let frame = 0;
    const sections = (JSON.parse(ids) as string[])
      .map(id => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));
    const update = () => {
      frame = 0;
      let current = sections[0]?.id ?? '';
      for (const section of sections) {
        const offset = parseFloat(getComputedStyle(section).scrollMarginTop)
          + parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
        if (section.getBoundingClientRect().top <= offset + 1) current = section.id;
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        current = sections.at(-1)?.id ?? current;
      }
      setActive(current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) };
    const target = document.getElementById(location.hash.slice(1));
    if (target && root.current?.contains(target)) target.scrollIntoView({ block: 'start' });
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const resize = new ResizeObserver(schedule);
    resize.observe(root.current!);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [ids]);

  useEffect(() => {
    const nav = root.current?.querySelector<HTMLElement>('nav');
    const link = nav?.querySelector<HTMLElement>('[aria-current]');
    if (!nav || !link) return;
    if (link.offsetTop < nav.scrollTop) nav.scrollTop = link.offsetTop;
    else if (link.offsetTop + link.offsetHeight > nav.scrollTop + nav.clientHeight) {
      nav.scrollTop = link.offsetTop + link.offsetHeight - nav.clientHeight;
    }
    if (link.offsetLeft < nav.scrollLeft) nav.scrollLeft = link.offsetLeft;
    else if (link.offsetLeft + link.offsetWidth > nav.scrollLeft + nav.clientWidth) {
      nav.scrollLeft = link.offsetLeft + link.offsetWidth - nav.clientWidth;
    }
  }, [active]);

  return <div ref={root} data-section-page="">
    <nav ref={scrollRef} aria-label={label} data-section-toc="">
      <PillTabList data-section-toc-items="" data-pill-nav="">
        {entries.map(entry => <a key={entry.id} href={`#${entry.id}`}
          aria-current={active === entry.id ? 'location' : undefined}
          data-pill-selected={active === entry.id ? '' : undefined} data-pill-variant="gray"
          className={cx('relative z-1 flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-body-regular text-text-secondary',
            'outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring',
            active === entry.id && 'text-text-primary')}>
          {entry.icon}<span>{entry.label}</span>
        </a>)}
      </PillTabList>
    </nav>
    <div data-toc-content="" className="flex min-w-0 flex-col gap-8">{children}</div>
  </div>;
}
