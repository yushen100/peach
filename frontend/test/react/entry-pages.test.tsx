import { describe, expect, it, vi } from 'vitest';

import { ErrorPage } from '../../src/react/pages/error/error-page';
import { AccessSetup, FIRST_ACCESS_URL } from '../../src/react/pages/login/access-setup';
import { FIRST_ACCESS_DENIED } from '../../src/react/pages/first-access';
import { LoginPage, WRONG_PASSWORD, WRONG_TOKEN } from '../../src/react/pages/login/login-page';
import { buttonNamed, click, fetchMock, mount, sentBody, settle, submit, switches, type } from './render';

const tokenInput = (root: ParentNode) => root.querySelector<HTMLInputElement>('input[name="token"]');
const alerts = (root: ParentNode) => [...root.querySelectorAll('[role="alert"]')];
const entries = (root: ParentNode) => [...new FormData(root.querySelector('form')!).entries()];

describe('登录页', () => {
  it('原生表单提交 token、next 与勾选时的 days=30', async () => {
    const host = await mount(<LoginPage data={{ next: '/stats?x=1' }} />);
    const form = host.querySelector('form')!;
    expect(form.getAttribute('method')).toBe('post');
    expect(form.getAttribute('action')).toBe('/login?next=%2Fstats%3Fx%3D1');
    const input = tokenInput(host)!;
    expect(input.type).toBe('password');
    expect(input.required).toBe(true);
    expect(input.maxLength).toBe(256);
    expect(input.getAttribute('autocomplete')).toBe('current-password');
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(alerts(host)).toHaveLength(0);
    await type(input, 'secret');
    expect(entries(host)).toEqual([['token', 'secret'], ['next', '/stats?x=1'], ['days', '30']]);
    await click(host.querySelector('input[name="days"]'));
    expect(entries(host)).toEqual([['token', 'secret'], ['next', '/stats?x=1']]);
    expect(form.checkValidity()).toBe(true);
  });

  it('没给 next 时回首页', async () => {
    const host = await mount(<LoginPage data={{}} />);
    expect(entries(host)).toContainEqual(['next', '/']);
  });

  it('口令不对时框标错、原因由读屏播报、焦点落在框里，改了内容就撤掉', async () => {
    const host = await mount(<LoginPage data={{ next: '/', invalid: 'true' }} />);
    const input = tokenInput(host)!;
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const [alert] = alerts(host);
    expect(alert?.textContent).toBe(WRONG_PASSWORD);
    const described = (input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(described.some((id) => document.getElementById(id)?.contains(alert!))).toBe(true);
    await type(input, 'again');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(alerts(host)).toHaveLength(0);
    expect(host.querySelector('form')!.checkValidity()).toBe(true);
  });

  it('限流与参数错误的原因照同一处写', async () => {
    for (const reason of ['尝试次数较多，请一分钟后重试', '请选择有效的保持登录时间']) {
      const host = await mount(<LoginPage data={{ next: '/', error: reason }} />);
      const input = tokenInput(host)!;
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(alerts(host).map((node) => node.textContent)).toEqual([reason]);
      host.remove();
    }
  });
});

describe('登录页的模式', () => {
  const label = (root: ParentNode) => root.querySelector('label[for="login-token"], label')?.textContent ?? '';

  it('有访问策略时填访问密码，不提口令', async () => {
    const host = await mount(<LoginPage data={{ next: '/' }} />);
    expect(label(host)).toContain('访问密码');
    expect(host.textContent).not.toContain('peach token');
  });

  it('非 Docker 还没有访问策略时填访问口令，说明用 peach token 查看', async () => {
    const host = await mount(<LoginPage data={{ next: '/', mode: 'legacy', invalid: 'true' }} />);
    expect(label(host)).toContain('访问口令');
    expect(alerts(host).map((node) => node.textContent)).toEqual([WRONG_TOKEN]);
    await type(tokenInput(host), 'again');
    expect(host.querySelector('code')?.textContent).toBe('peach token');
    expect(host.textContent).not.toContain('docker compose');
  });

  it('Docker 来源不满足时先说去哪里打开，再给口令登录并写 docker compose 的查法', async () => {
    const host = await mount(<LoginPage data={{ next: '/', mode: 'denied' }} />);
    expect(host.querySelector('[role="note"]')?.textContent).toBe(FIRST_ACCESS_DENIED);
    expect(label(host)).toContain('访问口令');
    expect(host.querySelector('code')?.textContent).toBe('docker compose exec peach peach token');
    expect(host.querySelector('form')?.getAttribute('action')).toBe('/login?next=%2F');
  });

  it('Docker 首次访问画访问设置，不画口令框', async () => {
    const host = await mount(<LoginPage data={{ next: '/', mode: 'setup' }} />);
    expect(tokenInput(host)).toBeNull();
    expect(host.querySelector('h1')?.textContent).toBe('访问设置');
    expect(host.querySelector('#access-password')).not.toBeNull();
  });
});

describe('Docker 首次访问设置', () => {
  it('设访问密码：提交密码与 next，成功后去服务端给的地址', async () => {
    const fetcher = fetchMock(200, { url: '/stats' });
    vi.stubGlobal('fetch', fetcher);
    const navigate = vi.fn();
    const host = await mount(<AccessSetup data={{ next: '/stats' }} navigate={navigate} />);
    await type(host.querySelector<HTMLInputElement>('#access-password'), 'correct-password');
    await type(host.querySelector<HTMLInputElement>('#access-confirm'), 'correct-password');
    await submit(host.querySelector('form'));
    await settle();
    expect(fetcher.mock.calls[0]?.[0]).toBe(FIRST_ACCESS_URL);
    expect(sentBody(fetcher)).toEqual({ mode: 'password', password: 'correct-password', confirmation: 'correct-password', next: '/stats' });
    expect(navigate).toHaveBeenCalledWith('/stats');
  });

  it('关掉开关就是选免登录，按钮写明，提交里不带密码', async () => {
    const fetcher = fetchMock(200, { url: '/' });
    vi.stubGlobal('fetch', fetcher);
    const navigate = vi.fn();
    const host = await mount(<AccessSetup data={{}} navigate={navigate} />);
    expect(buttonNamed('设置密码并进入', host)).not.toBeNull();
    await click(switches(host)[0]);
    expect(host.querySelector('#access-password')).toBeNull();
    await click(buttonNamed('免登录进入', host));
    await settle();
    expect(sentBody(fetcher)).toEqual({ mode: 'open', next: '/' });
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('字段错误写回框下，整页原因写在按钮上方，都不跳转', async () => {
    const navigate = vi.fn();
    vi.stubGlobal('fetch', fetchMock(400, { error: '两次输入的密码不一致', errors: { confirmation: '两次输入的密码不一致' } }));
    const host = await mount(<AccessSetup data={{}} navigate={navigate} />);
    await submit(host.querySelector('form'));
    await settle();
    expect(host.querySelector('#access-confirm')?.getAttribute('aria-invalid')).toBe('true');
    expect(alerts(host).map((node) => node.textContent)).toEqual(['两次输入的密码不一致']);
    vi.stubGlobal('fetch', fetchMock(403, { error: FIRST_ACCESS_DENIED }));
    await submit(host.querySelector('form'));
    await settle();
    expect(host.textContent).toContain(FIRST_ACCESS_DENIED);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('错误页', () => {
  const cases = [
    { status: '403', title: '这里不能打开', lede: '请在运行 Peach 的电脑上打开配置' },
    { status: '404', title: '四〇四', lede: null },
    { status: '409', title: '现在不能这样做', lede: '请先完成首次设置' },
    { status: '500', title: '出了点问题', lede: '服务出错' },
  ];
  for (const { status, title, lede } of cases) {
    it(`${status} 的标题与说明`, async () => {
      const detail = lede ?? '这个地址下没有页面。';
      const host = await mount(<ErrorPage data={{ status, detail }} />);
      expect(host.querySelector('h1')?.textContent).toBe(title);
      expect(document.title).toBe(`Peach · ${title}`);
      expect(host.textContent?.includes(detail)).toBe(lede !== null);
      const home = host.querySelector('a');
      expect(home?.getAttribute('href')).toBe('/');
      expect(home?.textContent).toBe('返回首页');
    });
  }
});
