/* 来源和凭证页的数据契约与折算。几条端点在 `frontend/src` 里都只在这里声明一次
 * （`tests/test_frontend_build.py` 盯着）。
 *
 * 来源配置、连接检查、封面任务、amane 桥和自定义来源各自缓存；后台任务按自己的节律读取状态，
 * 不重取正在编辑的来源配置。 */
import { apiGet } from '../../api';
import { queryClient } from '../query';
import { CUSTOM_SOURCES_KEY, fetchCustomSources } from './custom-source-data';
import { codedText } from '../../core/server-text';
import { t } from '../../i18n';

export const SCRAPING_URL = '/api/scraping';
export const SCRAPING_SETTINGS_URL = '/api/scraping/settings';
export const SCRAPING_CHECK_URL = '/api/scraping/check';
export const SCRAPING_CHECK_ALL_URL = '/api/scraping/check-all';
export const SCRAPING_COVER_URL = '/api/scraping/cover';
export const AMANE_BRIDGE_URL = '/api/scraping/amane-bridge';
export const AMANE_BRIDGE_CHECK_URL = '/api/scraping/amane-bridge/check';
export const AMANE_BRIDGE_REBUILD_URL = '/api/scraping/amane-bridge/rebuild';

/** 来源列表共用这一个键。 */
export const SCRAPING_KEY = ['scraping'] as const;
/** 抓封面那一趟后台任务的状态。 */
export const COVER_JOB_KEY = ['scraping', 'cover'] as const;
/** 全部来源连接检查那一趟后台任务的状态。 */
export const CHECK_ALL_KEY = ['scraping', 'check-all'] as const;
/** amane 桥的事实与重建任务的状态（`q_scraping_amane_bridge`）。 */
export const AMANE_BRIDGE_KEY = ['scraping', 'amane-bridge'] as const;

/** 一个采集来源。字段以 `q_scraping`（`src/peach/web_scraping.py`）为准。 */
export interface Source {
  source: string;
  label: string;
  /** 「片商官网」那样有译文的来源名带 code，其余是站方原名。 */
  label_code?: string;
  login: string;
  accepts_cookie: boolean;
  network: string;
  cookie_saved: boolean;
  /** 这台机器上这个来源的请求由本机浏览器发、验证由它自己过（ADR-0065）；为真时不需要 Cookie。 */
  browser: boolean;
  cooldown_until?: number | null;
}

/** 后台采集浏览器的模式：`window` 窗口留在屏幕外、验证可人工点；`headless` 不创建窗口、过不了就冷却。 */
export type BrowserMode = 'window' | 'headless';

export interface ScrapingData {
  sources: Source[];
  browser_mode?: BrowserMode;
}

/** 一次连接检查的一项结果：来源页面，以及来源取图的那台图片主机。 */
export interface Check {
  /** 查的是哪一跳：`page` 来源页面，`cdn` 图片主机。`label` 是它的 zh-CN 原文。 */
  target?: 'page' | 'cdn';
  label: string;
  label_code?: string;
  ok: boolean;
  /** `unchecked`：这一跳没发请求（来源没有固定的图片主机），不是连接失败。 */
  kind?: string;
  status?: number;
  message?: string;
  message_code?: string;
  message_params?: Record<string, unknown>;
  width?: number;
  height?: number;
  reason?: string;
  elapsed_s?: number;
  checked_at?: number;
}

/** 全部检查的报告口径，同 `peach check-sources`（`src/peach/source_preflight.py` 的 `OUTCOMES`）。 */
export type CheckOutcome = 'ok' | 'auth' | 'http' | 'cooldown' | 'network' | 'skipped';

/** 全部检查里的一项：比单项检查多了归类与它的中文名。 */
export interface ReportedCheck extends Check {
  outcome: CheckOutcome;
  outcome_label: string;
  outcome_label_code?: string;
}

/** 全部检查里的一个来源。 */
export interface SourceReport {
  source: string;
  label: string;
  label_code?: string;
  results: ReportedCheck[];
}

/** 全部检查的后台任务快照（`source_check_job`）。跑的时候 `results` 按完成先后追加，
 *  完成后换成按来源顺序排好的整份。`failed` 不计「未检查」。 */
export interface CheckAllJob {
  status: string;
  checked?: number;
  total?: number;
  results?: SourceReport[];
  failed?: number;
  elapsed_s?: number;
  completed_at?: number;
  error?: string;
}

