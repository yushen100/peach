/* 换头像的数据契约。
 *
 * 候选图走 `/avatar-choice?ref=`：页面只递服务端自己列出来的 ref，地址由服务端按索引拼。
 * 手填地址先交给 `/api/avatar-frame`，过了服务端的公网判据、取回来留在缓存里，才变成
 * 一个 `url:` ref；本机文件使用服务端转换后的候选预览，确认时按原字节发出去。 */
import { ApiError, apiGet, apiSend } from '../../api';
import { withBackoff } from '../../polling';
import {
  centeredBox, frameWithin, isUsableSize, type CropBox, type CropSize,
} from '../../crop-geometry';
import { quoted, t } from '../../i18n';
import { serverLabel } from '../../core/server-text';

export const AVATAR_CHOICES_URL = '/api/avatar-choices';
export const AVATAR_PICK_URL = '/api/avatar-pick';
export const AVATAR_CODE_COVER_URL = '/api/avatar-code-cover';
export const AVATAR_FRAME_URL = '/api/avatar-frame';
const AVATAR_CHOICE_IMAGE_URL = '/avatar-choice';

export interface AvatarChoice {
  ref: string;
  source: 'gfriends' | 'history' | 'asset' | 'code' | 'url' | 'upload' | 'social' | 'online';
  label: string;
  width: number;
  height: number;
  detail: string;
  /** 这一格是按哪个名字从图库里找到的。只有一个名字命中时是空串。 */
  found_by: string;
  current: boolean;
  user_cropped?: boolean;
  /** 这一格必须先框一块再装。作品画面是横图，整张装进圆框只剩一块背景。 */
  crop: boolean;
  /** 框选时可以换的底图，按 ref 给：封面加九宫格那九格。 */
  bases: string[];
  /** 封面上该取景的那一块（脸周围的方图，没检出脸的封套是正封），源图像素。
   *  只对 `ref` 那一张、`width`×`height` 那个尺寸作数。 */
  focus: CropBox | null;
  /** 这部作品有几位演员；0 是不知道。多于一位时 `focus` 不围着封面上那张脸，
   *  那多半是领衔的另一位。 */
  cast: number;
  /** 封面那张底图的版本。封面会原地替换，预览地址带上它才不显示旧图，交框时回递它，
   *  服务端才认得出框是在哪一张上画的。别的底图不会原地变，是空串。 */
  version: string;
  /** `label` 里来源名那一段的 code 与参数；空串表示 `label` 本身是内容（图库分类、番号、片名），原样显示。 */
  label_code?: string;
  label_params?: Record<string, unknown>;
  /** 整张作品封面那一格的番号，接在来源名后面。 */
  cover_code?: string;
  /** `detail` 的 code 与参数；空串表示 `detail` 是内容（文件名、地址、片名）。 */
  detail_code?: string;
  detail_params?: Record<string, unknown>;
}

export interface AvatarChoices {
  kind: string;
  entity_id: number;
  names: string[];
  /** 名字链里在图库中真有图的那几个，按链上的先后。 */
  matched_names: string[];
  choices: AvatarChoice[];
  index_age_hours: number | null;
  index_stale: boolean;
  index_refreshing?: boolean;
  index_error?: string;
}

/** 一个人一个键：换个人就是另一份候选，不该读到上一个人的。 */
export const avatarChoicesKey = (kind: string, id: number) => ['avatar-choices', kind, id] as const;

const query = (kind: string, id: number) => `?kind=${encodeURIComponent(kind)}&id=${id}`;

export const choiceImageUrl = (kind: string, id: number, ref: string, version = '') =>
  `${AVATAR_CHOICE_IMAGE_URL}${query(kind, id)}&ref=${encodeURIComponent(ref)}`
  + (version ? `&v=${encodeURIComponent(version)}` : '');

/** 底图 `ref` 的版本：只有封面那一张有，九宫格那几格是空串。 */
export const baseVersion = (choice: AvatarChoice, ref: string): string =>
  ref.startsWith('cover:') || ref.endsWith(':cover') ? choice.version : '';

export const fetchAvatarChoices = (kind: string, id: number, signal?: AbortSignal) =>
  apiGet<AvatarChoices>(AVATAR_CHOICES_URL + query(kind, id), signal);
/** 候选索引在后台重建时每秒读一次，建完就停；读失败按连续失败次数退避。 */
export const choicesInterval = withBackoff<AvatarChoices>((data) => (data?.index_refreshing ? 1000 : false));

