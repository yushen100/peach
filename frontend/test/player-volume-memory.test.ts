import { afterEach, describe, expect, it } from 'vitest';
import { mountVolumeMemory, savedVolume } from '../src/player/volume-memory';

const KEY = 'peach.player-volume.v1';

function video(volume = 1) {
  const element = document.createElement('video');
  let current = volume;
  Object.defineProperty(element, 'volume', { configurable: true, get: () => current, set: (next: number) => { current = next } });
  const change = (next: number) => { current = next; element.dispatchEvent(new Event('volumechange')) };
  return { element, change };
}

describe('音量记忆', () => {
  afterEach(() => localStorage.clear());

  it('新播放器从上次调过的音量起播，恢复本身不回写', () => {
    localStorage.setItem(KEY, '0.35');
    const { element } = video();
    const cleanup = new AbortController();
    mountVolumeMemory(element, cleanup.signal);
    expect(element.volume).toBe(0.35);
    localStorage.setItem(KEY, '0.8');           // 另一个标签页刚改过
    element.dispatchEvent(new Event('volumechange'));
    expect(localStorage.getItem(KEY)).toBe('0.8');
    cleanup.abort();
  });

  it('用户调音量时记下，0 不记，播放器销毁后不再写', () => {
    const { element, change } = video();
    const cleanup = new AbortController();
    mountVolumeMemory(element, cleanup.signal);
    expect(element.volume).toBe(1);
    change(0.4);
    expect(savedVolume()).toBe(0.4);
    change(0);
    expect(savedVolume()).toBe(0.4);
    cleanup.abort();
    change(0.9);
    expect(savedVolume()).toBe(0.4);
  });

  it('恢复事件到达前用户已经改过音量时按用户的值记', () => {
    localStorage.setItem(KEY, '0.5');
    const { element, change } = video();
    const cleanup = new AbortController();
    mountVolumeMemory(element, cleanup.signal);
    change(0.2);
    expect(savedVolume()).toBe(0.2);
    cleanup.abort();
  });

  it.each(['abc', '0', '-1', '2', ''])('存的值不合法（%s）时保持原音量', raw => {
    localStorage.setItem(KEY, raw);
    const { element } = video(0.7);
    const cleanup = new AbortController();
    mountVolumeMemory(element, cleanup.signal);
    expect(element.volume).toBe(0.7);
    cleanup.abort();
  });
});
