/* 首次设置表单。题目、默认值、显隐与随平台变化的文案来自 `GET /api/setup/questions`；
 * 分组标题、按钮与「完成设置后」那一组是页面骨架，写在这里。
 *
 * 提交走 `POST /api/setup`。400 的 `errors` 按题目 key 写回原位：媒体目录按行对齐，整表不成立
 * 的那一句放在目录区上方；高级设置里任一项出错就展开它；访问密码出错时开关保持打开。已填的
 * 内容都留在原地，焦点落到第一个标错的框。 */
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { RiFolderLine, RiSearchLine, RiPlayCircleLine } from '@remixicon/react';

import { Button } from '@/components/base/buttons/button';
import { IconButton } from '@/components/base/buttons/icon-button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Input } from '@/components/base/input/input';
import { Label } from '@/components/base/input/label';
import { Switch } from '@/components/base/switch/switch';
import { Select, SelectItem } from '@/components/base/select/select';

import { randomId } from '../../../core/random-id';
import { Note } from '../../components/note';
import { ConfigurationChoice, ConfigurationInput } from '../../components/configuration-fields';
import { busyProps } from '../../settings/busy-props';
import {
  FolderField, FolderFieldLine, FolderRow, FolderSearchIcon, isCloudSource, MediaReadPolicy, MediaReadPolicyHelp,
  SourceSelect, useFolderRows,
} from '../../settings/folder-rows';
import { LibraryIconPicker, libraryAutoChoice } from '../../settings/library-icon-picker';
import { AUTO_STAGES, LibraryColorPicker, PresetSelect, StageChooser, type Stage } from '../../settings/library-policy-settings';
import { PasswordPair } from '../../settings/password-pair';
import { isLoopbackProxy, ProxyAddressField, ProxyModeSelect } from '../../settings/peach-proxy-fields';
import { ReportingChoices } from '../../settings/remote-reporting-settings';
import { Disclosure, ErrorText, ExternalLink, Fact, FactList, Help, SourceMark } from '../../settings/section';
import { CardGroup, GroupTitle } from '../auth-card';
import {
  describeFailure, pickFolder, SetupRequestError, submitSetup,
  type SetupDone, type SetupErrors, type SetupFolder, type SetupQuestion, type SetupQuestions, type SetupSubmission,
} from './setup-api';
import { libraryFields, processingSummary } from './setup-processing';
import { SetupShell } from './setup-scene';
import { SETTINGS_KEY } from '../../../settings-key';
import {
  INTERFACE_LANGUAGES, interfaceLanguage, isInterfaceLanguageChoice, LANGUAGE_SELF_NAMES, storedInterfaceLanguage, t,
  type InterfaceLanguageChoice,
} from '../../../i18n';

/** 这几项出错时「高级设置」自己展开：错在折叠里的框，人看不见。 */
const ADVANCED_KEYS = ['port', 'mdns_name'];

/* 首启时还没有账本，界面语言先记在这台设备的本地偏好里：换语言要整页重载才生效，重载后从这里
   读回；完成设置时随答卷写进新账本，之后打开的设备都按它显示。 */
function storedPreferences(): Record<string, unknown> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return saved && typeof saved === 'object' ? saved as Record<string, unknown> : {};
  } catch { return {} }
}

function rememberPreferences(patch: Record<string, unknown>) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...storedPreferences(), ...patch })) } catch { /* 存不下就只在本页生效 */ }
}

/** 媒体目录那一项的错误：与行数对得上就按行写回，否则是整表一句。 */
function folderErrors(value: SetupErrors[string], count: number): { rows: string[]; table: string } {
  if (Array.isArray(value)) {
    return value.length === count ? { rows: value, table: '' } : { rows: [], table: value.filter(Boolean).join(' ') };
  }
  return { rows: [], table: value ?? '' };
}

