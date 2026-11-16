/* 滚动那一组：横排的滚轮转向、拖动与橡皮筋、横排自动滚动、选中底板的滑动、Geist Scroller，
   以及自动接管滚动区的覆盖式滚动条。由共享源码直接引用，随 `peach-app.js` 发出；
   已绑定的横排、自动滚动的那几排与弹簧取值都是模块级状态，只有一份。 */
import { esc } from '../core';

import { attachOverlayScrollbar, detachOverlayScrollbar, pruneOverlayScrollbars, refreshOverlayScrollbars, releaseOverlayScrollbars } from './overlay-scrollbar';
import { t } from '../i18n';

const horizontalControls=new Map<Element,any>();
let horizontalCleanup:MutationObserver|null|undefined;
/* 两次滚轮事件隔多久算下一次手势。触控板的惯性尾巴一格一格地来，间隔在几十毫秒；
   人停下来再滚一次，中间隔的比这长得多。 */
const WHEEL_GESTURE_GAP=240;
/* 一格滚轮至少这么大才平滑着走。鼠标滚轮一格是整整一段（Windows 上 100px 起），直接
   改 `scrollLeft` 会一格一格地跳，而页面自己滚的时候每一格都是一段动画；触控板一次只
   给几个像素、一秒几十次，本来就是连续的，再套动画只会拖慢跟手。 */
const WHEEL_SMOOTH_STEP=50;
/* 平滑那一段由这一排自己逐帧走，不用 `scrollTo({behavior:'smooth'})`：那条动画每接一格
   都从零速重新起步，连续转滚轮时一格一顿，实测每两格之间有两三帧完全停住。这里每帧
   朝终点走剩下距离的一截（时间常数 70ms），新的一格只把终点往前挪，速度连着走，不断档。 */
const WHEEL_GLIDE_MS=70;
/* 横排滚到头还往前推，内容多走一小段再弹回来。transitions.dev 没有这一条配方，越界位移
   借 UIScrollView 那条橡皮筋公式 `(1 - 1/(x·c/d + 1))·d`（c = 0.55，use-gesture 的
   `rubberband` 是同一条）：推得越远越推不动，怎么推也到不了容器那么宽。弹回走站内那条
   采样弹簧 `--spring-pane`，冲过原位再荡回来，和筛选条那块底板一个手感。 */
const RUBBER_BAND=.55;
/* 滚轮没有「手还按着」那一段，推到头的那一下按这一格的力度弹一次：一格滚轮当作手拖了它
   的三成半，放在最多 480px 宽的橡皮筋上算。宽屏上一整排一千多像素，按整排算，一格
   推出去的量会大到像是整排滑脱了。 */
const WHEEL_PULL=.35;
const WHEEL_PULL_SPAN=480;
export function rubberBand(distance:number,dimension:number):number{
  if(!distance||!(dimension>0))return 0;
  return Math.sign(distance)*(1-1/(Math.abs(distance)*RUBBER_BAND/dimension+1))*dimension;
}
/* 位移挂在这一排的子元素上（`.edgepull>*`，读 `--edge-pull`），不挂在容器自己身上：容器
   一挪，贴着它的渐隐遮罩和外面那一层的边界跟着一起走，右移时还会把整页撑出横向滚动条。
   动画只在越界那一下挂类名，平时子元素上什么都不多。 */
