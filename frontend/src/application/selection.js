import { selectionSurface, selectionDock, setSelectionMode, toggleSelection as toggleSelected } from '../react/catalog-grid/selection-controller';
import { JAV_SELECTION_EVENT, javSelectPage } from '../jav-controls';
import { pageSelectionActive, togglePageSelection } from '../react/components/page-selection';
import { selectSurface } from '../shell';
/* selection 域控制器：本域状态与动作，启动由 Application 的生命周期统一安装。 */
import { loadCatalog, pushGridPage } from './catalog.js';
import { followLastSelectedId, followSelected, lastSelectedId, pageOpens, selectMode, selected, state, writeShell } from './../shell/index';
import { photoViewActive, pushEntityPage, setPhotoSize } from './entity.js';
import { pushFollowFeed } from './follow.js';
import { batchDockApi, loadBatchDock } from '../react/application-residents';
import { censorOn, preferencesState } from './preferences.js';
import { configureHoverPreview, releaseHoverPreviews } from './../card-art/hover';
import { $, api } from '../core';
import { loadingState } from './loading.js';
import { applicationEffects } from './effects';
import { confirmModal, formModal, setActionBusy } from '../ui-kit';
import { reloadAfterWrite } from './layout.js';
import { receiptsState } from './receipts.js';
import { photoSize } from './../appearance/layout';
import { applyDensity, toggleDensity } from './../appearance/density';
import { installCardArt, refitNativeImages, upgradeCover } from './../card-art/framing';
import { t } from '../i18n';
import { queryClient } from '../react/query';
import { batchAction } from '../react/batch-dock/batch-dock-api';
import { confirmBody } from '../react/components/bulk-action';
export const selectionState = { batchDockProps: undefined, trashCount: undefined, currentSelectSurface: undefined, REGION_CHOICES: undefined, BATCH_RUNNERS: undefined, coverRecheck: undefined };

export function paintSelection(){
  // 卡片网格、垃圾队列与关注页的选中态归 React：每次推一份新的集合，卡片按引用比较才看得出变了。
  pushGridPage({selected:new Set(selected),selectMode});
  pushEntityPage({selected:new Set(selected),followSelected:new Set(followSelected),selectMode});
  pushFollowFeed({selected:new Set(followSelected),selectMode});
  /* 底部浮条归常驻组件 `batch-dock`（`react/batch-dock/`）：壳推计数与语境，每种语境列哪几颗键由它按语境定。 */
  selectionState.batchDockProps=selectionDockProps();
  /* 浮条宿主在 `#main` 外面，玻璃贴图的观察器看不到它长出来，画完补扫一遍。 */
  if(batchDockApi()){batchDockApi().render(selectionState.batchDockProps);preferencesState.syncGlassOptics()}
}

export function setSelectMode(on,clear=false) {
    writeShell(setSelectionMode({selected,followSelected},selectionSnapshot(),selectionSurface(location.pathname,location.search),!!on,clear));
    document.body.classList.toggle('select-mode',selectMode);
    if(selectMode)releaseHoverPreviews();
    $('#selectMode').setAttribute('aria-pressed',String(selectMode));paintSelection();
  }

export function visibleCardIds(){return [...loadingState.gridCards()].map(card=>+card.dataset.id)}

export function toggleSelection(id,range=false) {
    writeShell(toggleSelected({selected,followSelected},selectionSnapshot(),selectionSurface(location.pathname,location.search),visibleCardIds(),id,range));
    setSelectMode(true);
  }

export function visibleFollowIds(){return [...document.querySelectorAll('[data-follow-list] > [data-follow-item]')]
  .map(card=>+card.dataset.followItem)}

export function toggleFollowSelection(id,range=false) {
    writeShell(toggleSelected({selected,followSelected},selectionSnapshot(),'follow',visibleFollowIds(),id,range));
    setSelectMode(true);
  }

/* 浮条上每颗键的确认文案与撤销方式都在 `batch-dock-api.ts` 声明；这里照声明弹窗、写入、回执。 */
function declaredAction(operation){
  const {context,junkDismissed}=selectionState.batchDockProps;
  const action=batchAction(context,operation,junkDismissed);
  if(!action?.confirm||!action.reversal)throw new Error(`batch action ${operation} is not declared`);
  return action;
}

function declaredConfirm(action,count){
  return {title:action.confirm.title,confirmLabel:action.confirm.title,danger:action.reversal==='irreversible'&&!!action.danger,
    holdToConfirm:!!action.holdToConfirm,
    body:confirmBody(action.confirm.body(count),action.reversal,action.confirm.recovery)};
}

