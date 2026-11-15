/* feed 域控制器：本域状态与动作，启动由 Application 的生命周期统一安装。 */
import { coverImage, remoteCoverUrl } from './../card-art/markup';
import { feedIdentity } from './../card-art/feed-identity';
import { coverStateHtml } from './../card-art/cover-state';
import { $, api, esc, foldName, icon, isCatalogPath } from '../core';
import { javTitleHtml } from '../core/jav-title';
import { COVER_FRONT_RATIO } from './../appearance/layout';
import { catalogState } from './catalog.js';
import { feedNewSkeletonHtml } from '../feed-new-skeleton';
import { managedTaken, openManagedRoute, releaseManagedRoute, updateManagedRoute } from './../history/managed';
import { appSettingsStore } from './../appearance/settings';
import { noteHtml, stopAutoScroll, wireAutoScroll } from '../ui-kit';
import { preferencesState, wireDrag } from './preferences.js';
import { pushEntityPage } from './entity.js';
import { applicationEffects } from './effects';
import { t } from '../i18n';
export const feedState = { FEED_SKELETON_CARDS: undefined, feedNewSkeletonHtml: undefined, entityShapes: undefined, entityShapesComplete: false, hasEntityShape: undefined, hasEntityPart: undefined, feedNewSkeletonSection: undefined, COSTAR_SKELETON_PEOPLE: undefined, costarSkeletonFoot: undefined, factsSkeleton: undefined, feedRevision: undefined, feedNewHelpers: undefined, feedNewActions: undefined, HERO_WIDE_PX: undefined };

export function feedNewCoverHtml(item){
  if(item.has_cover)return coverImage(item,'big');
  // 还没有封面：说清在等什么、为什么没有，排队的可以当场先取（后台那条队可能被存量补修占着几个小时）。
  if(!item.cover_url||!item.code)return coverStateHtml(item);
  // 官方图经 Peach 代理取，断网或上游失败时换成「封面未取得」占位。
  return coverImage(item,'big').replace(/ src="[^"]*"/,
    ` src="${esc(remoteCoverUrl(item))}" data-panel-prior="1"`)
    .replace('data-drop="self"', `data-drop="initial" data-initial="${esc(t('shell:artworkGap.coverNotFound'))}" data-drop-class="nopic"`);
}

export function feedNewCardHtml(item){
  // 署名与日期各占一行，长出演名单可从悬停说明查看。
  const label=[item.performers&&`<span class="feednewperformers" title="${esc(item.performers)}">${esc(item.performers)}</span>`,
    item.release_date&&`<time class="feednewdate" datetime="${esc(item.release_date)}">${esc(item.release_date)}</time>`].filter(Boolean)
    .join('');
  const cover=feedNewCoverHtml(item);
  // 番号与标题排在同一个两行的标题块里，和资产卡一样：番号加粗打头，标题接在后面截断。
  const name=item.code||String(item.title||'').trim()||t('shell:feedNew.untitled');
  const heading=item.code
    ?javTitleHtml({is_jav:true,code:item.code,name:item.code,display_title:item.title||''})
    :esc(name);
  const open=item.code
    ?`<a class="feednewopen" href="/works/${encodeURIComponent(item.code)}" aria-label="${esc(t('shell:feedNew.openDetails', { name }))}"></a>`:'';
  return `<article class="card feednewcard${item.read?' isread':''}" data-feed-id="${item.id}">
    ${open}<div class="pic" style="--card-ratio:${COVER_FRONT_RATIO}">${cover}
      <div class="hovertools feednewtools">
        <button type="button" data-feed-action="${item.wanted?'unwant':'want'}" aria-pressed="${!!item.wanted}" title="${esc(item.wanted?t('catalog:javWant.remove'):t('catalog:javWant.want'))}" aria-label="${esc(t('shell:feedNew.wantNamed', { name }))}">${icon('star')}</button>
        <button type="button" data-feed-action="ignore" title="${esc(t('shell:feedNew.ignore'))}" aria-label="${esc(t('shell:feedNew.ignoreNamed', { name }))}">${icon('x')}</button>
        <button type="button" data-feed-action="read" title="${esc(t('shell:feedNew.markRead'))}" aria-label="${esc(t('shell:feedNew.markReadNamed', { name }))}">${icon('check')}</button></div></div>
    <div class="meta">${feedIdentity(item)}<div class="mtext"><span class="t">${heading}</span>
      <div class="s mono">${label||(item.title?'':t('shell:feedNew.metadataPending'))}</div></div></div></article>`;
}

