/* 没有别的封面时用不用 JavDB 带水印的图（#531）：默认关，跟着账本走（`/api/settings` 的 `javdbCoverFallback`）。
   打开之后官方与本地封面照旧在前，水印图只补空，之后取到不带水印的会被换掉。 */
import { useQuery } from '@tanstack/react-query';
import { SettingsRow } from '@/components/application/settings/settings-rows';
import { Switch } from '@/components/base/switch/switch';

import { errorMessage } from '../../api';
import { SETTINGS_KEY, fetchSettings, useSaveSettings } from '../settings-panel/settings-data';
import { ErrorText, Rows, Section, Stack } from './section';
import { t } from '../../i18n';

export function CoverFallbackSettings({ receipt }: { receipt(message: string): void }) {
  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: ({ signal }) => fetchSettings(signal), refetchOnMount: 'always' });
  const save = useSaveSettings('cover-fallback');
  const error = save.error || settings.error;
  return (
    <Section title={t('settings:coverFallback.title')}>
      <Rows>
        <SettingsRow label={t('settings:coverFallback.javdb')} description={t('settings:coverFallback.javdbHelp')}>
          <Switch aria-label={t('settings:coverFallback.javdb')} isSelected={settings.data?.javdbCoverFallback === true}
            isDisabled={!settings.data || save.isPending}
            onChange={(on) => save.mutate({ javdbCoverFallback: on },
              { onSuccess: () => receipt(t('settings:shared.settingsSaved')) })} />
        </SettingsRow>
      </Rows>
      {error ? <Stack divided><ErrorText>{errorMessage(error)}</ErrorText></Stack> : null}
    </Section>
  );
}