function edgeBounce(el:HTMLElement){
  let spring:Animation|null=null,pulled=0;
  const idle=()=>typeof el.animate!=='function'||matchMedia('(prefers-reduced-motion:reduce)').matches;
  const settle=()=>{spring=null;if(!pulled)el.classList.remove('edgepull')};
  const play=(frames:Keyframe[],duration:number)=>{
    spring?.cancel();el.classList.add('edgepull');
    spring=el.animate(frames,{duration});
    spring.onfinish=settle;
  };
  return {
    /* 拖动跟手：越界多少就按橡皮筋收成多少，松手 `release` 弹回。 */
    drag(excess:number){
      if(idle())return;
      spring?.cancel();spring=null;
      pulled=-rubberBand(excess,el.clientWidth);
      el.classList.toggle('edgepull',!!pulled);
      if(pulled)el.style.setProperty('--edge-pull',`${pulled}px`);else el.style.removeProperty('--edge-pull');
    },
    release(){
      if(!pulled)return;
      const from=pulled,ease=glideEase();pulled=0;el.style.removeProperty('--edge-pull');
      play([{'--edge-pull':`${from}px`,easing:ease.easing},{'--edge-pull':'0px'}],ease.duration);
    },
    /* 滚轮顶到头：冲出去那一段减速，荡回来那段走弹簧。一次手势只弹一下，调用方判。 */
    kick(delta:number){
      if(idle()||pulled)return;
      const peak=-rubberBand(delta*WHEEL_PULL,Math.min(el.clientWidth,WHEEL_PULL_SPAN));
      if(!peak)return;
      const ease=glideEase();
      play([{'--edge-pull':'0px',easing:'cubic-bezier(.2,.8,.4,1)'},
        {'--edge-pull':`${peak}px`,offset:.3,easing:ease.easing},{'--edge-pull':'0px'}],ease.duration*1.6);
    },
  };
}
/** 同一容器只绑定一次。指针在这一排上时滚轮只滚这一排，滚到头弹一下，不带着整页走。 */
/** 会超宽的横向滚动层：两端按滚动位置渐隐，竖向滚轮转成横向，`drag` 为真时可拖。 */
export function wireHorizontalScroller(el:any,{drag=false,fade=true,wheel=true,elastic=true,dragIgnore=''}={}):any{
  if(!el)return;
  if(fade)el.dataset.scrollGesture='';
  const existing=horizontalControls.get(el);
  if(existing){existing.options.drag ||= drag;existing.options.fade ||= fade;existing.update();return existing}
  const options={drag,fade,wheel,elastic,dragIgnore},abort=new AbortController(),bounce=edgeBounce(el);
  let start:{x:number;left:number}|null=null,moved=0,heldUntil=0,target=0,kicked=false,glide=0,glideAt=0,pos=0,pending=0;
  /* 值没变就不写：自动滚动每一帧都触发一次 `scroll`，同值重写属性照样让样式重算一遍。 */
  const mark=(key:string,value:string)=>{if(el.dataset[key]!==value)el.dataset[key]=value};
  /* `overflow-x` 只在尺寸观察器回调里重新读：那一刻样式和布局刚算完，读它不触发重算。
     滚动、滚轮里每次现读，会把上一次写进 `data-overflow-*` 弄脏的整棵样式树当场重算一遍。 */
  let overflowX='';
  const scrollable=()=>{if(!overflowX)overflowX=getComputedStyle(el).overflowX;return ['auto','scroll','hidden'].includes(overflowX)};
  const update=()=>{if(options.fade){const active=scrollable();mark('overflowLeft',String(active&&el.scrollLeft>1));mark('overflowRight',String(active&&el.scrollLeft+el.clientWidth<el.scrollWidth-1))}};
  /* 滚动事件一帧可能来好几次，渐隐标记合到下一帧写一次。 */
  let marking=0;
  const scheduleUpdate=()=>{if(!marking)marking=requestAnimationFrame(()=>{marking=0;update()})};
  const listen=(target:EventTarget,event:string,handler:(event:any)=>void,extra={})=>target.addEventListener(event,handler,{...extra,signal:abort.signal});
  listen(el,'scroll',scheduleUpdate,{passive:true});
  const kick=(delta:number)=>{if(options.elastic&&!kicked){kicked=true;bounce.kick(delta)}};
  const stopGlide=()=>{cancelAnimationFrame(glide);glide=0;pending=0};
  /* 位置自己记一份小数：一帧只走零点几个像素时，`scrollLeft` 读回来是取整后的值。
     推过头的那一下等走到头再弹，半路就弹看起来是没到头先弹了。 */
  const frame=(now:number)=>{
    const dt=Math.min(Math.max(now-glideAt,0),64);glideAt=now;
    pos+=(target-pos)*(1-Math.exp(-dt/WHEEL_GLIDE_MS));
    if(Math.abs(target-pos)<.5)pos=target;
    el.scrollLeft=pos;
    if(pos!==target){glide=requestAnimationFrame(frame);return}
    glide=0;
    if(pending){const delta=pending;pending=0;kick(delta)}
  };
  /* 页面那边开了头的手势拦不住：Chrome 把一串滚轮事件认作同一次手势，第一下没被拦下，
     后面那些就再也拦不住。页面滚着滚着让这一排经过指针底下时，这些原样留给页面。
     在这一排上开头的手势整段都归这一排：还没滚完、滚到头以后，都不把剩下的交给页面；
     要滚整页，指针挪到这一排外面去。推过头就弹一下，一次手势只弹一次：触控板的惯性
     尾巴一格一格地撞在边上，每格都弹就是一串抖动。 */
  listen(el,'wheel',event=>{
    if(!options.wheel)return;
    const max=el.scrollWidth-el.clientWidth;
    if(event.defaultPrevented||!event.cancelable||Math.abs(event.deltaY)<=Math.abs(event.deltaX)||max<=0||!scrollable())return;
    event.preventDefault();
    const now=performance.now(),step=Math.abs(event.deltaY);
    if(now>heldUntil)kicked=false;
    heldUntil=now+WHEEL_GESTURE_GAP;
    // 平滑那一段还在半路时，下一格从上一格的终点接着算。
    const from=glide?target:el.scrollLeft,want=from+event.deltaY;
    target=Math.min(max,Math.max(0,want));
    const over=want===target?0:event.deltaY;
    if(step<WHEEL_SMOOTH_STEP||target===from){
      if(target!==from){stopGlide();el.scrollLeft=target}
      if(over&&!glide)kick(over);else if(over)pending=over;
      return;
    }
    if(over)pending=over;
    if(!glide){pos=el.scrollLeft;glideAt=performance.now();glide=requestAnimationFrame(frame)}
  },{passive:false});
  listen(el,'mousedown',event=>{
    moved=0;
    if(!options.drag||event.button!==0||el.scrollWidth-el.clientWidth<=1)return;
    // 排序项拥有这段指针手势，按下时停止在途滚动，让重排时容器位置保持稳定。
    if(event.target.closest?.('[data-navigation-order] > [data-tab]')){stopGlide();return}
    if(options.dragIgnore&&(event.shiftKey||event.ctrlKey||event.metaKey||event.altKey||event.target.closest?.(options.dragIgnore)))return;
    event.stopPropagation();stopGlide();start={x:event.pageX,left:el.scrollLeft};moved=0;document.documentElement.dataset.dragScrolling='';
  });
  listen(window,'mousemove',event=>{
    if(!start)return;
    const dx=event.pageX-start.x,want=start.left-dx,max=el.scrollWidth-el.clientWidth;
    moved=Math.max(moved,Math.abs(dx));el.scrollLeft=want;
    if(options.elastic)bounce.drag(want<0?want:want>max?want-max:0);
    event.preventDefault();
  });
  const endDrag=()=>{if(start&&options.elastic)bounce.release();if(start)delete document.documentElement.dataset.dragScrolling;start=null};
  listen(window,'mouseup',endDrag);
  listen(window,'blur',endDrag);
  listen(el,'keydown',()=>{moved=0});
  listen(el,'click',event=>{if(moved>6){event.stopPropagation();event.preventDefault();moved=0}},{capture:true});
  /* 尺寸观察器第一次回调就在本帧布局之后，初次的渐隐标记也由它写：挂上的那一刻页面多半
     刚插完一批节点，当场量会把整棵样式树提前重算一遍。内容增删时重挂观察器，新挂上的
     子元素会再回调一次；只删不增的那种由下一帧补写。 */
  const resize=new ResizeObserver(()=>{overflowX='';update()});
  const observe=()=>{resize.observe(el);for(const child of el.children)resize.observe(child)};
  const contents=new MutationObserver(()=>{resize.disconnect();observe();scheduleUpdate()});
  contents.observe(el,{childList:true,characterData:true,subtree:true});observe();
  // 外面手动叫的重算（换了版式、改了内容）连 `overflow-x` 一起重读。
  const control={options,update(){overflowX='';update()},destroy(){abort.abort();stopGlide();cancelAnimationFrame(marking);marking=0;resize.disconnect();contents.disconnect();horizontalControls.delete(el);delete el.dataset.scrollGesture;if(start)delete document.documentElement.dataset.dragScrolling;if(!horizontalControls.size){horizontalCleanup?.disconnect();horizontalCleanup=null}}};
  horizontalControls.set(el,control);
  if(!horizontalCleanup){horizontalCleanup=new MutationObserver(()=>{for(const [node,item] of horizontalControls)if(!node.isConnected)item.destroy()});horizontalCleanup.observe(document.body,{childList:true,subtree:true})}
  return control;
}

