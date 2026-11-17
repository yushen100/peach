import { createRevealSourceAction } from './source-action';
import { completeReveal } from '../react/components/server-path-dialog';
import { emptyEntityFilters, parseEntityFilters, entityFilterSearch, parseMediaView, entityViewSearch } from '../react/entity-page/entity-route';
import { photoViewActive as hasPhotoView } from '../react/entity-page/photo-surface';
import { createEntityApplication } from '../react/entity-page/entity-application';
import { waitEntityShapes } from './loading.js';
/* entity 域控制器：本域状态与动作，启动由 Application 的生命周期统一安装。 */
import { catalogGridLayout, catalogSkeletonHtml, catalogState, comboItems, commitContextFilter, toggleTag } from './catalog.js';
import { nextSortState, sortDirWord } from './../sort-preferences';
import { barsContext, notifyShell, selectMode, selected, state, writeShell } from './../shell/index';
import { $, ENTITY_ROUTES, api, esc, icon, isCatalogPath } from '../core';
import { managedEntry, releaseManagedRoute, updateManagedRoute } from './../history/managed';
import { javActive, scheduleStickySurfaces, setJavLayout, sortOptions, syncHeaderActions } from './layout.js';
import { navigationState, openRoutedPage } from './navigation.js';
import { releaseHoverPreviews } from './../card-art/hover';
import { preferencesState, wireDrag } from './preferences.js';
import { fitSkeleton, formModal, indexSkeletonHtml, wireHorizontalScroller } from '../ui-kit';
import { feedRowHtml, feedState, loadEntityShapes, wireFeedNewRow } from './feed.js';
import { receiptsState } from './receipts.js';
import { JAV_LAYOUTS, PHOTO_LAYOUTS, javLayout, photoLayout, photoSize, storePhotoLayout, storePhotoSize } from './../appearance/layout';
import { dropBars } from './../catalog-bars';
import { indexState, openFollowAuthorFromIndex } from './index.js';
import { followState, pushFollowFeed } from './follow.js';
import { toggleFollowSelection } from './selection.js';
import { applyDensity, paintPhotoSizeButton } from './../appearance/density';
import { applicationEffects } from './effects';
import { entitySkeletonHtml } from './../entity-skeleton';
import { INDEX_TITLES } from './../index-skeleton';
import { FILTER_WAITING, filterControlsSkeletonHtml } from './../filter-controls-skeleton';
import { cardRatio, gridLayout } from './../appearance/layout';
import { islandShortcutsEntry } from './../island-skeleton';
import { catalogContentSkeletonHtml } from '../catalog-content-skeleton';
import { t } from '../i18n';
export const entityState = { ENTITY_FILTER_KEYS: undefined, emptyEntityFilters: undefined, parseEntityFilters: undefined, entityFilterSearch: undefined, cloneBarsContext: undefined, activeFilterState: undefined, entityPageView: undefined, entityPageWall: undefined, entityPageRevision: undefined, entityPageCurrent: undefined, entityPageLive: undefined, EMPTY_ENTITY_MEDIA: undefined, parseMediaView: undefined, entityViewSearch: undefined, entityBodyCanLoadMore: undefined, entityBodySkeleton: undefined, entityPageHelpers: undefined, entityFollowActions: undefined, SOURCE_HINTS: undefined, sourceHint: undefined, syncedText: undefined, sourceToolButtons: undefined, application: undefined };

export function entityPageEntry(){
  const entry=managedEntry($('#index'));
  return entry&&entry.path.endsWith('/*')&&entry.host.isConnected?entry:null;
}

export function pushEntityPage(patch){if(entityState.entityPageCurrent())updateManagedRoute($('#index'),patch)}

export function currentBarsContext(){
  if(barsContext.type==='item')return barsContext;
  // 地址已切回馆藏时，资料页的宿主可能还在等待路由卸载，筛选先按馆藏范围读取。
  if(isCatalogPath(location.pathname)||location.pathname==='/trash')return {type:'home',filters:state};
  const entry=entityPageEntry();
  if(entry){const {kind,name,filters}=entry.props;return {type:'entity',kind,name,filters:{...filters}}}
  return barsContext;
}

export function sortKeys(current,dir,jav=javActive()){
  return sortOptions(jav).map(([key,label])=>{
    const pressed=current===key,next=nextSortState(key,current,dir);
    return {key,label,pressed,dir:pressed&&sortDirWord(key,dir)?(dir==='asc'?'asc':'desc'):'',
      ariaLabel:next?t('shell:entitySort.ariaLabel', { label, direction: next.dir?sortDirWord(next.sort,next.dir):'' }):''}});
}