/** 抓封面的后台任务快照（`scraping_cover_job`）。`status` 是 `idle|running|complete|failed`。 */
export interface CoverJob {
  status: string;
  job_id?: string;
  result?: string;
  /** `result` 与 `error` 的 code 和参数；有译文时显示译文。 */
  result_code?: string;
  result_params?: Record<string, unknown>;
  error_code?: string;
  error_params?: Record<string, unknown>;
  /** 封面没取到时那句由几段拼成，每段一个 code。 */
  error_parts?: { code: string; params?: Record<string, unknown> }[];
  width?: number;
  height?: number;
}

/** amane 桥那张卡（ADR-0043）。`revision` 是清单里钉的 amane sha，`version` 是锁里那一条的
 *  版本号；`installed` 是 venv 里有没有解释器；`sites` 是经桥开放给来源链的站。`job` 是重建
 *  任务的快照，`status` 同 `CoverJob`。安装包缺桥的清单或脚本时 `bundled` 为假，
 *  `problem` 写原因，`revision` 与 `version` 为空。 */
export interface AmaneBridge {
  repository: string;
  license: string;
  bundled: boolean;
  problem: string;
  revision: string;
  version: string;
  installed: boolean;
  installed_version: string;
  python: string;
  sites: { source: string; label: string; label_code?: string }[];
  job: CoverJob;
}

/** Netscape Cookie 文件的上限。再大的多半不是 Cookie 文件，先拦住再说。 */
export const COOKIE_TEXT_LIMIT = 256 * 1024;

export const fetchSources = (signal?: AbortSignal) => apiGet<ScrapingData>(SCRAPING_URL, signal);
export const fetchCoverJob = (signal?: AbortSignal) => apiGet<CoverJob>(SCRAPING_COVER_URL, signal);
export const fetchCheckAllJob = (signal?: AbortSignal) => apiGet<CheckAllJob>(SCRAPING_CHECK_ALL_URL, signal);
export const fetchAmaneBridge = (signal?: AbortSignal) => apiGet<AmaneBridge>(AMANE_BRIDGE_URL, signal);

/** 首屏来源与任务快照并发取回，同一份缓存交给页面各分区。
 *
 * 抓封面与检查任务的状态用于确认操作是否可执行；amane 和自定义来源独立读取。
 * 中止时 `fetchQuery` 把 `AbortError` 抛回给挂载方，它据此
 * 放弃这一次。 */
export async function prefetchScraping(signal: AbortSignal): Promise<void> {
  void queryClient.prefetchQuery({ queryKey: AMANE_BRIDGE_KEY, queryFn: () => fetchAmaneBridge(signal) });
  void queryClient.prefetchQuery({ queryKey: CUSTOM_SOURCES_KEY, queryFn: () => fetchCustomSources(signal) });
  void queryClient.prefetchQuery({ queryKey: COVER_JOB_KEY, queryFn: () => fetchCoverJob(signal) });
  void queryClient.prefetchQuery({ queryKey: CHECK_ALL_KEY, queryFn: () => fetchCheckAllJob(signal) });
  await queryClient.fetchQuery({ queryKey: SCRAPING_KEY, queryFn: () => fetchSources(signal) });
}

/** 一条检查结果说成一句话：谁、通不通、图有多大、服务端补充了什么。
 *
 * 结果里的 `label` 是这一跳查的是什么；只有一跳时它就是来源页面本身，句子里不必再说一遍。 */
export function checkText(check: Check, sourceLabel: string): string {
  const target = check.target === 'cdn' ? t('manage:connectionCheck.hdImages', { source: sourceLabel }) : sourceLabel;
  const verdict = check.kind === 'unchecked' ? 'manage:connectionCheck.uncheckedTarget'
    : check.ok ? 'manage:connectionCheck.reachableTarget' : 'manage:connectionCheck.unreachableTarget';
  return t(verdict, { target })
    + (check.width ? ` · ${check.width} × ${check.height}` : '')
    + (check.elapsed_s !== undefined ? t('manage:connectionCheck.secondsSuffix', { seconds: check.elapsed_s.toFixed(2) }) : '')
    + (check.message ? t('manage:connectionCheck.messageSuffix', { message: codedText(check, 'message') }) : '');
}