/** 表格使用横向拖动；滚轮维持浏览器行为，控件、列宽手柄与整行表头独立处理指针（表头按偏了也不起拖）。 */
export function wireTableScroller(el:HTMLElement|null):any{
  return wireHorizontalScroller(el,{drag:true,fade:false,wheel:false,elastic:false,
    dragIgnore:'a,button,input,select,textarea,label,[role="button"],[role="checkbox"],[role="slider"],.react-aria-ColumnResizer,thead'});
}

/* 一排横卡自己缓缓往前走，走到头停一下再往回走。一秒 24px 是看得出在动、又不催人读的
   速度：一张 168px 的卡七秒走过去。两端各停两秒，最后一张和第一张都看得清。 */
const AUTO_SCROLL_SPEED=24;
const AUTO_SCROLL_DWELL=2000;
/* 人手动过之后隔多久再接着走：刚滚到想看的那张，这一排马上又自己挪走，等于跟人抢。 */
const AUTO_SCROLL_RESUME=3000;
const autoScrollers=new Map<Element,()=>void>();
const autoScrollWakeups=new Set<()=>void>();
let autoScrollVisibility:MutationObserver|null=null;
let autoScrollSight:IntersectionObserver|null=null;
const autoScrollSightings=new Map<Element,(visible:boolean)=>void>();
/**
 * 横排自动滚动。指针停在上面、焦点在里面、这一排不在屏幕上、页面切到后台时都停；
 * 人滚过或拖过之后从人停下的位置接着走。系统要求减少动态效果时不动。
 */
