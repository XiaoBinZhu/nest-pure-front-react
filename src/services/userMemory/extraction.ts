import {
  type AsyncTaskStatus,
  type IAsyncTaskError,
  type UserMemoryExtractionMetadata,
} from '@lobechat/types';

import { apiFetch } from '@/services/_api';

export interface MemoryExtractionTask {
  error?: IAsyncTaskError | null;
  id: string;
  metadata: UserMemoryExtractionMetadata;
  status: AsyncTaskStatus;
}

export interface RequestMemoryExtractionParams {
  fromDate?: Date;
  toDate?: Date;
}

export interface RequestMemoryExtractionResult extends MemoryExtractionTask {
  deduped: boolean;
}

// 统一解包 { code, data } 信封
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return (res as any)?.data ?? (res as T);
}

class MemoryExtractionService {
  /**
   * 从对话话题请求记忆提取（同步规则提取，返回任务摘要）
   */
  requestFromChatTopics = async (params: RequestMemoryExtractionParams): Promise<RequestMemoryExtractionResult> => {
    const result = await unwrap<{ newMemories: number; total: number }>('/api/v1/c-end/memory/extract', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: '提取我的记忆' }] }),
    });
    return {
      id: `extract-${Date.now()}`,
      status: 'completed',
      metadata: { newMemories: result.newMemories, total: result.total } as unknown as UserMemoryExtractionMetadata,
      deduped: false,
    };
  };

  getTask = async (_taskId?: string): Promise<MemoryExtractionTask | null> => {
    return null;
  };
}

export const memoryExtractionService = new MemoryExtractionService();
