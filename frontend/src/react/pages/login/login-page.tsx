/* 登录页：一张 Auth Card，一个密码框、「保持登录」与「登录」。
 *
 * 画哪一种由服务端判定后经 `data-mode` 交进来，页面不自己猜：没有这个键是有访问策略的部署，框里填
 * 访问密码；`legacy` 是还没有访问策略的非 Docker 部署，框里填自动生成的访问口令，下面一句说用
 * `peach token` 查看；`setup` 是 Docker 还没有访问策略、来源是本机或局域网，换成访问设置；`denied`
 * 是同样情况但来源不满足，先说去哪里打开，再给访问口令登录（ADR-0149）。
 *
 * 表单是原生提交：`POST /login` 收 `token`、`next`，勾选「保持登录」时多带 `days=30`，会话 cookie 由它的
 * 303 设下，页面不经脚本发请求。口令不对（401）、尝试太多（429）、保持登录时间不合法（400）时服务端
 * 回同一张壳，原因经 `data-invalid` 或 `data-error` 交进来，挂在密码框下面：框标成 `aria-invalid`，
 * 原因由 `role="alert"` 播报，焦点落在框里。改了框里的内容就撤掉这条原因：BoardUI 的 Input 走原生
 * 校验，标着错误时表单交不出去。 */
import { useState } from 'react';

import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Input } from '@/components/base/input/input';

import { Note } from '../../components/note';
import { AuthCard } from '../auth-card';
import type { PageData } from '../page-data';
import { FIRST_ACCESS_DENIED } from '../first-access';
import { AccessSetup } from './access-setup';
import { t } from '../../../i18n';

/** 口令不对时框下那句话。限流与参数错误的原因由服务端给。 */
export const WRONG_PASSWORD = t('shell:login.wrongPassword');
export const WRONG_TOKEN = t('shell:login.wrongToken');

/* 整句按语言写在资源里，命令落在 `{{command}}` 那一格：先代入一个占位符切开，命令再包进 `<code>`。 */
const COMMAND_SLOT = '\u0000';
const tokenHint = (docker: boolean) => {
  const [before = '', after = ''] = t(docker ? 'shell:login.tokenHintDocker' : 'shell:login.tokenHintLocal', { command: COMMAND_SLOT }).split(COMMAND_SLOT);
  return <>{before}<code className="wrap-anywhere">{docker ? 'docker compose exec peach peach token' : 'peach token'}</code>{after}</>;
};

export function LoginPage({ data }: { data: PageData }) {
  if (data.mode === 'setup') return <AccessSetup data={data} />;
  return <LoginForm data={data} />;
}

function LoginForm({ data }: { data: PageData }) {
  const token = data.mode === 'legacy' || data.mode === 'denied';
  const [reason, setReason] = useState(data.error || (data.invalid === 'true' ? (token ? WRONG_TOKEN : WRONG_PASSWORD) : ''));
  return (
    <AuthCard title="Peach">
      {data.mode === 'denied' ? <Note tone="warning">{FIRST_ACCESS_DENIED}</Note> : null}
      <form method="post" action={`/login?${new URLSearchParams({ next: data.next || '/' })}`}
        aria-labelledby="auth-card-title" className="flex flex-col gap-6">
        <Input id="login-token" label={token ? t('shell:login.accessToken') : t('shell:shared.accessPassword')} name="token" type="password" maxLength={256}
          autoComplete="current-password" autoFocus={data.mode !== 'denied'} isRequired
          isInvalid={reason ? true : undefined} onChange={() => setReason('')}
          hint={reason ? <span role="alert">{reason}</span> : token ? tokenHint(data.mode === 'denied') : undefined} />
        <input type="hidden" name="next" value={data.next || '/'} />
        <Checkbox name="days" value="30" defaultSelected>{t('shell:login.staySignedIn')}</Checkbox>
        <Button type="submit" className="w-full">{t('shell:login.signIn')}</Button>
      </form>
    </AuthCard>
  );
}
