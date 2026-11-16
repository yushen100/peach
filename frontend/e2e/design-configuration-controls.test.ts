/* 配置与设置入口的语义样式：图标、状态对齐、主次动作与单行入口。 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Browser } from 'playwright-core';
import { configurationBody, expectBody, layout, settle, visit, VIEWPORTS } from './harness.ts';
import { followCredential, installDesignBrowser, openActivity, openFollowManage, settledRun } from './design-fixture.ts';
import { openHome, openPanel, PANEL } from './settings-fixture.ts';

describe('设计决定：配置控件', () => {
  let browser: Browser;
  installDesignBrowser((next) => { browser = next; });

  for (const viewport of VIEWPORTS) {
    it(`来源菜单适应长选项并受视口宽度约束（${viewport.name}）`, async () => {
      const opened = await openFollowManage(browser, viewport);
      try {
        const { page } = opened;
        for (const name of ['Rule34 Paheal / SubscribeStar.adult',
          'https://www.subscribestar.adult/creators/a-long-creator-display-name-without-spaces']) {
          await page.route('**/api/follow/credentials', route => route.fulfill({ json: {
            root: '', providers: [followCredential(name, 'none', false, [])],
          } }));
          await page.goto(new URL('/subscriptions?tab=add', page.url()).href, { waitUntil: 'load' });
          await page.getByRole('button', { name: '全部来源', exact: true }).click();
          const menu = page.getByRole('dialog', { name: '来源筛选', exact: true });
          assert.equal(await menu.getByRole('checkbox', { name, exact: true }).count(), 1);
          const fit = await menu.evaluate(element => {
            const label = element.querySelector('label')!;
            const box = element.getBoundingClientRect();
            return { right: box.right, left: box.left, width: box.width, viewport: innerWidth,
              scroll: label.scrollWidth, client: label.clientWidth, content: element.scrollWidth, frame: element.clientWidth };
          });
          assert.ok(fit.left >= 0 && fit.right <= fit.viewport, JSON.stringify(fit));
          assert.ok(fit.scroll <= fit.client + 1 && fit.content <= fit.frame + 1, JSON.stringify(fit));
          if (viewport.width > 1000) assert.ok(fit.width > 203, '长选项应撑开菜单');
          await page.keyboard.press('Escape');
        }
        assert.deepEqual((await layout(page)).offenders, []);
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close(); }
    });

    it(`来源筛选短操作紧邻排列，选项靠近触发器（${viewport.name}）`, async () => {
      const opened = await openFollowManage(browser, viewport);
      try {
        const { page } = opened;
        await page.getByRole('tab', { name: '添加关注', exact: true }).click();
        await page.getByRole('button', { name: '全部来源', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: '来源筛选', exact: true });
        const geometry = await dialog.evaluate(element => {
          const actions = element.querySelector('[data-selection-actions]')!;
          const buttons = [...actions.querySelectorAll('button,a')].map(node => {
            const box = node.getBoundingClientRect();
            return { top: box.top, bottom: box.bottom, center: box.top + box.height / 2, left: box.left, right: box.right, width: box.width,
              scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
          });
          const options = element.querySelector('[data-selection-options]')!.getBoundingClientRect();
          const optionWidths = [...element.querySelectorAll('label')].map(label =>
            label.lastElementChild!.getBoundingClientRect().right - label.getBoundingClientRect().left);
          const actionWidth = buttons.reduce((sum, button) => sum + button.width, 0)
            + Math.max(0, buttons.length - 1) * parseFloat(getComputedStyle(actions).columnGap);
          return { actions: buttons, width: actions.getBoundingClientRect().width,
            contentWidth: element.getBoundingClientRect().width, naturalWidth: Math.max(actionWidth, ...optionWidths),
            placement: element.getAttribute('data-selection-placement'), optionTop: options.top, optionBottom: options.bottom,
            right: element.getBoundingClientRect().right, viewport: innerWidth };
        });
        assert.equal(geometry.actions.length, 3);
        assert.ok(Math.abs(geometry.contentWidth - geometry.naturalWidth) <= 1, '菜单跟随选项和操作行中较宽的一组');
        assert.ok(geometry.actions.every(action => Math.abs(action.center - geometry.actions[0]!.center) <= 1));
        assert.ok(geometry.actions.every(action => (geometry.placement === 'top'
          ? action.bottom <= geometry.optionTop : action.top >= geometry.optionBottom) && action.width < geometry.width));
        assert.ok(geometry.actions[2]!.left - geometry.actions[1]!.right <= 9, '凭据链接紧邻全不选');
        assert.ok(geometry.actions.every(action => action.scrollWidth <= action.clientWidth + 1));
        assert.ok(geometry.right <= geometry.viewport);
        assert.equal(await dialog.getByRole('link', { name: '凭据设置', exact: true }).count(), 1);
        assert.equal(await dialog.getByRole('link', { name: '凭据设置', exact: true }).getAttribute('href'), '/settings/subscriptions');
        assert.equal(await dialog.getByRole('link', { name: '凭据设置', exact: true }).locator('svg').count(), 1);
        await dialog.getByRole('button', { name: '全不选', exact: true }).click();
        assert.equal(await dialog.getByRole('checkbox', { checked: true }).count(), 0);
        await dialog.getByRole('button', { name: '全选', exact: true }).click();
        assert.equal(await dialog.getByRole('checkbox', { checked: false }).count(), 0);
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close(); }
    });

    it(`多选菜单随视口空间翻转，键盘顺序与选项位置一致（${viewport.name}）`, async () => {
      const opened = await openFollowManage(browser, viewport);
      try {
        const { page } = opened;
        await page.setViewportSize({ width: viewport.width, height: 1200 });
        await page.getByRole('tab', { name: '添加关注', exact: true }).click();
        const trigger = page.getByRole('button', { name: '全部来源', exact: true });
        await trigger.click();
        const dialog = page.getByRole('dialog', { name: '来源筛选', exact: true });
        await page.waitForFunction(() => document.querySelector('[data-selection-placement]')?.getAttribute('data-selection-placement') === 'bottom');
        assert.equal(await dialog.locator('button,a,input').first().getAttribute('type'), 'checkbox');
        await page.setViewportSize({ width: viewport.width, height: 480 });
        await page.waitForFunction(() => document.querySelector('[data-selection-placement]')?.getAttribute('data-selection-placement') === 'top');
        assert.equal(await dialog.locator('button,a,input').first().innerText(), '全选');
        const ordered = await dialog.evaluate(element => {
          const actions = element.querySelector('[data-selection-actions]')!.getBoundingClientRect();
          const options = element.querySelector('[data-selection-options]')!.getBoundingClientRect();
          return actions.bottom <= options.top;
        });
        assert.ok(ordered);
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close(); }
    });

    it(`关注管理集合和跨页管理导航保留滑动层与减少动态效果（${viewport.name}）`, { timeout: 60_000 }, async () => {
      const opened = await openFollowManage(browser, viewport);
      try {
        const { page } = opened;
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        const tabs = page.getByRole('tablist', { name: '关注管理区域' });
        const surface = tabs.locator(':scope > [data-pill-thumb]');
        await surface.waitFor();
        const original = await surface.elementHandle();
        assert.ok(original);
        await tabs.getByRole('tab', { name: '添加关注', exact: true }).click();
        await page.waitForFunction(() => {
          const host = document.querySelector('[role="tablist"][aria-label="关注管理区域"]')!;
          const selected = host.querySelector('[data-pill-selected]')!.getBoundingClientRect();
          const pane = host.querySelector('[data-pill-thumb]')!.getBoundingClientRect();
          return Math.abs(selected.left - pane.left) < 1 && Math.abs(selected.width - pane.width) < 1;
        });
        assert.equal(await original.evaluate((node) => node.isConnected), true);
        assert.match(await surface.evaluate((node) => getComputedStyle(node).transitionDuration), /0.3s/);
        await tabs.getByRole('tab', { name: '添加关注', exact: true }).press('ArrowRight');
        await tabs.getByRole('tab', { name: '关注列表', selected: true }).waitFor();
        assert.equal(await tabs.getByRole('tab').count(), 2);
        assert.equal(await surface.count(), 1);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await surface.evaluate((node) => getComputedStyle(node).transitionDuration), '0s');
        const navigation = page.getByRole('navigation', { name: '管理', exact: true });
        const managementSurface = navigation.locator('[data-pill-thumb]');
        const managementOriginal = await managementSurface.elementHandle();
        assert.ok(managementOriginal);
        await navigation.getByRole('button', { name: '任务中心', exact: true }).click();
        await page.waitForURL((url) => url.pathname === '/tasks');
        await page.getByRole('heading', { name: '任务中心', exact: true }).waitFor();
        assert.equal(await managementOriginal.evaluate((node) => node.isConnected), true);
        assert.equal(await navigation.locator('[data-pill-selected]').textContent(), '任务中心');
        assert.deepEqual((await layout(page)).offenders, []);
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close(); }
    });

    it(`页面页签复用 PillTabList 选中层并保留方向键导航（${viewport.name}）`, { timeout: 60_000 }, async () => {
      const opened = await visit(browser, '/studios', viewport);
      try {
        const page = opened.page;
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        const tabs = page.getByRole('tablist', { name: '资料类型' });
        const surface = tabs.locator(':scope > span[aria-hidden="true"]');
        await surface.waitFor();
        const original = await surface.elementHandle();
        assert.ok(original);
        const style = await surface.evaluate((node) => ({ duration: getComputedStyle(node).transitionDuration,
          properties: getComputedStyle(node).transitionProperty }));
        assert.match(style.properties, /transform/);
        assert.ok(style.duration.split(',').every((value) => value.trim() === '0.3s'));
        await tabs.getByRole('tab', { name: '事务所', exact: true }).click();
        await page.waitForURL((url) => url.pathname === '/agencies');
        await tabs.getByRole('tab', { name: '事务所', selected: true }).waitFor();
        // 等的就是开头取到的那一块选中层滑到位并停下：读它自己的父元素，不按标签名另找一排。
        await page.waitForFunction((thumb) => {
          const selected = thumb.parentElement!.querySelector('[aria-selected="true"]')!.getBoundingClientRect();
          const pane = thumb.getBoundingClientRect();
          return thumb.getAnimations().length === 0
            && Math.abs(selected.left - pane.left) <= 1 && Math.abs(selected.width - pane.width) <= 1;
        }, original);
        assert.equal(await original.evaluate((node) => node.isConnected), true);
        const selected = await tabs.getByRole('tab', { selected: true }).boundingBox();
        const pane = await surface.boundingBox();
        assert.ok(selected && pane && Math.abs(selected.x - pane.x) <= 1 && Math.abs(selected.width - pane.width) <= 1);
        await tabs.getByRole('tab', { selected: true }).press('ArrowLeft');
        await page.waitForURL((url) => url.pathname === '/series');
        await tabs.getByRole('tab', { name: '系列', selected: true }).press('ArrowLeft');
        await page.waitForURL((url) => url.pathname === '/studios');
        await tabs.getByRole('tab', { name: '厂牌', selected: true }).waitFor();
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await surface.evaluate((node) => getComputedStyle(node).transitionDuration), '0s');
        assert.deepEqual((await layout(page)).offenders, []);
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close(); }
    });

    it(`设置项分隔线左侧内缩、右侧通栏，独立行组之间有一条线（${viewport.name}）`, { timeout: 60_000 }, async () => {
      const opened = await visit(browser, '/settings/library', viewport);
      try {
        const page = opened.page;
        const section = page.getByRole('region', { name: '视频预览', exact: true });
        await section.getByRole('switch', { name: '生成视频预览' }).waitFor();
        await settle(page);
        const measured = await section.evaluate((element) => {
          const card = element.lastElementChild!;
          const box = card.getBoundingClientRect();
          const groups = [...card.querySelectorAll(':scope > .ui-settings-rows')];
          return groups.map((group) => ({
            top: parseFloat(getComputedStyle(group).borderTopWidth),
            rows: [...group.children].map((row) => ({
              left: row.getBoundingClientRect().left - box.left,
              right: box.right - row.getBoundingClientRect().right,
              bottom: parseFloat(getComputedStyle(row).borderBottomWidth),
            })),
          }));
        });
        // 总开关、时间轴档位、抽帧解码方式各占一个行组，组与组之间由下一组的上边线分开。
        assert.equal(measured.length, 3);
        assert.deepEqual(measured.map((group) => group.rows.length), [1, 1, 1]);
        assert.deepEqual(measured.map((group) => group.top), [0, 1, 1]);
        assert.deepEqual(measured.flatMap((group) => group.rows.map((row) => row.bottom)), [0, 0, 0]);
        for (const row of measured.flatMap((group) => group.rows)) {
          assert.ok(Math.abs(row.left - 12) <= .5 && Math.abs(row.right) <= .5, JSON.stringify(row));
        }
        const footer = await page.getByRole('form', { name: '自动发现新文件', exact: true })
          .getByRole('button', { name: '保存配置', exact: true }).evaluate((button) => {
            const bar = button.parentElement!;
            const card = bar.parentElement!.getBoundingClientRect();
            const box = bar.getBoundingClientRect();
            return { left: box.left - card.left, right: card.right - box.right, top: getComputedStyle(bar).borderTopWidth };
          });
        assert.ok(Math.abs(footer.left) <= .5 && Math.abs(footer.right) <= .5, JSON.stringify(footer));
        assert.equal(footer.top, '1px');
        await openPanel(page);
        const rows = await page.locator(`${PANEL} [data-setting-group]:visible [data-setting-row]`).evaluateAll((elements) =>
          elements.map((row) => {
            const group = row.parentElement!.getBoundingClientRect();
            const box = row.getBoundingClientRect();
            return { left: box.left - group.left, right: group.right - box.right };
          }));
        assert.ok(rows.length > 1);
        for (const row of rows) assert.ok(Math.abs(row.left - 12) <= .5 && Math.abs(row.right) <= .5, JSON.stringify(row));
        assert.deepEqual((await layout(page)).offenders, []);
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close(); }
    });

    it(`设置导航字形可见，口味入口呈按钮并进入对应页面（${viewport.name}）`, { timeout: 60_000 }, async () => {
      const opened = await openHome(browser, viewport);
      try {
        const page = opened.page;
        await openPanel(page);
        const marks = await page.locator(`${PANEL} [data-settings-nav] button svg`).evaluateAll((icons) => icons.map((icon) => {
          const shape = (icon as SVGSVGElement).getBBox();
          const symbol = document.querySelector(icon.querySelector('use')!.getAttribute('href')!);
          return { width: shape.width, height: shape.height, text: symbol?.textContent, name: icon.closest('button')!.textContent };
        }));
        for (const mark of marks) assert.ok(mark.width > 0 && mark.height > 0, `${mark.name} 字形为空`);
        assert.ok(marks.find((mark) => mark.name === 'JAV 与新作')?.text?.includes('番'));
        await page.locator(PANEL).getByRole('tab', { name: '搜索与推荐' }).click();
        const link = page.locator(PANEL).getByRole('link', { name: '打开口味与记录' });
        const style = await link.evaluate((node) => ({ display: getComputedStyle(node).display,
          height: node.getBoundingClientRect().height, decoration: getComputedStyle(node).textDecorationLine }));
        assert.ok(['flex', 'inline-flex'].includes(style.display));
        assert.ok(style.height >= 32);
        assert.equal(style.decoration, 'none');
        await link.click();
        await page.waitForURL((url) => url.pathname === '/taste');
        await page.locator(PANEL).waitFor({ state: 'hidden' });
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close(); }
    });

    it(`媒体状态居中，辅助动作与保存有层级，新手教程入口可见（${viewport.name}）`, { timeout: 60_000 }, async () => {
      const opened = await visit(browser, '/settings/library', viewport);
      try {
        const page = opened.page;
        await page.route('**/api/configuration', async (route) => {
          const data = await (await route.fetch()).json();
          const paths = ['R:\\media', 'B:\\', 'A:\\'];
          await route.fulfill({ json: { ...data, editable: true, windows: true, media_dirs: paths, media_sources: paths.map((path, index) => ({
            path, location: ['local', '115', 'pikpak'][index], online: index > 0, library: ['media', '115', 'PikPak'][index],
          })) } });
        });
        await page.reload({ waitUntil: 'load' });
        await expectBody(page, '/settings/library', configurationBody(page));
        await settle(page);
        await page.locator('[data-mount]').first().waitFor();
        const centers = await page.locator('[data-folder-row]').evaluateAll((rows) => rows.map((row) => {
          const input = row.querySelector('input')!.getBoundingClientRect();
          const status = row.querySelector('[data-mount]')!.getBoundingClientRect();
          return Math.abs(input.top + input.height / 2 - status.top - status.height / 2);
        }));
        assert.equal(centers.length, 3);
        for (const delta of centers) assert.ok(delta <= 1, `状态偏离输入框中线 ${delta}px`);
        const media = page.getByRole('form', { name: '媒体库与目录', exact: true });
        assert.notEqual(await media.getByRole('button', { name: '添加媒体库', exact: true }).evaluate((node) => getComputedStyle(node).backgroundImage),
          await media.getByRole('button', { name: '保存配置', exact: true }).evaluate((node) => getComputedStyle(node).backgroundImage));
        await page.getByRole('tab', { name: '应用与维护', exact: true }).click();
        const tutorial = page.getByRole('region', { name: '新手教程', exact: true });
        await tutorial.waitFor();
        const aligned = await tutorial.evaluate((node) => {
          const label = [...node.querySelectorAll('p')].find((item) => item.textContent === '新手教程')!.parentElement!.getBoundingClientRect();
          const button = node.querySelector('button')!.getBoundingClientRect();
          return { delta: Math.abs(label.top + label.height / 2 - button.top - button.height / 2), gap: button.left - label.right };
        });
        assert.ok(aligned.delta <= 1 && aligned.gap > 0, JSON.stringify(aligned));
        await page.screenshot({ path: `../build/agent-verification/browser/configuration-${viewport.name}.png`, fullPage: true });
        assert.deepEqual((await layout(page)).offenders, []);
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close(); }
    });
  }

  for (const viewport of VIEWPORTS) for (const path of ['/settings/library', '/review']) {
    it(`分类目录在桌面左侧、手机上方，选中态区别于悬停（${path} · ${viewport.name}）`, { timeout: 60_000 }, async () => {
      const opened = await visit(browser, path, viewport);
      try {
        const page = opened.page;
        const nav = page.locator('#stats [data-section-nav]:not([data-skeleton] *)');
        const selected = nav.getByRole('tab', { selected: true });
        await selected.waitFor();
        await settle(page);
        const content = page.getByRole('tabpanel').filter({ visible: true }).first();
        const a = (await nav.boundingBox())!;
        const b = (await content.boundingBox())!;
        assert.ok(viewport.name === 'desktop' ? a.x + a.width <= b.x + 1 : a.y + a.height <= b.y + 1,
          JSON.stringify({ nav: a, content: b }));
        const surface = nav.locator('[data-pill-thumb]');
        const fill = await surface.evaluate((node) => getComputedStyle(node).backgroundColor);
        assert.notEqual(fill, 'rgba(0, 0, 0, 0)');
        const selectedBox = await selected.boundingBox();
        const surfaceBox = await surface.boundingBox();
        assert.ok(selectedBox && surfaceBox && Math.abs(selectedBox.x - surfaceBox.x) <= 1
          && Math.abs(selectedBox.y - surfaceBox.y) <= 1 && Math.abs(selectedBox.width - surfaceBox.width) <= 1
          && Math.abs(selectedBox.height - surfaceBox.height) <= 1);
        const unselected = nav.getByRole('tab', { selected: false }).first();
        await unselected.hover();
        await settle(page);
        assert.notEqual(await unselected.evaluate((node) => getComputedStyle(node).backgroundColor), fill);
        assert.equal(await unselected.evaluate((node) => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
        assert.deepEqual((await layout(page)).offenders, []);
        await page.screenshot({ path: `../build/agent-verification/browser/${path.slice(1)}-navigation-${viewport.name}.png`, fullPage: true });
        assert.deepEqual(opened.problems, []);
      } finally { await opened.close(); }
    });
  }

  it('大量已完成后继可通过键盘展开和收起', { timeout: 60_000 }, async () => {
    const parent = settledRun(1000, 'succeeded', '订阅源拉取');
    const children = Array.from({ length: 20 }, (_, index) => ({ ...settledRun(index + 1, 'succeeded', '资料图片补全'),
      parent_run_id: parent.id, root_run_id: parent.id, followup_key: `entity-avatar:${index}`, followup_depth: 1 }));
    const opened = await openActivity(browser, [parent, ...children]);
    try {
      const page = opened.page;
      const summary = page.locator('summary').filter({ hasText: '任务明细 · 20 项' });
      assert.equal(await page.locator('[data-followup-key]:visible').count(), 0);
      await summary.focus();
      await page.keyboard.press('Enter');
      await settle(page);
      assert.equal(await page.locator('[data-followup-key]:visible').count(), 20);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => ![...document.querySelectorAll('details')].find((node) => node.textContent?.includes('任务明细 · 20 项'))?.open);
      assert.equal(await page.locator('[data-followup-key]:visible').count(), 0);
      assert.deepEqual(opened.problems, []);
    } finally { await opened.close(); }
  });
});
