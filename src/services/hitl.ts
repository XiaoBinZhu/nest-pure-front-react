import { apiFetch } from '@/services/_api';

// C 端 HITL 审批 API（对应 nest-admin /api/v1/c-end/hitl）

async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return (res as any)?.data ?? (res as T);
}

export interface HitlApproval {
  id: string;
  userId: number;
  tool: string;
  args?: any;
  risk: 'SAFE' | 'MODERATE' | 'DANGEROUS';
  description?: string;
  threadId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reason?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface HitlPolicy {
  id: string;
  tool: string;
  defaultRisk: string;
  forceApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

class HitlService {
  listApprovals = async (params?: { status?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const q = qs.toString();
    return unwrap<{ items: HitlApproval[]; total: number }>(
      `/api/v1/c-end/hitl/approvals${q ? `?${q}` : ''}`,
    );
  };

  approve = async (id: string, reason?: string) =>
    unwrap(`/api/v1/c-end/hitl/approvals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || '确认执行' }),
    });

  reject = async (id: string, reason?: string) =>
    unwrap(`/api/v1/c-end/hitl/approvals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || '拒绝执行' }),
    });

  listPolicies = async () => unwrap<HitlPolicy[]>('/api/v1/c-end/hitl/policies');

  createPolicy = async (data: { tool: string; defaultRisk?: string; forceApproval?: boolean }) =>
    unwrap<HitlPolicy>('/api/v1/c-end/hitl/policies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
}

export const hitlService = new HitlService();