export function wireAutoScroll(el:any):void{
  if(!el||autoScrollers.has(el))return;
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const abort=new AbortController();
  let pos=el.scrollLeft,dir=1,last=0,frame=0,hovered=false,focused=false,onscreen=true,holdUntil=0,max=-1,resync=false;
  const listen=(target:EventTarget,type:string,fn:()=>void)=>target.addEventListener(type,fn,{passive:true,signal:abort.signal});
  /* 在不在屏幕上交给共用的交叉观察器，回调里叫醒；循环里只读自己记下的状态。每帧量
     `getBoundingClientRect()` 会在上一帧写完 `scrollLeft` 之后把整棵样式树当场重算。
     交叉观察器不看 `visibility`：播放墙盖住页面时这一排几何上仍在屏幕里，按页面标记停。 */
  const covered=()=>(document.body.hasAttribute('data-detail-open')&&!el.closest('#stage'))
    ||(document.body.hasAttribute('data-wall-open')&&!el.closest('[data-video-wall]'));
  const running=()=>el.isConnected&&onscreen&&!hovered&&!focused&&!document.hidden&&!covered();
  const tick=(now:number)=>{
    frame=0;
    if(!el.isConnected){stop();return}
    if(!running())return;
    frame=requestAnimationFrame(tick);
    const dt=last?Math.min(now-last,64):0;last=now;
    if(now<holdUntil)return;
    /* 循环里只写不读：可滚距离等尺寸变了才重量，人动过之后才回读一次位置。每帧读一次
       `scrollWidth`，赶上别处刚改过样式（换主题、悬停、滚页面）就是一次整树重算。 */
    if(max<0)max=el.scrollWidth-el.clientWidth;
    if(resync){resync=false;pos=el.scrollLeft}
    if(max<=1)return;
    /* 位置自己记一份小数：一帧只走零点几个像素，`scrollLeft` 读回来是取整后的值，
       拿它接着加会一直原地不动。 */
    pos=Math.min(max,Math.max(0,pos+dir*AUTO_SCROLL_SPEED*dt/1000));
    el.scrollLeft=pos;
    if(pos>=max||pos<=0){dir=pos>=max?-1:1;holdUntil=now+AUTO_SCROLL_DWELL}
  };
  // 重画换掉了这一排时，挂在 document 上的监听要在下一次叫醒时跟着撤掉。
  const wake=()=>{if(!el.isConnected)stop();else if(!frame&&running()){last=0;frame=requestAnimationFrame(tick)}};
  const hold=()=>{holdUntil=performance.now()+AUTO_SCROLL_RESUME};
  /* 人能滚这一排的时候指针一定在上面或焦点在里面（滚轮、拖动、触摸、方向键），那时循环已经停了；
     离开时记下要回读位置，下一帧从人停下的地方接着走。 */
  listen(el,'pointerenter',()=>{hovered=true});
  listen(el,'pointerleave',()=>{hovered=false;resync=true;hold();wake()});
  listen(el,'focusin',()=>{focused=true});
  listen(el,'focusout',()=>setTimeout(()=>{focused=el.contains(document.activeElement);resync=true;wake()},0));
  const sizes=new ResizeObserver(()=>{max=-1});
  sizes.observe(el);
  const contents=new MutationObserver(()=>{max=-1});
  contents.observe(el,{childList:true});
  listen(document,'visibilitychange',wake);
  wake();
  function stop(){cancelAnimationFrame(frame);frame=0;abort.abort();sizes.disconnect();contents.disconnect();autoScrollers.delete(el);autoScrollWakeups.delete(wake);
    autoScrollSight?.unobserve(el);autoScrollSightings.delete(el);
    if(!autoScrollers.size){autoScrollVisibility?.disconnect();autoScrollVisibility=null;autoScrollSight?.disconnect();autoScrollSight=null}}
  autoScrollers.set(el,stop);
  autoScrollWakeups.add(wake);
  if(!autoScrollVisibility){autoScrollVisibility=new MutationObserver(()=>autoScrollWakeups.forEach(resume=>resume()));
    autoScrollVisibility.observe(document.body,{attributes:true,attributeFilter:['data-detail-open','data-wall-open']})}
  if(typeof IntersectionObserver==='function'){
    autoScrollSight??=new IntersectionObserver(entries=>{for(const entry of entries)autoScrollSightings.get(entry.target)?.(entry.isIntersecting)});
    autoScrollSightings.set(el,visible=>{onscreen=visible;wake()});
    autoScrollSight.observe(el);
  }
}
export function stopAutoScroll(el:Element):void{autoScrollers.get(el)?.()}

