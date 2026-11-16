import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachHoldToConfirm, HOLD_CONFIRM_MS } from '../src/ui-kit/hold-to-confirm';

let dispose: () => void;
let pageHidden = false;
beforeEach(() => {
  vi.useFakeTimers();
  pageHidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => pageHidden);
});
afterEach(() => {
  dispose?.();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup() {
  const button = document.createElement('button');
  button.textContent = '删除记录';
  document.body.append(button);
  const action = vi.fn();
  button.addEventListener('click', action);
  dispose = attachHoldToConfirm(button);
  return { button, action };
}

function pointer(button: HTMLButtonElement, type: string, patch: PointerEventInit = {}) {
  button.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, isPrimary: true, ...patch }));
}

describe('长按确认', () => {
  it('普通点击和提前松开不执行，完整按满两秒只执行一次', () => {
    const { button, action } = setup();
    button.click();
    expect(action).not.toHaveBeenCalled();
    pointer(button, 'pointerdown');
    vi.advanceTimersByTime(HOLD_CONFIRM_MS - 1);
    expect(action).not.toHaveBeenCalled();
    pointer(button, 'pointerup');
    vi.advanceTimersByTime(1);
    expect(action).not.toHaveBeenCalled();
    pointer(button, 'pointerdown');
    vi.advanceTimersByTime(HOLD_CONFIRM_MS);
    expect(action).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(HOLD_CONFIRM_MS);
    pointer(button, 'pointerup');
    button.click();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it.each(['pointerleave', 'pointercancel'])('%s 取消后再次按下从零计时', (event) => {
    const { button, action } = setup();
    pointer(button, 'pointerdown');
    vi.advanceTimersByTime(1400);
    pointer(button, event);
    pointer(button, 'pointerdown');
    vi.advanceTimersByTime(1400);
    expect(action).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it.each(['Enter', ' '])('按住 %s 两秒执行，重复 keydown 和释放不重复执行', (key) => {
    const { button, action } = setup();
    button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    vi.advanceTimersByTime(1000);
    button.dispatchEvent(new KeyboardEvent('keydown', { key, repeat: true, bubbles: true, cancelable: true }));
    vi.advanceTimersByTime(1000);
    expect(action).toHaveBeenCalledTimes(1);
    button.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
    button.click();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('失焦、页面隐藏、控件忙碌和移除都取消待执行动作', async () => {
    const { button, action } = setup();
    pointer(button, 'pointerdown');
    window.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(HOLD_CONFIRM_MS);
    pointer(button, 'pointerdown');
    pageHidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(HOLD_CONFIRM_MS);
    pageHidden = false;
    pointer(button, 'pointerdown');
    button.setAttribute('aria-busy', 'true');
    await Promise.resolve();
    vi.advanceTimersByTime(HOLD_CONFIRM_MS);
    button.removeAttribute('aria-busy');
    pointer(button, 'pointerup');
    pointer(button, 'pointerdown');
    button.remove();
    vi.advanceTimersByTime(HOLD_CONFIRM_MS);
    expect(action).not.toHaveBeenCalled();
  });

  it('禁用、非主指针、鼠标右键和 Alt 点击都不启动', () => {
    const { button, action } = setup();
    button.disabled = true;
    pointer(button, 'pointerdown');
    pointer(button, 'pointerup');
    button.disabled = false;
    pointer(button, 'pointerdown', { isPrimary: false });
    pointer(button, 'pointerdown', { button: 2 });
    pointer(button, 'pointerdown', { altKey: true });
    vi.advanceTimersByTime(HOLD_CONFIRM_MS);
    expect(action).not.toHaveBeenCalled();
    expect(button.hasAttribute('data-holding')).toBe(false);
  });

  it('解绑取消计时并恢复普通点击与原有说明', () => {
    const { button, action } = setup();
    pointer(button, 'pointerdown');
    dispose();
    vi.advanceTimersByTime(HOLD_CONFIRM_MS);
    expect(action).not.toHaveBeenCalled();
    expect(button.hasAttribute('data-hold-confirm')).toBe(false);
    expect(button.hasAttribute('aria-description')).toBe(false);
    button.click();
    expect(action).toHaveBeenCalledTimes(1);
  });
});
