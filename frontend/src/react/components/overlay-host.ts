/* 弹层该挂到哪个容器里。
 *
 * 默认那一个在 `body` 末尾（`providers.tsx` 的 `overlayContainer`），对整页 island 够用。
 * 详情浮窗不是：舞台用 `showModal()` 开一个原生 `<dialog>`，而顶层元素排在所有 z-index
 * 之上——弹层落在 `body` 上就被详情页整个盖住，再大的 z-index 也压不过顶层，而盖住的样子
 * 和「弹层没画出来」在屏幕上看不出区别。所以弹层挂进那个已打开的 dialog；找不到就还是 `body`。
 * 舞台在自己那一层统一给出这个容器（`stage.tsx` 的 `UNSAFE_PortalProvider`），详情里的
 * 弹层、下拉与气泡不必各自包一层。
 *
 * token、Preflight 与焦点规则都作用在 `.peach-react` 上，所以容器自己带这个类。
 * 每个 dialog 复用同一个容器，弹层关掉之后它留在那儿，下一次不必再建。
 */
function hostIn(parent: HTMLElement): HTMLElement {
  const existing = parent.querySelector<HTMLElement>(':scope > [data-react-overlays]');
  if (existing) return existing;
  const host = parent.ownerDocument.createElement('div');
  host.className = 'peach-react';
  host.dataset.reactOverlays = '';
  parent.append(host);
  return host;
}

/** 弹层挂到最近的详情浮窗或偏好设置面板，页面级弹层挂到 body。 */
export function overlayHost(node: Element | null | undefined): HTMLElement {
  const document = node?.ownerDocument ?? globalThis.document;
  const modal = node?.closest('dialog[open], [data-settings-panel]:not([hidden])');
  return hostIn((modal as HTMLElement | null) ?? document.body);
}

const LAYER = '[role="dialog"],[role="listbox"],[role="menu"]';

/** 挂在 `modal` 里最上面那层弹层的对话框、列表或菜单；没有开着的层时为 `null`。
 *  容器里还有焦点范围的哨兵等非弹层节点，按从后往前取第一个是层或含层的子元素。 */
export function topOverlay(modal: HTMLElement): HTMLElement | null {
  const host = modal.querySelector(':scope > [data-react-overlays]');
  for (let node = host?.lastElementChild; node; node = node.previousElementSibling) {
    const layer = node.matches(LAYER) ? node as HTMLElement : node.querySelector<HTMLElement>(LAYER);
    if (layer) return layer;
  }
  return null;
}

/** 全站 Toast 栈（`#toasts`）跟着模态 dialog 进出：传开着的 dialog 就挪进去，传 `null` 放回 `body`。
 *  栈留在 `body` 上时被顶层的详情浮窗整个盖住，回执发了也看不见；挪进 dialog 才在它之上，
 *  也不落进模态 dialog 之外那片 inert 区，「撤销」照样点得到。dialog 卸掉之前必须先放回，
 *  否则栈跟着 dialog 一起离开文档。 */
export function adoptToasts(modal: HTMLDialogElement | null): void {
  const host = document.getElementById('toasts');
  const parent = modal?.open ? modal : document.body;
  if (host && host.parentElement !== parent) parent.append(host);
}
