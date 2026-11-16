/* 首次运行页：取题目、画表单，成功后在同一页换成完成态。
 *
 * 题目接口只对运行 Peach 的这台电脑开放（Docker 是部署机器与局域网）；别的设备打开时它回 403，
 * 页面不画表单，只说去哪里打开。Docker 的 403 正文带 `docker`，那句话换成容器的说法。 */
import { useEffect, useState } from 'react';

import { Button } from '@/components/base/buttons/button';

import { Note } from '../../components/note';
import { FIRST_ACCESS_DENIED } from '../first-access';
import { describeFailure, fetchQuestions, SetupRequestError, type SetupDone, type SetupQuestions } from './setup-api';
import { SetupDoneView } from './setup-done';
import { SetupForm } from './setup-form';
import { SetupRestore } from './setup-restore';
import { SetupShell } from './setup-scene';
import { t } from '../../../i18n';

type View =
  | { kind: 'loading' }
  | { kind: 'denied'; docker: boolean }
  | { kind: 'failed'; message: string }
  | { kind: 'form'; setup: SetupQuestions }
  | { kind: 'done'; done: SetupDone };

export function SetupPage() {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [restoring, setRestoring] = useState(false);
  // 服务端按浏览器语言写的标题；第一步改过界面语言后整页重载，标题跟着换。
  useEffect(() => { document.title = t('server:pages.setup.title') }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchQuestions(controller.signal).then(
      (setup) => setView({ kind: 'form', setup }),
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        setView(cause instanceof SetupRequestError && cause.status === 403
          ? { kind: 'denied', docker: cause.docker }
          : { kind: 'failed', message: describeFailure(cause) });
      });
    return () => controller.abort();
  }, [attempt]);

  if (view.kind === 'done') return <SetupDoneView done={view.done} />;
  const retry = () => {
    setView({ kind: 'loading' });
    setAttempt((count) => count + 1);
  };
  // Docker 的数据目录就是 `/data` 卷，接回已有数据是换卷，不在页面上做。
  if (view.kind === 'form' && !restoring) return <SetupForm setup={view.setup}
    onRestore={view.setup.docker ? undefined : () => setRestoring(true)} onDone={(done) => setView({ kind: 'done', done })} />;
  if (view.kind === 'form') return <SetupRestore onBack={() => setRestoring(false)}
    onDone={(done) => setView({ kind: 'done', done })} />;
  return (
    <SetupShell step={0}>
    <section data-setup-form-panel="" aria-labelledby="auth-card-title" aria-busy={view.kind === 'loading' || undefined}>
      <div data-setup-top=""><span className="text-body-2-regular text-text-secondary">{t('shell:setupForm.eyebrow')}</span></div>
      <div data-setup-step-scroll=""><div data-setup-step-content="">
      <header data-setup-step-heading="">
        <h1 id="auth-card-title" className="text-title-1-semibold text-text-primary">{t('shell:setupForm.welcomeTitle')}</h1>
        <p className="text-body-regular text-text-secondary">{t('shell:setupForm.welcomeLede')}</p>
      </header>
      {view.kind === 'loading' ? <div data-setup-loading="" data-skeleton="" role="status" aria-label={t('shell:setupPage.loading')}><span /><span /><span /></div> : null}
      {view.kind === 'denied'
        ? <Note tone="error">{view.docker ? FIRST_ACCESS_DENIED : t('shell:setupPage.openOnServer')}</Note> : null}
      {view.kind === 'failed'
        ? <Note tone="error" action={<Button variant="secondary" onClick={retry}>{t('shell:shared.retryNow')}</Button>}>{view.message}</Note>
        : null}
      </div></div>
    </section>
    </SetupShell>
  );
}
