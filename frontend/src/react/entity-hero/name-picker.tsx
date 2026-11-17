/* 名字右边那枚下拉：在这条实体已有的写法里挑一个当统称，或者添一个新的。
 *
 * 统称由用户自己定。同一个人在库里常有中文、日文、罗马字几种写法，哪一个该顶在标题上是他的
 * 偏好，数据库里没有能推出答案的字段。菜单按名称语言偏好归并已有艺名的写法，读音与损坏条目不列入。
 * 语言切换不触发统一名称操作。这枚下拉恒在，只有一个名字时也在——「她还叫过别的」要有入口，而恰恰是只剩一个
 * 名字的人最需要补。添别名与合并重复档案是另一类事，隔一条线摆在末尾；合并只在能合并的种类上出现。
 *
 * 换统称写的是 `entity.canonical_name` 这个真相字段：确认、写回、回执与重进这一页都在壳里
 * （`actions.chooseName`），勾只在服务端换完、页面重画之后才挪。
 *
 * 面板从按钮左缘往右开：往左开的话 260px 的菜单越过名字压在头像上（用户报过）。面板那身
 * 盒子取 BoardUI 的菜单面（`MENU_POPOVER_SURFACE`，同旧锚定菜单 `.popmenu` 的 16px 圆角、
 * 10px 内边距与投影），菜单项的几何写在 `./entity-hero.css`。 */
import { useEffect, useRef, useState } from 'react';
import { Button, Menu, MenuItem, MenuSection, MenuTrigger, Popover, Separator } from 'react-aria-components';

import { MENU_POPOVER_SURFACE } from '@/components/base/dropdown/menu-styles';

import { Glyph } from './glyph';
import { t } from '../../i18n';

export function NamePicker({ current, choices, onChoose, onAddAlias, onMerge, onDelete, onContribute }: {
  current: string;
  choices: { value: string; label: string }[];
  onChoose(name: string): void;
  onAddAlias(): void;
  onMerge?: () => void;
  onDelete?: () => void;
  onContribute?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const textEdit = useRef(false);
  /* title 给壳的提示条用（board-controls 只认 [title]），和旧资料卡那枚一样悬停就出字。
     react-aria 的 Button 不收 title，挂载后直接写到节点上；提示条收起时会把它放回来。 */
  useEffect(() => { toggle.current?.setAttribute('title', t('catalog:namePicker.title')) }, []);
  return (
    <MenuTrigger isOpen={open} onOpenChange={setOpen}>
      <Button ref={toggle} data-namepick-toggle="" aria-label={t('catalog:namePicker.title')}>
        <Glyph name="chevron-down" />
      </Button>
      {/* 离按钮 8px：旧锚定菜单 wireAnchoredMenu 就是 anchor.bottom + 8，另两枚弹层也是 8。 */}
      <Popover placement="bottom start" offset={8} containerPadding={8} className={MENU_POPOVER_SURFACE}
        isNonModal={new URLSearchParams(window.location.search).has('edit')}
        shouldCloseOnInteractOutside={element => !element.closest('[data-copy-editor]')}
        data-namepick-menu="">
        <div className="contents" onKeyDownCapture={event => { textEdit.current = event.altKey }}>
          <Menu aria-label={t('catalog:namePicker.title')} data-namepick-list="" data-copy-interact=""
            onPointerDownCapture={event => { textEdit.current = event.altKey }}>
            <MenuSection selectionMode="single" disallowEmptySelection selectedKeys={[current]}
              onSelectionChange={(keys) => {
                const chosen = [...(keys as Set<string>)][0];
                if (chosen && chosen !== current) onChoose(chosen);
              }}>
              {choices.map((option) => (
                <MenuItem key={option.value} id={option.value} textValue={option.label} data-namepick-name={option.value}>
                  <Glyph name="check" /><span>{option.label}</span>
                </MenuItem>
              ))}
            </MenuSection>
            <Separator data-namepick-rule="" />
            <MenuSection>
              {onContribute ? <MenuItem id="contribute-name" textValue={t('catalog:seedName.title')}
                onAction={onContribute}><Glyph name="globe" /><span>{t('catalog:seedName.title')}</span></MenuItem> : null}
              <MenuItem id="alias" textValue={t('catalog:namePicker.addAlias')} data-namepick-alias="" onAction={onAddAlias}>
                <Glyph name="plus" /><span>{t('catalog:namePicker.addAliasMenu')}</span>
              </MenuItem>
              {onMerge ? (
                <MenuItem id="merge" textValue={t('shell:entityMerge.menu')} data-namepick-merge="" onAction={onMerge}>
                  <Glyph name="git-compare" /><span>{t('shell:entityMerge.menu')}</span>
                </MenuItem>
              ) : null}
            </MenuSection>
            {onDelete ? <Separator data-namepick-rule="" /> : null}
            {onDelete ? <MenuSection>
              <MenuItem id="delete" textValue={t('catalog:rosterActions.delete')} data-namepick-delete=""
                shouldCloseOnSelect={false} onAction={() => {
                  if (textEdit.current) return;
                  setOpen(false);
                  onDelete();
                }}>
                <Glyph name="trash" /><span>{t('catalog:rosterActions.deleteMenu')}</span>
              </MenuItem>
            </MenuSection> : null}
          </Menu>
        </div>
      </Popover>
    </MenuTrigger>
  );
}
