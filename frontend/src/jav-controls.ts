/** JAV 卡片页的壳入口；选择集由当前页面持有，不混入馆藏资产 ID。 */
export const JAV_SELECTION_EVENT = 'peach:jav-selection';
export function javCardPage(path: string, search: string) {
  return path === '/jav' && ['releases', 'discover'].includes(new URLSearchParams(search).get('tab') || '');
}

/** 右上角多选开关在哪几个 JAV 页签上生效：卡片两页之外，「想要」也是浏览页，进多选模式后才显示勾选。 */
export function javSelectPage(path: string, search: string) {
  return path === '/jav' && ['releases', 'discover', 'wants'].includes(new URLSearchParams(search).get('tab') || '');
}
