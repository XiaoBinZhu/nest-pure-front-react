import { type PartialDeep } from 'type-fest';

import { apiFetch } from '../_api';

// 统一解包 { code, data } 信封（后端响应统一包装）
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return 'data' in (res as any) ? (res as any).data : (res as T);
}

import { type LobeAgentChatConfig, type LobeAgentConfig } from '@/types/agent';
import { type MetaData } from '@/types/meta';
import {
  type ChatSessionList,
  type LobeAgentSession,
  type LobeSessions,
  type LobeSessionType,
  type SessionGroupItem,
  type UpdateSessionParams,
} from '@/types/session';

/**
 * @deprecated Session service is legacy. Use agentService for agent CRUD operations.
 * Mobile still uses this, but should migrate to agentService.
 */
export class SessionService {
  hasSessions = async (): Promise<boolean> => {
    const result = await this.countSessions();
    return result > 0;
  };

  /** @deprecated Use agentService.createAgent instead */
  createSession = async (
    type: LobeSessionType,
    data: Partial<LobeAgentSession>,
  ): Promise<string> => {
    const { config, group, meta, ...session } = data;
    const result = await unwrap<{ id: string }>('/app/front-hub/sessions', {
      method: 'POST',
      body: JSON.stringify({
        config: { ...config, ...meta } as any,
        session: { ...session, groupId: group },
        type,
      }),
    });
    return result.id;
  };

  cloneSession = async (id: string, newTitle: string): Promise<string | undefined> => {
    const result = await unwrap<{ id?: string }>(`/app/front-hub/sessions/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify({ newTitle }),
    });
    return result.id;
  };

  // 列表：GET /app/front-hub/sessions（后端分页 {items,total} → 前端 ChatSessionList {sessions, sessionGroups}）
  getGroupedSessions = async (): Promise<ChatSessionList> => {
    const data = await unwrap<{ items: any[]; total: number }>('/app/front-hub/sessions');
    return {
      sessions: data?.items ?? [],
      sessionGroups: [],
    };
  };

  countSessions = async (params?: {
    endDate?: string;
    range?: [string, string];
    startDate?: string;
  }): Promise<number> => {
    const query = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params).flatMap(([k, v]) =>
            Array.isArray(v)
              ? [
                  [k, v[0]],
                  [k, v[1]],
                ]
              : v != null
                ? [[k, String(v)]]
                : [],
          ),
        ).toString()
      : '';
    return unwrap<number>(`/app/front-hub/sessions/count${query}`);
  };

  updateSession = (id: string, data: Partial<UpdateSessionParams>) => {
    const { group, pinned, meta, updatedAt } = data;
    return unwrap(`/app/front-hub/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        groupId: group === 'default' ? null : group,
        pinned,
        ...meta,
        updatedAt,
      }),
    });
  };

  // TODO: Wave 2 - 待对接 nest-admin session config 接口
  getSessionConfig = async (_id: string): Promise<LobeAgentConfig> => {
    return {} as LobeAgentConfig;
  };

  // TODO: Wave 2
  updateSessionConfig = (
    _id: string,
    _config: PartialDeep<LobeAgentConfig>,
    _signal?: AbortSignal,
  ) => {
    return Promise.resolve();
  };

  // TODO: Wave 2
  updateSessionMeta = (_id: string, _meta: Partial<MetaData>, _signal?: AbortSignal) => {
    return Promise.resolve();
  };

  // TODO: Wave 2
  updateSessionChatConfig = (
    _id: string,
    _value: Partial<LobeAgentChatConfig>,
    _signal?: AbortSignal,
  ) => {
    return Promise.resolve();
  };

  // TODO: Wave 2 - 待对接 nest-admin 搜索接口
  searchSessions = (_keywords: string): Promise<LobeSessions> => {
    return Promise.resolve([] as unknown as LobeSessions);
  };

  removeSession = (id: string) => {
    return unwrap(`/app/front-hub/sessions/${id}`, { method: 'DELETE' });
  };

  // ************************************** //
  // ***********  SessionGroup  *********** //
  // ************************************** //

  // TODO: Wave 2 - 待对接 nest-admin session group 接口
  createSessionGroup = (
    _name: string,
    _sort?: number,
    _visibility?: 'private' | 'public',
  ): Promise<string> => {
    return Promise.resolve('');
  };

  // TODO: Wave 2
  removeSessionGroup = (_id: string, _removeChildren?: boolean) => {
    return Promise.resolve();
  };

  // TODO: Wave 2
  updateSessionGroup = (_id: string, _value: Partial<SessionGroupItem>) => {
    return Promise.resolve();
  };

  // TODO: Wave 2
  updateSessionGroupOrder = (_sortMap: { id: string; sort: number }[]) => {
    return Promise.resolve();
  };
}

export const sessionService = new SessionService();
