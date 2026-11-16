/* 首启页的三条请求：取题目、提交、让这台电脑弹文件夹对话框。
 *
 * 页面包不带主界面的请求封装与 Query 缓存，这里直接用 `fetch`。形态见 `docs/OPERATIONS.md`
 * 「首次设置的内部流程」：错误正文是 `{error, errors?}`，`errors` 按题目 key 给，媒体目录那一项是
 * 与行对应的列表，整表不成立时是只有一句话的列表。服务端给的文字都配了 code（同形的 `error_codes` 等），
 * 这里一律换成当前语言再交给页面。 */
import { PICK_FOLDER_URL } from '../../../configuration-endpoints';
import { bodyFieldErrors, codedText, serverLabel, serverText } from '../../../core/server-text';
import { t } from '../../../i18n';
import { localizedFact } from '../../settings/coded-text';
import { pickServerFolder, type FolderReply } from '../../components/server-path-dialog';

export const SETUP_QUESTIONS_URL = '/api/setup/questions';
export const SETUP_URL = '/api/setup';

export interface SetupOption { value: string; label: string }

export interface SetupQuestion {
  key: string;
  label: string;
  help: string[];
  default: string;
  required: boolean;
  advanced: boolean;
  input: 'folders' | 'folder' | 'choice' | 'text' | 'number';
  prefix: string;
  suffix: string;
  options?: SetupOption[];
  visible_when?: Record<string, string>;
}

export interface MountDependency { name: string; message: string; download_url: string; download_label: string }

export interface SetupQuestions {
  peach_proxy?: import('../../bundle').PeachProxyState;
  docker?: boolean;
  /** Docker 固定的数据目录（`/data`），不出题，只在确认页列出；其余部署为 `null`。 */
  data_root?: string | null;
  /** 容器启动时已按 `PEACH_ACCESS_PASSWORD` 写下访问密码，访问那一项不再出题。 */
  access_preset?: boolean;
  remote_reporting?: import('../../settings/remote-reporting-settings').RemoteReportingState;
  windows: boolean;
  standalone: boolean;
  questions: SetupQuestion[];
  media_sources: SetupOption[];
  media_source_default: string;
  media_root: { label: string; placeholder: string } | null;
  cloud: { help: string; link: { url: string; label: string }; dependencies: MountDependency[] };
  access_enabled: boolean;
  scan_now: boolean;
  history_guide: boolean;
}

export interface SetupFact { term: string; value: string; download_url?: string; download_label?: string; install_tool?: string }

export interface SetupDone {
  restored?: boolean;
  skip_media?: boolean;
  url: string;
  scan_requested: boolean;
  history_guide: boolean;
  standalone: boolean;
  redirect: string | null;
  facts: SetupFact[];
}

export type SetupErrors = Partial<Record<string, string | string[]>>;

export interface SetupFolder {
  path: string;
  location: string;
  root: string;
  library_id?: string;
  library?: string;
  library_icon?: string;
  library_color?: string;
  cost?: 'free' | 'metered' | '';
  library_policy?: import('../../settings/library-policy-settings').Preset;
  library_stages?: string;
}

export interface SetupSubmission {
  media_dir: SetupFolder[];
  skip_media: boolean;
  access_enabled: boolean;
  access_password?: string;
  access_confirm?: string;
  scan_now: boolean;
  history_guide?: boolean;
  interface_language?: import('../../../i18n').InterfaceLanguageChoice;
  [key: string]: unknown;
}

export class SetupRequestError extends Error {
  constructor(readonly status: number, message: string, readonly errors?: SetupErrors, readonly docker = false) {
    super(message);
  }
}

async function request<T>(url: string, init: RequestInit, fallback: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'same-origin', ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    });
  } catch (cause) {
    if (init.signal?.aborted) throw cause;
    throw new SetupRequestError(0, t('shell:accessSetup.unreachable'));
  }
  const body = await response.json().catch(() => null) as { error?: string; errors?: SetupErrors; docker?: boolean } | null;
  if (!response.ok) {
    throw new SetupRequestError(response.status, serverText(body) || fallback, bodyFieldErrors<SetupErrors>(body),
      body?.docker === true);
  }
  return body as T;
}

/* 服务端给的题面、说明、选项与云盘提示都配了 code（`label_code`、逐行的 `help_codes` 等），这里换成当前语言。 */
function localizedQuestions(setup: SetupQuestions): SetupQuestions {
  const coded = (text: string, code: unknown) => serverLabel(typeof code === 'string' ? code : '', text);
  return {
    ...setup,
    questions: setup.questions.map((question) => {
      const codes = (question as { help_codes?: unknown[] }).help_codes ?? [];
      return {
        ...question, label: codedText(question, 'label'),
        help: question.help.map((line, index) => coded(line, codes[index])),
        ...(question.options ? { options: question.options.map((option) => ({ ...option, label: codedText(option, 'label') })) } : {}),
      };
    }),
    cloud: {
      ...setup.cloud, help: codedText(setup.cloud, 'help'),
      link: { ...setup.cloud.link, label: codedText(setup.cloud.link, 'label') },
      dependencies: setup.cloud.dependencies.map((dependency) => ({
        ...dependency, message: codedText(dependency, 'message'), download_label: codedText(dependency, 'download_label'),
      })),
    },
  };
}

const localizedDone = (done: SetupDone): SetupDone => ({ ...done, facts: done.facts.map(localizedFact) });

export const fetchQuestions = async (signal?: AbortSignal) =>
  localizedQuestions(await request<SetupQuestions>(SETUP_QUESTIONS_URL, { signal }, t('shell:setupErrors.questionsFailed')));

export const submitSetup = async (submission: SetupSubmission) =>
  localizedDone(await request<SetupDone>(SETUP_URL, { method: 'POST', body: JSON.stringify(submission) }, t('shell:setupErrors.submitFailed')));

export const restoreSetup = async (dataRoot: string) =>
  localizedDone(await request<SetupDone>(`${SETUP_URL}/restore`, { method: 'POST', body: JSON.stringify({ data_root: dataRoot }) }, t('shell:setupErrors.restoreFailed')));

export const pickFolder = async (initial: string, purpose: 'media' | 'data' = 'media') =>
  pickServerFolder(initial, body => request<FolderReply>(PICK_FOLDER_URL,
    { method: 'POST', body: JSON.stringify(body) }, t('shell:setupErrors.pickFolderFailed')), purpose);

export const describeFailure = (cause: unknown) => (cause instanceof Error && cause.message) || t('shell:setupErrors.requestFailed');
