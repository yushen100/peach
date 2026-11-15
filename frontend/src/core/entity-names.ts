/** 语言写法只用于标签。查询、路由和写入始终使用调用方持有的原始名称与 ID。
 *  显示方式五种：中文化（译名）、日语原文、英文（罗马音）、日语原文（本地语言）、本地语言（日语原文）。
 *  本地语言跟界面语言走：中文界面是译名，日文界面是原文，其余界面是罗马音。没有对应写法时退回原文。 */
export type NameLanguage = 'zh-CN' | 'ja' | 'en' | 'ja-local' | 'local-ja';
export const NAME_LANGUAGES: readonly NameLanguage[] = ['zh-CN', 'ja', 'en', 'ja-local', 'local-ja'];
export interface NameWriting {
  id: number; kind: string; canonical_name: string; zh_cn: string | null; ja: string | null; en?: string | null;
}
const names = new Map<string, NameWriting>();
const identities = new Map<string, NameWriting>();
const spellings = new Map<string, Map<number, NameWriting>>();
let glyphs: Record<string, string> = {};
const listeners = new Set<() => void>();
let language: NameLanguage = 'zh-CN';
let locale = 'zh-CN';
let revision = 0;
const notify = () => { revision++; listeners.forEach(listener => listener()) };
export const nameRevision = () => revision;
export const subscribeNames = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } };
export const nameLanguage = () => language;
/** 别名分组与名字菜单只有中文、日文两套（服务端 `name_display`）：中文化与中文界面下的「本地语言在前」用中文那套，其余用日文那套。 */
export const nameScript = (): 'zh-CN' | 'ja' =>
  language === 'zh-CN' || (language === 'local-ja' && locale.startsWith('zh')) ? 'zh-CN' : 'ja';
/** 界面语言，决定「本地语言」取哪种写法与括号样式；启动时由偏好控制器交进来。 */
export function setNameLocale(value: string): void {
  if (locale === value) return;
  locale = value;
  notify();
}
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
function translated(kind: string, name: string, row: NameWriting | undefined): string {
  if (row?.zh_cn) return row.zh_cn;
  if ((kind !== 'performer' && kind !== 'creator') || !/^[\p{Script=Han}々\s]+$/u.test(name)) return name;
  const written: string[] = [];
  // i18n-exempt: 日文人名里的叠字符号，是名字内容
  for (const char of name) written.push(char === '々' ? written.at(-1) || char : glyphs[char] || char);
  return written.join('');
}
/** 界面语言下的写法；取不到返回空串，由调用方退回原文。 */
function local(kind: string, name: string, row: NameWriting | undefined): string {
  if (locale.startsWith('zh')) return translated(kind, name, row);
  if (locale === 'ja') return row?.ja || name;
  return row?.en || '';
}
/** 两种写法并排：后一种和前一种相同或取不到时只留前一种；中文界面用全角括号。 */
function paired(first: string, second: string): string {
  if (!second || second === first) return first;
  // i18n-exempt: 中文界面并列两种写法用的全角括号是标点，不是文案
  return locale.startsWith('zh') ? `${first}（${second}）` : `${first} (${second})`;
}
export function entityDisplayName(kind: string, name: string, id?: number | null): string {
  const row = entityWriting(kind, name, id);
  const original = row?.ja || name;
  if (language === 'ja') return original;
  if (language === 'en') return row?.en || original;
  if (language === 'ja-local') return paired(original, local(kind, name, row));
  if (language === 'local-ja') return paired(local(kind, name, row) || original, original);
  return translated(kind, name, row);
}