export function routeEntityPage(kind,name,filters,media=entityState.EMPTY_ENTITY_MEDIA,options={}){
  return entityState.application.route(kind,name,filters,media,options);
}

export function entityPageActions(kind,name){return entityState.application.actions(kind,name)}

export function entityPageProps(kind,name,filters,media){return entityState.application.props(kind,name,filters,media)}

export function photoViewActive(){return hasPhotoView({entityWall:entityState.entityPageWall,
    entityCurrent:entityState.entityPageCurrent(),indexVisible:!$('#index').hidden,pathname:location.pathname,
    followMedia:followState.followMediaView,statsVisible:!$('#stats').hidden},
    ()=>[...document.querySelectorAll('.followphotowall')].some(wall=>wall.getClientRects().length>0))}

export function syncPhotoWalls(){entityState.photos.sync()}

export function syncDensityControl(){
  if(photoViewActive())paintPhotoSizeButton(photoSize());else applyDensity();
}

export function setPhotoSize(value){entityState.photos.setSize(value)}

export const revealSource = createRevealSourceAction({
  request:id=>api('/api/reveal',{method:'POST',body:JSON.stringify({id})}),
  success:()=>receiptsState.toast({text:t('shell:sourceTools.revealed')}),
  complete:completeReveal,
  failureText:error=>entityState.sourceHint(error instanceof Error?error.message:String(error)),
});

export async function revealForIsland(id){const status={textContent:''};await revealSource(id,status);return status.textContent}

export async function syncForIsland(id){
  const status={textContent:''};let removed=[];
  await syncMissing(id,status,result=>{if(result.items)removed=result.items.map(item=>item.id)});
  return {text:status.textContent,removed};
}

export async function syncMissing(id,status,done){
  status.textContent=t('shell:sourceTools.checking');
  try{
    const r=await api('/api/purge-missing',{method:'POST',body:JSON.stringify({id})});
    if(r.ok===false){status.textContent=entityState.sourceHint(r.error);return}
    status.textContent=r.removed
      ? r.unreadable
        ? t('shell:sourceTools.checkedSummaryUnreadable', { summary: entityState.syncedText(r), count: r.checked, unreadable: r.unreadable })
        : t('shell:sourceTools.checkedSummary', { summary: entityState.syncedText(r), count: r.checked })
      : r.unreadable
        ? t('shell:sourceTools.unreadable', { count: r.unreadable })
        : t('shell:sourceTools.allPresent', { count: r.checked });
    if(r.removed){
      const ids=(r.items||[]).filter(item=>item.disposal!=='reattached').map(item=>item.id);
      if(done)done(r);
      receiptsState.actionReceipt(entityState.syncedText(r),{undo:ids.length?async()=>{
        await api('/api/batch',{method:'POST',body:JSON.stringify({ids,operation:'restore'})});
        if(done)done({removed:0,restored:ids.length});
      }:null});
    }else receiptsState.actionReceipt(t('shell:sourceTools.noChanges'));
  }catch(e){status.textContent=entityState.sourceHint(e.message);receiptsState.actionFailure(t('shell:sourceTools.checkAction'),e)}
}

export function sourceTools(id){return `<div class="srctools">${entityState.sourceToolButtons(id)}
    <span class="srcstate" aria-live="polite"></span></div>`}

export function wireSourceTools(root,done){
  const status=root.querySelector('.srcstate');
  if(!status)return;
  const reveal=root.querySelector('[data-reveal]');
  const sync=root.querySelector('[data-sync]');
  if(reveal)applicationEffects.handler(reveal, 'onclick', ()=>revealSource(Number(reveal.dataset.reveal),status,{button:reveal}));
  if(sync)applicationEffects.handler(sync, 'onclick', ()=>syncMissing(Number(sync.dataset.sync),status,done));
}