/* 一排里标出「当前是哪一个」的那块底板，全站只有这一种动法：滑过去、冲过落点、荡回来。
   筛选条上那块玻璃、抽屉那一列、分段控件里那块白底，在人眼里是同一件事，各写一段就会
   各自漂移成三种手感。
   弹簧曲线和它的时长都写在 `board.css` 的 `--spring-pane` 上，这里只读一次：那串数是一次
   弹簧模拟的采样结果，抄第二份就没人再改得动它。 */
let paneSpring:{easing:string;duration:number}|null=null;
export function glideEase():{easing:string;duration:number}{
  if(!paneSpring){
    const css=getComputedStyle(document.documentElement);
    paneSpring={easing:css.getPropertyValue('--spring-pane').trim()||'ease',
      duration:parseFloat(css.getPropertyValue('--spring-pane-ms'))||300};
  }
  return paneSpring;
}
/* 位移走 `translate`、形变走 `scale`，两个独立属性各挂一段动画，不挤进同一条
   `transform`：一条属性上只放得下一段，而这两下的时间形状不是同一条曲线——位移冲过
   落点再荡回来，抻开是中途最大、两头归一。分开写，两段仍然都在合成线程上。
   都不碰 `width`：宽度是布局属性，逐帧改它等于让整份文档重新排版一遍，合成线程碰不
   到它，主线程一忙这块底板就跟着卡住。
   `from` 给 null 就只落位不动画：第一次出现的那块不该从别处飞进来。 */
