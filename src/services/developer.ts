import { apiFetch } from '@/services/_api';

// C 端开发者门户 API（对应 nest-admin /app/front-hub/developer）
// 数据按 userId 隔离（scope=self），鉴权走 _api 的统一 JWT 注入。

// 统一解包 { code, data } 信封
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return (res as any)?.data ?? (res as T);
}

export type MyTokenStatus = 'active' | 'disabled' | 'expired';

export interface MyToken {
  id: string;
  name: string;
  // 掩码后的 key（仅后 4 位），如 sk-****abcd；明文仅在创建/轮换时返回一次
  keyPrefix?: string;
  keyLast4?: string;
  expiresAt?: string | null;
  usedQuota?: number;
  quota?: number;
  modelLimits?: Record<string, unknown>;
  endpointLimits?: string[];
  allowIps?: string[];
  status: MyTokenStatus;
  createdAt: string;
  lastUsedAt?: string | null;
}

export interface CreateMyTokenParams {
  name: string;
  expiresAt?: string | null;
  modelLimits?: Record<string, unknown>;
  endpointLimits?: string[];
  allowIps?: string[];
}

export interface CreateMyTokenResult {
  token: MyToken;
  // 一次性明文 sk- key，仅此一次可见
  plaintext: string;
}

export interface UsageSummary {
  monthRequests: number;
  monthSpend: number;
  monthTokens?: number;
  balance: number;
  totalRequests?: number;
  totalTokens?: number;
  totalSpend?: number;
}

export interface DeveloperUsagePoint {
  day?: string;
  date?: string;
  requests: number;
  tokens: number;
  spend: number;
}

export interface DeveloperUsageByKey {
  tokenId: string;
  name?: string;
  keyLast4?: string;
  requests: number;
  tokens: number;
  spend: number;
}

export type WebhookEvent = 'usage.spend_alert' | 'request.failed' | 'webhook.test';

export interface MyWebhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  enabled: boolean;
  failedCount: number;
  lastStatus?: number | null;
  lastError?: string | null;
  lastTriggeredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeveloperModel {
  id: string;
  object?: string;
  owned_by?: string;
  context_length?: number;
  capabilities?: string[];
  modalities?: string[];
  pricing?: Record<string, unknown>;
  tags?: string[];
  published?: boolean;
}

export interface TopupPackage {
  id: string;
  name: string;
  amount: number;
  price: number;
  currency?: string;
  bonus?: number;
}

class DeveloperService {
  // ============ API Key ============
  listMyTokens = async () => unwrap<MyToken[]>('/app/front-hub/developer/tokens');

  createMyToken = async (data: CreateMyTokenParams) =>
    unwrap<CreateMyTokenResult>('/app/front-hub/developer/tokens', {
      method: 'POST',
      body: JSON.stringify(data),
    });

  rotateMyToken = async (id: string) =>
    unwrap<CreateMyTokenResult>('/app/front-hub/developer/tokens/' + id + '/rotate', {
      method: 'POST',
    });

  deleteMyToken = async (id: string) =>
    unwrap('/app/front-hub/developer/tokens/' + id, { method: 'DELETE' });

  // ============ 用量 ============
  getUsageSummary = async () => unwrap<UsageSummary>('/app/front-hub/developer/usage/summary');

  getUsage = async (params?: {
    tokenId?: string;
    start?: string;
    end?: string;
    granularity?: 'day' | 'month';
  }) => {
    const qs = new URLSearchParams();
    if (params?.tokenId) qs.set('tokenId', params.tokenId);
    if (params?.start) qs.set('start', params.start);
    if (params?.end) qs.set('end', params.end);
    if (params?.granularity) qs.set('granularity', params.granularity);
    const q = qs.toString();
    return unwrap<DeveloperUsagePoint[] | DeveloperUsageByKey[]>(
      '/app/front-hub/developer/usage' + (q ? '?' + q : ''),
    );
  };

  // ============ Webhook ============
  listWebhooks = async () => unwrap<MyWebhook[]>('/app/front-hub/developer/webhooks');

  createWebhook = async (data: { url: string; events: WebhookEvent[]; secret?: string }) =>
    unwrap<MyWebhook>('/app/front-hub/developer/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });

  updateWebhook = async (
    id: string,
    data: Partial<{ url: string; events: WebhookEvent[]; enabled: boolean }>,
  ) =>
    unwrap<MyWebhook>('/app/front-hub/developer/webhooks/' + id, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

  deleteWebhook = async (id: string) =>
    unwrap('/app/front-hub/developer/webhooks/' + id, { method: 'DELETE' });

  testWebhook = async (id: string) =>
    unwrap<{ success: boolean; status?: number }>(
      '/app/front-hub/developer/webhooks/' + id + '/test',
      { method: 'POST' },
    );

  redeliverWebhook = async (id: string) =>
    unwrap<{ success: boolean }>('/app/front-hub/developer/webhooks/' + id + '/redeliver', {
      method: 'POST',
    });

  // ============ 模型目录 / 充值 ============
  getModels = async () => unwrap<DeveloperModel[]>('/app/front-hub/developer/models');

  topupPackages = async () => unwrap<TopupPackage[]>('/app/front-hub/developer/topup/packages');

  createTopupSession = async (packageId: string) =>
    unwrap<{ sessionUrl?: string; url?: string }>('/app/front-hub/developer/topup/session', {
      method: 'POST',
      body: JSON.stringify({ packageId }),
    });
}

export const developerService = new DeveloperService();
