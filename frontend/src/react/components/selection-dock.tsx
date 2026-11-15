import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import { useFocusVisible } from 'react-aria';
import { Button } from '@/components/base/buttons/button';
import { busyProps } from '../settings/busy-props';
import { assertBulkAction, runBulkAction, type BulkAction, type BulkHost } from './bulk-action';

const reduceQuery = '(prefers-reduced-motion: reduce)';
const readReduce = () => matchMedia(reduceQuery).matches;
const subscribeReduce = (notify: () => void) => {
  const media = matchMedia(reduceQuery);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};

/** 浮条上一颗会写数据的键：动作声明、此刻作用于哪几项、回执交给谁。 */
export interface DockAction {
  action: BulkAction<unknown>;
  items: readonly unknown[];
  host: BulkHost;
  /** 选中的项都不适用时置灰。 */
  disabled?: boolean;
  /** 写完之后的收尾（清空选择、重读列表）；取消时不调。 */
  done?(): void;
}

interface SelectionDockProps {
  /** 会写数据的键一律走这里：每项都要声明确认文案与撤销方式，缺项当场报错。 */
  actions: readonly DockAction[];
  /** 排在写入键前面的选择控件：全选本页。 */
  leading?: ReactNode;
  /** 排在写入键后面、不写数据的控件：打开查找面板、取消选择。 */
  children?: ReactNode;
  count: string;
  label: string;
  visible: boolean;
}

/** 浮条上的写入键：确认、写入、回执都交给 `runBulkAction`。 */
function DockActionButton({ entry }: { entry: DockAction }) {
  const { action, items, host, disabled, done } = entry;
  const [busy, setBusy] = useState(false);
  const press = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (await runBulkAction(action, items, host)) done?.();
    } catch (error) {
      if (host.failure) host.failure(error);
      else throw error;
    } finally {
      setBusy(false);
    }
  };
  return <Button size="small" variant={action.danger ? 'danger' : 'secondary'} data-bulk-action={action.key}
    disabled={disabled || !items.length} {...busyProps(busy)} onClick={() => void press()}>{action.label}</Button>;
}

const dockSpaces = new Map<HTMLElement, number>();
const publishDockSpace = () => {
  const root = document.documentElement;
  if (dockSpaces.size) root.style.setProperty('--selection-dock-space', `${Math.max(...dockSpaces.values())}px`);
  else root.style.removeProperty('--selection-dock-space');
};

function DockSurface({ actions, leading, children, count, label }: Omit<SelectionDockProps, 'visible'>) {
  const dock = useRef<HTMLDivElement>(null);
  const present = useIsPresent();
  const reduce = useSyncExternalStore(subscribeReduce, readReduce, () => false);
  const { isFocusVisible } = useFocusVisible();
  const instant = reduce || isFocusVisible;
  const hidden = { opacity: 0, transform: 'translate(-50%, 8px)' };
  useLayoutEffect(() => {
    const node = dock.current;
    if (!node || !present) return;
    const measure = () => {
      dockSpaces.set(node, Math.ceil(node.offsetHeight + (parseFloat(getComputedStyle(node).bottom) || 0) + 16));
      publishDockSpace();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      dockSpaces.delete(node);
      publishDockSpace();
    };
  }, [present]);
  return (
    <motion.div ref={dock} role="group" aria-label={label} data-selection-dock data-glass-pane=""
      inert={!present} aria-hidden={!present || undefined}
      initial={instant ? false : hidden}
      animate={{ opacity: 1, transform: 'translate(-50%, 0px)' }}
      exit={{ ...hidden, transition: { duration: instant ? 0 : 0.12 } }}
      transition={{ duration: instant ? 0 : 0.16, ease: [0.23, 1, 0.32, 1] }}>
      <span role="status" className="px-2 text-body-2-regular whitespace-nowrap text-text-primary">
        {count}
      </span>
      {leading}
      {actions.map((entry) => <DockActionButton key={entry.action.key} entry={entry} />)}
      {children}
    </motion.div>
  );
}

/** 持续挂载这个外壳，数量变化只更新内容，清空选择由内部完成退出。 */
export function SelectionDock({ visible, ...props }: SelectionDockProps) {
  for (const entry of props.actions) assertBulkAction(entry.action);
  return <AnimatePresence>{visible ? <DockSurface key="selection" {...props} /> : null}</AnimatePresence>;
}
