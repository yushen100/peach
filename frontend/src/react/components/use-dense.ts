import { useSyncExternalStore } from 'react';

/* 卡片密度由外观层写在 `<body data-density>` 上（`appearance/density.ts`），顶栏那颗键一按就换。 */
function subscribe(notify: () => void) {
  const observer = new MutationObserver(notify);
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-density'] });
  return () => observer.disconnect();
}
const dense = () => document.body.dataset.density === 'dense';

/** 现在是不是紧凑档：卡上的动作键跟着换小一档。 */
export const useDense = () => useSyncExternalStore(subscribe, dense, () => false);
