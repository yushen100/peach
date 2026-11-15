/* 批量动作的统一契约：先弹确认、弹窗写明能否撤销、做完给回执，能撤回的回执带撤销；
 * 浮条只收声明齐全的写入键，缺确认或缺撤销方式当场报错。 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runBulkAction, type BulkAction } from '../../src/react/components/bulk-action';
import { SelectionDock } from '../../src/react/components/selection-dock';
import { buttonNamed, click, mountRoot, settle } from './render';

// 测试配置把 `@peach/legacy/ui` 换成了一律取消的桩；这里要看真实弹窗的正文与按钮。
vi.mock('@peach/legacy/ui', async (original) => ({
  ...await original<typeof import('@peach/legacy/ui')>(),
  confirmModal: (await import('../../src/ui-kit/modal')).confirmModal,
}));

afterEach(() => document.body.replaceChildren());

const dialog = () => document.querySelector('dialog')!;
const accept = () => dialog().querySelector<HTMLButtonElement>('[data-modal-confirm]')!.click();

function action(overrides: Partial<BulkAction<number>> = {}): BulkAction<number> {
  return {
    key: 'mark', label: '标记所选', reversal: 'undo',
    confirm: (items) => ({ title: '标记所选', body: `将标记选中的 ${items.length} 项。` }),
    run: async () => async () => {},
    receipt: (items) => `已标记 ${items.length} 项`,
    ...overrides,
  };
}

describe('runBulkAction', () => {
  it('能撤回的弹窗写「可撤销」，回执带上 run 交回的撤销', async () => {
    const undo = vi.fn(async () => {});
    const receipt = vi.fn();
    const pending = runBulkAction(action({ run: async () => undo }), [1, 2, 3], { receipt });
    await settle();
    expect(dialog().textContent).toContain('将标记选中的 3 项。完成后可在回执里撤销。');
    accept();
    expect(await pending).toBe(true);
    expect(receipt).toHaveBeenCalledWith('已标记 3 项', { undo });
  });

  it('撤不回的弹窗写「不能撤销」，回执不带撤销', async () => {
    const receipt = vi.fn();
    const pending = runBulkAction(action({ reversal: 'irreversible', run: async () => {} }), [1], { receipt });
    await settle();
    expect(dialog().textContent).toContain('不能撤销。');
    accept();
    await pending;
    expect(receipt).toHaveBeenCalledWith('已标记 1 项');
  });

  it('声明能撤销却没交回撤销函数：弹窗不关，原因留在正文下面', async () => {
    const pending = runBulkAction(action({ run: async () => {} }), [1], { receipt: vi.fn() });
    await settle();
    accept();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(dialog().open).toBe(true);
    expect(dialog().textContent).toContain('returned no undo');
    dialog().querySelector<HTMLButtonElement>('[data-modal-cancel]')!.click();
    expect(await pending).toBe(false);
  });
});

describe('SelectionDock', () => {
  it('写入键缺撤销方式时拒绝渲染', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { ...action(), reversal: undefined } as unknown as BulkAction<unknown>;
    await expect(mountRoot(<SelectionDock label="批量" count="已选 1 项" visible
      actions={[{ action: broken, items: [1], host: { receipt: vi.fn() } }]} />)).rejects.toThrow(/how to undo/);
  });

  it('写入键点下去先弹确认，取消不写入', async () => {
    const run = vi.fn(async () => async () => {});
    const { host } = await mountRoot(<SelectionDock label="批量" count="已选 2 项" visible
      actions={[{ action: action({ run }) as BulkAction<unknown>, items: [1, 2], host: { receipt: vi.fn() } }]} />);
    await click(buttonNamed('标记所选', host));
    expect(dialog().textContent).toContain('将标记选中的 2 项。');
    dialog().querySelector<HTMLButtonElement>('[data-modal-cancel]')!.click();
    await settle();
    expect(run).not.toHaveBeenCalled();
  });
});
