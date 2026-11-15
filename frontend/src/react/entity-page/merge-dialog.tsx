/* 名字菜单里的「合并重复档案」：搜出另一份同类档案，弹层里写明保留哪份、并入哪份，确认后合并。
 *
 * 判据与添加别名撞名时那一条相同（`mergeSides`）：保留作品多的一侧，作品数相同保留当前页。双方的
 * 作品数由 `GET /api/entity-merge` 读，选中之前确认键报「先选」。写入失败时原因留在弹层里，沿用
 * `formModal`；弹层里的下拉挂进它自己的 dialog，理由同编辑资料框（`item-edit.tsx`）。 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { UNSAFE_PortalProvider } from 'react-aria';
import { formModal } from '@peach/legacy/ui';
import { overlayHost } from '../components/overlay-host';
import { EntityChips, type Choice } from '../item-detail/item-edit';
import { apiGet, apiSend } from '../../api';
import { mergeSides, type EntityMergePair, type EntityMergeResult } from './entity-page';
import { t } from '../../i18n';

type FormDialog = ReturnType<typeof formModal>;

const planUrl = (kind: string, id: number, other: number) =>
  `/api/entity-merge?kind=${encodeURIComponent(kind)}&id=${id}&other=${other}`;

export function MergeDialog({ kind, currentId, close, onMerged }: {
  kind: string; currentId: number; close(): void; onMerged(done: EntityMergeResult): void;
}) {
  const given = useRef({ close, onMerged });
  /* 确认键读的是最近一次说明：选了另一份还没读到作品数时，按「先选」处理，不猜保留哪边。 */
  const plan = useRef<EntityMergePair | null>(null);
  const [view, setView] = useState<{ host: Element; dialog: FormDialog } | null>(null);
  useEffect(() => {
    const { close: done, onMerged: merged } = given.current;
    const dialog = formModal({
      title: t('shell:entityMerge.title'), confirmLabel: t('shell:entityMerge.confirm'), backdropCloses: false,
      body: '<div class="peach-react" data-entity-merge-fields></div>',
      onConfirm: async () => {
        const pair = plan.current;
        if (!pair) throw new Error(t('shell:entityMerge.pickFirst'));
        const { keep, absorb } = mergeSides(pair);
        return apiSend<EntityMergeResult>('/api/entity-merge', { kind, target_id: keep.id, source_id: absorb.id });
      },
    });
    dialog.dialog.setAttribute('data-entity-merge-dialog', '');
    // 合并撤不回，确认键与撞名那个确认框一样用危险样式（confirmModal 的 danger 也是这样换的）。
    dialog.confirmButton.classList.remove('primary');
    dialog.confirmButton.classList.add('danger');
    setView({ host: dialog.dialog.querySelector('[data-entity-merge-fields]')!, dialog });
    void dialog.done.then(result => {
      const response = result.result as EntityMergeResult | undefined;
      if (result.confirmed && response?.target) merged(response);
      done();
    });
    return () => dialog.close();
  }, [kind]);
  return view ? createPortal(<UNSAFE_PortalProvider getContainer={() => overlayHost(view.dialog.dialog)}>
    <MergeFields kind={kind} currentId={currentId} onPlan={value => { plan.current = value }} />
  </UNSAFE_PortalProvider>, view.host) : null;
}

function MergeFields({ kind, currentId, onPlan }: { kind: string; currentId: number; onPlan(pair: EntityMergePair | null): void }) {
  const [picked, setPicked] = useState<Choice | null>(null);
  const other = picked?.id ?? null;
  const read = useQuery({
    queryKey: ['entity-merge-plan', kind, currentId, other],
    queryFn: ({ signal }) => apiGet<EntityMergePair>(planUrl(kind, currentId, other!), signal),
    enabled: other != null, staleTime: 0,
  });
  const pair = other != null ? read.data ?? null : null;
  useEffect(() => { onPlan(pair) }, [pair, onPlan]);
  const sides = pair ? mergeSides(pair) : null;
  return (
    <div data-entity-merge="" className="flex flex-col gap-2">
      <span id="entity-merge-pick">{t('shell:entityMerge.pickLabel')}</span>
      <EntityChips kind={kind} single values={picked ? [picked] : []} labelledBy="entity-merge-pick"
        onChange={values => setPicked(values[0] ?? null)}
        picker={{ allowCreate: false, exclude: currentId, placeholder: t('shell:entityMerge.pickPlaceholder') }} />
      {sides ? (
        <p data-entity-merge-summary="">{t('shell:entityMerge.summary', {
          keep: sides.keep.canonical_name, keepWorks: sides.keep.works,
          absorb: sides.absorb.canonical_name, absorbWorks: sides.absorb.works,
        })}</p>
      ) : null}
    </div>
  );
}
