/* 「保留期限」：写入前的账本自动备份留几份、日志留多少天。两项存在这台电脑的状态目录
   （`retention_settings`），启动时读不到账本也能用；档位与服务端 `BACKUP_KEEP_CHOICES`、`LOG_DAY_CHOICES` 一致。 */
import { useQuery } from '@tanstack/react-query';
import { SettingsRow } from '@/components/application/settings/settings-rows';
import { Select, SelectItem } from '@/components/base/select/select';

import { apiGet, apiSend, errorMessage } from '../../api';
import { queryClient } from '../query';
import { ErrorText, Rows, Section, Stack } from './section';
import { useAction } from './use-action';
import { t } from '../../i18n';

const URL = '/api/configuration/retention';
const KEY = ['retention-settings'];
const BACKUP_CHOICES = [2, 5, 10, 20];
const LOG_CHOICES = [30, 90, 183, 365];

interface Retention { backup_keep: number; log_days: number }

const logLabel = (days: number) => days === 183 ? t('settings:retention.halfYear')
  : days === 365 ? t('settings:retention.oneYear') : t('settings:retention.days', { count: days });

export function RetentionSettings({ receipt }: { receipt(message: string): void }) {
  const query = useQuery({ queryKey: KEY, queryFn: ({ signal }) => apiGet<Retention>(URL, signal) });
  const action = useAction();
  const blocked = !query.data || Boolean(action.busy);
  const choose = (patch: Partial<Retention>) => void action.run('save', (signal) => apiSend<Retention>(URL, patch, 'POST', signal),
    (saved) => { queryClient.setQueryData(KEY, saved); receipt(t('settings:shared.settingsSaved')); });
  const error = action.error || (query.error ? errorMessage(query.error) : '');
  return (
    <Section title={t('settings:retention.title')}>
      <Rows>
        <SettingsRow label={t('settings:retention.backups')} description={t('settings:retention.backupsHelp')}>
          <div id="backupKeepSetting" className="shrink-0">
            <Select aria-label={t('settings:retention.backups')} selectedKey={String(query.data?.backup_keep ?? 5)} isDisabled={blocked}
              onSelectionChange={(key) => { if (key !== null) choose({ backup_keep: Number(key) }) }}>
              {BACKUP_CHOICES.map((count) => <SelectItem key={count} id={String(count)}>{t('settings:retention.copies', { count })}</SelectItem>)}
            </Select>
          </div>
        </SettingsRow>
        <SettingsRow label={t('settings:retention.logs')} description={t('settings:retention.logsHelp')}>
          <div id="logDaysSetting" className="shrink-0">
            <Select aria-label={t('settings:retention.logs')} selectedKey={String(query.data?.log_days ?? 183)} isDisabled={blocked}
              onSelectionChange={(key) => { if (key !== null) choose({ log_days: Number(key) }) }}>
              {LOG_CHOICES.map((days) => <SelectItem key={days} id={String(days)}>{logLabel(days)}</SelectItem>)}
            </Select>
          </div>
        </SettingsRow>
      </Rows>
      {error ? <Stack divided><ErrorText>{error}</ErrorText></Stack> : null}
    </Section>
  );
}
