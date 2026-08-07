import { INBOX_SESSION_ID } from '@/const/session';
import { apiFetch } from '@/services/_api';
import { type BatchTaskResult } from '@/types/service';
import {
  type ChatTopic,
  type ChatTopicMetadata,
  type CreateTopicParams,
  type QueryTopicParams,
  type RecentTopic,
  type TopicRankItem,
} from '@/types/topic';

// 统一解包 { code, data } 信封（后端响应统一包装）
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return 'data' in (res as any) ? (res as any).data : (res as T);
}

/**
 * A row from `queryTopics`. It comes straight off the `topics` table, so it
 * carries `agentId` even though `ChatTopic` doesn't declare it, plus the
 * optional last-assistant-reply preview.
 */
export interface TopicListItem extends ChatTopic {
  agentId?: string | null;
  lastAssistantMessage?: string | null;
}

export type TopicBatchDeleteScope = 'own' | 'workspace';

type OnboardingSessionMetadataPatch = Partial<NonNullable<ChatTopicMetadata['onboardingSession']>>;

type UpdateTopicMetadataInput = Omit<Partial<ChatTopicMetadata>, 'onboardingSession'> & {
  onboardingSession?: OnboardingSessionMetadataPatch;
};

export class TopicService {
  // 创建话题：POST /api/v1/c-end/topics
  createTopic = (params: CreateTopicParams): Promise<string> => {
    return unwrap<string>('/api/v1/c-end/topics', {
      method: 'POST',
      body: JSON.stringify({
        ...params,
        sessionId: this.toDbSessionId(params.sessionId),
      }),
    });
  };

  // TODO: Wave 2 - 待对接 nest-admin 批量创建接口
  batchCreateTopics = (_importTopics: ChatTopic[]): Promise<BatchTaskResult> => {
    return Promise.resolve({ added: 0, errors: [], skips: 0 } as unknown as BatchTaskResult);
  };

  // TODO: Wave 2 - 待对接 nest-admin clone 接口
  cloneTopic = (_id: string, _newTitle?: string): Promise<string> => {
    return Promise.resolve('');
  };

  // TODO: Wave 2
  batchMoveTopics = (_topicIds: string[], _targetAgentId: string) => {
    return Promise.resolve();
  };

  // TODO: Wave 2
  importTopic = (_params: {
    agentId: string;
    data: string;
    groupId?: string | null;
  }): Promise<{ messageCount: number; topicId: string }> => {
    return Promise.resolve({ messageCount: 0, topicId: '' });
  };

  // 列表：GET /api/v1/c-end/topics?sessionId=xxx
  getTopics = async (params: QueryTopicParams): Promise<{ items: ChatTopic[]; total: number }> => {
    const query = new URLSearchParams();
    if (params.agentId) query.set('sessionId', params.agentId);
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    if (params.current) query.set('current', String(params.current));
    if (params.sortBy) query.set('sortBy', params.sortBy);
    const qs = query.toString();
    return unwrap<{ items: ChatTopic[]; total: number }>(
      `/api/v1/c-end/topics${qs ? `?${qs}` : ''}`,
    ) as any;
  };

  // TODO: Wave 2 - 待对接 nest-admin queryTopics 接口
  queryTopics = (_params?: {
    pageSize?: number;
    statuses?: string[];
    withLastMessage?: boolean;
  }): Promise<TopicListItem[]> => {
    return Promise.resolve([]);
  };

  // TODO: Wave 2 - 待对接 nest-admin count 接口
  countTopics = async (_params?: {
    agentId?: string;
    containerId?: string | null;
    endDate?: string;
    range?: [string, string];
    startDate?: string;
  }): Promise<number> => {
    return Promise.resolve(0);
  };

  // TODO: Wave 2
  rankTopics = async (_limit?: number): Promise<TopicRankItem[]> => {
    return Promise.resolve([]);
  };

  // TODO: Wave 2
  getMaxTaskDuration = async (): Promise<number> => {
    return Promise.resolve(0);
  };

  // 详情：GET /api/v1/c-end/topics/:id
  getTopicDetail = async (id: string): Promise<ChatTopic | null> => {
    return unwrap<ChatTopic | null>(`/api/v1/c-end/topics/${id}`);
  };

  // TODO: Wave 2 - 待对接 nest-admin recent 接口
  getRecentTopics = async (_limit?: number): Promise<RecentTopic[]> => {
    return Promise.resolve([]);
  };

  // TODO: Wave 2
  hasTopicFiles = async (_ids: string[]): Promise<boolean> => {
    return Promise.resolve(false);
  };

  // TODO: Wave 2
  searchTopics = (_keywords: string, _agentId?: string, _groupId?: string): Promise<ChatTopic[]> => {
    return Promise.resolve([]);
  };

  // 更新话题：PATCH /api/v1/c-end/topics/:id
  updateTopic = (id: string, data: Partial<ChatTopic>) => {
    return unwrap(`/api/v1/c-end/topics/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ value: data }),
    });
  };

  // TODO: Wave 2 - 待对接 nest-admin metadata 接口
  updateTopicMetadata = (_id: string, _metadata: UpdateTopicMetadataInput) => {
    return Promise.resolve();
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方对 .id/.visibility 的访问
  getShareInfo = (_topicId: string): Promise<any> => {
    return Promise.resolve({ id: '', visibility: 'private' } as any);
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方
  enableSharing = (_topicId: string, _visibility?: 'private' | 'link'): Promise<any> => {
    return Promise.resolve({} as any);
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方
  updateShareVisibility = (_topicId: string, _visibility: 'private' | 'link'): Promise<any> => {
    return Promise.resolve({} as any);
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方
  disableSharing = (_topicId: string): Promise<any> => {
    return Promise.resolve({} as any);
  };

  // 删除话题：DELETE /api/v1/c-end/topics/:id
  removeTopic = (id: string, _removeFiles?: boolean) => {
    return unwrap(`/api/v1/c-end/topics/${id}`, { method: 'DELETE' });
  };

  // TODO: Wave 2 - 待对接 nest-admin 批量删除接口
  removeTopics = (_sessionId: string, _scope: TopicBatchDeleteScope = 'own') => {
    return Promise.resolve();
  };

  // TODO: Wave 2
  removeTopicsByAgentId = (_agentId: string, _scope: TopicBatchDeleteScope = 'own') => {
    return Promise.resolve();
  };

  // TODO: Wave 2
  removeTopicsByGroupId = (_groupId: string, _scope: TopicBatchDeleteScope = 'own') => {
    return Promise.resolve();
  };

  // TODO: Wave 2
  batchRemoveTopics = (_topics: string[]) => {
    return Promise.resolve();
  };

  // TODO: Wave 2
  removeAllTopic = () => {
    return Promise.resolve();
  };

  private toDbSessionId = (sessionId?: string | null) =>
    sessionId === INBOX_SESSION_ID ? null : sessionId;
}

export const topicService = new TopicService();