export async function runCatalogBatch(operation,button){
  const done={like:'shell:batchCatalog.doneLike',seen:'shell:batchCatalog.doneSeen',later:'shell:batchCatalog.doneLater',dispose:'shell:batchCatalog.doneDispose',restore:'shell:batchCatalog.doneRestore',delete:'shell:batchCatalog.doneDelete'};
  const ids=[...selected];if(!ids.length)return;
  const action=declaredAction(operation);
  return confirmModal({...declaredConfirm(action,ids.length),onConfirm:async()=>{
  setActionBusy(button);
  try{const r=await api('/api/batch',{method:'POST',body:JSON.stringify({ids,operation})});
    if(r.blocked&&r.blocked.length)throw new Error(`${t('shell:trash.partlyPurged', { purged: r.purged, count: r.blocked.length })}\n`
      +r.blocked.slice(0,5).map(x=>t('shell:trash.blockedItem', { path: x.path, reason: x.reason })).join('\n'));
    setSelectMode(false,true);await reloadAfterWrite();
    const inverse=operation==='dispose'?'restore':operation==='restore'?'dispose':
      ['like','seen','later'].includes(operation)?`revert-${operation}`:null;
    receiptsState.actionReceipt(t(done[operation], { count: ids.length }),{undo:action.reversal==='undo'&&inverse?async()=>{
      if(inverse==='dispose'&&r.restored_reasons){
        for(const reason of [null,'manual','junk','duplicate','missing']){
          const group=ids.filter(id=>r.restored_reasons[id]===reason);
          if(group.length)await api('/api/batch',{method:'POST',body:JSON.stringify({ids:group,operation:inverse,disposal_reason:reason})});
        }
      }else await api('/api/batch',{method:'POST',body:JSON.stringify({ids,operation:inverse,
        ...(r.previous?{previous:r.previous}:{})})});
      await reloadAfterWrite();
    }:null})}
  catch(error){setActionBusy(button,false);throw error}
  finally{setActionBusy(button,false);paintSelection()}
  }});
}

export async function pickBatchRegion(){
  const ids=[...selected];if(!ids.length)return;
  const {body}=declaredConfirm(declaredAction('region'),ids.length);
  const modal=formModal({
    title:t('shell:batchRegion.title'),
    description:body,
    body:`<div class="chips" role="group" aria-label="${t('navigation:sidebarFilters.region')}">`+selectionState.REGION_CHOICES.map(([key,label])=>
      `<button type="button" class="chip" aria-pressed="false" data-region-pick="${key}">
        <span class="chip-label">${label}</span></button>`).join('')+`</div>`,
    confirmLabel:t('shell:batchRegion.title'),
    confirmDisabled:true,
    onConfirm:async()=>{
      const picked=modal.dialog.querySelector('[data-region-pick][aria-pressed="true"]');
      if(!picked)throw new Error(t('shell:batchRegion.pickFirst'));
      await api('/api/batch',{method:'POST',
        body:JSON.stringify({ids,operation:'region',region:picked.dataset.regionPick})});
      return {region:picked.dataset.regionPick,label:picked.textContent.trim()};
    }});
  modal.dialog.querySelectorAll('[data-region-pick]').forEach(chip=>applicationEffects.handler(chip, 'onclick', ()=>{
    modal.dialog.querySelectorAll('[data-region-pick]').forEach(other=>
      other.setAttribute('aria-pressed',String(other===chip)));
    modal.confirmButton.disabled=false;
  }));
  const {confirmed,result}=await modal.done;
  if(!confirmed)return;
  setSelectMode(false,true);await reloadAfterWrite();
  receiptsState.actionReceipt(result.region==='none'
    ? t('shell:batchRegion.cleared', { count: ids.length }) : t('shell:batchRegion.set', { region: result.label, count: ids.length }));
}

export async function runFollowBatch(action,button){
  const items=[...followSelected];if(!items.length)return;
  const done={save:'shell:batchFollow.doneSave',seen:'shell:batchFollow.doneSeen',ignored:'shell:batchFollow.doneIgnored'};
  const declared=declaredAction(action);
  /* 关注页按地址重读；资料页的在线视图读的是同一族查询（`['follow-feed']`），让它们失效重取。 */
  const reload=()=>{if(location.pathname==='/follow')writeShell({pageOpens:pageOpens+1});else void queryClient.invalidateQueries({queryKey:['follow-feed']})};
  return confirmModal({...declaredConfirm(declared,items.length),onConfirm:async()=>{
  setActionBusy(button);
  try{
    const path=action==='save'?'/api/follow/save':'/api/follow/status';
    const body=action==='save'?{items}:{items,to:action};
    const r=await api(path,{method:'POST',body:JSON.stringify(body)});
    // 标记完按地址重读这一页：路由树的关注元素推一个新代次，列表重取、不重挂。
    setSelectMode(false,true);reload();
    receiptsState.actionReceipt(t(done[action], { count: items.length }),{undo:declared.reversal==='undo'&&r.previous?async()=>{
      await api('/api/follow/status',{method:'POST',body:JSON.stringify({items,previous:r.previous})});
      reload();
    }:null});
  }catch(error){setActionBusy(button,false);throw error}
  finally{setActionBusy(button,false);paintSelection()}
  }});
}

