import { apiFetch } from '@/services/_api';
import { type AgentUsageGranularity } from '@/types/usage/usageRecord';

class UsageService {
  // 月度用量：GET /api/v1/c-end/usage/monthly?year=xxx&month=xxx
  findByMonth = async (mo?: string) => {
    const query = new URLSearchParams();
    if (mo) {
      // 兼容原 mo 参数（如 "2024-01"），拆分为 year/month
      const [year, month] = mo.split('-');
      if (year) query.set('year', year);
      if (month) query.set('month', month);
    }
    const qs = query.toString();
    return apiFetch(`/api/v1/c-end/usage/monthly${qs ? `?${qs}` : ''}`);
  };

  // 日度用量：GET /api/v1/c-end/usage/daily?year=xxx&month=xxx
  findAndGroupByDay = async (mo?: string) => {
    const query = new URLSearchParams();
    if (mo) {
      const [year, month] = mo.split('-');
      if (year) query.set('year', year);
      if (month) query.set('month', month);
    }
    const qs = query.toString();
    return apiFetch(`/api/v1/c-end/usage/daily${qs ? `?${qs}` : ''}`);
  };

  // Agent 用量统计：GET /api/v1/c-end/usage/agent-stats
  getAgentUsageStats = async (params: {
    agentId: string;
    endAt: string;
    granularity: AgentUsageGranularity;
    startAt: string;
  }) => {
    const query = new URLSearchParams({
      agentId: params.agentId,
      endAt: params.endAt,
      granularity: params.granularity,
      startAt: params.startAt,
    });
    return apiFetch(`/api/v1/c-end/usage/agent-stats?${query.toString()}`);
  };
}

export const usageService = new UsageService();