/** 按番号取一张封面来框。番号不必在馆藏里：本机没有时服务端去官方渠道取。 */
export const fetchCodeCover = (code: string) =>
  apiSend<AvatarChoice>(AVATAR_CODE_COVER_URL, { code });

/** 一格人像进框选之前，服务端量出的尺寸、检出的脸和可换的底图，并进这一格自己的说明。
 *  列表里图库图还没取过时尺寸是 0，而默认框只在尺寸对得上时才按脸落。 */
export async function frameChoice(kind: string, id: number, choice: AvatarChoice): Promise<AvatarChoice> {
  const framed = await apiSend<AvatarChoice>(AVATAR_FRAME_URL, { kind, id, ref: choice.ref });
  return { ...choice, width: framed.width, height: framed.height, focus: framed.focus, bases: framed.bases };
}

/** 手填的地址：服务端过公网判据、取一次留进缓存，交回一格 `url:` 候选。 */
export const frameAddress = (kind: string, id: number, url: string) =>
  apiSend<AvatarChoice>(AVATAR_FRAME_URL, { kind, id, url });

/** 本机文件：按原字节提交，服务端转换为静态预览并交回候选引用。 */
export const frameFile = (kind: string, id: number, file: File) =>
  sendBytes<AvatarChoice>(`${AVATAR_FRAME_URL}${query(kind, id)}&name=${encodeURIComponent(file.name)}`, file);

/* 本机文件按原样发字节，不走 multipart：解析 multipart 要多一个依赖，而这里只有
   一个文件、没有别的字段，文件名和框走查询串。请求体不是 JSON，所以不经 `apiSend`。 */
async function sendBytes<T>(url: string, file: File): Promise<T> {
  const response = await fetch(url, { method: 'POST', credentials: 'same-origin', body: file });
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (response.ok) return payload as T;
  throw new ApiError(payload?.error || t('catalog:avatarPicker.requestFailed', { status: response.status }), response.status, payload);
}

/** 一张候选按 `aspect` 取景的那一块：有取景区就在它里面取，没有就整张图居中。
 *  `size` 不是这一格自己那张图时（换了底图）一律居中：取景区只对它自己的像素作数。 */
export function choiceFrame(choice: AvatarChoice, size: CropSize, aspect: number): CropBox {
  const own = size.width === choice.width && size.height === choice.height;
  return choice.focus && own ? frameWithin(choice.focus, size, aspect) : centeredBox(size, aspect);
}

/** 格子要不要自己取景：只有要框的那几路（作品画面、番号封面）是横图。竖的图库
 *  人像照旧 `object-cover`，尺寸不知道的也是。 */
export const framesItself = (choice: AvatarChoice): boolean =>
  choice.crop && isUsableSize({ width: choice.width, height: choice.height });

/** 框选出来的那一块，源图像素、右下开区间。后端按同一组整数裁。 */
export interface AvatarCrop { x0: number; y0: number; x1: number; y1: number }

/** 两条路交上去的东西不同，落点是同一个端点。`crop` 是共用的可选工序，不给就整张装。 */
export type AvatarSubmission =
  | { ref: string; crop?: AvatarCrop; version?: string }
  | { file: File; crop?: AvatarCrop };

export async function sendAvatarPick(
  kind: string, id: number, submission: AvatarSubmission,
): Promise<void> {
  if (!('file' in submission)) {
    await apiSend(AVATAR_PICK_URL, { kind, id, ...submission });
    return;
  }
  const { file, crop } = submission;
  const box = crop ? `&crop=${[crop.x0, crop.y0, crop.x1, crop.y1].join(',')}` : '';
  await sendBytes(`${AVATAR_PICK_URL}${query(kind, id)}&name=${encodeURIComponent(file.name)}${box}`, file);
}

/** 说明里点名的别名个数。再多就是一大段字，把候选网格挤得只剩一排。 */
const NOTE_NAMES = 2;

/** 说明只留一句：这一屏已经用图说清了在选什么，多一行字就是多一行要读的东西。
 *  按哪个名字找到的要说——找错人是这里唯一会出的大错，而名字是唯一的线索。名字多时点名
 *  前两个，余下的只报个数，每一格按谁找到的在格子的 title 里。 */