export async function runJunkBatch(operation,button){
  const ids=[...selected];if(!ids.length)return;
  const done={'dismiss-junk':'shell:batchJunk.doneNotJunk','reconsider-junk':'shell:batchJunk.doneRecheck',dispose:'shell:batchJunk.doneDispose'};
  const action=declaredAction(operation);
  return confirmModal({...declaredConfirm(action,ids.length),onConfirm:async()=>{
  setActionBusy(button);
  try{
    await api('/api/batch',{method:'POST',body:JSON.stringify({ids,operation,
      ...(operation==='dispose'?{disposal_reason:'junk'}:{})})});
    setSelectMode(false,true);await loadCatalog();
    const inverse=operation==='dispose'?'restore':operation==='dismiss-junk'?'reconsider-junk':
      operation==='reconsider-junk'?'dismiss-junk':null;
    receiptsState.actionReceipt(t(done[operation], { count: ids.length }),{undo:inverse?async()=>{
      await api('/api/batch',{method:'POST',body:JSON.stringify({ids,operation:inverse})});
      await loadCatalog();
    }:null});
  }catch(error){setActionBusy(button,false);throw error}
  finally{setActionBusy(button,false);paintSelection()}
  }});
}

export function mountBatchDock(){
  loadBatchDock({root:$('[data-batch-dock]'),run:(group,operation,button)=>{void selectionState.BATCH_RUNNERS[group]?.(operation,button)}})
    .then(dock=>{dock.render(selectionState.batchDockProps);preferencesState.syncGlassOptics()}).catch(()=>{});
}

export function installSelection11() {
selectionState.batchDockProps = {count:0,context:'catalog',junkDismissed:false};
selectionState.trashCount = null;
selectionState.currentSelectSurface = ()=>selectionSurface(location.pathname,location.search);
applicationEffects.handler($('#selectMode'), 'onclick', ()=>{
  if(javSelectPage(location.pathname,location.search)){window.dispatchEvent(new Event(JAV_SELECTION_EVENT));return}
  if(pageSelectionActive(location.pathname)){togglePageSelection();return}
  setSelectMode(!selectMode,!selectMode?false:true)
});
selectionState.REGION_CHOICES = [['jp',t('shell:region.japan')],['kr',t('shell:region.korea')],['cn',t('shell:region.china')],['west',t('shell:region.western')],
  ['other',t('shell:region.other')],['none',t('shell:region.clear')]];
selectionState.BATCH_RUNNERS = {batch:runCatalogBatch,region:pickBatchRegion,follow:runFollowBatch,junk:runJunkBatch,
  clear:()=>setSelectMode(false,true)};
applicationEffects.handler($('#density'), 'onclick', ()=>{if(photoViewActive()){
    setPhotoSize(photoSize()==='big'?'small':'big');return}
  toggleDensity()});
applyDensity();
configureHoverPreview({
  selecting:()=>selectMode,
  censored:()=>censorOn(),
  enabled:()=>preferencesState.appSettings.hoverPreview,
  delaySeconds:()=>preferencesState.appSettings.hoverDelaySeconds,
});
applicationEffects.listen(window, 'pagehide', ()=>releaseHoverPreviews());
applicationEffects.listen(document, 'visibilitychange', ()=>{if(document.hidden)releaseHoverPreviews()});
installCardArt();
selectionState.coverRecheck = 0;
applicationEffects.listen(window, 'resize', ()=>{
  refitNativeImages($('#index'));
  // 窗口放大后卡片跟着变大，先前够用的派生档可能就不够了；只增不减，换回来的原件留着。
  // 等拖动停下再量：逐张量尺寸要读样式和盒子，跟着每一帧 resize 跑就是一次次强制排版。
  clearTimeout(selectionState.coverRecheck);
  selectionState.coverRecheck=applicationEffects.delay(()=>$('#index').querySelectorAll('img.cover').forEach(img=>{
    if(img.complete)upgradeCover(img)}),200);
}, {passive:true});
}

function selectionSnapshot(){return {selectMode,selectSurface,lastSelectedId,followLastSelectedId}}
export function selectionDockProps(){return selectionDock({selected,followSelected},location.pathname,location.search,state.state)}
