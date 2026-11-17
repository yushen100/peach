/* Geist MiddleTruncate 的 Peach 原生适配层。

   只复用已验证的行为：按容器宽度保留首尾、使用单个省略号、宽度变化后重算、复制与无障碍名称
   仍提供完整原文。调用方只需给文件名、路径、URL 或 ID 加 data-middle-truncate；标题和说明继续
   使用末尾省略。随 `peach-app.js` 发出，由 Application 启动与清理全文档的唯一观察者，
   原生宿主与 React 子树写的属性都归它管。 */

interface TruncateState { full: string; rendered: string }

const ELLIPSIS='…';
const segmenter=typeof Intl.Segmenter==='function'
  ? new Intl.Segmenter(undefined,{granularity:'grapheme'})
  : null;
const states=new WeakMap<Element,TruncateState>();
const scheduled=new Set<HTMLElement>();
let frame=0;
let observed=new WeakSet<Element>();
let resizeObserver:ResizeObserver|null=null;
let disposeTruncation:(()=>void)|null=null;

const graphemes=(value:unknown)=>segmenter
  ? [...segmenter.segment(String(value??''))].map(part=>part.segment)
  : Array.from(String(value??''));

/* 保留 kept 个字形时的显示文字，奇数位优先保留开头；kept 等于总数即原文。 */
const keptText=(parts:string[],kept:number)=>{
  if(kept>=parts.length)return parts.join('');
  const head=Math.ceil(kept/2),tail=Math.floor(kept/2);
  return parts.slice(0,head).join('')+ELLIPSIS+(tail?parts.slice(-tail).join(''):'');
};

/* 二分寻找能放下的最长首尾组合，返回保留的字形数；全都放不下时为 0，只剩省略号。 */
const longestKept=(parts:string[],fits:(candidate:string)=>boolean)=>{
  if(!parts.length||fits(parts.join('')))return parts.length;
  let low=0,high=parts.length-1,best=0;
  while(low<=high){
    const kept=(low+high)>>1;
    if(fits(keptText(parts,kept))){best=kept;low=kept+1}else high=kept-1;
  }
  return best;
};

/* 纯算法边界单独导出，Node 可直接实测，不需要伪造 DOM。fits(candidate) 由浏览器
   测量层注入。 */
function middleTruncateText(value:unknown,fits:(candidate:string)=>boolean):string{
  const parts=graphemes(value);
  return keptText(parts,longestKept(parts,fits));
}

/* 页面开着 text-autospace：Chromium 在汉字、假名与拉丁字母、数字相邻处加 1/8 em 的间距，
   全角标点还受 text-spacing-trim 挤压，Canvas 的 measureText 两样都不算。含这类字符的文字
   拿 Canvas 读数（补上估算的间距）当起点，再由离屏 DOM 探针逐个确认；纯西文仍只用 Canvas。 */
const WIDE=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}　-〿＀-￯]/u;
const IDEOGRAPH=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const ALPHANUMERIC=/[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Nd}]/u;
const FULLWIDTH=/[＀-￯]/u;

const spacingClass=(char:string)=>IDEOGRAPH.test(char)?1:ALPHANUMERIC.test(char)&&!FULLWIDTH.test(char)?2:0;
const autospaceGaps=(value:string)=>{
  let gaps=0,previous=0;
  for(const char of value){
    const current=spacingClass(char);
    if(previous&&current&&previous!==current)gaps++;
    previous=current;
  }
  return gaps;
};

