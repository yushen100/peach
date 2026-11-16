import { afterEach, expect, it, vi } from 'vitest';
import { confirmModal } from '../src/ui-kit';

afterEach(() => { document.querySelectorAll('dialog[open]').forEach(dialog => (dialog as HTMLDialogElement).close()); document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks() });
it('确认清单逐条呈现文件名，文件名保持纯文本', async () => {
  const names = ['作品一.mp4', '<img src=x onerror=alert(1)>.mp4'];
  const pending = confirmModal({title:'清理记录',body:'清理 2 项',items:names,confirmLabel:'清理记录'});
  const list = document.querySelector('dialog ul')!;
  expect([...list.children].map(item => item.textContent)).toEqual(names);
  expect(list.querySelector('img')).toBeNull();
  expect(list.getAttribute('tabindex')).toBe('0');
  document.querySelector<HTMLButtonElement>('[data-modal-cancel]')!.click();
  expect((await pending).confirmed).toBe(false);
});
it('危险操作聚焦取消，取消不写入，关闭归还焦点', async () => {
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
  const write = vi.fn();
  const pending = confirmModal({title:'清理记录',body:'清理 2 项',confirmLabel:'清理记录',danger:true,onConfirm:write});
  const cancel = document.querySelector<HTMLButtonElement>('[data-modal-cancel]')!;
  expect(document.activeElement).toBe(cancel);
  const dialog = document.querySelector('dialog')!;
  expect(dialog.getAttribute('role')).toBe('alertdialog');
  expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toBe('清理 2 项');
  cancel.click();
  expect((await pending).confirmed).toBe(false);
  expect(write).not.toHaveBeenCalled(); expect(document.activeElement).toBe(trigger);
});
it('等待写入时阻止重复提交和关闭，失败保留弹层可重试', async () => {
  let reject!: (error: Error) => void;
  const write = vi.fn().mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })).mockResolvedValueOnce('done');
  const pending = confirmModal({title:'清理记录',body:'清理 2 项',confirmLabel:'清理记录',onConfirm:write});
  const dialog = document.querySelector('dialog')!;
  const accept = dialog.querySelector<HTMLButtonElement>('[data-modal-confirm]')!;
  accept.click(); accept.click();
  dialog.querySelector<HTMLButtonElement>('[data-modal-cancel]')!.click();
  const escape = new Event('cancel', {cancelable: true}); dialog.dispatchEvent(escape);
  expect(escape.defaultPrevented).toBe(true); expect(dialog.open).toBe(true); expect(write).toHaveBeenCalledTimes(1);
  reject(new Error('磁盘离线')); await new Promise(resolve => setTimeout(resolve, 0));
  expect(dialog.textContent).toContain('磁盘离线'); expect(dialog.open).toBe(true);
  accept.click(); expect((await pending).result).toBe('done'); expect(write).toHaveBeenCalledTimes(2);
});

it('同一弹窗提供三个范围，每个按钮长按两秒只执行对应范围', async () => {
  vi.useFakeTimers();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const write = vi.fn().mockResolvedValue('done');
  const pending = confirmModal({ title:'删除',body:'请选择范围',confirmLabel:'删除',danger:true,
    choices:['profile','trash','purge'].map(key => ({ key,label:key,description:`范围 ${key}`,
      danger:true,holdToConfirm:true,onConfirm:() => write(key) })) });
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-modal-confirm]')];
  expect(buttons.map(button => button.dataset.modalConfirm)).toEqual(['profile','trash','purge']);
  expect(document.activeElement).toBe(document.querySelector('[data-modal-cancel]'));
  buttons[0]!.click();
  buttons[0]!.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,isPrimary:true,pointerId:1}));
  await vi.advanceTimersByTimeAsync(1000);
  buttons[0]!.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1}));
  await vi.advanceTimersByTimeAsync(1000);
  expect(write).not.toHaveBeenCalled();
  buttons[1]!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  await vi.advanceTimersByTimeAsync(1999);
  expect(write).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(write).toHaveBeenCalledExactlyOnceWith('trash');
  expect(await pending).toEqual({confirmed:true,result:'done',choice:'trash'});
});

it('危险弹窗点击遮罩会关闭并取消未完成的长按', async () => {
  vi.useFakeTimers();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const write = vi.fn().mockResolvedValue('done');
  const pending = confirmModal({title:'删除',body:'删除所选',confirmLabel:'删除',danger:true,
    holdToConfirm:true,onConfirm:write});
  const dialog = document.querySelector('dialog')!;
  dialog.querySelector('button[data-modal-confirm]')!.dispatchEvent(new KeyboardEvent('keydown',
    {key:' ',bubbles:true,cancelable:true}));
  await vi.advanceTimersByTimeAsync(1000);
  dialog.click();
  await vi.advanceTimersByTimeAsync(2000);
  expect(await pending).toEqual({confirmed:false});
  expect(write).not.toHaveBeenCalled();
});