export function installEntityShapeBootstrap(){
  const script=document.getElementById('peach-entity-shape');
  if(!script)return;
  try{
    const shape=JSON.parse(script.textContent||'null');
    if(!shape?.id||typeof shape.kind!=='string'||!Array.isArray(shape.names)||!Array.isArray(shape.parts))return;
    feedState.entityShapes=new Map([String(shape.id),...shape.names]
      .map(name=>[`${shape.kind}/${foldName(name)}`,shape.parts]));
  }catch{/* 无效的首屏形状由异步名单处理。 */}
}

export async function loadEntityShapes(){
  const effects=applicationEffects;
  const data=await api('/api/entity/shapes',{signal:effects.signal}).catch(()=>null);
  if(!effects.isActive)return feedState.entityShapes;
  if(data&&!data.error){
    feedState.entityShapesComplete=true;
    feedState.entityShapes=new Map((data.entities||[])
      .flatMap(entity=>[String(entity.id),...entity.names].map(name=>[`${entity.kind}/${foldName(name)}`,entity.parts])));
    if(typeof data.home?.feed==='boolean')rememberHomeFeed(data.home.feed);
    if(isFeedNewPath(location.pathname))prepareHomeFeed($('#feedNew'));
  }
  return feedState.entityShapes;
}

/* 首页有没有「未入库的新作」记在本机：首屏骨架就按上次的结论铺这一行，不等形状接口回来再插进来，
   把下面的目录往下推一跳。接口或那一行画完后改记新的结论。 */
const HOME_FEED_KEY='peach.home-feed.v1';
export function rememberHomeFeed(has){
  catalogState.homeHasFeed=has;
  try{localStorage.setItem(HOME_FEED_KEY,has?'1':'0')}catch{/* 下次照旧等接口。 */}
}
export function recalledHomeFeed(){
  try{const value=localStorage.getItem(HOME_FEED_KEY);return value==='1'?true:value==='0'?false:null}catch{return null}
}

export function prepareHomeFeed(host){
  // 一打开，宿主就归路由树：骨架只在打开之前铺，之后由画出来的那一行或空着说话。
  if(!host||managedTaken(host)||host.querySelector('[data-feed-id]'))return;
  host.hidden=catalogState.homeHasFeed!==true;
  if(catalogState.homeHasFeed!==true)return;
  host.setAttribute('aria-busy','true');
  if(!host.querySelector('.feednewskeleton'))host.innerHTML=feedState.feedNewSkeletonHtml();
}

export function feedNetworkNote(unreachable,items){
  if(!(unreachable>0)||!items.some(item=>!item.has_cover))return '';
  return noteHtml(t('shell:feedNew.dmmUnreachable', { count: unreachable }),
    {variant:'warning',className:'feednetwork',actionLabel:t('shell:feedNew.configureConnection'),actionHref:'/sources'});
}

/* `allHref` 给了就在行尾多一张「查看全部新作」卡，跳到 JAV 页的新作分区；首页那一行给，资料页那一行不给。 */
export function feedRowHtml(data,allHref=''){
  const items=data&&!data.error?(data.items||[]):[];
  const all=allHref&&items.length
    ?`<a class="feednewall" href="${esc(allHref)}" style="--card-ratio:${COVER_FRONT_RATIO}"><span>${t('shell:feedNew.viewAll')}</span>${icon('chevron-right')}</a>`:'';
  return feedNetworkNote(data?.cover_network,items)
    +`<div class="feednewrow srow">${items.map(feedNewCardHtml).join('')}${all}</div>`;
}

export function wireFeedNewRow(row){
  if(!row)return;
  wireDrag(row);
  if(preferencesState.appSettings.feedAutoScroll)wireAutoScroll(row);
}

/* 首页这一行在不在场：设置里关掉「在首页显示新作」就哪条目录路径上都没有它，骨架也不铺。人物页那一行另走资料页。 */
export function isFeedNewPath(path){return appSettingsStore().value.feedNewRows!==false&&isCatalogPath(path)&&path!=='/junk-files'}