let canvas:HTMLCanvasElement|null=null;
const canvasWidth=(element:Element,mixed:boolean)=>{
  const style=getComputedStyle(element);
  const context=(canvas||(canvas=document.createElement('canvas'))).getContext('2d');
  if(!context)return ()=>Number.POSITIVE_INFINITY;
  /* Chromium 会在 font-variant-numeric 等长数字开启时把计算后的 font 简写返回为空串；
     直接赋值会让 Canvas 静默退回 10px sans-serif，进而低估中文文件名宽度。 */
  context.font=style.font||`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const letterSpacing=parseFloat(style.letterSpacing),wordSpacing=parseFloat(style.wordSpacing);
  const autospace=style.getPropertyValue('text-autospace');
  const gap=mixed&&autospace&&autospace!=='no-autospace'?(parseFloat(style.fontSize)||0)/8:0;
  return (value:string)=>{
    let width=context.measureText(value).width;
    if(Number.isFinite(letterSpacing))width+=Math.max(0,graphemes(value).length-1)*letterSpacing;
    if(Number.isFinite(wordSpacing))width+=(value.match(/\s/g)||[]).length*wordSpacing;
    if(gap)width+=autospaceGaps(value)*gap;
    return width;
  };
};

/* 探针挂在 <html> 下、<body> 之外，量的时候不惊动正文的 MutationObserver；contain: strict
   让改字只重排它自己。它继承不到 React 容器上的样式，排版相关的计算值逐项抄过去，同款样式
   连续量时不重设。 */
const PROBE_STYLE=['font-family','font-size','font-weight','font-style','font-stretch',
  'font-variant-ligatures','font-variant-caps','font-variant-numeric','font-variant-east-asian',
  'font-variant-alternates','font-variant-position','font-feature-settings','font-variation-settings',
  'font-kerning','font-optical-sizing','font-size-adjust','font-synthesis','letter-spacing','word-spacing',
  'text-transform','text-rendering','text-autospace','text-spacing-trim','white-space-collapse'];
let probe:{box:HTMLElement,groups:Map<string,HTMLElement>}|null=null;

const probeGroup=(element:Element)=>{
  if(!probe){
    const box=document.createElement('div');
    box.setAttribute('aria-hidden','true');box.dataset.middleTruncateProbe='';
    box.style.cssText='position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;contain:strict';
    probe={box,groups:new Map()};
  }
  if(!probe.box.isConnected)document.documentElement.append(probe.box);
  const style=getComputedStyle(element);
  const values=PROBE_STYLE.map(name=>style.getPropertyValue(name));
  const lang=element.closest('[lang]')?.getAttribute('lang')||'';
  const key=values.join('\n')+'\n'+lang;
  let group=probe.groups.get(key);
  if(!group){
    group=document.createElement('div');
    values.forEach((value,index)=>group!.style.setProperty(PROBE_STYLE[index]!,value));
    group.lang=lang;probe.box.append(group);probe.groups.set(key,group);
  }
  return group;
};

interface Fit { element:HTMLElement; state:TruncateState; available:number; parts:string[]; kept:number }
interface Probing { fit:Fit; group:HTMLElement; fits:number; fails:number; tries:number[] }

/* 每帧只排一次探针：所有待定元素的候选同时放进探针，读一遍宽度，再按结果收窄区间。
   fits 是已确认放得下的最大保留数（0 只剩省略号，总能放下），fails 是已确认放不下的最小值。
   首轮试 Canvas 种子与它的下一个，通常一轮定论；没定的再试区间两端与中间，几轮内收敛。 */
const MAX_PROBE_ROUNDS=8;
const probeAll=(pending:Probing[])=>{
  for(let round=0;pending.length&&round<MAX_PROBE_ROUNDS;round++){
    const spans=pending.map(job=>job.tries.map(count=>{
      const span=document.createElement('span');
      span.style.cssText='display:block;width:max-content;text-wrap-mode:nowrap';
      span.textContent=keptText(job.fit.parts,count);job.group.append(span);
      return span;
    }));
    pending.forEach((job,index)=>job.tries.forEach((count,offset)=>{
      if(spans[index]![offset]!.getBoundingClientRect().width<=job.fit.available)job.fits=Math.max(job.fits,count);
      else job.fails=Math.min(job.fails,count);
    }));
    spans.flat().forEach(span=>span.remove());
    pending=pending.filter(job=>{
      job.fit.kept=job.fits;
      const open=job.fails-job.fits-1;
      if(open<=0)return false;
      const step=(job.fails-job.fits)/3;
      job.tries=[...new Set([job.fails-1,job.fits+1,Math.round(job.fits+step),Math.round(job.fits+2*step)])]
        .filter(count=>count>job.fits&&count<job.fails);
      return true;
    });
  }
};

/* 先按 Canvas 定下所有元素的结果；含中日文的再交探针批量确认。 */
const fitAll=(fits:Fit[])=>{
  const pending:Probing[]=[];
  for(const fit of fits){
    const full=fit.state.full,mixed=WIDE.test(full);
    const estimate=canvasWidth(fit.element,mixed);
    fit.kept=longestKept(fit.parts,candidate=>estimate(candidate)<=fit.available);
    if(!mixed)continue;
    const tries=[fit.kept,fit.kept+1].filter(count=>count>0&&count<=fit.parts.length);
    pending.push({fit,group:probeGroup(fit.element),fits:0,fails:fit.parts.length+1,tries});
  }
  probeAll(pending);
};

/* clientWidth 取整到整数。盒子按内容收缩（面包屑里带 max-width 的名字）时向下取整就比现有文字
   窄一点，探针量得准，每一轮都判「放不下」再截短一个字。改取计算样式里的小数宽度，序列化只留
   六位有效数字，补一个 LayoutUnit；向上取整时仍用 clientWidth，原来放得下的结果不变。 */
const clientWidth=(element:HTMLElement)=>{
  const style=getComputedStyle(element),width=parseFloat(style.width);
  if(!Number.isFinite(width))return element.clientWidth;
  const inner=style.boxSizing==='border-box'
    ? width-(parseFloat(style.borderLeftWidth)||0)-(parseFloat(style.borderRightWidth)||0)
    : width+(parseFloat(style.paddingLeft)||0)+(parseFloat(style.paddingRight)||0);
  return Math.max(element.clientWidth,inner+1/64);
};

/* 可用宽度默认取元素自己的盒子。带 data-middle-truncate-within 的元素按内容收缩（后面紧跟着
   别的东西，比如文件名后面的「最大」标记），自己的盒子就是当前文字的宽度——拿它当上限，
   clientWidth 取整少掉的那不到一像素每一轮都让全文「放不下」，越截越短。这类元素改按父级
   量：父级的内容宽减去所有兄弟和列间距，剩下的才是文字能占的。 */
const availableWidth=(element:HTMLElement)=>{
  if(element.dataset.middleTruncateWithin===undefined)return clientWidth(element);
  const box=element.parentElement;if(!box)return element.clientWidth;
  const style=getComputedStyle(box);
  const gap=parseFloat(style.columnGap)||0;
  let used=0,shown=0;
  for(const child of box.children){
    const width=child.getBoundingClientRect().width;
    if(child===element){shown++;continue}
    if(width>0){used+=width;shown++}
  }
  return box.getBoundingClientRect().width-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0)
    -used-gap*Math.max(0,shown-1);
};

/* 一帧里先读完所有宽度、量完所有候选，最后统一写回：边读边写会让每个元素都触发一次整页重排，
   几百个文件名时一次 resize 要排上几百遍。 */
const paint=()=>{
  frame=0;
  const fits:Fit[]=[];
  for(const element of scheduled){
    const state=states.get(element);
    if(!state||!element.isConnected)continue;
    fits.push({element,state,available:availableWidth(element),parts:graphemes(state.full),kept:0});
  }
  scheduled.clear();
  fitAll(fits.filter(fit=>fit.available>0));
  for(const {element,state,available,parts,kept} of fits){
    const rendered=available>0?keptText(parts,kept):state.full;
    state.rendered=rendered;
    if(element.textContent!==rendered)element.textContent=rendered;
    const truncated=rendered!==state.full;
    element.classList.toggle('middle-truncated',truncated);
    element.setAttribute('aria-label',state.full);
    if(!element.hasAttribute('title')||element.dataset.middleTitle==='true'){
      element.title=state.full;element.dataset.middleTitle='true';
    }
  }
};

/** 富文本由 React 渲染时复用相同测量，返回中间需要省略的 UTF-16 区间。 */
export function middleTruncateCut(element: HTMLElement, value: string): { start: number; end: number } | null {
  const parts = graphemes(value);
  const fit: Fit = {
    element, state: { full: value, rendered: value },
    available: availableWidth(element), parts, kept: 0,
  };
  if (fit.available <= 0) return null;
  fitAll([fit]);
  if (fit.kept >= parts.length) return null;
  const head = Math.ceil(fit.kept / 2), tail = Math.floor(fit.kept / 2);
  return {
    start: parts.slice(0, head).join('').length,
    end: value.length - parts.slice(parts.length - tail).join('').length,
  };
}

const schedule=(element:Element)=>{
  if(!states.has(element))return;
  scheduled.add(element as HTMLElement);
  if(!frame)frame=requestAnimationFrame(paint);
};

const bind=(element:Element)=>{
  if(!(element instanceof HTMLElement))return;
  if(element.hasAttribute('data-middle-truncate-managed'))return;
  if(!states.has(element))states.set(element,{full:element.textContent||'',rendered:element.textContent||''});
  if(!observed.has(element)){
    observed.add(element);
    /* 按父级量的元素跟着父级的尺寸重算：它自己的盒子只会随文字变，不会随窗口变。 */
    if(element.dataset.middleTruncateWithin!==undefined&&element.parentElement)resizeObserver?.observe(element.parentElement);
    else resizeObserver?.observe(element);
  }
  schedule(element);
};

const scan=(node:Node)=>{
  if(node.nodeType!==Node.ELEMENT_NODE)return;
  const element=node as Element;
  if(element.matches('[data-middle-truncate]'))bind(element);
  element.querySelectorAll('[data-middle-truncate]').forEach(bind);
};

function initMiddleTruncate(root:Document|Element=document):()=>void{
  disposeTruncation?.();
  observed=new WeakSet<Element>();
  let live=true;
  resizeObserver=new ResizeObserver(entries=>entries.forEach(entry=>{
    if(!live)return;
    schedule(entry.target);
    entry.target.querySelectorAll?.(':scope>[data-middle-truncate-within]').forEach(schedule);
  }));
  const resize=resizeObserver;
  scan((root as Document).documentElement||root);
  const mutations=new MutationObserver(records=>records.forEach(record=>{
    if(!live)return;
    record.addedNodes.forEach(scan);
    const element=record.target.nodeType===Node.TEXT_NODE?record.target.parentElement:record.target as Element;
    const target=element?.closest?.('[data-middle-truncate]') as HTMLElement|null|undefined;
    if(!target)return;
    const state=states.get(target);
    if(state&&target.textContent!==state.rendered){
      state.full=target.textContent||'';
      if(target.dataset.middleTitle==='true')target.removeAttribute('title');
      schedule(target);
    }
  }));
  mutations.observe((root as Document).body||root,{childList:true,characterData:true,subtree:true});
  document.fonts?.ready?.then(()=>{if(live)root.querySelectorAll('[data-middle-truncate]').forEach(schedule)});
  const copy:EventListener=event=>{
    const selection=document.getSelection();
    if(!selection||selection.isCollapsed)return;
    const anchor=selection.anchorNode?.nodeType===Node.ELEMENT_NODE?selection.anchorNode as Element:selection.anchorNode?.parentElement;
    const target=anchor?.closest?.('[data-middle-truncate]');
    const state=target&&states.get(target);
    if(!state||!target.contains(selection.focusNode)||!(event as ClipboardEvent).clipboardData)return;
    (event as ClipboardEvent).clipboardData?.setData('text/plain',state.full);event.preventDefault();
  };
  root.addEventListener('copy',copy);
  const dispose=()=>{
    if(!live)return;live=false;
    resize.disconnect();mutations.disconnect();root.removeEventListener('copy',copy);probe?.box.remove();
    if(frame)cancelAnimationFrame(frame);
    frame=0;scheduled.clear();
    if(disposeTruncation===dispose){disposeTruncation=null;resizeObserver=null}
  };
  disposeTruncation=dispose;
  return dispose;
}

export { initMiddleTruncate, middleTruncateText };