export async function entityAliasForm(mine,write){
  const form=formModal({
    title:t('shell:entityAlias.add'),
    description:t('shell:entityAlias.hint'),
    body:`<label class="modalfield"><span>${t('shell:entityAlias.fieldLabel')}</span>
        <input class="geist-input" name="alias" maxlength="80" autocomplete="off"
          placeholder="${esc(t('shell:entityAlias.placeholder'))}"></label>`
      +(mine.length?`<div class="modalfield"><span>${t('shell:entityAlias.addedByYou')}</span>
        <div class="aliaschips">${mine.map(one=>`<span class="aliaschip">${esc(one)}
          <button type="button" data-alias-drop="${esc(one)}"
            aria-label="${esc(t('shell:entityAlias.removeNamed', { alias: one }))}">${icon('x')}</button></span>`).join('')}</div></div>`:''),
    confirmLabel:t('shell:entityAlias.add'),
    confirmDisabled:true,
    onConfirm:()=>write({alias:field.value.trim()})});
  const field=form.dialog.querySelector('[name=alias]');
  applicationEffects.handler(field, 'oninput', ()=>{form.confirmButton.disabled=!field.value.trim()});
  /* 撤销只认自己添的那几个：刮削和合并留下的别名是这条实体当初被认成这个人的依据，
     一次点击删不得。服务端按来源守这条线，这里只列它报回来的那几个。 */
  form.dialog.querySelectorAll('[data-alias-drop]').forEach(chip=>applicationEffects.handler(chip, 'onclick', async()=>{
    const gone=chip.dataset.aliasDrop;
    form.close();
    try{await write({alias:gone,remove:true})}
    catch(error){receiptsState.actionFailure(t('shell:entityAlias.removeAction'),error);return}
    receiptsState.actionReceipt(t('shell:entityAlias.removed', { alias: gone }),{undo:async()=>{await write({alias:gone})}});
  }));
  const {confirmed,result}=await form.done;
  if(!confirmed)return undefined;
  /* 撞上另一份档案的别名时别名照常写了，先给回执再由资料页问要不要合并；撞上对方的名字时没写，只交给资料页。 */
  if(result?.added)receiptsState.actionReceipt(t('shell:entityAlias.added', { alias: result.alias }),{undo:async()=>{
    await write({alias:result.alias,remove:true})}});
  else if(!result?.conflict)receiptsState.actionReceipt(t('shell:entityAlias.exists', { alias: result?.alias }));
  return result;
}

export function showEntityLoading(kind,name){
  const jav=['performer','studio'].includes(kind)&&feedState.hasEntityPart(kind,name,'jav');
  const head=`<div data-filter-row="bottom" class="flex min-w-0 items-center gap-3 px-3 py-2 min-h-12"><h3 data-entity-readout><span data-skeleton="count" class="relative inline-block h-3.5 w-24 rounded-md align-middle skeleton-sheen"></span></h3>${islandShortcutsEntry()}${kind==='agency'?'':filterControlsSkeletonHtml(sortKeys(state.sort,state.dir,jav),jav?{name:'jav-layout',label:t('shell:cardLayout.jav'),value:javLayout(),options:JAV_LAYOUTS}:null)}</div>`;
  const top=kind==='agency'?'':`<div data-entity-media><button type="button" data-media-view="videos" aria-label="${t('catalog:shared.videos')}" aria-pressed="true" ${FILTER_WAITING}>${icon('play')}</button><button type="button" data-media-view="photos" data-media-icon="image" aria-label="${t('catalog:entityFilter.photos')}" ${FILTER_WAITING}>${icon('pics')}</button></div><span data-entity-sep></span><div data-entity-scroll><div data-entity-states>${catalogState.catalogViews().map(view=>`<button type="button" data-entity-state="${esc(view.k)}" aria-pressed="${state.state===view.k}" ${FILTER_WAITING}>${esc(view.label)}</button>`).join('')}<span data-entity-sep></span></div>`;
  const body=kind==='agency'
    ?indexSkeletonHtml({kind:'performers',layout:indexState.peopleIndexLayout()})
    :catalogContentSkeletonHtml(t('shell:skeleton.loadingVideos'),cardRatio(gridLayout({active:jav,home:false,portrait:false})));
  const placeholder=entitySkeletonHtml(kind,head,body,top);
  if($('#index').firstElementChild?.dataset.skeleton!==`entity/${kind}`){
    $('#index').innerHTML=placeholder;
    syncEntitySkeletonParts(kind,name);
    fitSkeleton($('#index'));
  }else syncEntitySkeletonParts(kind,name);
}

export function syncEntitySkeletonParts(kind,name){
  const skeleton=$('#index').firstElementChild;
  if(skeleton?.dataset.skeleton!==`entity/${kind}`)return;
  const sync=(present,wanted,insert)=>{if(wanted&&!present)insert();else if(!wanted&&present)present.remove()};
  sync(skeleton.querySelector('.entityfoot'),kind!=='agency'&&feedState.hasEntityPart(kind,name,'costars'),
    ()=>skeleton.querySelector('.entityhero')?.insertAdjacentHTML('beforeend',feedState.costarSkeletonFoot()));
  /* 设置关掉了新作行，骨架也不给它留位。 */
  sync(skeleton.querySelector('.feednew'),preferencesState.appSettings.feedNewRows!==false&&feedState.hasEntityPart(kind,name,'feed'),
    ()=>skeleton.querySelector('.entitysection')?.insertAdjacentHTML('beforebegin',feedState.feedNewSkeletonSection()));
  sync(skeleton.querySelector('.entityfacts'),kind==='performer'&&feedState.hasEntityPart(kind,name,'facts'),
    ()=>skeleton.querySelector('.entityprofile')?.insertAdjacentHTML('beforeend',feedState.factsSkeleton()));
}