export function moveGlidePane(
  pane:HTMLElement,
  from:{x:number;y:number;w:number;h:number}|null,
  box:{x:number;y:number;w:number;h:number},
  axis:'x'|'y'='x',
):void{
  /* 原地重量也要撤掉还在跑的位移与形变，动画不能继续覆盖新落点。 */
  cancelGlide(pane);
  pane.style.width=`${box.w}px`;pane.style.height=`${box.h}px`;
  const span=axis==='y'?'h':'w',head=axis==='y'?'y':'x';
  const settled=`${box.x}px ${box.y}px`;
  if(from&&from[head]!==box[head]&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
    const ease=glideEase();
    const moving=[pane.animate([{translate:axis==='y'?`${box.x}px ${from.y}px`:`${from.x}px ${box.y}px`},
      {translate:settled}],{duration:ease.duration,easing:ease.easing,fill:'none'})];
    glides.set(pane,moving);
    /* 一块被拽着走的软东西，跑起来在跑的方向上抻开，停下来收回去。抻多少按这一跳跨了
       自己几个身位算，封在一个半身位：再远也不该更长，那时候读起来不是被拉长的同一
       块，是换上来的另一块。峰值压在前三成——加速那一段才拉得动它。
       形变只在这一排排布的方向上：另一根轴的尺寸是这一排给定的，在那儿拉扯会让它看
       起来不是这一排里的东西。 */
    const reach=Math.min(Math.abs(box[head]-from[head])/box[span],1.5),grow=1+reach*.12;
    moving.push(pane.animate([{scale:'1 1',offset:0},
      {scale:axis==='y'?`1 ${grow}`:`${grow} 1`,offset:.3},{scale:'1 1',offset:1}],
      {duration:ease.duration,easing:'ease-in-out',fill:'none'}));
  }
  pane.style.translate=settled;
}
/* 底板上跑的只有上面这两段，自己记着撤：`getAnimations()` 要先把整份样式算到最新才答得上来，
   侧栏开合那一下正好整页样式都脏着，读一次就是一次整树重算。 */
const glides=new WeakMap<HTMLElement,Animation[]>();
export function cancelGlide(pane:HTMLElement|null|undefined):void{
  if(!pane)return;
  glides.get(pane)?.forEach(a=>a.cancel());
  glides.delete(pane);
}
/** 底板正在滑：等这一段跑完再调 `then`（被撤掉就不调），返回 true。没在滑时返回 false，调用方当场处理。
 *  给「原地重量」用：键被点中时所在那一排常会跟着平滑滚几帧，每帧都撤掉重摆的话，刚起跑的滑动当场就没了。 */
export function afterGlide(pane:HTMLElement|null|undefined,then:()=>void):boolean{
  const moving=pane?glides.get(pane):undefined;
  if(!moving?.length||moving.every(a=>a.playState==='finished'))return false;
  moving[0]!.finished.then(()=>{if(glides.get(pane!)===moving)then()},()=>{});
  return true;
}

/** Geist Scroller: one-axis overflow with edge fades as the scroll affordance. */
export function scrollerHtml(content:string,{className='',label=t('shell:scroller.defaultLabel'),overflow='y'}={}){
  const axis=new Set(['x','y','both']).has(overflow)?overflow:'y';
  return `<div class="ui-geist-scroller${className?` ${esc(className)}`:''}" data-geist-scroller>
    <div class="ui-geist-scroller-overlay" aria-hidden="true"></div>
    <div class="ui-geist-scroller-container" data-overflow="${axis}" tabindex="0" aria-label="${esc(label)}">${content}</div>
  </div>`;
}

function updateScroller(wrapper:Element){
  const container=wrapper.querySelector(':scope > .ui-geist-scroller-container');
  const overlay=wrapper.querySelector(':scope > .ui-geist-scroller-overlay');
  if(!container||!overlay)return;
  overlay.classList.toggle('ui-can-scroll-top',container.scrollTop>1);
  overlay.classList.toggle('ui-can-scroll-bottom',container.scrollTop+container.clientHeight<container.scrollHeight-1);
  overlay.classList.toggle('can-scroll-left',container.scrollLeft>1);
  overlay.classList.toggle('can-scroll-right',container.scrollLeft+container.clientWidth<container.scrollWidth-1);
}

/** Wire newly rendered scrollers without duplicating listeners after a rerender. */
export function wireScrollers(root:ParentNode=document):void{
  root.querySelectorAll('[data-geist-scroller]').forEach(wrapper=>{
    const container=wrapper.querySelector<HTMLElement>(':scope > .ui-geist-scroller-container');
    if(!container)return;
    if(!container.dataset.scrollerWired){
      container.dataset.scrollerWired='true';
      container.addEventListener('scroll',()=>updateScroller(wrapper),{passive:true});
      container.addEventListener('load',()=>updateScroller(wrapper),true);
    }
    requestAnimationFrame(()=>updateScroller(wrapper));
  });
}

