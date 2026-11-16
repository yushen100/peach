/* 后台采集浏览器的模式：保留屏幕外窗口（自动过不了的验证可以从任务栏点开再点），或不创建窗口
   （过不了就让来源冷却）。存在这台机器的凭据目录里，读写走 `/api/scraping` 与 `/api/scraping/settings`。 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { SettingsRow } from '@/components/application/settings/settings-rows';
import { Select, SelectItem } from '@/components/base/select/select';

import { apiSend, errorMessage } from '../../api';
import { queryClient } from '../query';
import { SCRAPING_KEY, SCRAPING_SETTINGS_URL, fetchSources, type BrowserMode, type ScrapingData } from '../scraping/scraping';
import { ErrorText, Rows, Section, Stack } from './section';
import { t } from '../../i18n';

const MODES: BrowserMode[] = ['window', 'headless'];
const modeLabel = (mode: BrowserMode) => mode === 'headless' ? t('settings:scrapingBrowser.headless') : t('settings:scrapingBrowser.window');

export function ScrapingBrowserSettings({ receipt }: { receipt(message: string): void }) {
  const sources = useQuery({ queryKey: SCRAPING_KEY, queryFn: ({ signal }) => fetchSources(signal), refetchOnMount: 'always' });
  const save = useMutation({
    mutationFn: (mode: BrowserMode) => apiSend<{ browser_mode: BrowserMode }>(SCRAPING_SETTINGS_URL, { browser_mode: mode }),
    onSuccess: (result) => {
      queryClient.setQueryData<ScrapingData>(SCRAPING_KEY, (current) => current && { ...current, browser_mode: result.browser_mode });
      receipt(t('settings:shared.settingsSaved'));
    },
  }, queryClient);
  const error = save.error || sources.error;
  return (
    <Section title={t('settings:scrapingBrowser.title')}>
      <Rows>
        <SettingsRow label={t('settings:scrapingBrowser.mode')} description={t('settings:scrapingBrowser.modeHelp')}>
          <div id="scrapingBrowserModeSetting" className="shrink-0">
            <Select aria-label={t('settings:scrapingBrowser.mode')} selectedKey={sources.data?.browser_mode ?? 'window'}
              isDisabled={!sources.data || save.isPending}
              onSelectionChange={(key) => { if (key !== null) save.mutate(String(key) as BrowserMode) }}>
              {MODES.map((mode) => <SelectItem key={mode} id={mode}>{modeLabel(mode)}</SelectItem>)}
            </Select>
          </div>
        </SettingsRow>
      </Rows>
      {error ? <Stack divided><ErrorText>{errorMessage(error)}</ErrorText></Stack> : null}
    </Section>
  );
}
