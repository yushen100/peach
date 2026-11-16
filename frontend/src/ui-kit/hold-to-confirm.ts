import { t } from '../i18n';
import './hold-to-confirm.css';

export const HOLD_CONFIRM_MS = 2000;

/** 按满两秒才派发一次点击，松开、移出、失焦或控件忙碌时取消。 */
export function attachHoldToConfirm(button: HTMLButtonElement): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pointer: number | null = null;
  let key: string | null = null;
  let confirmedClick = false;
  const description = button.getAttribute('aria-description');
  const title = button.getAttribute('title');
  const instruction = t('shell:holdToConfirm.instruction');
  button.dataset.holdConfirm = '';
  button.setAttribute('aria-description', instruction);
  button.title = title ? `${title}\n${instruction}` : instruction;

  const available = () => button.isConnected && !button.disabled
    && button.getAttribute('aria-disabled') !== 'true'
    && button.getAttribute('aria-busy') !== 'true' && !document.hidden;
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    delete button.dataset.holding;
  };
  const start = () => {
    if (!available() || timer !== undefined) return;
    button.dataset.holdReset = '';
    // 每次按下都从零开始，快速重新按下也要完成完整的两秒。
    void getComputedStyle(button, '::after').clipPath;
    delete button.dataset.holdReset;
    button.dataset.holding = '';
    timer = setTimeout(() => {
      if (!available()) { cancel(); return; }
      timer = undefined;
      confirmedClick = true;
      try { button.click(); }
      finally { confirmedClick = false; delete button.dataset.holding; }
    }, HOLD_CONFIRM_MS);
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || !event.isPrimary || event.altKey || pointer !== null) return;
    pointer = event.pointerId;
    start();
  };
  const up = (event: PointerEvent) => {
    if (pointer !== event.pointerId) return;
    pointer = null;
    cancel();
  };
  const leave = () => { pointer = null; cancel(); };
  const keyDown = (event: KeyboardEvent) => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    if (event.repeat || key || event.altKey) return;
    key = event.key;
    start();
  };
  const keyUp = (event: KeyboardEvent) => {
    if (event.key !== key) return;
    event.preventDefault();
    key = null;
    cancel();
  };
  const click = (event: MouseEvent) => {
    if (confirmedClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const blur = () => { pointer = null; key = null; cancel(); };
  const visibility = () => { if (document.hidden) blur(); };
  const contextMenu = (event: Event) => event.preventDefault();
  const observer = new MutationObserver(() => { if (!available()) blur(); });
  observer.observe(button, { attributes: true, attributeFilter: ['disabled', 'aria-disabled', 'aria-busy'] });
  button.addEventListener('pointerdown', down);
  button.addEventListener('pointerleave', leave);
  button.addEventListener('keydown', keyDown);
  button.addEventListener('keyup', keyUp);
  button.addEventListener('click', click, true);
  button.addEventListener('blur', blur);
  button.addEventListener('contextmenu', contextMenu);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  window.addEventListener('blur', blur);
  document.addEventListener('visibilitychange', visibility);
  return () => {
    blur();
    observer.disconnect();
    button.removeEventListener('pointerdown', down);
    button.removeEventListener('pointerleave', leave);
    button.removeEventListener('keydown', keyDown);
    button.removeEventListener('keyup', keyUp);
    button.removeEventListener('click', click, true);
    button.removeEventListener('blur', blur);
    button.removeEventListener('contextmenu', contextMenu);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    window.removeEventListener('blur', blur);
    document.removeEventListener('visibilitychange', visibility);
    delete button.dataset.holdConfirm;
    delete button.dataset.holdReset;
    if (description === null) button.removeAttribute('aria-description');
    else button.setAttribute('aria-description', description);
    if (title === null) button.removeAttribute('title');
    else button.title = title;
  };
}