function scanLabel(paths: string[]): string {
  if (!paths.length) return t('shell:setupForm.scanAfterSetup');
  return t('shell:setupForm.scanFoldersAfterSetup', { count: paths.length });
}

const text = (value: SetupErrors[string]) => (Array.isArray(value) ? value.filter(Boolean).join(' ') : value ?? '');

export function SetupForm({ setup, onDone, onRestore }: { setup: SetupQuestions; onDone: (done: SetupDone) => void; onRestore?: () => void }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const stepTitle = useRef<HTMLHeadingElement>(null);
  const stepScroll = useRef<HTMLDivElement>(null);
  const move = (next: number) => { setDirection(next > step ? 1 : -1); setStep(next); };
  useEffect(() => {
    stepTitle.current?.focus({ preventScroll: true });
    stepScroll.current?.scrollTo({ top: 0 });
  }, [step]);
  const media = setup.questions.find((question) => question.input === 'folders');
  const dataRoot = setup.questions.find((question) => question.input === 'folder');
  const fields = setup.questions.filter((question) => question.input !== 'folders');
  const host = fields.find((question) => question.key === 'host');
  const others = fields.filter((question) => question.input !== 'folder' && question.key !== 'host');
  const sources = setup.media_sources.map(({ value, label }) => [value, label] as const);
  const firstLibrary = useRef<Partial<SetupFolder>>({ library_id: randomId(), library: t('shell:setupForm.defaultLibraryName'),
    library_icon: '', library_color: '', library_policy: 'auto' });
  const blank = (path = ''): SetupFolder => ({ path, location: setup.media_source_default, root: '', ...firstLibrary.current,
    cost: setup.media_source_default === 'local' ? 'free' : '' });
  const folders = useFolderRows<SetupFolder>({
    // 第一行带上服务端给的默认目录：Docker 是 Compose 挂载媒体的 `/media`，桌面没有默认值。
    initial: () => [blank(setup.docker ? media?.default ?? '' : '')], blank: () => blank(), pickFolder, describe: describeFailure,
    focusAfterPick: true,
  });
  firstLibrary.current = libraryFields(folders.rows[0]);
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(fields.map((question) => [question.key, question.default])));
  const [pickingData, setPickingData] = useState(false);
  const [pickError, setPickError] = useState('');
  const preset = Boolean(setup.access_preset);
  const [accessOn, setAccessOn] = useState(setup.access_enabled && !preset);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [scanNow, setScanNow] = useState(setup.scan_now);
  const [skipMedia, setSkipMedia] = useState(false);
  const [reporting, setReporting] = useState(setup.remote_reporting);
  const [proxyMode, setProxyMode] = useState(setup.peach_proxy?.mode ?? 'environment');
  const [proxyAddress, setProxyAddress] = useState('');
  const [languageChoice, setLanguageChoice] = useState<InterfaceLanguageChoice>(() => {
    const saved = storedPreferences().interfaceLanguage;
    return isInterfaceLanguageChoice(saved) ? saved : 'auto';
  });
  const pickLanguage = (value: string) => {
    if (!isInterfaceLanguageChoice(value)) return;
    setLanguageChoice(value);
    rememberPreferences({ interfaceLanguage: value });
    // 界面语言只在页面载入时定，换成另一种语言要重载；还在第一步，没有填过的内容会丢。
    if (storedInterfaceLanguage() !== interfaceLanguage) location.reload();
  };
  const [errors, setErrors] = useState<SetupErrors>({});
  const [tableError, setTableError] = useState('');
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const [requireReadPolicy, setRequireReadPolicy] = useState(false);
  // 每次因为错误要展开就换一个 key：折叠按初始状态展开，已填的值都在这一层的 state 里。
  const [advancedOpenings, setAdvancedOpenings] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  // 写回之后焦点交给第一个标错的框。错误在 await 之后才到，React 不在点击那一刻同步提交，
  // 所以等这一轮落到 DOM 上再找，不赌下一帧之前一定画完。
  const [errorRound, setErrorRound] = useState(0);
  useEffect(() => {
    if (errorRound) [...(form.current?.querySelectorAll<HTMLElement>('input[aria-invalid="true"]') ?? [])]
      .find(input => !input.closest('[hidden]'))?.focus();
  }, [errorRound]);
  // 写回的错误放进框下的提示：`role="alert"` 让读屏在它出现时播报一次，提示本身仍由
  // `aria-describedby` 挂在框上，文字在页面上只有这一份。`key` 跟着提交轮次换，同一句错误
  // 再提交一次也会重新播报。
  const announce = (message: string | undefined) =>
    message ? <span key={errorRound} role="alert">{message}</span> : undefined;

  const visible = (question: SetupQuestion) =>
    !question.visible_when || Object.entries(question.visible_when).every(([key, value]) => values[key] === value);
  const setValue = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (step < 3) {
      move(step + 1);
      return;
    }
    const missing = skipMedia ? -1 : folders.rows.findIndex((row) => !row.cost);
    if (missing >= 0) {
      setRequireReadPolicy(true);
      move(1);
      requestAnimationFrame(() => form.current?.querySelector<HTMLButtonElement>(`[data-media-read-policy="${missing}"] button`)?.focus());
      return;
    }
    setBusy(true);
    setFailure('');
    const submission: SetupSubmission = {
      media_dir: skipMedia ? [] : folders.rows.map(row => ({ ...row, library: row.library?.trim() || t('shell:shared.untitledLibrary') })),
      skip_media: skipMedia, access_enabled: accessOn, scan_now: !skipMedia && scanNow,
      interface_language: languageChoice,
      peach_proxy: { mode: proxyMode, proxy: proxyMode === 'proxy' ? proxyAddress : '' },
      ...(setup.history_guide ? { history_guide: true } : {}),
      ...(reporting ? { remote_reporting: { usage: reporting.usage, errors: reporting.errors } } : {}),
    };
    // 隐藏的题不提交，服务端按题目默认值补上。
    for (const question of fields) if (visible(question)) submission[question.key] = values[question.key] ?? '';
    if (accessOn) Object.assign(submission, { access_password: password, access_confirm: confirmation });
    try {
      onDone(await submitSetup(submission));
    } catch (cause) {
      if (cause instanceof SetupRequestError && cause.status === 400 && cause.errors) {
        const found = cause.errors;
        const { rows, table } = folderErrors(found.media_dir, folders.rows.length);
        folders.setErrors(rows);
        setTableError(table);
        setErrors(found);
        if (ADVANCED_KEYS.some((key) => found[key])) setAdvancedOpenings((count) => count + 1);
        if (found.access_password) setAccessOn(true);
        move(found.interface_language ? 0
          : found.media_dir || (dataRoot && found[dataRoot.key]) ? 1 : 2);
        setErrorRound((count) => count + 1);
      } else {
        setFailure(describeFailure(cause));
      }
    } finally {
      setBusy(false);
    }
  };

  const field = (question: SetupQuestion) => {
    const error = text(errors[question.key]);
    const help = question.help.join('');
    if (question.input === 'choice') {
      return (
        <ConfigurationChoice key={question.key} id={`setup-${question.key}`} label={question.label}
          value={values[question.key] ?? question.default} onChange={(value) => setValue(question.key, value)}
          options={question.options ?? []} isInvalid={Boolean(error)}>
          {help ? <Help>{help}</Help> : null}
          {error ? <ErrorText key={errorRound}>{error}</ErrorText> : null}
        </ConfigurationChoice>
      );
    }
    return (
      <ConfigurationInput key={question.key} id={`f-${question.key}`} label={question.label} isRequired={question.required}
        inputMode={question.input === 'number' ? 'numeric' : undefined} autoComplete="off" spellCheck="false"
        value={values[question.key] ?? ''} onChange={(value) => setValue(question.key, value)}
        prefix={question.prefix} suffix={question.suffix}
        validationBehavior="aria" isInvalid={Boolean(error)} hint={announce(error) ?? (help || undefined)} />
    );
  };

  const pickDataRoot = async () => {
    if (!dataRoot || pickingData) return;
    setPickingData(true);
    setPickError('');
    try {
      const path = await pickFolder(values[dataRoot.key] ?? '', 'data');
      if (path) setValue(dataRoot.key, path);
    } catch (cause) {
      setPickError(describeFailure(cause));
    } finally {
      setPickingData(false);
    }
  };
  const dataRootError = dataRoot ? text(errors[dataRoot.key]) || pickError : '';

  const filled = folders.rows.map((row) => row.path.trim()).filter(Boolean);
  const cloud = folders.rows.some((row) => isCloudSource(row.location));
  const libraries = [...new Map(folders.rows.map(row => [row.library_id, row])).values()];
  const editLibrary = (row: SetupFolder, patch: Partial<SetupFolder>) => folders.rows.forEach((other, index) => {
    if (other.library_id === row.library_id) folders.edit(index, patch);
  });
  const lan = values.host === '2';
  const address = lan && !setup.standalone
    ? `https://${values.mdns_name || 'peach'}.local/`
    : `http://${lan ? `${values.mdns_name || 'peach'}.local` : '127.0.0.1'}:${values.port || '8900'}/`;
  return (
    <SetupShell step={step}>
    <form ref={form} noValidate onSubmit={(event) => void submit(event)} aria-labelledby="auth-card-title"
      data-setup-form-panel="">
      <div data-setup-top="">
        <div data-setup-progress="" role="img" aria-label={t('shell:setupForm.progress', { step: step + 1 })}>
          {[0, 1, 2, 3].map(index => <span key={index} data-active={index === step || undefined} data-complete={index < step || undefined} />)}
        </div>
        <span className="text-body-2-regular text-text-secondary">{t('shell:setupForm.eyebrow')}</span>
      </div>
      <div data-setup-step-scroll="" ref={stepScroll}>
      <div data-setup-step-content="" style={{ '--setup-direction': `${direction * 20}px` } as CSSProperties}>
        <header data-setup-step-heading="" key={step}>
          <h1 id="auth-card-title" data-copy-key={`setup.title.${step}`} ref={stepTitle} tabIndex={-1} className="text-title-1-semibold text-text-primary">
            {step === 0 ? t('shell:setupForm.welcomeTitle') : step === 1 ? t('shell:setupForm.mediaTitle') : step === 2 ? (setup.docker ? t('shell:setupForm.accessTitleDocker') : t('shell:setupForm.accessTitle')) : t('shell:setupForm.confirmTitle')}
          </h1>
          <p data-copy-key={`setup.description.${step}`} className="text-body-regular text-text-secondary">
            {step === 0 ? t('shell:setupForm.welcomeLede') : step === 1 ? t('shell:setupForm.mediaLede')
              : step === 2 ? (setup.docker ? t('shell:setupForm.accessLedeDocker') : t('shell:setupForm.accessLede'))
              : t('shell:setupForm.confirmLede')}
          </p>
        </header>
      <div hidden={step !== 0}>
        {/* 下拉而不是分段：Weblate 译好的语言登记上线后直接多一项，宽度不随语言数变。 */}
        <div className="flex flex-col items-start gap-1.5">
          <Label elementType="span" id="setup-language-label">{t('settings:interfaceLanguage.title')}</Label>
          <Select className="w-60 max-w-full" aria-labelledby="setup-language-label" selectedKey={languageChoice}
            isInvalid={Boolean(errors.interface_language)}
            onSelectionChange={(key) => { if (key !== null) pickLanguage(String(key)); }}>
            {[['auto', t('settings:interfaceLanguage.auto')] as const,
              ...INTERFACE_LANGUAGES.map(code => [code, LANGUAGE_SELF_NAMES[code]] as const)].map(([value, name]) =>
              <SelectItem key={value} id={value} textValue={name}>{name}</SelectItem>)}
          </Select>
          {errors.interface_language ? <ErrorText key={errorRound}>{text(errors.interface_language)}</ErrorText> : null}
        </div>
        <ul data-setup-welcome-points="">
          <li><RiFolderLine /><div data-setup-welcome-copy=""><strong className="text-body-medium">{t('shell:setupForm.welcomeLibraries')}</strong><p className="text-body-2-regular text-text-secondary">{t('shell:setupForm.welcomeLibrariesBody')}</p></div></li>
          <li><RiSearchLine /><div data-setup-welcome-copy=""><strong className="text-body-medium">{t('shell:setupForm.welcomeFind')}</strong><p className="text-body-2-regular text-text-secondary">{t('shell:setupForm.welcomeFindBody')}</p></div></li>
          <li><RiPlayCircleLine /><div data-setup-welcome-copy=""><strong className="text-body-medium">{t('shell:setupForm.welcomePlay')}</strong><p className="text-body-2-regular text-text-secondary">{t('shell:setupForm.welcomePlayBody')}</p></div></li>
        </ul>
      </div>
      <div hidden={step !== 1}>
      {media ? (
        <CardGroup first labelledBy="setup-media-title">
          <GroupTitle id="setup-media-title">
            {media.label}
          </GroupTitle>
          <Checkbox isSelected={skipMedia} onChange={setSkipMedia}>{t('shell:setupForm.addLibrariesLater')}</Checkbox>
          {skipMedia ? <Help>{t('shell:setupForm.addLibrariesLaterHint')}</Help> : <>
          {tableError ? <ErrorText key={errorRound}>{tableError}</ErrorText> : null}
          <div role="group" aria-labelledby="setup-media-title" className="flex flex-col gap-3">
            {libraries.map(library => <div key={library.library_id} data-library-block="" data-setup-library-block="">
              <div data-library-head="">
                <LibraryIconPicker label={t('shell:setupForm.libraryIconNamed', { name: library.library || t('shell:shared.untitledLibrary') })} value={library.library_icon || ''} kind={library.location}
                  onChange={library_icon => editLibrary(library, { library_icon })} />
                <Input className="w-full" aria-label={t('shell:setupForm.libraryNameNamed', { name: library.library || t('shell:shared.untitledLibrary') })} placeholder={t('shell:setupForm.libraryName')} maxLength={80}
                  value={library.library || ''} onChange={value => editLibrary(library, { library: value })} />
                <LibraryColorPicker id={library.library_id || ''} name={library.library || t('shell:shared.untitledLibrary')} value={library.library_color || ''}
                  onChange={library_color => editLibrary(library, { library_color })} />
                <div data-setup-library-policy=""><PresetSelect name={library.library || t('shell:shared.untitledLibrary')} value={library.library_policy || 'auto'}
                  onChange={library_policy => editLibrary(library, { library_policy,
                    library_stages: library_policy === 'custom' ? library.library_stages || AUTO_STAGES.join(',') : '' })} /></div>
              </div>
              {library.library_policy === 'custom' ? <StageChooser name={library.library || t('shell:shared.untitledLibrary')}
                value={(library.library_stages?.split(',').filter(Boolean) ?? AUTO_STAGES) as Stage[]}
                onChange={value => editLibrary(library, { library_stages: value.join(',') })} /> : null}
              <div data-library-folders="" role="group" aria-label={t('shell:setupForm.libraryDirectoriesNamed', { name: library.library || t('shell:shared.untitledLibrary') })}>
            {folders.rows.map((row, index) => row.library_id === library.library_id ? (
              <FolderRow key={index} label={`${media.label} ${index + 1}`} path={row.path}
                onPath={(path) => folders.edit(index, { path })} error={announce(folders.errors[index])}
                inputRef={folders.inputRef(index)} picking={folders.picking === index}
                onPick={() => void folders.pick(index)}
                onRemove={folders.rows.length > 1 ? () => { folders.remove(index); addButton.current?.focus(); } : undefined}>
                <FolderFieldLine>
                  <SourceSelect index={index} value={row.location} options={sources}
                    onChange={(location) => folders.edit(index, { location, cost: location === 'local' ? 'free' : '' })} />
                  <MediaReadPolicy index={index} cost={row.cost ?? ''}
                    error={requireReadPolicy && !row.cost ? t('shell:setupForm.readPolicyRequired') : undefined}
                    onChange={(cost) => folders.edit(index, { cost })} />
                  {libraries.length > 1 ? <FolderField label={t('shell:setupForm.moveToLibrary')} className="w-full @lg:w-60">
                    <Select className="w-full" aria-label={t('shell:setupForm.directoryLibrary', { index: index + 1 })} selectedKey={row.library_id}
                      renderValue={<span className="flex min-w-0 items-center gap-2"><SourceMark mark={row.library_icon || libraryAutoChoice(row.location)[0]} /><span className="truncate">{row.library || t('shell:shared.untitledLibrary')}</span></span>}
                      onSelectionChange={key => {
                        const other = folders.rows.find(value => value.library_id === key);
                        if (other) folders.edit(index, libraryFields(other));
                      }}>
                      {[...new Map(folders.rows.map(value => [value.library_id, value])).values()].map(value => (
                        <SelectItem key={value.library_id} id={value.library_id} textValue={value.library || t('shell:shared.untitledLibrary')}>
                          <span className="flex min-w-0 items-center gap-2"><SourceMark mark={value.library_icon || libraryAutoChoice(value.location)[0]} /><span className="truncate">{value.library || t('shell:shared.untitledLibrary')}</span></span>
                        </SelectItem>
                      ))}
                    </Select>
                  </FolderField> : null}
                </FolderFieldLine>
              </FolderRow>
            ) : null)}
              <div className="flex"><Button variant="secondary" data-copy-interact aria-label={t('shell:setupForm.addDirectoryTo', { name: library.library || t('shell:shared.untitledLibrary') })}
                onClick={() => { folders.add(); folders.edit(folders.rows.length,
                  { ...libraryFields(library), location: library.location, cost: library.cost }); }}>{t('shell:setupForm.addFolder')}</Button></div>
              </div>
            </div>)}
          </div>
          <Button ref={addButton} variant="secondary" className="self-start" data-copy-interact onClick={() => {
            folders.add(); folders.edit(folders.rows.length, { library_id: randomId(), library: t('shell:setupForm.libraryNumbered', { number: libraries.length + 1 }),
              library_icon: '', library_color: '', library_policy: 'auto', library_stages: undefined });
          }}>
            {t('shell:setupForm.addLibrary')}
          </Button>
          {cloud ? (
            <>
              <MediaReadPolicyHelp />
              <Help>{setup.cloud.help}<ExternalLink href={setup.cloud.link.url}>{setup.cloud.link.label}</ExternalLink></Help>
              {setup.cloud.dependencies.map((dependency) => (
                <Help key={dependency.name}>
                  {dependency.message}<ExternalLink href={dependency.download_url}>{dependency.download_label}</ExternalLink>
                </Help>
              ))}
            </>
          ) : null}
          {media.help.map((line) => <Help key={line}>{line}</Help>)}
          </>}
        </CardGroup>
      ) : null}

      {dataRoot ? (
        <CardGroup labelledBy="setup-data-title">
          <GroupTitle id="setup-data-title">
            {dataRoot.label}<span aria-hidden className="ml-0.5 text-text-error-primary">*</span>
          </GroupTitle>
          <div className="flex items-start gap-2">
            <Input className="min-w-0 flex-1" id={`f-${dataRoot.key}`} aria-label={dataRoot.label} isRequired
              autoComplete="off" spellCheck="false" value={values[dataRoot.key] ?? ''}
              onChange={(value) => setValue(dataRoot.key, value)}
              validationBehavior="aria" isInvalid={Boolean(dataRootError)} hint={announce(dataRootError)} />
            <IconButton icon={FolderSearchIcon} aria-label={t('shell:setupForm.pickDataDirectory')} onClick={() => void pickDataRoot()}
              {...busyProps(pickingData)} />
          </div>
          {dataRoot.help.map((line) => <Help key={line}>{line}</Help>)}
        </CardGroup>
      ) : null}

      </div>
      <div hidden={step !== 2}>
      <CardGroup first labelledBy="auth-card-title">
        {host ? field(host) : null}
        {preset ? <>
          <Label elementType="span">{t('shell:shared.accessPassword')}</Label>
          <Note tone="info">{t('shell:setupForm.presetPassword')}</Note>
        </> : <>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Label id="setup-password-title" elementType="span">{t('shell:shared.accessPassword')}</Label>
            <p id="setup-access-description" className="text-body-2-regular text-text-secondary">{t('shell:accessSetup.passwordHelp')}</p>
          </div>
          <Switch aria-labelledby="setup-password-title" aria-describedby="setup-access-description"
            isSelected={accessOn} onChange={setAccessOn} />
        </div>
        <Help>{lan || setup.docker ? t('shell:accessSetup.lanPasswordHint')
          : t('shell:setupForm.localOnlyHint')}</Help>
        </>}
        {accessOn
          ? <PasswordPair label={t('shell:shared.accessPassword')} password={password} confirmation={confirmation}
              onPassword={setPassword} onConfirmation={setConfirmation}
              passwordError={announce(text(errors.access_password))} passwordHint={t('shell:accessSetup.passwordLength')}
              confirmationInvalid={Boolean(errors.access_password)} />
          : null}
      </CardGroup>

      <CardGroup labelledBy="setup-proxy-title">
        <GroupTitle id="setup-proxy-title">{t('shell:setupForm.peachProxy')}</GroupTitle>
        <Help>{t('shell:setupForm.proxyHelp')}</Help>
        <div className="flex flex-col items-start gap-1.5">
          <Label elementType="span" id="setup-proxy-mode-label">{t('shell:setupForm.connectionMode')}</Label>
          <ProxyModeSelect mode={proxyMode} onChange={setProxyMode} labelledBy="setup-proxy-mode-label" />
        </div>
        {proxyMode === 'proxy'
          ? <ProxyAddressField id="setupProxyAddress" value={proxyAddress} onChange={setProxyAddress}
              saved={setup.peach_proxy?.proxy_saved} error={announce(text(errors.peach_proxy))} />
          : errors.peach_proxy ? <ErrorText key={errorRound}>{text(errors.peach_proxy)}</ErrorText> : null}
        {setup.docker && proxyMode === 'proxy' && isLoopbackProxy(proxyAddress)
          ? <Note tone="warning" title={t('shell:setupForm.loopbackProxyTitle')}>{t('shell:setupForm.loopbackProxyBody')}</Note>
          : null}
        {setup.peach_proxy?.needs_selection
          ? <Note tone="warning" title={t('shell:setupForm.proxySelectionTitle')}>{t('shell:setupForm.proxySelectionBody')}</Note>
          : null}
      </CardGroup>

      {/* Docker 的端口与局域网名由 Compose 决定，不出题，也算不出外部访问地址。 */}
      {setup.docker ? null : <CardGroup>
        <Disclosure key={advancedOpenings} summary={t('shell:setupForm.advanced')} defaultOpen={advancedOpenings > 0}>
          <div className="flex flex-col gap-4">{others.filter(visible).map(field)}</div>
        </Disclosure>
        <Help><span className="break-all">{t('shell:setupForm.address', { address })}</span></Help>
      </CardGroup>}

      </div>
      <div hidden={step !== 3}>
      <CardGroup first labelledBy="setup-options-title">
        <GroupTitle id="setup-options-title">{t('shell:setupForm.firstScan')}</GroupTitle>
        {skipMedia ? <Help>{t('shell:setupForm.firstScanSkipped')}</Help> : <>
        <div className="flex flex-col gap-1.5">
          <Checkbox isSelected={scanNow} onChange={setScanNow}>{scanLabel(filled)}</Checkbox>
          <Help>{scanNow ? t('shell:setupForm.scanNowHint') : t('shell:setupForm.scanLaterHint')}</Help>
        </div>
        {folders.rows.some(row => row.cost === 'metered')
          ? <Help>{t('shell:setupForm.dataSaverHint')}</Help>
          : null}
        </>}
      </CardGroup>

      {failure ? <ErrorText>{failure}</ErrorText> : null}
      {reporting ? <CardGroup>
        <GroupTitle>{t('shell:setupForm.reportingTitle')}</GroupTitle>
        <ReportingChoices value={reporting} onChange={setReporting} />
        <Help>{t('shell:setupForm.reportingHint')}</Help>
      </CardGroup> : null}
      <CardGroup labelledBy="setup-summary-title">
        <GroupTitle id="setup-summary-title">{t('shell:setupForm.summaryTitle')}</GroupTitle>
        <FactList>
          <Fact term={t('settings:interfaceLanguage.title')}>{languageChoice === 'auto'
            ? t('settings:interfaceLanguage.auto') : LANGUAGE_SELF_NAMES[languageChoice]}</Fact>
          <Fact term={t('shell:setupForm.mediaDirectories')}>{skipMedia ? t('shell:setupForm.addLater') : filled.length ? `${t('shell:setupForm.directoryCount', { count: filled.length })} · ${t('shell:setupForm.libraryCount', { count: libraries.length })}` : t('shell:setupForm.notFilled')}</Fact>
          <Fact term={t('shell:setupForm.dataDirectory')}><span className="break-all">{dataRoot ? values[dataRoot.key] || t('shell:setupForm.notFilled') : setup.data_root || t('shell:shared.notFound')}</span></Fact>
          <Fact term={t('shell:setupForm.accessScope')}>{setup.docker ? t('shell:setupForm.scopeCompose') : lan ? t('shell:setupForm.scopeLan') : t('shell:setupForm.scopeLocal')} · {
            preset ? t('shell:setupForm.scopePresetPassword') : accessOn ? t('shell:setupForm.scopePasswordOn') : t('shell:setupForm.scopePasswordOff')}</Fact>
          <Fact term={t('shell:setupForm.firstScan')}>{!skipMedia && scanNow ? t('shell:setupForm.scanAfterFinish') : t('shell:setupForm.scanManually')}</Fact>
          {reporting ? <Fact term={t('shell:setupForm.diagnostics')}>{reporting.usage || reporting.errors ? t('shell:setupForm.reportingOn') : t('shell:shared.off')}</Fact> : null}
          {!skipMedia ? libraries.map(row => <Fact key={row.library_id} term={row.library || t('shell:shared.untitledLibrary')}>{processingSummary(row)}</Fact>) : null}
        </FactList>
      </CardGroup>
      </div>
      </div>
      </div>
      <footer data-setup-footer="" data-setup-footer-end={step === 0 && !onRestore ? '' : undefined} key={step} data-copy-interact>
        {step > 0 ? <Button variant="ghost" onClick={() => { if (!busy) move(step - 1); }} aria-disabled={busy || undefined}>{t('shell:shared.back')}</Button>
          : onRestore ? <Button variant="ghost" onClick={onRestore}>{t('shell:setupForm.useExistingData')}</Button> : null}
        <Button type="submit" {...busyProps(busy)}>{step === 0 ? t('shell:setupForm.start') : step === 3 ? t('shell:setupForm.finish') : t('shell:setupForm.continue')}</Button>
      </footer>
    </form>
    </SetupShell>
  );
}
