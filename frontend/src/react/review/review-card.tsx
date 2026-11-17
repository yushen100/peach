/* 队列里的一张卡：问的是什么、凭什么判、以及三个结论。
 *
 * 待处理卡依次提供忽略、稍后处理、通过，主操作靠右；已忽略卡只提供恢复。 */
import { useRef } from 'react';

import { avatarInner } from '@peach/card-art';

import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Chip } from '@/components/base/badges/chip';
import { LinkButton } from '@/components/base/buttons/link-button';
import { cx } from '@/utils/cx';
import { cardClass } from '../components/card';
import { FIELDSET_FOOT } from '../components/fieldset-layout';
import { EmptyState } from '../components/empty-state';
import { rowSelectionOperation, useWorkContextMenu, type WorkContextOperation } from '../components/work-context-menu';
import { useOverlayScrollbar } from '../components/overlay-scrollbar';
import { RiArrowGoBackLine, RiCheckLine, RiEyeOffLine, RiImageLine, RiPlayLine, RiTimeLine, RiUserLine } from '@remixicon/react';
import { busyProps } from '../settings/use-action';
import { CandidateChoices, PendingGenres } from './candidate-form';
import { ComparisonText } from './comparison-text';
import { AssetPicker, EntityHead, IdentityEvidence, OriginAsset, SourceImage } from './review-evidence';
import type { DecisionStatus, ReviewCategory, ReviewQueue, ReviewRow, RowChoice } from './review';
import { REVIEW_DECISION_LABELS } from './review';
import {
  canApprove, ENTITY_REVIEW_KINDS, rowEvidence, rowFieldName, rowSubject, rowTags, rowTitle,
} from './review';
import { t } from '../../i18n';

/* 卡面与管理页同层；来源选择是卡内唯一带单选边框的表单。 */
const CARD = cardClass({
  variant: 'filled', padding: 'none', className: 'flex flex-col overflow-hidden',
});

/* 卡头那一行的行高：字段名是一枚 caption Chip（12/16 加上下各 4），24px 由它定。标题、
   勾选框和判定徽章各自在这 24px 里居中，谁的字号变了也还在同一条中线上。 */
const HEADING_LINE = 'flex min-h-6 min-w-0 items-center';

/** 实体类卡头最多露几部对照作品，同服务端给的条数。 */
const COMPARISON_SHOWN = 2;

/* 一排卡等高，长出来的那部分在卡内滚。高度随内容走的话，一行里几张卡参差不齐，
   眼睛要在每张卡上重新找「判定」在哪；身份回配那一类要放下来源图和样本列表，高一档。 */
const CARD_HEIGHT = (category: ReviewCategory) =>
  (category === 'western_identity' ? 'h-review-card-tall' : 'h-review-card');

export interface CardHandlers {
  openItem(id: number): void;
  openEntity(kind: string, name: string): void;
  onReveal(id: number): void;
  revealing: number;
  revealNote: string;
  toast(message: string): void;
}

export interface ReviewCardProps {
  category: ReviewCategory;
  queueView?: ReviewQueue;
  row: ReviewRow;
  choice: RowChoice;
  onChoice(next: RowChoice): void;
  selected: boolean;
  onSelect(range: boolean, checked: boolean): void;
  locked: boolean;
  busy: boolean;
  problem: string;
  genreTags: string[];
  onDecide(status: DecisionStatus): void;
  handlers: CardHandlers;
}

