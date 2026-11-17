import { useLayoutEffect, useRef, useState } from 'react';
import { middleTruncateCut } from '../../ui-kit/middle-truncate';
import { ComparisonText } from '../review/comparison-text';

/** 文件名按实际宽度中间截断，差异高亮与完整名称由 React 保留。 */
export function FilenameComparison({ value, reference, onOpen }: {
  value: string; reference?: string; onOpen(): void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const [cut, setCut] = useState<{ start: number; end: number } | null>(null);
  useLayoutEffect(() => {
    const node = button.current;
    if (!node) return undefined;
    let live = true;
    const measure = () => {
      if (!live) return;
      const next = middleTruncateCut(node, value);
      setCut(current => current?.start === next?.start && current?.end === next?.end ? current : next);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    if (node.parentElement) observer?.observe(node.parentElement);
    void document.fonts?.ready.then(measure);
    return () => { live = false; observer?.disconnect() };
  }, [value]);
  return <button ref={button} type="button" onClick={onOpen} title={value} aria-label={value}
    data-middle-truncate="" data-middle-truncate-within="" data-middle-truncate-managed=""
    onCopy={event => { event.clipboardData.setData('text/plain', value); event.preventDefault() }}
    className="min-w-0 shrink cursor-pointer truncate text-left text-body-regular hover:text-text-secondary">
    <ComparisonText value={value} reference={reference} cut={cut} />
  </button>;
}
