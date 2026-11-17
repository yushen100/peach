import { apiGet } from '../../api';
import { codedText, partsLabel } from '../../core/server-text';
import { queryClient } from '../query';
import type { TableFacets } from '../components/use-table-filters';

/** 一项诊断。`label`、`reason`、`action` 是服务端按中文渲染的原文，旁边的 code 按界面语言取译文；
 *  几条原因并列时 `reason_parts` 是按段存的一句。 */
export interface DiagnosticCheck {
  label: string; label_code?: string; status: string;
  reason: string; reason_code?: string; reason_params?: Record<string, unknown>; reason_parts?: unknown[];
  action: string; action_code?: string | null; target: string | null;
  details: Record<string, unknown>;
}
export interface LibraryItem {
  id: number; code: string | null; name: string; title: string; location: string; path: string;
  duration: number | null; size: number | null;
  /** 与 `/api/items` 同一个归属；不在任何媒体库里时为空。 */
  library_id?: string;
}
export interface LibraryGroup {
  label: string; label_code?: string; status: string; count: number | null; items: LibraryItem[];
  truncated: boolean;
  column_facets?: TableFacets;
}
export interface DiagnosticReport {
  version: string; status: string; checks: Record<string, DiagnosticCheck>;
  library: { groups: Record<string, LibraryGroup>; issue_at: string | null };
  sources: Array<{ source: string; label: string; status: string; reason: string; reason_code?: string;
    last_success_at: string | null; cooldown_until: string | null;
    last_check_at?: string | null; elapsed_s?: number | null }>;
}

/** 诊断项在当前界面语言下的显示名、原因与修法。 */
export function checkText(check: DiagnosticCheck): { label: string; reason: string; action: string } {
  return {
    label: codedText(check, 'label'),
    reason: check.reason_parts ? partsLabel(check.reason_parts, check.reason) : codedText(check, 'reason'),
    action: check.action ? codedText(check, 'action') : '',
  };
}
export const DIAGNOSTICS_KEY = ['diagnostics'] as const;
export const fetchDiagnostics = (signal?: AbortSignal) => apiGet<DiagnosticReport>('/api/diagnostics', signal);
export async function prefetchDiagnostics(signal: AbortSignal): Promise<void> {
  await queryClient.fetchQuery({ queryKey: DIAGNOSTICS_KEY, queryFn: () => fetchDiagnostics(signal), staleTime: 10_000 });
}