export function ReviewCard(props: ReviewCardProps) {
  const {
    category, row, choice, onChoice, selected, onSelect, locked, busy, problem, genreTags,
    onDecide, handlers, queueView = 'pending',
  } = props;
  /* Checkbox 的 `onChange` 只给新状态，Shift 要从触发它的那一下事件里取：按下先于变更，
     键盘的空格也一样。 */
  const range = useRef(false);
  /* 当前资料与候选共用一个滚动区，卡头和判断操作保持可见。 */
  const body = useOverlayScrollbar<HTMLDivElement>();
  const metadata = category === 'metadata_fields';
  const subjectKind = ENTITY_REVIEW_KINDS[category] || '';
  const subjectName = String(row.creator || '').trim();
  const asEntity = !!subjectKind && !!subjectName;
  const title = rowTitle(category, row);
  const fieldName = rowFieldName(category, row);
  const subject = rowSubject(category, row);
  const evidence = rowEvidence(row);
  const tags = rowTags(row);
  const approvable = canApprove(category, row);
  const comparison = row.comparison_assets || [];
  const assets = row.preview_assets || [];
  const decisionLabel = REVIEW_DECISION_LABELS[row.decision || ''];

  /* 对照作品排在不缩的卡头里：服务端给两条，再多也只露前两条，其余报一个数，
     否则卡头会把动作条挤出卡外。 */
  const origin = comparison.length > 1
    ? <div className="flex flex-col gap-3">
        {comparison.slice(0, COMPARISON_SHOWN).map((asset) => (
          <OriginAsset key={asset.id} asset={asset} openItem={handlers.openItem} />
        ))}
        {comparison.length > COMPARISON_SHOWN
          ? <p className="text-body-2-regular text-text-secondary">
              {t('manage:reviewCard.moreComparison', { count: comparison.length - COMPARISON_SHOWN })}
            </p>
          : null}
      </div>
    : asEntity
      ? <EntityHead kind={subjectKind} name={subjectName}
          works={Number(row.video_count || row.videos || 0)}
          openEntity={handlers.openEntity}
          avatar={avatarInner(subjectName,
            row.entity_id
              ? { id: row.entity_id, has_image: !!row.has_image, image_version: row.image_version, avatar_focus: row.avatar_focus }
              : null,
            null, subjectKind)} />
      : row.asset_id
        ? <OriginAsset openItem={handlers.openItem}
            asset={{ id: row.asset_id, name: row.asset_name, code: row.code, preview_url: row.asset_preview_url }} />
        : null;

  /* 预览和判断依据是同一件事的两半：看这几帧，然后读这一句。候选表单和身份证据那两类
     每一项自己就是一个框，不再套一层。 */
  const preview = metadata
    ? <CandidateChoices row={row} fieldName={fieldName} value={choice.candidateKey}
        onChange={(next) => onChoice({ ...choice, candidateKey: next })} locked={locked} />
    : category === 'creator_tags'
      ? (assets.length
        ? <AssetPicker assets={assets} picked={choice.assets} locked={locked}
            onPicked={(next) => onChoice({ ...choice, assets: next })} />
        /* 空白一片会被当成界面坏了。真实原因是这些作品还没抽帧，说清楚比留白好。 */
        : <EmptyState size="compact" icon={RiImageLine} title={t('manage:reviewCard.noFramesTitle')}>
            {row.video_count ? t('manage:reviewCard.noFramesBody', { count: row.video_count }) : t('manage:reviewCard.noFramesBodyUncounted')}
          </EmptyState>)
      : category === 'fc2_similarity'
        ? null
        : category === 'western_identity'
          ? <IdentityEvidence row={row} openItem={handlers.openItem} openEntity={handlers.openEntity}
              onReveal={handlers.onReveal} revealing={handlers.revealing} note={handlers.revealNote} />
          : <SourceImage url={row.preview_url} />;

  const heading = asEntity
    ? origin
    : fieldName
      /* 字段名是这张卡在问的问题（「这个作品的创作者填什么」），作品标识只是它问的对象。
         写在标题末尾的话，一条无番号视频的文件名会先把它挤出省略号。 */
      ? <h4 className={cx(HEADING_LINE, 'flex-wrap gap-2')}>
          {/* Chip 自己不截断：外面套一层封顶的裁切框，超长的字段名不撑出卡外，全文在 title 里。 */}
          <span title={fieldName} className="flex max-w-full min-w-0 overflow-hidden rounded-md"><Chip variant="caption" color="neutral">{fieldName}</Chip></span>
          <span title={subject} className="min-w-0 truncate text-body-medium text-text-primary">{subject}</span>
        </h4>
      : <h4 className={HEADING_LINE}>
          <span title={title} className="min-w-0 truncate text-body-medium text-text-primary">{title}</span>
        </h4>;

  const menu = useWorkContextMenu();
  const operations: WorkContextOperation[] = [];
  if (comparison.length <= 1) {
    if (asEntity) {
      operations.push({ id: 'entity', label: subjectName, icon: RiUserLine,
        run: () => handlers.openEntity(subjectKind, subjectName) });
    } else if (row.asset_id) {
      const assetId = row.asset_id;
      operations.push({ id: 'open', label: t('catalog:mediaActions.open'), icon: RiPlayLine,
        run: () => handlers.openItem(assetId) });
    }
  }
  if (!locked) {
    operations.push(rowSelectionOperation(selected, () => onSelect(false, !selected)));
    if (queueView !== 'ignored') {
      operations.push({ id: 'approve', label: t('manage:reviewDecision.approve'), icon: RiCheckLine,
        disabled: busy || !approvable, run: () => onDecide('approved') });
    }
    operations.push(queueView === 'pending'
      ? { id: 'later', label: t('manage:reviewDecision.later'), icon: RiTimeLine, disabled: busy, run: () => onDecide('skipped') }
      : { id: 'restore', label: t('manage:reviewDecision.moveToPending'), icon: RiArrowGoBackLine, disabled: busy, run: () => onDecide('restore') });
    if (queueView !== 'ignored') {
      operations.push({ id: 'ignore', label: t('manage:shared.ignore'), icon: RiEyeOffLine,
        disabled: busy, run: () => onDecide('rejected') });
    }
  }
  const context = { key: row.item_key, operations };
  return (
    <section aria-label={title} data-review-key={row.item_key}
      className={cx(CARD, CARD_HEIGHT(category))}
      onContextMenu={event => {
        if (!(event.target as Element).closest('input, textarea, select, [contenteditable]')) menu.onContextMenu(event, context);
      }}
      onKeyDown={event => {
        if (!(event.target as Element).closest('input, textarea, select, [contenteditable]')) menu.onKeyDown(event, context);
      }}>
      {menu.menu}
      <header className="flex min-w-0 shrink-0 items-center gap-2 border-b border-separator-border px-5 py-4">
        {locked ? null : (
          /* 勾选框只有 16px，标题那行 24px。两个都按 24px 各自居中，中线才落在一条上——
             顶对顶排的话，读的人看到的是勾选框浮在标题上面一截。 */
          <span className={cx(HEADING_LINE, 'shrink-0')}
            onPointerDownCapture={(event) => { range.current = event.shiftKey }}
            onKeyDownCapture={(event) => { range.current = event.shiftKey }}>
            <Checkbox isSelected={selected} aria-label={t('manage:reviewCard.selectItem', { title })}
              onChange={(on) => onSelect(range.current, on)} />
          </span>
        )}
        <div className="min-w-0 flex-1">{heading}</div>
        {decisionLabel ? <Chip variant="caption" color="neutral">{decisionLabel}</Chip> : null}
      </header>

      {/* 中段只长不缩：内容短时它吃掉剩下的高度，内容长时卡不变形，由这一段自己滚。
          外面这一层只为放那条覆盖式滚动条的轨道：它按 `absolute` 铺，得有一个只裹着
          滚动块本身的定位祖先，否则会跑到整页的右边缘去。 */}
      <div className="relative mx-5 flex min-w-0 min-h-0 flex-1 flex-col">
        <div ref={body} className="flex min-w-0 min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
          {/* 数据库规范名当标题，抓取来源给的写法（多为罗马音）留作副标题。 */}
          {row.source_name
            ? <p className="text-body-2-regular text-text-secondary">{t('manage:reviewCard.sourceSpelling', { name: row.source_name })}</p>
            : null}
          {/* 实体类卡片的作品数已经写在创作者入口里，这里再写一遍就是同一个数字两处。 */}
          {!asEntity && (row.board || row.assets)
            ? <p className="text-body-2-regular text-text-secondary">
                {t('manage:reviewCard.comparisonFiles', { count: Number(row.video_count || row.assets || 0) })}
              </p>
            : null}
          {!asEntity && origin ? origin : null}
          {metadata && (evidence || row.current_value !== undefined) ? <div role="region" aria-label={t('manage:reviewCard.currentInfo')}
            className="flex min-w-0 flex-col gap-1 border-b border-separator-border pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <h5 data-copy-key="review.card.current_value" className="text-caption-1-medium text-text-secondary">{t('manage:reviewCard.currentValue')}</h5>
              {row.current_owner?.startsWith('user:') || row.current_owner?.startsWith('review:')
                ? <Chip variant="caption" color="neutral">{t('manage:reviewCard.manuallyConfirmed')}</Chip> : null}
            </div>
            <p className="text-body-2-regular text-text-primary wrap-anywhere">
              {row.current_value === undefined ? evidence : row.current_value
                ? <ComparisonText value={row.current_value}
                    reference={(row.candidates?.find(candidate => candidate.candidate_key === choice.candidateKey)
                      || row.candidates?.[0])?.display_value} />
                : t('manage:reviewCard.noMetadata')}
            </p>
            {row.videos !== undefined ? <p className="text-caption-1-regular text-text-secondary">
              {t(row.asset_path ? 'manage:reviewCard.matchingFiles' : 'manage:reviewCard.sameCodeFiles', { count: Number(row.videos) })}
            </p> : null}
          </div> : null}
          {tags.length || category === 'creator_tags' ? (
            <div className="flex flex-wrap gap-1">
              {tags.length
                ? tags.map((tag) => <Chip key={tag} variant="caption" color="soft">{tag}</Chip>)
                : <small className="text-body-2-regular text-text-secondary">{t('manage:reviewCard.noPendingTags')}</small>}
            </div>
          ) : null}
          {metadata ? <div className="flex flex-wrap items-center justify-between gap-2">
            <h5 className="text-caption-1-medium text-text-secondary">
              <span data-copy-key="review.card.candidate_sources">{t('manage:reviewCard.candidateSources')}</span>{` · ${row.candidates?.length || 0}`}
            </h5>
            {row.current_value || (row.candidates?.length || 0) > 1 ? <span
              data-copy-key={row.current_value ? 'review.card.compare_current' : 'review.card.compare_sources'}
              className="text-caption-1-regular text-text-tertiary">
              {row.current_value ? t('manage:reviewCard.comparedToCurrent') : t('manage:reviewCard.sourceDifferences')}
            </span> : null}
          </div> : null}
          {preview}
          <PendingGenres row={row} tags={genreTags} locked={locked} toast={handlers.toast} />
          {!metadata && evidence
            ? <p className="text-body-2-regular text-text-secondary wrap-anywhere">{evidence}</p>
            : null}
        </div>
      </div>

      <footer className={cx(FIELDSET_FOOT.stack, 'shrink-0')}>
        {queueView !== 'ignored' ? <LinkButton variant="secondary" size="small" className="me-auto" disabled={locked} {...busyProps(busy)}
          onClick={() => onDecide('rejected')}>{t('manage:shared.ignore')}</LinkButton> : null}
        {queueView === 'pending' ? <Button variant="secondary" size="small" disabled={locked} {...busyProps(busy)}
          onClick={() => onDecide('skipped')}>{t('manage:reviewDecision.later')}</Button> : <Button
          variant={queueView === 'ignored' ? 'primary' : 'secondary'} size="small" disabled={locked} {...busyProps(busy)}
          onClick={() => onDecide('restore')}>{t('manage:reviewDecision.moveToPending')}</Button>}
        {queueView !== 'ignored' ? <Button variant="primary" size="small" disabled={locked || !approvable} {...busyProps(busy)}
          title={approvable ? undefined : t('manage:reviewCard.cannotApproveHint')}
          onClick={() => onDecide('approved')}>
          {approvable ? t('manage:reviewDecision.approve') : t('manage:reviewCard.cannotApprove')}
        </Button> : null}
        {problem
          ? <p role="status" className="w-full text-body-2-regular text-text-error-primary">{problem}</p>
          : null}
      </footer>
    </section>
  );
}
