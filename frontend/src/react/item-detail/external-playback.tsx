import { useEffect, useState } from 'react';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { apiGet, apiSend } from '../../api';
import { SelectField } from '../components/select-field';
import { ErrorText, Help } from '../settings/section';
import { busyProps, useAction } from '../settings/use-action';
import { t } from '../../i18n';
import { serverLabel } from '../../core/server-text';
import { schemePlayers, type SchemePlayer } from '../../player/external-schemes';

const TARGET_KEY = 'peach.playback-target.v1';
/** 本机播放器：`label` 是播放器名或服务端按 zh-CN 渲染的「系统默认播放器」，后者带 `label_code`。 */
type LocalPlayer = { id: string; label: string; label_code?: string };
const NETWORK_TARGETS = [['m3u', t('catalog:externalPlayback.m3uPlaylist')], ['url', t('catalog:externalPlayback.streamUrlVr')]] as const;
const schemeLabel = (player: SchemePlayer) => player.label || t('catalog:externalPlayback.androidChooser');
/** 链接调起的播放器按客户端平台给；本机已检测到的同名播放器走服务端打开，不重复列。 */
const schemeTargets = (players: LocalPlayer[] | null) =>
  schemePlayers(undefined, (players || []).map(item => item.id)).map(player => [`scheme:${player.id}`, player] as const);

function savedTarget() {
  try { return localStorage.getItem(TARGET_KEY) || `local:${localStorage.getItem('peach.local-player.v1') || 'default'}` }
  catch { return 'local:default' }
}

export function ExternalPlayback({ id, onOpened }: { id: number; onOpened?(): void }) {
  const [players, setPlayers] = useState<LocalPlayer[] | null>(null);
  const [player, setPlayer] = useState(savedTarget);
  const [links, setLinks] = useState<{ url: string; playlist: string } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [epoch, setEpoch] = useState(0);
  const action = useAction();
  useEffect(() => {
    const controller = new AbortController();
    apiGet<{ players: LocalPlayer[] }>('/api/local-players', controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setPlayers(result.players);
      setPlayer(current => {
        if (result.players.some(item => `local:${item.id}` === current) || NETWORK_TARGETS.some(([key]) => key === current)
          || schemeTargets(result.players).some(([key]) => key === current)) return current;
        if (result.players.length) return `local:${result.players[0]!.id}`;
        return 'm3u';
      });
    }).catch(cause => {
      if (controller.signal.aborted) return;
      setPlayers([]);
      setPlayer(current => NETWORK_TARGETS.some(([key]) => key === current)
        || schemeTargets([]).some(([key]) => key === current) ? current : 'm3u');
      setLoadError(String(cause.message || cause));
    });
    return () => controller.abort();
  }, [epoch]);
  const open = () => void action.run('open', async signal => {
    if (player.startsWith('local:')) {
      await apiSend(`/api/local-playback?id=${id}&player=${encodeURIComponent(player.slice(6))}`, {}, 'POST', signal);
      return null;
    }
    const result = await apiSend<{ url: string; playlist: string }>(`/api/external-playback?id=${id}`, {}, 'POST', signal);
    return { url: new URL(result.url, location.origin).href, playlist: new URL(result.playlist, location.origin).href };
  }, result => {
    if (!result) {
      document.querySelector<HTMLVideoElement>('#stage video')?.pause();
      onOpened?.();
      return;
    }
    setLinks(result);
    if (player === 'url') return;
    const scheme = schemeTargets(players).find(([key]) => key === player)?.[1];
    const link = document.createElement('a');
    link.href = scheme ? scheme.link(result.url) : result.playlist;
    link.rel = 'noreferrer';
    document.body.append(link);
    link.click();
    link.remove();
  });
  return <div data-local-playback="">
    <div data-local-playback-row="">
      <SelectField id={`external-player-${id}`} label={t('catalog:externalPlayback.externalPlayer')}
        options={[...(players || []).map(item => [`local:${item.id}`, serverLabel(item.label_code ?? '', item.label)] as const),
          ...schemeTargets(players).map(([key, item]) => [key, schemeLabel(item)] as const), ...NETWORK_TARGETS]}
        value={player} disabled={players === null || !!action.busy} epoch={epoch * 2 + Number(players !== null)} onPick={value => {
          setPlayer(value);
          setLinks(null);
          action.setError('');
          try { localStorage.setItem(TARGET_KEY, value) } catch { /* 浏览器未允许保存偏好。 */ }
        }} />
      <Button variant="secondary" aria-label={t('catalog:externalPlayback.openInPlayer')} disabled={players === null}
        {...busyProps(action.busy === 'open')} onClick={open}>{t('catalog:shared.open')}</Button>
    </div>
    {action.error || loadError ? <ErrorText>{action.error || loadError}</ErrorText> : null}
    {loadError ? <Button variant="secondary" disabled={!!action.busy}
      onClick={() => { setLoadError(''); setPlayers(null); setEpoch(value => value + 1) }}>{t('catalog:externalPlayback.redetect')}</Button> : null}
    {links ? <>
      <Input label={t('catalog:externalPlayback.streamUrl')} value={links.url} isReadOnly />
      <Help>{player.startsWith('scheme:') ? t('catalog:externalPlayback.schemeHint') : t('catalog:externalPlayback.streamUrlHint')}</Help>
    </> : null}
  </div>;
}