export function renderHomeFeed(){
  const host=$('#feedNew');
  if(managedTaken(host)){host.hidden=catalogState.homeHasFeed!==true;return}
  prepareHomeFeed(host);
  /* 这一行不随筛选变，判在不在场只看路径：换筛选换掉的是目录的代次，不该把它这一趟作废。 */
  void openManagedRoute('feed-new',{host,revision:feedState.feedRevision,helpers:feedState.feedNewHelpers,actions:feedState.feedNewActions},
    {container:host,isCurrent:()=>isFeedNewPath(location.pathname)});
}

export function clearHomeFeed(){
  const host=$('#feedNew');
  host.querySelectorAll('.feednewrow').forEach(stopAutoScroll);
  host.hidden=true;
}

/* 设置里切了「在首页显示新作」：关掉就把画着的那一行连同它的查询一起卸掉，之后不再取数；打开时人正在目录上就当场画。 */
export function syncHomeFeedSetting(folders){
  const host=$('#feedNew');
  if(appSettingsStore().value.feedNewRows===false){releaseManagedRoute(host);clearHomeFeed();return}
  if(isFeedNewPath(location.pathname)&&!folders)renderHomeFeed();
}

export function refreshFeedRows(){
  feedState.feedRevision+=1;
  // 首页那一行只在目录页画着，人不在那儿时 `updateManagedRoute` 是空操作，不会在别的页面上冒出来。
  updateManagedRoute($('#feedNew'),{revision:feedState.feedRevision});
  pushEntityPage({feedRevision: feedState.feedRevision});
}

export function syncFeedAutoScroll(){
  document.querySelectorAll('.feednewrow').forEach(row=>
    preferencesState.appSettings.feedAutoScroll?wireAutoScroll(row):stopAutoScroll(row));
}

/* 开关挪到下一帧写：它一翻，资料卡换栏、页面变高，而整页那条覆盖滚动条正观察着 `<body>`。在尺寸观察
   回调里当场写，`<body>` 这一层浅的变化本轮送不出去，浏览器就报一次 ResizeObserver 循环错误，
   每开一次资料页都进错误上报。 */
let heroWideFrame=0;
export function syncHeroWide([entry]){
  const wide=entry.contentRect.width>=feedState.HERO_WIDE_PX;
  cancelAnimationFrame(heroWideFrame);
  heroWideFrame=requestAnimationFrame(()=>{heroWideFrame=0;$('#index')?.toggleAttribute('data-hero-wide',wide)});
}

export function installFeed13() {
feedState.FEED_SKELETON_CARDS = 8;
feedState.feedNewSkeletonHtml = ()=>feedNewSkeletonHtml(feedState.FEED_SKELETON_CARDS);
feedState.entityShapes = null;
feedState.entityShapesComplete = false;
feedState.hasEntityShape = (kind,name)=>feedState.entityShapesComplete||!!feedState.entityShapes?.has(`${kind}/${foldName(name)}`);
feedState.hasEntityPart = (kind,name,part)=>!!name&&!!feedState.entityShapes?.get(`${kind}/${foldName(name)}`)?.includes(part);
feedState.feedNewSkeletonSection = ()=>`<section class="feednew">${feedState.feedNewSkeletonHtml()}</section>`;
feedState.COSTAR_SKELETON_PEOPLE = 12;
feedState.costarSkeletonFoot = ()=>`<div class="entityfoot" data-entity-foot><div class="relatedpeople" data-related-people>${
  '<button type="button" disabled tabindex="-1"><span class="skeleton" data-hero-ring></span><span class="skeleton" data-hero-costar-name>&#8203;</span></button>'
    .repeat(feedState.COSTAR_SKELETON_PEOPLE)}</div></div>`;
feedState.factsSkeleton = ()=>`<dl class="entityfacts" data-entity-facts>${
  '<dt><span class="skeleton"></span></dt><dd><span class="skeleton"></span></dd>'.repeat(5)}</dl>`;
feedState.feedRevision = 0;
feedState.feedNewHelpers = {feedRowHtml,wireFeedRow:row=>wireFeedNewRow(row)};
feedState.feedNewActions = {settled:hasItems=>rememberHomeFeed(hasItems)};
feedState.HERO_WIDE_PX = 900;
applicationEffects.resize(syncHeroWide).observe($('#index'));
}
