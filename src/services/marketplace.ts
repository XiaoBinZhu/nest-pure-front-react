import { apiFetch } from '@/services/_api';

// C 端 Agent 市场 API（对应 nest-admin /api/v1/c-end/marketplace）

async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return (res as any)?.data ?? (res as T);
}

export interface MarketAgent {
  id: string;
  userId: number;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'offline';
  rating: number;
  ratingCount: number;
  cloneCount: number;
  createdAt: string;
  updatedAt: string;
}

class MarketplaceService {
  listAgents = async (params?: { category?: string; status?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const q = qs.toString();
    return unwrap<{ items: MarketAgent[]; total: number }>(
      `/api/v1/c-end/marketplace/agents${q ? `?${q}` : ''}`,
    );
  };

  getAgent = async (id: string) => unwrap<MarketAgent>(`/api/v1/c-end/marketplace/agents/${id}`);

  getCategories = async () => unwrap<string[]>('/api/v1/c-end/marketplace/categories');

  clone = async (id: string) => unwrap(`/api/v1/c-end/marketplace/${id}/clone`, { method: 'POST' });

  rate = async (id: string, rating: number, comment?: string) =>
    unwrap(`/api/v1/c-end/marketplace/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment }),
    });

  publish = async (data: { title: string; description?: string; category?: string; tags?: string[]; agentId?: string }) =>
    unwrap('/api/v1/c-end/marketplace/publish', {
      method: 'POST',
      body: JSON.stringify(data),
    });

  mine = async () => unwrap<MarketAgent[]>('/api/v1/c-end/marketplace/mine');
}

export const marketplaceService = new MarketplaceService();
