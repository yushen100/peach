import { useLayoutEffect, useRef, type ButtonHTMLAttributes } from 'react';
import { Button, type ButtonProps } from '@/components/base/buttons/button';
import { attachHoldToConfirm } from '../../ui-kit/hold-to-confirm';
import { t } from '../../i18n';

type HoldButtonProps = Omit<ButtonProps, 'children' | 'ref'> & { children?: string; holdToConfirm?: boolean };

function useHoldButton(enabled = true) {
  const button = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (enabled) return attachHoldToConfirm(button.current!);
  }, [enabled]);
  return button;
}

/** 直接删除入口复用 BoardUI 按钮与确认框的长按逻辑。 */
export function HoldButton({ children, iconOnly, holdToConfirm = true, ...props }: HoldButtonProps) {
  const button = useHoldButton(holdToConfirm);
  return <Button {...props} ref={button} iconOnly={iconOnly}>
    {children && holdToConfirm ? t('shell:holdToConfirm.label', { action: children }) : children}
  </Button>;
}

/** 原生删除键沿用所在面的尺寸与内容。可切换的还原动作使用普通点击。 */
export function HoldActionButton({ holdToConfirm = true, ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { holdToConfirm?: boolean }) {
  const button = useHoldButton(holdToConfirm);
  return <button type="button" {...props} ref={button} />;
}
