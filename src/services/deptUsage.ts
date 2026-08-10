import { apiFetch } from '@/services/_api';

// 统一解包 { code, data } 信封（后端响应统一包装）
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return 'data' in (res as any) ? (res as any).data : (res as T);
}

// 部门负责人数据看板 API（对应 nest-admin /app/front-hub/usage/dept/*）
// 数据范围由后端 DataScopeService 解析：admin→全量 / 部门负责人→本部门 / 普通用户→仅自己

export interface DeptOverview {
  /** 部门成员总数 */
  memberCount: number;
  /** 有用量记录的活跃成员数 */
  activeMemberCount: string;
  /** 请求次数 */
  requestCount: string;
  /** 总 token 数 */
  totalTokens: string;
  /** 成本金额（USD） */
  costAmount: string;
  /** 售价金额（USD） */
  sellAmount: string;
}

export interface DeptMemberRow {
  userId: number;
  username: string;
  nickname: string;
  requestCount: string;
  totalTokens: string;
  costAmount: string;
  sellAmount: string;
}

export interface DeptMemberPage {
  items: DeptMemberRow[];
  total: number;
}

export interface DeptModelRow {
  model: string;
  requestCount: string;
  totalTokens: string;
  costAmount: string;
  sellAmount: string;
}

export interface DeptTrendRow {
  date: string;
  requestCount: string;
  totalTokens: string;
  costAmount: string;
  sellAmount: string;
}

class DeptUsageService {
  // 部门用量汇总
  getOverview = async (year?: number, month?: number): Promise<DeptOverview> => {
    const qs = new URLSearchParams();
    if (year) qs.set('year', String(year));
    if (month) qs.set('month', String(month));
    const query = qs.toString();
    return unwrap(`/app/front-hub/usage/dept/overview${query ? `?${query}` : ''}`);
  };

  // 部门成员用量排行
  getMembers = async (params: {
    year?: number;
    month?: number;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }): Promise<DeptMemberPage> => {
    const qs = new URLSearchParams();
    if (params.year) qs.set('year', String(params.year));
    if (params.month) qs.set('month', String(params.month));
    if (params.keyword) qs.set('keyword', params.keyword);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString();
    return unwrap(`/app/front-hub/usage/dept/members${query ? `?${query}` : ''}`);
  };

  // 部门模型使用分布
  getModels = async (year?: number, month?: number): Promise<DeptModelRow[]> => {
    const qs = new URLSearchParams();
    if (year) qs.set('year', String(year));
    if (month) qs.set('month', String(month));
    const query = qs.toString();
    return unwrap(`/app/front-hub/usage/dept/models${query ? `?${query}` : ''}`);
  };

  // 部门用量趋势（按天）
  getTrend = async (year?: number, month?: number): Promise<DeptTrendRow[]> => {
    const qs = new URLSearchParams();
    if (year) qs.set('year', String(year));
    if (month) qs.set('month', String(month));
    const query = qs.toString();
    return unwrap(`/app/front-hub/usage/dept/trend${query ? `?${query}` : ''}`);
  };
}

export const deptUsageService = new DeptUsageService();