/* Board 层里会超宽的横向滚动层：两端按滚动位置渐隐说明「那边还有」，鼠标停在上面时竖向
   滚轮转成横向。边线留给外层框，渐隐只落在这一层。
   这里登记的都是 `frontend/` 或 board.css 画出来的层，它们不经过 `wireAllDrag` 那份按 id
   点名的清单，漏登记就是「看得见、够不着」：一排分区在 390px 下溢出两百多像素，
   却既没有渐隐也不接滚轮。组件自己量溢出，不溢出的宽度上登记等于空转，所以按可能
   溢出的层登记，不按某一个断点登记。React 档的页面自己用 `overflow-x-auto`，不进这份清单。 */
const BOARD_EDGE_SCROLLERS='.reviewtabs,.ftablewrap,.ui-board-local-nav,[data-manage-menu],'
  +'.follow-workspace-switch,.fmanagenav';

/** 按实际 overflow 接管滚动容器；横向手势导航保留现有渐隐反馈。 */
export function wireOverlayScrollbars(root:ParentNode=document,subtree=true):void{
  const nodes=[...(root instanceof HTMLElement?[root]:[]),...(subtree?root.querySelectorAll<HTMLElement>('*'):[])];
  nodes.filter(el=>el instanceof HTMLElement&&el.matches(BOARD_EDGE_SCROLLERS)).forEach(el=>wireHorizontalScroller(el));
  const gesture=(el:HTMLElement)=>el.hasAttribute('data-horizontal-scroll')
    ||(horizontalControls.has(el)&&horizontalControls.get(el).options.fade!==false);
  // 样式读取与轨道挂载分两段，避免每插入一条轨道就重新计算后面所有节点的样式。
  const candidates=nodes.flatMap<{el:HTMLElement;axes:readonly ('x'|'y')[]}>(el=>{
    if(!(el instanceof HTMLElement)||el===document.body||el===document.documentElement
      ||el.closest('.ovtrack,.ui-ov-edges'))return [];
    if(el.closest('[data-skeleton],[data-skeleton-tier]')){detachOverlayScrollbar(el);return []}
    if(el.closest('[inert]'))return [];
    const horizontalGesture=gesture(el),axes=horizontalGesture?['y'] as const:['y','x'] as const;
    if(el.dataset.overlayScrollbar&&el.dataset.overlayAxes===axes.join(''))return [];
    const style=getComputedStyle(el);
    const vertical=/^(auto|scroll)$/.test(style.overflowY);
    if(vertical||(!horizontalGesture&&/^(auto|scroll)$/.test(style.overflowX)))return [{el,axes}];
    return horizontalGesture&&el.dataset.overlayScrollbar?[{el,axes:[] as const}]:[];
  });
  candidates.forEach(({el,axes})=>axes.length?attachOverlayScrollbar(el,{axes}):detachOverlayScrollbar(el));
}

/** 按新增子树及样式变化增量接管滚动区；响应式布局改变时刷新整棵树。 */
export function observeScrollRegions(root:HTMLElement=document.body):()=>void{
  let frame=0;
  const pending=new Map<HTMLElement,boolean>();
  const decorative=(node:Element)=>!!node.closest('.ovtrack,.ui-ov-edges');
  const flush=()=>{
    frame=0;
    const trees=[...pending].filter(([node])=>node.isConnected);
    pending.clear();
    for(const [node,subtree] of trees)if(!trees.some(([parent,deep])=>deep&&parent!==node&&parent.contains(node)))wireOverlayScrollbars(node,subtree);
    pruneOverlayScrollbars();
  };
  const queue=(node:HTMLElement,subtree=true)=>{
    if(decorative(node))return;
    pending.set(node,(pending.get(node)??false)||subtree);
    if(!frame)frame=requestAnimationFrame(flush);
  };
  const observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='attributes'){
        if(record.target instanceof HTMLElement){
          if(record.attributeName==='data-theater')refreshOverlayScrollbars(record.target);
          queue(record.target,record.attributeName!=='style');
        }
      }else{
        for(const node of record.addedNodes)if(node instanceof HTMLElement)queue(node);
        if(record.removedNodes.length&&!frame)frame=requestAnimationFrame(flush);
      }
    }
  });
  observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','open','inert','data-skeleton','data-skeleton-tier','data-horizontal-scroll','data-theater']});
  const resize=()=>queue(root);
  window.addEventListener('resize',resize,{passive:true});
  queue(root);
  return ()=>{observer.disconnect();window.removeEventListener('resize',resize);cancelAnimationFrame(frame);pending.clear();releaseOverlayScrollbars(root);pruneOverlayScrollbars()};
}