/* 「找不到这个X」按索引各写一句：英文要单数小写的名词，不能拿索引页的复数标题去拼。 */
const MISSING_TITLES={performers:'shell:entityMissing.performer',creators:'shell:entityMissing.seller',studios:'shell:entityMissing.studio',
  agencies:'shell:entityMissing.agency',series:'shell:entityMissing.series',tags:'shell:entityMissing.tag'};

export function showEntityMissing(kind){
  const index=ENTITY_ROUTES[kind]||kind,title=INDEX_TITLES[index];
  const actions=title?`<a class="geist-button primary" href="/${index}">${esc(t('shell:entityMissing.backToList', { title }))}</a>`:'';
  $('#index').innerHTML=preferencesState.emptyState('search-x',t(MISSING_TITLES[index]||'shell:entityMissing.item'),t('shell:entityMissing.hint'),{actions});
}

export function openEntity(kind,name){openRoutedPage(entityState.application.fresh(kind,name))}

export function installEntity9() {
entityState.ENTITY_FILTER_KEYS = ['loc','creator','tag','state','dur_min','dur_max','orient','year','sort','dir'];
entityState.emptyEntityFilters = emptyEntityFilters;
entityState.parseEntityFilters = search=>parseEntityFilters(search,{sort:preferencesState.appSettings.defaultSort,dir:preferencesState.appSettings.defaultSortDirection});
entityState.entityFilterSearch = entityFilterSearch;
entityState.cloneBarsContext = context=>context&&context.type==='entity'
  ? {...context,filters:{...context.filters}}:context;
entityState.activeFilterState = ()=>{const context=currentBarsContext();return context.type==='home'?state:context.filters};
$('#q').value=state.q;
catalogState.rememberSearchValue();
}

export function installEntity17() {
entityState.entityPageView = '';
entityState.entityPageWall = false;
entityState.entityPageRevision = 0;
entityState.entityPageCurrent = ()=>!!entityPageEntry();
entityState.entityPageLive = (kind,name)=>{const entry=entityPageEntry();
  return !!entry&&!$('#index').hidden&&entry.props.kind===kind&&entry.props.name===name};
entityState.EMPTY_ENTITY_MEDIA = {media:'videos',set:0};
entityState.parseMediaView = parseMediaView;
entityState.entityViewSearch = entityViewSearch;
entityState.entityBodyCanLoadMore = ()=>!$('#index').hidden&&$('#stats').hidden;
entityState.entityBodySkeleton = ()=>catalogSkeletonHtml();
entityState.entityPageHelpers = {
  wireDrag:row=>{if(row)wireDrag(row)},
  wireScroller:row=>{if(row)wireHorizontalScroller(row)},
  wireFeedRow:row=>wireFeedNewRow(row),
  feedRowHtml,
  receipt:(message,options)=>receiptsState.actionReceipt(message,options),
  failure:(label,error)=>receiptsState.actionFailure(label,error),
  aliasForm:(mine,write)=>entityAliasForm(mine,write),
  sourceToolsHtml:id=>sourceTools(id),
  wireSourceTools:(root,done)=>wireSourceTools(root,done),
  comboItems:filters=>comboItems(filters),
  sortKeys:(sort,dir,jav)=>sortKeys(sort,dir,jav),
};
/* 在线视图的多选认关注条目：和关注页同一份选择集（`followSelected`），和作品区的选择分开。 */
entityState.entityFollowActions = {...followState.followFeedActions,
  route:()=>{},shuffle:()=>{},loaded:()=>{},toggleSelection:(id,range)=>toggleFollowSelection(id,range)};
entityState.SOURCE_HINTS = {
  'source offline':t('shell:sourceTools.libraryOffline'),
  'source not mapped':t('shell:sourceTools.notMapped'),
  'file missing':t('shell:sourceTools.fileMissing'),
  'unsupported platform':t('shell:sourceTools.unsupportedPlatform'),
  'reveal failed':t('shell:sourceTools.revealFailed'),
};
entityState.sourceHint = message=>entityState.SOURCE_HINTS[message]||message;
entityState.syncedText = r=>[r.trashed?t('shell:sourceTools.trashed', { count: r.trashed }):'',
  r.vanished?t('shell:sourceTools.vanished', { count: r.vanished }):'',
  r.reattached?t('shell:sourceTools.reattached', { count: r.reattached }):''].filter(Boolean).join(t('shell:sourceTools.resultSeparator'));
entityState.sourceToolButtons = id=>`
    <button type="button" data-reveal="${id}" title="${esc(t('catalog:detailSource.revealTip'))}"
      aria-label="${esc(t('catalog:detailSource.reveal'))}">${icon('folder-open')}</button>
    <button type="button" data-sync="${id}" title="${esc(t('catalog:detailSource.syncDeletionsTip'))}"
      aria-label="${esc(t('catalog:detailSource.syncDeletions'))}">${icon('folder-sync')}</button>`;
}

