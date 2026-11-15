/* 这台机器的媒体处理偏好，两张卡读写同一个 `['media-processing']` 键：
 * - 「视频预览」（「媒体库与入库」）：为本地视频生成九宫格与时间轴预览的总开关、时间轴档位与抽帧解码方式。
 *   总开关在前，依赖它的档位次之，少改的解码方式最后。
 * - 「视频播放」（「应用与维护」）：播放时整片与 HLS 转码的编解码方式与画质上限。它管的是这台电脑的硬件，
 *   和开机自启同属本机运行，不放在设置弹窗的界面偏好里（ADR-0103）。 */
import { useQuery } from '@tanstack/react-query';
import { SettingsRow } from '@/components/application/settings/settings-rows';
import { Switch } from '@/components/base/switch/switch';
import { Select, SelectItem } from '@/components/base/select/select';

import { apiSend, errorMessage } from '../../api';
import { queryClient } from '../query';
import {
  MEDIA_PROCESSING_KEY, MEDIA_PROCESSING_URL, THUMBNAIL_JOBS_KEY, fetchMediaProcessing, type MediaProcessingPolicy,
} from '../settings-panel/settings-data';
import { LIBRARY_PROCESSING_KEY } from '../library-processing/library-processing';
import { TaskProgress } from '../components/task-progress';
import { ErrorText, Rows, Section, Stack } from './section';
import { useAction } from './use-action';
import { VideoThumbnailControls } from './service-preferences';
import { t } from '../../i18n';

export function MediaProcessingSettings({ receipt }: { receipt(message: string): void }) {
  const policy = useQuery({ queryKey: MEDIA_PROCESSING_KEY, queryFn: ({ signal }) => fetchMediaProcessing(signal) });
  const action = useAction();
  const error = action.error || (policy.error ? errorMessage(policy.error) : '');
  const blocked = !policy.data || policy.isFetching || !!action.busy;
  return (
    <Section guide="preview" title={t('settings:videoPreviews.title')}>
      <Rows>
        <SettingsRow label={t('settings:videoPreviews.generate')} description={t('settings:videoPreviews.generateHelp')}>
          <Switch aria-label={t('settings:videoPreviews.generate')} isSelected={!!policy.data && !policy.data.metadata_only} isDisabled={blocked}
            onChange={(value) => void action.run('save', (signal) =>
              apiSend<MediaProcessingPolicy>(MEDIA_PROCESSING_URL, { metadata_only: !value }, 'POST', signal), (saved) => {
                queryClient.setQueryData(MEDIA_PROCESSING_KEY, saved);
                void queryClient.invalidateQueries({ queryKey: THUMBNAIL_JOBS_KEY });
                void queryClient.invalidateQueries({ queryKey: LIBRARY_PROCESSING_KEY });
                receipt(saved.metadata_only ? t('settings:videoPreview.turnedOff') : t('settings:videoPreview.turnedOn'));
              })} />
        </SettingsRow>
      </Rows>
      <VideoThumbnailControls disabled={!policy.data || policy.data.metadata_only || !!action.busy} />
      <Rows>
        <SettingsRow label={t('settings:videoPreviews.decoder')} description={t('settings:videoPreviews.decoderHelp')}>
          <div id="previewAccelerationSetting">
            <Select aria-label={t('settings:videoPreviews.decoder')} selectedKey={policy.data?.preview_acceleration || 'auto'} isDisabled={blocked}
              onSelectionChange={(mode) => {
                if (mode === null) return;
                void action.run('preview_acceleration', (signal) => apiSend<MediaProcessingPolicy>(MEDIA_PROCESSING_URL,
                  { preview_acceleration: String(mode) }, 'POST', signal), (saved) => {
                  queryClient.setQueryData(MEDIA_PROCESSING_KEY, saved);
                  receipt(t('settings:videoPreview.decodingSaved'));
                });
              }}>
              <SelectItem id="auto">{t('settings:videoProcessing.autoHardwareFirst')}</SelectItem>
              <SelectItem id="software">{t('settings:videoPreview.softwareDecoding')}</SelectItem>
            </Select>
          </div>
        </SettingsRow>
      </Rows>
      {action.busy ? <Stack divided><TaskProgress embedded kind="gather" label={t('settings:shared.saving')} /></Stack> : null}
      {error ? <Stack divided><ErrorText>{error}</ErrorText></Stack> : null}
    </Section>
  );
}

/** 画质上限的档位，与服务端 `PLAYBACK_QUALITY_CHOICES` 一致；0 是原画。 */
const QUALITY_CHOICES = [0, 1080, 720, 480];

export function PlaybackTranscodeSettings({ receipt }: { receipt(message: string): void }) {
  const policy = useQuery({ queryKey: MEDIA_PROCESSING_KEY, queryFn: ({ signal }) => fetchMediaProcessing(signal) });
  const action = useAction();
  const error = action.error || (policy.error ? errorMessage(policy.error) : '');
  const blocked = !policy.data || policy.isFetching || !!action.busy;
  return (
    <Section guide="transcode" title={t('settings:transcoding.title')}>
      <Rows>
        <SettingsRow label={t('settings:transcoding.mode')} description={t('settings:transcoding.modeHelp')}>
          <div id="playbackAccelerationSetting">
            <Select aria-label={t('settings:transcoding.mode')} selectedKey={policy.data?.playback_acceleration || 'auto'}
              isDisabled={blocked}
              onSelectionChange={(mode) => {
                if (mode === null) return;
                void action.run('playback_acceleration', (signal) => apiSend<MediaProcessingPolicy>(MEDIA_PROCESSING_URL,
                  { playback_acceleration: String(mode) }, 'POST', signal), (saved) => {
                  queryClient.setQueryData(MEDIA_PROCESSING_KEY, saved);
                  receipt(t('settings:playbackTranscode.saved'));
                });
              }}>
              <SelectItem id="auto">{t('settings:videoProcessing.autoHardwareFirst')}</SelectItem>
              <SelectItem id="software">{t('settings:playbackTranscode.software')}</SelectItem>
            </Select>
          </div>
        </SettingsRow>
        <SettingsRow label={t('settings:transcoding.quality')} description={t('settings:transcoding.qualityHelp')}>
          <div id="playbackQualitySetting">
            <Select aria-label={t('settings:transcoding.quality')} selectedKey={String(policy.data?.playback_max_height ?? 0)}
              isDisabled={blocked}
              onSelectionChange={(key) => {
                if (key === null) return;
                void action.run('playback_max_height', (signal) => apiSend<MediaProcessingPolicy>(MEDIA_PROCESSING_URL,
                  { playback_max_height: Number(key) }, 'POST', signal), (saved) => {
                  queryClient.setQueryData(MEDIA_PROCESSING_KEY, saved);
                  receipt(t('settings:playbackTranscode.qualitySaved'));
                });
              }}>
              {QUALITY_CHOICES.map((height) => <SelectItem key={height} id={String(height)}>
                {height ? t('settings:transcoding.qualityHeight', { height }) : t('settings:transcoding.original')}
              </SelectItem>)}
            </Select>
          </div>
        </SettingsRow>
      </Rows>
      {action.busy ? <Stack divided><TaskProgress embedded kind="gather" label={t('settings:shared.saving')} /></Stack> : null}
      {error ? <Stack divided><ErrorText>{error}</ErrorText></Stack> : null}
    </Section>
  );
}
