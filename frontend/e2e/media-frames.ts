/* 媒体格与它所在那层底的明度差。
 *
 * 媒体格指封面、头像、缩略图、照片这类「放一张图」的格子：图没有、没加载完或取不到时，露出来的
 * 是格子自己的底色。这块底要和它坐着的那层面分得开，否则「无封面」那格看着就像没有格子。
 *
 * 认格子不看类名，看浏览器里的计算值，写法换了照样认得出：
 * - 自己画了底色（不透明度大于 0），且
 * - 是一个比例框（`aspect-ratio` 不是 auto），或直接装着 `img`／`video`／`picture`／`canvas`，
 *   或是一个不大于 64px、装着字而没有 svg 的正圆（头像首字母那种，没有图时里面只有字）。
 *
 * 底下那层按祖先链从格子往上找，一路把半透明的底叠起来，直到第一层不透明的底；叠色交给 1×1
 * 画布做，和屏幕上的合成一个算法，`oklch()`、`color-mix()` 不用自己解析。底不是一个颜色时量
 * 不出来，记作 `skipped`：祖先里有背景图（模糊衬底、渐变）或毛玻璃，或者底是纯黑的媒体层。 */
import type { Locator, Page } from 'playwright-core';

export interface FrameReading {
  /** 选择器式的路径，标签加 data-* 名，够在源码里找到它。 */
  frame: string;
  /** 格子底叠在那层面上之后的 CIE L*，与那层面自己的 L*。 */
  fill: number;
  ground: number;
  delta: number;
  /** 祖先链上有背景图，底不是一个颜色。 */
  skipped: boolean;
  /** 格子里此刻有没有加载出来的图：有图时底被盖住，量的是图取不到时会露出来的那块。 */
  covered: boolean;
}

/** 量 `scope` 里所有可见的媒体格。只读计算值，不改页面。 */
export async function mediaFrames(page: Page, scope = 'body'): Promise<FrameReading[]> {
  return page.locator(scope).first().evaluate(readFrames);
}

/** 同上，只量一个容器里面的格子：悬停或选中某一行之后，只看这一行。 */
export async function mediaFramesIn(container: Locator): Promise<FrameReading[]> {
  return container.evaluate(readFrames);
}

/** 在页面里执行。整段自包含：`evaluate` 只序列化函数体，外面的辅助函数带不进去。 */
function readFrames(root: Element): FrameReading[] {
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const alpha = (color: string) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = 'rgba(0, 0, 0, 0)';
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    return context.getImageData(0, 0, 1, 1).data[3]!;
  };
  const lightness = ([red, green, blue]: number[]) => {
    const linear = (channel: number) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const y = 0.2126 * linear(red!) + 0.7152 * linear(green!) + 0.0722 * linear(blue!);
    return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
  };
  /* 自下往上一层层叠：最底下先铺一层不透明白，免得祖先链一路透明时读到的是画布的空。 */
  const composite = (layers: string[]) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 1, 1);
    for (const color of layers) {
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
    }
    return [...context.getImageData(0, 0, 1, 1).data];
  };
  const label = (node: Element) => {
    const data = [...node.attributes].map((item) => item.name).filter((name) => name.startsWith('data-'));
    return node.tagName.toLowerCase() + data.map((name) => `[${name}]`).join('');
  };
  const path = (node: Element) => {
    const parts: string[] = [];
    for (let at: Element | null = node; at && at !== document.body && parts.length < 4; at = at.parentElement) {
      parts.unshift(label(at));
    }
    return parts.join(' > ');
  };
  const visible = (node: Element) => {
    const box = node.getBoundingClientRect();
    if (box.width < 16 || box.height < 16) return false;
    return node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  };
  const isFrame = (node: Element, style: CSSStyleDeclaration) => {
    const holdsImage = !!node.querySelector(':scope > :is(img, video, picture, canvas)');
    if (holdsImage || style.aspectRatio !== 'auto') return true;
    /* 圆形图标键（顶栏、播放器、换头像那颗）只装一枚 svg，不是放图的格子。 */
    if (node.querySelector('svg') || !node.textContent?.trim()) return false;
    const box = node.getBoundingClientRect();
    const radius = parseFloat(style.borderTopLeftRadius);
    const round = style.borderTopLeftRadius.endsWith('%') ? radius >= 50 : radius >= box.width / 2 - 1;
    return round && Math.abs(box.width - box.height) < 1 && box.width <= 64;
  };
  const readings: FrameReading[] = [];
  for (const node of [root, ...root.querySelectorAll('*')]) {
    const style = getComputedStyle(node);
    if (!alpha(style.backgroundColor) || !isFrame(node, style) || !visible(node)) continue;
    const layers: string[] = [];
    let skipped = false;
    for (let at = node.parentElement; at; at = at.parentElement) {
      const own = getComputedStyle(at);
      if (own.backgroundImage !== 'none' || own.backdropFilter !== 'none') skipped = true;
      if (!alpha(own.backgroundColor)) continue;
      layers.unshift(own.backgroundColor);
      if (alpha(own.backgroundColor) === 255) break;
    }
    if (style.backdropFilter !== 'none') skipped = true;
    const ground = lightness(composite(layers));
    const fill = lightness(composite([...layers, style.backgroundColor]));
    /* 纯黑的底只有播放器和封面图上的叠层，两套主题都一样黑，不是页面的面。 */
    if (ground < 1) skipped = true;
    const covered = [...node.querySelectorAll('img')].some((image) => image.complete && image.naturalWidth > 1
      && image.checkVisibility());
    readings.push({ frame: path(node), fill, ground, delta: Math.abs(fill - ground), skipped, covered });
  }
  return readings;
}