export function connectPhotoController(){
  entityState.application=createEntityApplication({
    controller:{
      context:()=>{const context=currentBarsContext();return context.type==='entity'?context:null},
      live:(kind,name)=>entityState.entityPageLive(kind,name),current:()=>entityState.entityPageCurrent(),
      route:(path,replace=false)=>navigationState.route(path,replace),suffix:()=>location.search+location.hash,
      restoreHomeContext:()=>writeShell({barsContext:{type:'home',filters:state}}),
      releaseBodyPreviews:()=>releaseHoverPreviews($('#index [data-entity-body]')),push:pushEntityPage,
      state:()=>({seed:String(state.seed||''),jav:state.jav==='1'}),
      preferences:()=>({revision:entityState.entityPageRevision,feedRevision:feedState.feedRevision,
        photoSize:photoSize(),photoLayout:photoLayout(),photoLayouts:PHOTO_LAYOUTS,
        followImagesOnly:!!preferencesState.appSettings.followImagesOnly,
        javLayout:javLayout(),javLayouts:JAV_LAYOUTS,states:catalogState.VIEW_PILLS,peopleLayout:indexState.peopleIndexLayout(),
        layout:catalogGridLayout(),selectMode,selected:new Set(selected),seekSeconds:preferencesState.appSettings.seekSeconds,
        groupCollapse:preferencesState.appSettings.groupCollapse,wireDrag,skeletonHtml:entityState.entityBodySkeleton,
        canLoadMore:entityState.entityBodyCanLoadMore,
        follow:{helpers:followState.followFeedHelpers,actions:entityState.entityFollowActions}}),
      changeFilter:commitContextFilter,rollSeed:()=>receiptsState.rollSeed(),
      writeSeed:seed=>{state.seed=seed;notifyShell()},
      setJavLayout,javLayout,setPhotoLayout:storePhotoLayout,syncPhotoWalls,openEntity,photoViewActive,
      /* 换到名册、照片或在线视图时顶栏的多选、播放键跟着变，画完重排一次。 */
      recordPainted:(view,wall)=>{const changed=view!==entityState.entityPageView;entityState.entityPageView=view;entityState.entityPageWall=wall;if(changed)syncHeaderActions()},
      syncDensity:syncDensityControl,scheduleSticky:scheduleStickySurfaces,
      releasePage:()=>releaseManagedRoute($('#index')),showMissing:showEntityMissing,dropBars,
    },
    loading:{
      shapesReady:(kind,name)=>feedState.hasEntityShape(kind,name),waitShapes:waitEntityShapes,paintSkeleton:showEntityLoading,
      resetView:()=>{writeShell({detailReturnBarsContext:null});entityState.entityPageView='';entityState.entityPageWall=false},
      loadShapes:loadEntityShapes,syncParts:syncEntitySkeletonParts,
    },
    photos:{
      preferences:()=>({size:photoSize(),layout:photoLayout(),imagesOnly:!!preferencesState.appSettings.followImagesOnly}),
      walls:()=>document.querySelectorAll('.followphotowall'),pushEntity:pushEntityPage,pushFollow:pushFollowFeed,
      syncDensity:syncDensityControl,storeSize:storePhotoSize,
    },
    helpers:entityState.entityPageHelpers,
    actions:{toggleTag,openFollowAuthor:openFollowAuthorFromIndex,javContext:on=>writeShell({entityJavLayout:!!on})},
    sortPreference:()=>({sort:preferencesState.appSettings.defaultSort,dir:preferencesState.appSettings.defaultSortDirection}),
  });
  entityState.photos=entityState.application.photos;
  entityState.entityPageHelpers=entityState.application.helpers;
}
