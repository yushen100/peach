/* 「修复与迁移」的数据契约与首屏预取。和页面分开放：路由切换时先取数，页面那一块按需加载，
 * 两路并行，页面挂上去读的是 Query 缓存里已经取好的这一份，路由骨架直接换成内容。 */
import { apiGet } from '../../api';
import { serverLabel } from '../../core/server-text';
import { queryClient } from '../query';

export interface RepairItem {
  id: string; title: string; summary: string; mode: 'auto' | 'confirm';
  state: string; changed?: number; done?: number; total?: number; pending?: number;
  /** 删除类确认项：能回收的文件数与字节数；`estimating` 为还在后台统计。 */
  files?: number; bytes?: number; estimating?: boolean; error?: string;
  /** 改账本的确认项：确认前先说明会先备份账本，`pending` 是还剩几处要改。 */
  backed_up?: boolean;
}
/** `rule` 是修复规则的 id，按它取译文；`id` 是这一次执行的记录号。 */
export interface RepairHistory { id: string; rule: string; title: string; at: number; changed: number; backups: { name: string; exists: boolean }[] }
export interface RepairCenterData { available: boolean; items: RepairItem[]; history: RepairHistory[] }

export const REPAIRS_URL = '/api/configuration/repairs';
export const REPAIRS_KEY = ['configuration', 'repairs'] as const;

/** 各项的名称与说明按 id 换成界面语言；没有译文的照用服务端的中文。 */
export const localizeRepairs = (data: RepairCenterData): RepairCenterData => ({
  ...data,
  items: (data.items || []).map((item) => ({
    ...item,
    title: serverLabel(`repairCenter.items.${item.id}.title`, item.title),
    summary: serverLabel(`repairCenter.items.${item.id}.summary`, item.summary),
  })),
  history: (data.history || []).map((row) => ({ ...row, title: serverLabel(`repairCenter.history.${row.rule}`, row.title) })),
});

export const fetchRepairs = async (signal?: AbortSignal) => localizeRepairs(await apiGet<RepairCenterData>(REPAIRS_URL, signal));

export async function prefetchRepairs(signal: AbortSignal): Promise<void> {
  await queryClient.fetchQuery({ queryKey: REPAIRS_KEY, queryFn: () => fetchRepairs(signal) });
}
