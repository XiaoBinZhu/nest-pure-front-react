import { apiFetch } from '@/services/_api';

// 统一解包 { code, data } 信封（后端响应统一包装）
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return 'data' in (res as any) ? (res as any).data : (res as T);
}

/** GET /app/front-hub/user/quota 聚合响应（token/金额额度 + 积分钱包） */
export interface QuotaOverview {
  aiQuota: number;
  aiQuotaAmount: number;
  aiQuotaAmountUnlimited: boolean;
  aiQuotaUnlimited: boolean;
  aiTotalQuota: number;
  aiTotalQuotaAmount: number;
  aiUsedQuota: number;
  aiUsedQuotaAmount: number;
  billingMode: string;
  pointsBalance: number;
  pointsFrozen: number;
  pointsTotalConsumed: number;
  pointsTotalGranted: number;
}

/** GET /ai/point-transaction/me 流水分页项 */
export interface PointTransactionItem {
  amountUsd: number;
  balanceAfter: number;
  createdAt: string;
  delta: number;
  id: number;
  remark: string | null;
  source: string | null;
  sourceId: string | null;
  type: number;
  userId: number;
}

export interface PointTransactionPage {
  list: PointTransactionItem[];
  page: number;
  size: number;
  total: number;
}

/** GET /app/front-hub/usage/summary 月度汇总 */
export interface UsageSummary {
  costAmount: string | number | null;
  inputTokens: string | number | null;
  outputTokens: string | number | null;
  requestCount: string | number | null;
  sellAmount: string | number | null;
  totalTokens: string | number | null;
}

/** GET /app/front-hub/usage/recent 最近日志项 */
export interface RecentUsageLog {
  costAmount?: string | number | null;
  createdAt: string;
  id: number;
  model?: string | null;
  pointsConsumed?: string | number | null;
  sellAmount?: string | number | null;
  totalTokens?: number | null;
}

class QuotaService {
  /** 额度三合一聚合（token/金额/积分），优先使用 C 端聚合接口 */
  getOverview = (): Promise<QuotaOverview> => unwrap<QuotaOverview>('/app/front-hub/user/quota');

  /** 积分流水（分页） */
  getTransactions = (params?: { page?: number; pageSize?: number }): Promise<PointTransactionPage> => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    const qs = query.toString();
    return unwrap<PointTransactionPage>(`/ai/point-transaction/me${qs ? `?${qs}` : ''}`);
  };

  /** 本月用量汇总 */
  getUsageSummary = (year?: number, month?: number): Promise<UsageSummary> => {
    const query = new URLSearchParams();
    if (year) query.set('year', String(year));
    if (month) query.set('month', String(month));
    const qs = query.toString();
    return unwrap<UsageSummary>(`/app/front-hub/usage/summary${qs ? `?${qs}` : ''}`);
  };

  /** 最近用量日志 */
  getRecentLogs = (limit = 10): Promise<RecentUsageLog[]> =>
    unwrap<RecentUsageLog[]>(`/app/front-hub/usage/recent?limit=${limit}`);
}

export const quotaService = new QuotaService();
