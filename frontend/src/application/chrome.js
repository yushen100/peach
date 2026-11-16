/* chrome 域控制器：本域状态与动作，启动由 Application 的生命周期统一安装。 */
import { applicationEffects } from './effects';
import { MEDIA_SOURCE_ICONS, moveGlidePane, wireAnchoredMenu } from '../ui-kit';
import { api, esc, icon } from '../core';
import { publishLibraries, orderLibraries } from '../library-catalog';
import { appSettingsStore } from '../appearance/settings';
import { narrowShell, openDrawer, openSettings } from './layout.js';
import { openConfigurationSection } from './playlists.js';
import { transitionTheme } from './../theme-transition';
import { preferencesState } from './preferences.js';
import { applyTheme } from './../appearance/theme';
import { wireGlowButton } from './../appearance/glow';
import { loadGlowPicker } from '../react/application-residents';
import { t } from '../i18n';
export const chromeState = {  };



export function installChrome25() {
(()=>{
const effects=applicationEffects;
const nativeNodes=['#brandHome','#filterBtn','#settingsBtn'].map(selector=>{
  const node=document.querySelector(selector);
  return {node,parent:node.parentNode,next:node.nextSibling};
});
const drawer=document.querySelector('#drawer'),drawerInert=drawer.inert;
const previousPlace=preferencesState.placeSidebarHead,previousOptics=preferencesState.syncGlassOptics;
const nativeBrand=nativeNodes[0].node;
const brandAttributes=['aria-label','aria-haspopup','aria-controls','aria-expanded'].map(name=>[name,nativeBrand.getAttribute(name)]);
effects.own(()=>{
  for(const {node,parent,next} of [...nativeNodes].reverse()){
    const target=parent.isConnected?parent:document.querySelector('.top');
    target.insertBefore(node,next?.parentNode===target?next:null);
  }
  for(const [name,value] of brandAttributes){if(value===null)nativeBrand.removeAttribute(name);else nativeBrand.setAttribute(name,value)}
  drawer.inert=drawerInert;
  if(preferencesState.placeSidebarHead===placeBrand)preferencesState.placeSidebarHead=previousPlace;
});
/* Board 外壳：媒体库选择、侧栏底部、玻璃折射。 */
document.documentElement.classList.toggle('board-high-contrast',localStorage.getItem('peach.high-contrast')==='true');
const boardBrand=document.querySelector('#brandHome');
boardBrand.setAttribute('aria-label',t('shell:libraryPicker.choose'));
const libraryPicker=document.createElement('div');libraryPicker.className='board-library-menu';libraryPicker.id='boardLibraryMenu';libraryPicker.hidden=true;libraryPicker.setAttribute('popover','manual');libraryPicker.setAttribute('role','dialog');libraryPicker.setAttribute('aria-label',t('shell:shared.library'));
document.body.append(libraryPicker);
effects.own(()=>libraryPicker.remove());
boardBrand.setAttribute('aria-haspopup','dialog');boardBrand.setAttribute('aria-controls',libraryPicker.id);
if(!boardBrand.querySelector('.board-library-chevron')){
  boardBrand.insertAdjacentHTML('beforeend','<svg class="board-library-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m5 6 3-3 3 3M5 10l3 3 3-3"/></svg>');
  const brandChevron=boardBrand.lastElementChild;effects.own(()=>brandChevron.remove());
}
effects.handler(boardBrand, 'onclick', event=>{event.preventDefault()});
const libraryFloating=wireAnchoredMenu(document.querySelector('#drawer'),boardBrand,libraryPicker,{side:true});
effects.own(libraryFloating.dispose);
/* 媒体库这一列跟侧栏导航那一列、筛选条那一排是同一件事：标出「当前是哪一个」，指到
   哪儿就滑到哪儿，指针离开这一列再滑回真正选中的那一项。所以走同一块玻璃、同一段
   位移，不在这里另写一份选中底色——那样这一处的手感会自己漂移成第四种。
   `aria-pressed` 全程不动：移过去不是选中，读屏和键盘那边不该跟着变。
   菜单收起时量不到尺寸（`offsetHeight` 是 0），玻璃先收起来，开的时候再落位。 */
let libraryGlide=null,libraryGlideBox=null;
function syncLibraryGlide(animate,target){
  const rows=libraryPicker.querySelector('.board-library-rows');
  const active=(target&&target.isConnected?target:null)
    ||rows?.querySelector('button[aria-pressed="true"]');
  if(!rows||!active?.offsetHeight){if(libraryGlide)libraryGlide.hidden=true;libraryGlideBox=null;return}
  if(!libraryGlide||libraryGlide.parentElement!==rows){
    libraryGlide=document.createElement('span');libraryGlide.className='viewglide';
    libraryGlide.setAttribute('aria-hidden','true');rows.prepend(libraryGlide);libraryGlideBox=null;
  }
  libraryGlide.hidden=false;
  const box={x:active.offsetLeft,y:active.offsetTop,w:active.offsetWidth,h:active.offsetHeight};
  const from=libraryGlideBox;libraryGlideBox=box;
  moveGlidePane(libraryGlide,animate?from:null,box,'y');
}
effects.listen(libraryPicker, 'toggle', event=>{if(event.newState==='open'){
  libraryPicker.querySelector('button')?.focus();syncLibraryGlide(false)}});
effects.listen(libraryPicker, 'keydown', event=>{if(event.key==='Escape'){event.stopPropagation();libraryFloating.setOpen(false);boardBrand.focus()}});
api('/api/libraries',{signal:effects.signal}).then(data=>{
  if(!effects.isActive)return;
  publishLibraries(data.libraries);
  const choices=[['',t('shell:libraryPicker.allLibraries'),'database'],...data.libraries.map(row=>[row.id,row.name,row.icon||'database'])];
  const selected=sessionStorage.getItem('peach.library')||'';
  if(!choices.some(row=>row[0]===selected)){
    const matching=data.libraries.filter(row=>row.name===selected);
    if(matching.length===1)sessionStorage.setItem('peach.library',matching[0].id);
    else sessionStorage.removeItem('peach.library');
    sessionStorage.removeItem('peach.library-label');location.reload();return;
  }
  const current=sessionStorage.getItem('peach.library')||'';
  const currentName=choices.find(row=>row[0]===current)?.[1]||t('shell:libraryPicker.allLibraries');
  sessionStorage.setItem('peach.library-label',currentName);
  boardBrand.querySelector('h1').textContent=currentName;
  const libraryMark=glyph=>MEDIA_SOURCE_ICONS[glyph]?.startsWith('data:')?`<img src="${MEDIA_SOURCE_ICONS[glyph]}" alt="">`:icon(MEDIA_SOURCE_ICONS[glyph]||glyph);
  const mark=document.createElement('span');mark.className='mark';mark.setAttribute('aria-hidden','true');
  mark.innerHTML=libraryMark(choices.find(row=>row[0]===current)?.[2]||'database');boardBrand.querySelector('.mark').replaceWith(mark);
  libraryPicker.innerHTML=`<p>${t('shell:shared.library')}</p><div class="board-library-rows">${choices.map(([id,name,glyph])=>`<button type="button" data-library="${esc(id)}" aria-pressed="${id===current}"><span class="board-library-avatar">${libraryMark(glyph)}</span><span>${esc(name)}</span></button>`).join('')}</div><footer><button type="button" class="geist-button primary" data-library-manage>${t('manage:syncMenu.manageLibraries')}</button></footer>`;
  libraryPicker.querySelectorAll('[data-library]').forEach(button=>effects.handler(button, 'onclick', ()=>{sessionStorage.setItem('peach.library',button.dataset.library);sessionStorage.setItem('peach.library-label',choices.find(row=>row[0]===button.dataset.library)?.[1]||t('shell:libraryPicker.allLibraries'));location.assign('/')}));
  effects.handler(libraryPicker.querySelector('[data-library-manage]'), 'onclick', ()=>{libraryFloating.setOpen(false);openDrawer(false);openConfigurationSection('library')});
  /* 委托在这一列上，不挂在每个按钮身上：菜单每次取回媒体库都整块重画。
     `pointerover`／`pointerout` 而不是 enter／leave，后两个不冒泡，委托接不到。 */
  const libraryRows=libraryPicker.querySelector('.board-library-rows');
  const libraryButtons=[...libraryRows.querySelectorAll('[data-library]')];
  const libraryStore=appSettingsStore();
  const arrangeLibraries=()=>{
    orderLibraries(libraryButtons,['',...libraryStore.value.libraryOrder],button=>button.dataset.library)
      .forEach(button=>libraryRows.append(button));
    syncLibraryGlide(false);
  };
  arrangeLibraries();
  effects.own(libraryStore.subscribe(arrangeLibraries));
  effects.listen(libraryRows, 'pointerover', event=>{
    if(event.pointerType==='touch')return;
    const button=event.target.closest?.('button[data-library]');
    if(button)syncLibraryGlide(true,button);
  });
  effects.listen(libraryRows, 'pointerout', event=>{
    if(event.pointerType==='touch')return;
    if(!libraryRows.contains(event.relatedTarget))syncLibraryGlide(true);
  });
  syncLibraryGlide(false);
}).catch(()=>{if(effects.isActive)libraryPicker.hidden=true});
const boardToggle=document.querySelector('#filterBtn'),toggleHome=document.createComment('sidebar toggle');
(document.querySelector('.top')||boardToggle.closest('header')).prepend(toggleHome);
effects.own(()=>toggleHome.remove());
const boardFoot=document.createElement('div');boardFoot.className='board-sidebar-foot';
effects.own(()=>boardFoot.remove());
boardFoot.innerHTML=`<div class="board-theme-toggle" role="group" aria-label="${t('shell:themeToggle.group')}"><span class="board-theme-thumb" aria-hidden="true"></span><button type="button" data-board-theme="light" aria-label="${t('shell:themeToggle.light')}">${icon('sun')}</button><button type="button" data-board-theme="dark" aria-label="${t('shell:themeToggle.dark')}">${icon('moon')}</button></div>`;
/* 光晕配色钮和设置钮归一组，明暗键单独一组。展开时从左到右、收起时从上到下
   均按明暗、配色、设置排列，键盘焦点也沿用同一顺序。
   字形直接引 `#ri-palette-line`，不走 `icon()`：那一枚是 Remix 的实心路径，`icon()` 拼的是
   `#i-` 前缀的线条件。它和设置分区「界面」那一枚是同一个意思——这枚钮的弹层底部「详细
   设置」开的正是那一页，两处说的都是外观，同一个意思本来就只该有一枚字形。 */
boardFoot.insertAdjacentHTML('beforeend',`<div class="board-foot-actions"><button type="button" class="board-glow-toggle" id="boardGlowBtn" aria-label="${t('settings:sidebarGlow.palette')}" aria-haspopup="dialog" aria-expanded="false" aria-controls="boardGlowMenu"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ri-palette-line"/></svg><span class="board-glow-mark" aria-hidden="true"><span class="board-glow-mark-glow"></span><span class="board-glow-mark-accent"></span></span></button></div>`);
boardFoot.querySelector('.board-foot-actions').append(document.querySelector('#settingsBtn'));
document.querySelector('#drawer').append(boardFoot);
boardFoot.querySelectorAll('[data-board-theme]').forEach(button=>effects.handler(button, 'onclick', ()=>{if(button.getAttribute('aria-pressed')==='true')return;transitionTheme(button,()=>{preferencesState.appSettings.theme=button.dataset.boardTheme;preferencesState.saveSettings();applyTheme()})}));
applyTheme();
/* 侧栏的光晕配色卡照 boardui.com 右下角那枚「Accent color」：钮上不画字形，画的就是它管的那两样——
   左上一枚光晕色的圆、右下一枚强调色的圆叠在它上面（`appearance/glow.ts` 的 `paintGlowButton`）。
   卡的外壳在这里建、由 `wireAnchoredMenu` 锚定与开合，材质与媒体库选择弹层同一条规则；卡里的内容归
   常驻组件 `glow-picker`（`frontend/src/react/glow-picker/`），由路由树画进来。 */
const glowPicker=document.createElement('div');
glowPicker.className='popmenu board-glow-menu';glowPicker.id='boardGlowMenu';glowPicker.hidden=true;
glowPicker.setAttribute('popover','manual');glowPicker.setAttribute('role','dialog');
glowPicker.setAttribute('aria-label',t('shell:glowPicker.title'));
document.body.append(glowPicker);
effects.own(()=>glowPicker.remove());
const glowButton=boardFoot.querySelector('#boardGlowBtn');
const glowFloating=wireAnchoredMenu(boardFoot,glowButton,glowPicker);
effects.own(glowFloating.dispose);
effects.own(wireGlowButton(glowButton));
void loadGlowPicker({root:glowPicker,store:preferencesState.settingsStore,openDetails:()=>{
  if(!effects.isActive)return;
  glowFloating.setOpen(false);openDrawer(false);
  // 设置面板按标题选页签，传它自己那份标题；地址那一步按标题或 id 都认。
  void openSettings('appearance').then(panel=>{if(effects.isActive)panel.reveal('#homeGlowControls')});
}}).catch(error=>{if(effects.isActive&&error?.name!=='AbortError')console.error(error)});
/* 品牌（媒体库选择）与开合键是壳里浮层的锚点，挪进侧栏标题行那个空槽：骨架画好时一次，路由树画上
   侧栏、换掉骨架时（`attached`）再一次。手机上抽屉收着时开合键回到顶栏原位，抽屉整块不可聚焦。 */
function placeBrand(){
  if(!effects.isActive)return;
  const head=document.querySelector('#drawerScroll > [data-sidebar-head]'),drawer=document.querySelector('#drawer');
  if(!head)return;
  boardBrand.setAttribute('aria-label',t('shell:libraryPicker.choose'));
  if(boardBrand.parentElement!==head)head.prepend(boardBrand);
  const expanded=drawer.classList.contains('open'),desktop=!narrowShell();
  if(desktop||expanded){if(boardToggle.parentElement!==head)head.append(boardToggle)}else if(boardToggle.parentElement!==toggleHome.parentElement)toggleHome.after(boardToggle);
  drawer.inert=!desktop&&!expanded;
}
preferencesState.placeSidebarHead=placeBrand;
placeBrand();
effects.listen(document, 'board:sidebar', placeBrand);
effects.listen.bind(applicationEffects, window)('resize',placeBrand);

let floatingScheduled=false;
function updateFloating(){
  floatingScheduled=false;
  document.body.classList.toggle('board-scrolled',scrollY>8);
}
effects.listen.bind(applicationEffects, window)('scroll',()=>{if(!floatingScheduled){floatingScheduled=true;effects.frame(updateFloating)}},{passive:true});effects.listen.bind(applicationEffects, window)('resize',updateFloating);updateFloating();

/* Generate an edge-normal displacement field; only the backdrop is refracted. */
if(/Chrome|Chromium|Edg\//.test(navigator.userAgent)){
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.setAttribute('aria-hidden','true');svg.style.position='fixed';svg.style.pointerEvents='none';
  const defs=document.createElementNS(ns,'defs');svg.append(defs);document.body.append(svg);
  const attached=new Map();let sequence=0;
  effects.own(()=>{
    for(const [node,{optic,priority,flag}] of attached){
      if(optic)node.style.setProperty('--glass-optic',optic,priority);else node.style.removeProperty('--glass-optic');
      if(flag===undefined)delete node.dataset.opticGlass;else node.dataset.opticGlass=flag;
    }
    attached.clear();svg.remove();
    if(preferencesState.syncGlassOptics===sync)preferencesState.syncGlassOptics=previousOptics;
  });
  /* 侧栏开合那 300ms 里（`body` 的 `padding-left` 与抽屉的 `width` 在过渡），抽屉和主区里的
     玻璃宽度逐帧在变，贴图不跟着画：一张是几毫秒 JS 加一次 PNG 编码，写回 `--glass-optic`
     又让排在后面的观察器每次读尺寸都强制重排一遍，关注页实测一次开合要画十到十六张，
     观察器回调合计 95–126ms。过渡期间尺寸变了的那几块先退成同一档的纯模糊，全部停下来
     再按终态尺寸补画一次。 */
  let sizing=0;const stale=new Set();
  const isSizing=()=>sizing||document.documentElement.hasAttribute('data-sidebar-resizing');
  const sizingEvent=event=>(event.target===document.body&&event.propertyName==='padding-left')
    ||(attached.has(event.target)&&(event.propertyName==='width'||event.propertyName==='height'));
  effects.listen(document, 'transitionrun', event=>{if(sizingEvent(event))sizing++}, true);
  const settleSizing=event=>{
    if(!sizingEvent(event)||!sizing||--sizing)return;
    // 过渡刚停，补画不等空闲：终态那一帧就该是终态尺寸的贴图。
    stale.forEach(node=>pendingOptics.add(node));stale.clear();flushOptics(null);
  };
  effects.listen(document, 'transitionend', settleSizing, true);effects.listen(document, 'transitioncancel', settleSizing, true);
  function attach(node){
    if(attached.has(node))return;
    const id=`peach-optic-${++sequence}`;const filter=document.createElementNS(ns,'filter');filter.id=id;filter.setAttribute('filterUnits','userSpaceOnUse');filter.setAttribute('color-interpolation-filters','sRGB');
    const map=document.createElementNS(ns,'feImage');map.setAttribute('result','edge-map');map.setAttribute('preserveAspectRatio','none');
    const displacement=document.createElementNS(ns,'feDisplacementMap');displacement.setAttribute('in','SourceGraphic');displacement.setAttribute('in2','edge-map');displacement.setAttribute('xChannelSelector','R');displacement.setAttribute('yChannelSelector','G');displacement.setAttribute('scale','24');filter.append(map,displacement);defs.append(filter);
    let previous='';
    const fallback=()=>{
      if(node.dataset.opticGlass&&node.style.getPropertyValue('--glass-optic')!=='blur(14px)')node.style.setProperty('--glass-optic','blur(14px)');
      previous='';stale.add(node);
    };
    const draw=()=>{if(isSizing())fallback();else{pendingOptics.add(node);scheduleOptics()}};
    const paint=(width,height,radius)=>{
      const key=`${width}:${height}:${radius}`;if(previous===key)return;
      previous=key;
      map.setAttribute('href',edgeMap(width,height,radius));map.setAttribute('width',width);map.setAttribute('height',height);filter.setAttribute('x','0');filter.setAttribute('y','0');filter.setAttribute('width',width);filter.setAttribute('height',height);
      /* 模糊排在位移前面：backdrop-filter 是一条流水线，先糊的是身后那片内容，
         再由边缘法线场把已经糊掉的像素往外挤，边上那圈拉伸就带着颜色一起走。
         反过来先位移再糊，折射出来的亮边会被第二步抹平，只剩一块均匀磨砂。 */
      node.style.setProperty('--glass-optic',`blur(14px) url("#${id}")`);node.dataset.opticGlass='true';
    };
    const observer=effects.resize(draw);observer.observe(node);
    attached.set(node,{observer,filter,draw,paint,fallback,optic:node.style.getPropertyValue('--glass-optic'),priority:node.style.getPropertyPriority('--glass-optic'),flag:node.dataset.opticGlass});draw();
  }
  /* 位移贴图只由宽、高、圆角决定：顶栏那几枚圆钮同一个尺寸，侧栏开合来回也只在两档之间换，
     画过的按这三个数留着直接复用。 */
  const edgeMaps=new Map();
  function edgeMap(width,height,radius){
    const key=`${width}:${height}:${radius}`;const cached=edgeMaps.get(key);
    if(cached){edgeMaps.delete(key);edgeMaps.set(key,cached);return cached}
    const ratio=Math.min(1,600/width,600/height);const w=Math.max(2,Math.round(width*ratio)),h=Math.max(2,Math.round(height*ratio));
    /* 画布只拿来写一次像素、读一次 PNG，走 CPU 那一种：默认的 GPU 画布在 toDataURL 时要把
       像素读回来，第一次还得先建 GPU 上下文，冷启动实测单这一下就是一百毫秒上下，之后的
       重画也时不时要和合成抢 GPU 等几十毫秒。 */
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});const pixels=ctx.createImageData(w,h);
    const distance=(x,y)=>{const qx=Math.abs(x-width/2)-(width/2-radius),qy=Math.abs(y-height/2)-(height/2-radius);return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-radius};
    const depth=Math.min(24,Math.min(width,height)/3);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const px=(x+.5)/ratio,py=(y+.5)/ratio,inside=-distance(px,py);let dx=0,dy=0;
      if(inside>0&&inside<depth){const gx=distance(px+.5,py)-distance(px-.5,py),gy=distance(px,py+.5)-distance(px,py-.5),length=Math.hypot(gx,gy)||1;const bend=Math.sin(Math.PI*inside/depth);dx=gx/length*bend;dy=gy/length*bend}
      const i=(y*w+x)*4;pixels.data[i]=128+dx*116;pixels.data[i+1]=128+dy*116;pixels.data[i+2]=128;pixels.data[i+3]=255;
    }
    ctx.putImageData(pixels,0,0);const href=canvas.toDataURL();
    edgeMaps.set(key,href);if(edgeMaps.size>24)edgeMaps.delete(edgeMaps.keys().next().value);
    return href;
  }
  /* 贴图放到空闲时画，先把排队的几块玻璃的尺寸一起量完再统一写：边量边写的话，前一块写进
     `--glass-optic` 弄脏的样式会让后一块读圆角时当场整树重算。空闲时间用完就把剩下的
     留到下一段空闲；最多等 300ms，在那之前玻璃用样式表里的纯模糊。 */
  const pendingOptics=new Set();let opticsHandle=0;
  const idle=typeof requestIdleCallback==='function';
  function scheduleOptics(){
    if(!opticsHandle)opticsHandle=idle?requestIdleCallback(flushOptics,{timeout:300}):setTimeout(flushOptics,50);
  }
  effects.own(()=>{if(opticsHandle){if(idle)cancelIdleCallback(opticsHandle);else clearTimeout(opticsHandle)}opticsHandle=0;pendingOptics.clear()});
  function flushOptics(deadline){
    if(deadline!==null)opticsHandle=0;
    if(!effects.isActive)return;
    const nodes=[...pendingOptics].filter(node=>node.isConnected&&attached.has(node));pendingOptics.clear();
    if(isSizing()){nodes.forEach(node=>attached.get(node).fallback());return}
    const sizes=nodes.map(node=>{
      const width=Math.round(node.clientWidth),height=Math.round(node.clientHeight);
      return {node,width,height,radius:width&&height?Math.min(parseFloat(getComputedStyle(node).borderRadius)||22,width/2,height/2):0};
    });
    for(const [index,{node,width,height,radius}] of sizes.entries()){
      if(index&&deadline&&!deadline.didTimeout&&deadline.timeRemaining()<=0){
        sizes.slice(index).forEach(rest=>pendingOptics.add(rest.node));scheduleOptics();return;
      }
      if(width&&height)attached.get(node).paint(width,height,radius);
    }
  }
  const sync=()=>{
    if(!effects.isActive)return;
    for(const [node,{observer,filter}] of attached){
      if(!node.isConnected){observer.disconnect();filter.remove();attached.delete(node)}
    }
    /* 设置面板左栏那块 `[data-glass-pane]` 挂在 `<body>` 上、不在 `#main` 里，下面那个
       观察器看不到它；岛第一次画出面板时经 `syncGlassOptics` 叫这里再扫一遍。面板收着时
       宽高是零，`draw` 直接返回，等 `ResizeObserver` 在它露出来那一帧再画一次贴图。 */
    document.querySelectorAll('.board-filter-frame,.top>.ib,[data-sidebar-drawer],.reviewcontrols,.reviewgroupbar,[data-glass-pane]').forEach(attach);
  };
  preferencesState.syncGlassOptics=sync;
  /* 指针拖宽期间的尺寸连续变化，沿用开合过渡的完整模糊面，松手再补最终尺寸的折射贴图。 */
  effects.mutation(()=>{
    if(document.documentElement.hasAttribute('data-sidebar-resizing')){
      attached.forEach(({fallback})=>fallback());return;
    }
    stale.forEach(node=>pendingOptics.add(node));stale.clear();scheduleOptics();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['data-sidebar-resizing']});
  const panes='.board-filter-frame,.top>.ib,[data-sidebar-drawer],.reviewcontrols,.reviewgroupbar,[data-glass-pane]';
  effects.mutation(records=>{
    if(records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>
      node instanceof Element&&(node.matches(panes)||node.querySelector(panes)))))sync();
  }).observe(document.body,{childList:true,subtree:true});sync();
}

})();
openDrawer(!narrowShell()&&sessionStorage.getItem('board.sidebar')!=='closed');
}
