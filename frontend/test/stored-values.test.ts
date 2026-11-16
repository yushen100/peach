/* 账本取值是英文 id，界面按语言显示；旧书签里的中文参数读入时换成 id（ADR-0162）。 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SETTINGS_KEY } from '../src/settings-key';

async function load(language: 'en' | 'zh-CN') {
  vi.resetModules();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ interfaceLanguage: language }));
  return import('../src/core/stored-values');
}

afterEach(() => {
  localStorage.removeItem(SETTINGS_KEY);
  vi.resetModules();
});

describe('地址参数', () => {
  it('旧书签里的中文画幅与时长档换成 id，新 id 与空值原样', async () => {
    const { lengthParam, orientParam } = await load('zh-CN');
    expect(orientParam('竖屏')).toBe('portrait');
    expect(orientParam('横屏')).toBe('landscape');
    expect(orientParam('portrait')).toBe('portrait');
    expect(orientParam(null)).toBe('');
    expect(lengthParam('速食')).toBe('quick');
    expect(lengthParam('长')).toBe('long');
    expect(lengthParam('medium')).toBe('medium');
    expect(lengthParam(undefined)).toBe('');
  });
});

describe('显示名', () => {
  it('中文界面', async () => {
    const { linkLabel, orientLabel } = await load('zh-CN');
    expect(orientLabel('portrait')).toBe('竖屏');
    expect(orientLabel('landscape')).toBe('横屏');
    expect(linkLabel('official-site')).toBe('官方网站');
    expect(linkLabel('blog')).toBe('博客');
    expect(linkLabel('official-archive:2022-05')).toBe('官网存档（2022-05）');
    expect(linkLabel('blog:旬の果実')).toBe('博客 旬の果実');
    expect(linkLabel('catalog-page:KMP')).toBe('KMP 作品页');
  });

  it('英文界面按 id 取译文，专名原样', async () => {
    const { linkLabel, orientLabel } = await load('en');
    expect(orientLabel('portrait')).toBe('Vertical');
    expect(orientLabel('landscape')).toBe('Horizontal');
    expect(orientLabel('')).toBe('');
    expect(linkLabel('official-site')).toBe('Official site');
    expect(linkLabel('blog')).toBe('Blog');
    expect(linkLabel('T-POWERS')).toBe('T-POWERS');
    expect(linkLabel(undefined)).toBe('');
  });

  it('带专名的通用链接名把专名代进译文，冒号前不认识的照原文', async () => {
    const { linkLabel } = await load('en');
    expect(linkLabel('official-blog')).toBe('Official blog');
    expect(linkLabel('official-archive:2022-05')).toBe('Official site archive (2022-05)');
    expect(linkLabel('blog:旬の果実')).toBe('Blog: 旬の果実');
    expect(linkLabel('series-page:TeamSkeet')).toBe('TeamSkeet series page');
    expect(linkLabel('Note: 12')).toBe('Note: 12');
  });
});
