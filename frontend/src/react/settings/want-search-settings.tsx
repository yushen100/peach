/* 「想要」定时查资源的节奏：老片多久再查一次、查几次没找到就暂时放弃。两项跟着账本走（`/api/settings`），
   档位与服务端 `wants.STALE_SEARCH_DAY_CHOICES`、`wants.STALE_ATTEMPT_LIMITS` 一致。 */
import { useQuery } from '@tanstack/react-query';
import { SettingsRow } from '@/components/application/settings/settings-rows';
import { Select, SelectItem } from '@/components/base/select/select';

import { errorMessage } from '../../api';
import { SETTINGS_KEY, fetchSettings, useSaveSettings, type SyncedSettings } from '../settings-panel/settings-data';
import { ErrorText, Rows, Section, Stack } from './section';
import { t } from '../../i18n';

const DAY_CHOICES = [1, 3, 7, 14, 30];
const ATTEMPT_CHOICES = [1, 3, 5, 10, 0];

const dayLabel = (days: number) => days === 1 ? t('settings:wantSearch.daily') : t('settings:wantSearch.everyDays', { count: days });
const attemptLabel = (count: number) => count === 0 ? t('settings:wantSearch.never') : t('settings:wantSearch.attempts', { count });

export function WantSearchSettings({ receipt }: { receipt(message: string): void }) {
  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: ({ signal }) => fetchSettings(signal), refetchOnMount: 'always' });
  const save = useSaveSettings('want-search');
  const blocked = !settings.data || save.isPending;
  const choose = (patch: SyncedSettings) => save.mutate(patch, { onSuccess: () => receipt(t('settings:shared.settingsSaved')) });
  const error = save.error || settings.error;
  return (
    <Section title={t('settings:wantSearch.title')}>
      <Rows>
        <SettingsRow label={t('settings:wantSearch.interval')} description={t('settings:wantSearch.intervalHelp')}>
          <div id="wantStaleSearchDaysSetting" className="shrink-0">
            <Select aria-label={t('settings:wantSearch.interval')} selectedKey={String(settings.data?.wantStaleSearchDays ?? 7)}
              isDisabled={blocked} onSelectionChange={(key) => { if (key !== null) choose({ wantStaleSearchDays: Number(key) }) }}>
              {DAY_CHOICES.map((days) => <SelectItem key={days} id={String(days)}>{dayLabel(days)}</SelectItem>)}
            </Select>
          </div>
        </SettingsRow>
        <SettingsRow label={t('settings:wantSearch.giveUp')} description={t('settings:wantSearch.giveUpHelp')}>
          <div id="wantStaleAttemptLimitSetting" className="shrink-0">
            <Select aria-label={t('settings:wantSearch.giveUp')} selectedKey={String(settings.data?.wantStaleAttemptLimit ?? 3)}
              isDisabled={blocked} onSelectionChange={(key) => { if (key !== null) choose({ wantStaleAttemptLimit: Number(key) }) }}>
              {ATTEMPT_CHOICES.map((count) => <SelectItem key={count} id={String(count)}>{attemptLabel(count)}</SelectItem>)}
            </Select>
          </div>
        </SettingsRow>
      </Rows>
      {error ? <Stack divided><ErrorText>{errorMessage(error)}</ErrorText></Stack> : null}
    </Section>
  );
}
