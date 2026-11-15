/* 编辑资料里新建的档案（ADR-0165）带一个「自建」小标签，和刮来的放在一起时认得出来。
 * 用文字不用图标：手势、符号的含义随地区不同，文字随界面语言翻译。 */
import { Chip } from '@/components/base/badges/chip';
import { t } from '../../i18n';

export function UserCreatedChip({ className, ...data }: { className?: string } & Record<`data-${string}`, string>) {
  return <Chip variant="caption" color="soft" data-user-created-mark="" className={className} {...data}>{t('catalog:itemEdit.userCreated')}</Chip>;
}
