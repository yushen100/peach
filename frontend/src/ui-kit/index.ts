/* 共享控件导出清单：Application 与 React 页面按 @peach/legacy/ui 或源码路径引用。
 * 别名直接指向本文件，控件随 peach-app.js 发出一份，类型检查也读同一清单。
 * 独立页面包仅将用到的控件直接打进自己的产物。 */
export { attachOverlayScrollbar } from './overlay-scrollbar';
export { growCollapse, setCollapseOpen, setCollapseRegionOpen, wireCollapse } from './collapse';
export { closeAnchoredMenu, dismissMenu, presentMenu, scrollMovesAnchor, wireAnchoredMenu } from './anchored-menu';
export { MEDIA_SOURCE_ICONS } from './media-source-icons';
export {
  badgeHtml, boardTabsHtml, checkboxHtml, collectionHeaderHtml, emptyStateHtml, LOAD_MORE_STATUS, noteHtml,
  searchInputHtml, spinnerHtml,
} from './markup';
export { activityMotionHtml, activityStatusHtml, type ActivityKind, type ActivitySize } from './activity-motion';
export { dissolveValue, iconSwapHtml, popBadges, popCount, revealTexts, rollPlaceholder, setIconSwap, swapText } from './motion';
export {
  configurationSkeletonHtml, fillSkeletonTier, fitSkeleton, indexSkeletonHtml, revealSkeleton, SKELETON_REVEAL_DELAY,
  skeletonHtml,
} from './skeleton';
export { gateSweep, releaseSweep } from './sweep-gate';
export {
  afterGlide, cancelGlide, glideEase, moveGlidePane, rubberBand, scrollerHtml, stopAutoScroll, wireAutoScroll, wireHorizontalScroller,
  observeScrollRegions, wireOverlayScrollbars, wireScrollers,
} from './scroll';
export {
  dialSliderHtml, iconSwitchHtml, setActionBusy, wireBusyActions, wireContextCard, wireDialSlider, wireDragReorder,
  wireIconSwitch,
} from './controls';
export { confirmModal, formModal } from './modal';
export { attachHoldToConfirm } from './hold-to-confirm';
