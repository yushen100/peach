import { fmtSize } from '@peach/legacy/core';
import { t } from '../../i18n';

export const resourceSourceKey = (source: string) =>
  source === 'manko.fun' ? 'manko' : source === 'javdb-comments' ? 'javdb' : source.toLowerCase();

/** 来源的字节数按馆藏容量口径展示，其他来源单位保留；来源没给大小时显示未知。 */
export function resourceSize(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  const bytes = /^([\d,]+)\s*B$/i.exec(text);
  if (/^[\d,.]+$/.test(text)) return t('catalog:shared.unknownSize');
  return bytes ? fmtSize(Number(bytes[1].replaceAll(',', ''))) : value || t('catalog:shared.unknownSize');
}

/** 缓存中的来源限制只表述本次取得范围，不推断账号权限。 */
export function resourceNotice(value: string): string {
  return /^更多评论.*(?:VIP|官方 App)/.test(value)
    ? t('catalog:wantMagnets.partialComments')
    : value;
}
