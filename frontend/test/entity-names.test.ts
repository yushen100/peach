import { beforeEach, describe, expect, it } from 'vitest';
import {
  entityDisplayName, nameLanguage, nameScript, registerNameWriting, registerNameWritings,
  setNameLanguage, setNameLocale, type NameWriting,
} from '../src/core/entity-names';

const writing: NameWriting = {
  id: 1, kind: 'performer', canonical_name: '枫花恋', zh_cn: '枫花恋', ja: '楓カレン',
};

beforeEach(() => { registerNameWritings([]); setNameLanguage('zh-CN'); setNameLocale('zh-CN') });

describe('实体名称的只读显示投影', () => {
  it('同一艺名的已核对日文署名可显示中文，不把历史艺名换为现名', () => {
    registerNameWritings([writing]);
    expect(entityDisplayName('performer', '楓カレン', 1)).toBe('枫花恋');
    expect(entityDisplayName('performer', '楓カレン')).toBe('枫花恋');
    expect(entityDisplayName('performer', '田中レモン', 1)).toBe('田中レモン');
    setNameLanguage('ja');
    expect(entityDisplayName('performer', '枫花恋', 1)).toBe('楓カレン');
  });

  it('共享写法不能在未取得身份时选中另一人，显式身份仍使用各自来源', () => {
    registerNameWritings([writing, { ...writing, id: 2, canonical_name: '另一艺名', zh_cn: '另一写法' }]);
    expect(entityDisplayName('performer', '楓カレン')).toBe('楓カレン');
    expect(entityDisplayName('performer', '楓カレン', 1)).toBe('枫花恋');
    expect(entityDisplayName('performer', '楓カレン', 2)).toBe('另一写法');
  });
  it('原始纯汉字署名使用服务端字形表，未绑定艺名也不漏掉简体显示', () => {
    const glyphs = { 宮: '宫', 澤: '泽', 寧: '宁', 鈴: '铃' };
    registerNameWritings([], glyphs);
    expect(entityDisplayName('performer', '宮澤寧音')).toBe('宫泽宁音');
    expect(entityDisplayName('performer', '山田鈴奈')).toBe('山田铃奈');
    expect(entityDisplayName('creator', '宮澤寧音')).toBe('宫泽宁音');
    expect(entityDisplayName('performer', '宮澤かな')).toBe('宮澤かな');
    expect(entityDisplayName('performer', 'Rin 鈴')).toBe('Rin 鈴');
    expect(entityDisplayName('studio', '宮澤寧音')).toBe('宮澤寧音');
    setNameLanguage('ja');
    expect(entityDisplayName('performer', '宮澤寧音')).toBe('宮澤寧音');
    expect(glyphs).toEqual({ 宮: '宫', 澤: '泽', 寧: '宁', 鈴: '铃' });
    registerNameWritings([]);
    setNameLanguage('zh-CN');
    expect(entityDisplayName('performer', '宮澤寧音')).toBe('宮澤寧音');
  });
  it('切换显示语言保留原始名称、身份和来源对象', () => {
    const original = { ...writing };
    registerNameWritings([original]);
    expect(entityDisplayName('performer', '枫花恋', 1)).toBe('枫花恋');
    setNameLanguage('ja');
    expect(entityDisplayName('performer', '枫花恋', 1)).toBe('楓カレン');
    expect(original).toEqual(writing);
  });

  it('同一身份下其他艺名不会被替换为当前统称，人物与创作者分开索引', () => {
    registerNameWriting(writing);
    setNameLanguage('ja');
    expect(entityDisplayName('performer', '田中柠檬', 1)).toBe('田中柠檬');
    expect(entityDisplayName('creator', '枫花恋', 1)).toBe('枫花恋');
  });

  it('缺少已核对的写法时保留原名', () => {
    registerNameWriting({ ...writing, zh_cn: null });
    expect(entityDisplayName('performer', '枫花恋', 1)).toBe('枫花恋');
  });

  it('刷新资料集合清除过期名称，但保留用户的语言偏好', () => {
    registerNameWritings([writing]);
    setNameLanguage('ja');
    registerNameWritings([]);
    expect(nameLanguage()).toBe('ja');
    expect(entityDisplayName('performer', '枫花恋', 1)).toBe('枫花恋');
  });

  it('罗马音与两种写法并列：本地语言跟界面语言走，括号随界面语言', () => {
    registerNameWritings([{ ...writing, en: 'Karen Kaide' }]);
    setNameLanguage('en');
    expect(entityDisplayName('performer', '枫花恋', 1)).toBe('Karen Kaide');
    setNameLanguage('ja-local');
    expect(entityDisplayName('performer', '枫花恋', 1)).toBe('楓カレン（枫花恋）');
    setNameLanguage('local-ja');
    expect(entityDisplayName('performer', '楓カレン', 1)).toBe('枫花恋（楓カレン）');
    setNameLocale('en');
    expect(entityDisplayName('performer', '楓カレン', 1)).toBe('Karen Kaide (楓カレン)');
    setNameLanguage('ja-local');
    expect(entityDisplayName('performer', '枫花恋', 1)).toBe('楓カレン (Karen Kaide)');
  });

  it('没有对应写法时退回原文，名字不丢、不重复括注', () => {
    registerNameWritings([writing, { id: 2, kind: 'performer', canonical_name: '篠田ゆう', zh_cn: null, ja: '篠田ゆう' }]);
    setNameLanguage('en');
    expect(entityDisplayName('performer', '枫花恋', 1)).toBe('楓カレン');
    expect(entityDisplayName('studio', 'S1 NO.1 STYLE')).toBe('S1 NO.1 STYLE');
    setNameLanguage('ja-local');
    expect(entityDisplayName('performer', '篠田ゆう', 2)).toBe('篠田ゆう');
    setNameLocale('en');
    expect(entityDisplayName('performer', '枫花恋', 1)).toBe('楓カレン');
    setNameLanguage('local-ja');
    expect(entityDisplayName('performer', '枫花恋', 1)).toBe('楓カレン');
    expect(entityDisplayName('performer', '无人认领的名字')).toBe('无人认领的名字');
  });

  it('别名分组与名字菜单只有中日两套：中文界面下本地语言在前用中文那套', () => {
    expect(nameScript()).toBe('zh-CN');
    for (const [value, script] of [['ja', 'ja'], ['en', 'ja'], ['ja-local', 'ja'], ['local-ja', 'zh-CN']] as const) {
      setNameLanguage(value);
      expect(nameScript(), value).toBe(script);
    }
    setNameLocale('en');
    expect(nameScript()).toBe('ja');
  });
});
