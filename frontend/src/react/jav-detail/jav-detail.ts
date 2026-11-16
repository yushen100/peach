import { apiGet } from '../../api';
import type { FaceRef } from '@peach/card-art';
import { queryClient } from '../query';

export interface JavDetail {
  code: string; title: string; state: 'ready' | 'partial'; message?: string;
  release_date?: string; duration?: number; score?: number; summary: string;
  studio?: string; director: string; publisher: string;
  performers: string; performer_refs: JavEntityRef[]; studio_refs: JavEntityRef[]; series_refs: JavEntityRef[];
  tags: string[]; has_cover: boolean; cover_version?: string; cover_url?: string;
  tag_refs?: { name: string; category: string; source_name: string }[];
  preview_video_url?: string;
  /** 预告没取到时的原因；取到了（哪怕走的是备用来源或旧结果）就没有这一句。 */
  preview_message?: string;
  /** 本机没有封面时，上次取官方封面没取到的原因；`_code`／`_params` 给界面取当前语言。 */
  cover_message?: string; cover_message_code?: string; cover_message_params?: Record<string, unknown>;
  source_image: boolean; preview_count: number; comments_count: number;
  source_url: string; wanted: boolean; want_id: number | null;
}
export interface JavEntityRef extends FaceRef { name: string; gender?: 'female' | 'male' | 'unknown'; has_logo?: boolean; source_actor_id?: string; source_avatar?: boolean }
/** 一条评论。没有用户名时 `username` 是服务端给的「匿名用户」原文，`username_code` 是它的 code。 */
export interface JavReview { id: string; username: string; username_code?: string; content: string; score?: number; created_at: string }
export interface JavReviews { ok: boolean; items: JavReview[]; page: number; more: boolean; message?: string; checked_at?: string; cache_stale?: boolean }
export interface JavDetailProps {
  code: string; readOnly: boolean;
  actions: { close(): void; navigate(path: string): void; openTag(tag: string): void; receipt(message: string): void;
    canonicalCode?(code: string): void };
}
export const javDetailKey = (code: string) => ['jav-detail', code] as const;
export const fetchJavDetail = (code: string, signal?: AbortSignal, refresh = false) =>
  apiGet<JavDetail>(`/api/jav/detail?code=${encodeURIComponent(code)}${refresh ? '&refresh=1' : ''}`, signal);
export const fetchJavReviews = (code: string, page: number, signal?: AbortSignal, refresh = false) =>
  apiGet<JavReviews>(`/api/jav/reviews?code=${encodeURIComponent(code)}&page=${page}${refresh ? '&refresh=1' : ''}`, signal);
export const prefetchJavDetail = (props: JavDetailProps, signal: AbortSignal) =>
  queryClient.ensureQueryData({ queryKey: javDetailKey(props.code), queryFn: () => fetchJavDetail(props.code, signal),
    staleTime: 6 * 3600_000, revalidateIfStale: true });

/** 同一评论身份只呈现一次；重复页结束翻页。 */
export function nextReviewPage(last: JavReviews, pages: JavReviews[]): number | undefined {
  if (!last.ok || !last.more) return undefined;
  const seen = new Set(pages.slice(0, -1).flatMap(page => page.items.map(item => item.id)));
  return last.items.some(item => !seen.has(item.id)) ? last.page + 1 : undefined;
}
