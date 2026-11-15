/** 语言写法只用于标签。查询、路由和写入始终使用调用方持有的原始名称与 ID。 */
export type NameLanguage = 'zh-CN' | 'ja';
export interface NameWriting {
  id: number; kind: string; canonical_name: string; zh_cn: string | null; ja: string | null; en?: string | null;
}
const names = new Map<string, NameWriting>();
const identities = new Map<string, NameWriting>();
const spellings = new Map<string, Map<number, NameWriting>>();
let glyphs: Record<string, string> = {};
const listeners = new Set<() => void>();
let language: NameLanguage = 'zh-CN';
let revision = 0;
const notify = () => { revision++; listeners.forEach(listener => listener()) };
export const nameRevision = () => revision;
export const subscribeNames = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } };
export const nameLanguage = () => language;
export function setNameLanguage(value: NameLanguage): void {
  if (language === value) return;
  language = value;
  notify();
}
export function registerNameWritings(rows: NameWriting[], sharedGlyphs: Record<string, string> = {}): void {
  names.clear(); identities.clear(); spellings.clear();
  glyphs = sharedGlyphs;
  for (const row of rows) indexNameWriting(row);
  notify();
}
function indexNameWriting(row: NameWriting): void {
  // 单人资料投影（`name_display.current`）不带罗马字：刷新一个人的写法不能丢掉形状总表交付过的 `en`。
  const previous = identities.get(`${row.kind}/${row.id}`);
  const merged = previous?.en && !row.en ? { ...row, en: previous.en } : row;
  identities.set(`${merged.kind}/${merged.id}`, merged);
  names.set(`${merged.kind}/${merged.canonical_name}`, merged);
  for (const name of [merged.zh_cn, merged.ja]) {
    if (!name) continue;
    const key = `${merged.kind}/${name}`;
    const candidates = spellings.get(key) || new Map<number, NameWriting>();
    candidates.set(merged.id, merged);
    spellings.set(key, candidates);
  }
}
export function registerNameWriting(row: NameWriting): void {
  indexNameWriting(row);
  notify();
}
export function entityWriting(kind: string, name: string, id?: number | null): NameWriting | undefined {
  const byId = id ? identities.get(`${kind}/${id}`) : undefined;
  if (byId && [byId.canonical_name, byId.zh_cn, byId.ja].includes(name)) return byId;
  const key = `${kind}/${name}`;
  const canonical = names.get(key);
  if (canonical) return canonical;
  const candidates = spellings.get(key);
  return id ? candidates?.get(id) : candidates?.size === 1 ? candidates.values().next().value : undefined;
}
export function entityDisplayName(kind: string, name: string, id?: number | null): string {
  const row = entityWriting(kind, name, id);
  if (language === 'ja') return row?.ja || name;
  if (row?.zh_cn) return row.zh_cn;
  if ((kind !== 'performer' && kind !== 'creator') || !/^[\p{Script=Han}々\s]+$/u.test(name)) return name;
  const written: string[] = [];
  // i18n-exempt: 日文人名里的叠字符号，是名字内容
  for (const char of name) written.push(char === '々' ? written.at(-1) || char : glyphs[char] || char);
  return written.join('');
}