export function pickerNote(name: string, data: AvatarChoices | undefined): string {
  // 候选在路上时网格里是 Skeleton，这里不再另写一句「正在读取」。
  if (!data) return name;
  const elsewhere = data.matched_names.filter((one) => one !== name);
  if (elsewhere.length) {
    // 中文引号自带分隔，名字之间不加顿号；英文用逗号隔开。
    const names = elsewhere.slice(0, NOTE_NAMES).map(quoted).join(t('catalog:avatarPicker.quotedNameSeparator'));
    return elsewhere.length > NOTE_NAMES
      ? t('catalog:avatarPicker.foundByNamesMore', { name, names, count: elsewhere.length - NOTE_NAMES, total: elsewhere.length })
      : t('catalog:avatarPicker.foundByNames', { name, names });
  }
  return data.choices.length ? name : t('catalog:avatarPicker.noChoices', { name });
}

/** 图库索引正在更新或更新失败时的那句提示；别的情形是空串。 */
export function indexNote(data: AvatarChoices | undefined): string {
  if (data?.index_refreshing) return t('catalog:avatarPicker.indexUpdating');
  if (data?.index_error && data.index_stale) return t('catalog:avatarPicker.indexFailed', { error: data.index_error });
  return '';
}

/** 多人合演的作品：格子上标人数，框选时提醒先找到她自己的脸。 */
export const sharedCast = (choice: AvatarChoice): boolean => choice.cast > 1;

/** 格子的名字：来源名按 code 取当前语言，再接上「已裁剪」或番号；缺译文时用服务端的原文。 */
export function choiceLabel(choice: AvatarChoice): string {
  const source = choice.label_code ? serverLabel(choice.label_code, '', choice.label_params) : '';
  if (!source) return choice.label;
  if (choice.user_cropped) return serverLabel('labels.avatarPicker.cropped', choice.label, { label: source });
  return choice.cover_code ? `${source} ${choice.cover_code}` : source;
}

/** 格子的说明：代表作画面那句按 code 取当前语言；其余是内容，原样显示。 */
export const choiceDetailText = (choice: AvatarChoice): string =>
  choice.detail_code ? serverLabel(choice.detail_code, choice.detail, choice.detail_params) : choice.detail;

export const cropNote = (choice: AvatarChoice): string =>
  sharedCast(choice)
    ? t('catalog:avatarPicker.cropNoteShared', { label: choiceLabel(choice), count: choice.cast })
    : t('catalog:avatarPicker.cropNote', { label: choiceLabel(choice), detail: choice.source === 'social' && choice.detail ? ` · ${choiceDetailText(choice)}` : '' });

const SOURCE_LABELS: Record<string, string> = {
  gfriends: t('catalog:avatarPicker.sourceGallery'), history: t('catalog:avatarPicker.sourceHistory'), asset: t('catalog:avatarPicker.sourceVideoStill'), code: t('catalog:avatarPicker.sourceCodeCover'),
  url: t('catalog:avatarPicker.sourceUrl'), upload: t('catalog:avatarPicker.sourceUpload'), social: t('catalog:avatarPicker.sourceSocial'), online: t('catalog:shared.onlineVideo'),
};

/** 底图那一排每一格的名字：封面一格，九宫格九格按位置数。 */
export function baseLabel(ref: string): string {
  if (ref.startsWith('follow:')) {
    const what = ref.split(':')[2];
    return what === 'cover' ? t('catalog:avatarPicker.videoCover') : t('catalog:avatarPicker.contentImage', { number: Number(what.replace('image', '') || 0) + 1 });
  }
  if (ref.startsWith('cover:')) return t('catalog:shared.cover');
  const what = ref.split(':')[2] || '';
  if (what === 'cover') return t('catalog:shared.cover');
  const cell = Number(what.replace('cell', ''));
  return Number.isFinite(cell) ? t('catalog:avatarPicker.gridCell', { number: cell + 1 }) : what;
}

/** 一格的完整说明，进 `title`：哪儿来的、多大、按谁找到的。作品画面再接上服务端的说明：
 *  片名，账号没有本人身份依据时还有「代表作画面，非本人」。 */
export const choiceDetail = (choice: AvatarChoice): string =>
  `${SOURCE_LABELS[choice.source] || choice.source} · ${choiceLabel(choice)}`
  + (choice.width ? ` · ${choice.width}×${choice.height}` : '')
  + (sharedCast(choice) ? t('catalog:avatarPicker.castDetail', { count: choice.cast }) : '')
  + (choice.found_by ? t('catalog:avatarPicker.foundByDetail', { name: choice.found_by }) : '')
  + (['asset', 'social', 'history'].includes(choice.source) && choice.detail && choice.detail !== choice.label ? ` · ${choiceDetailText(choice)}` : '');
