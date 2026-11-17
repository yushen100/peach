import { useMemo } from 'react';
import { diffChars } from 'diff';

/** 差异只影响展示；保留来源文字、空白和 Unicode 字符，不参与采用资料的请求。 */
type Cut = { start: number; end: number };
type Part = { value: string; added?: boolean };

function visibleParts(parts: Part[], cut?: Cut | null): Part[] {
  if (!cut) return parts;
  const before: Part[] = [], after: Part[] = [];
  let position = 0;
  for (const part of parts) {
    const head = part.value.slice(0, Math.max(0, cut.start - position));
    const tail = part.value.slice(Math.max(0, cut.end - position));
    if (head) before.push({ ...part, value: head });
    if (tail) after.push({ ...part, value: tail });
    position += part.value.length;
  }
  return [...before, { value: '…', added: false }, ...after];
}

export function ComparisonText({ value, reference, cut }: { value: string; reference?: string; cut?: Cut | null }) {
  const parts = useMemo(() => reference
    ? diffChars(reference, value).filter(part => !part.removed)
    : [{ value, added: false }], [value, reference]);
  return <>{visibleParts(parts, cut).map((part, index) => part.added
    ? <mark key={index} data-review-difference=""
        className="rounded-sm bg-status-yellow-background text-status-yellow-text">{part.value}</mark>
    : <span key={index}>{part.value}</span>)}</>;
}
