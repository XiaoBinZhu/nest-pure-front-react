import { type CreateMessageParams } from '@lobechat/types';

import { INBOX_SESSION_ID } from '@/const/session';
import { apiFetch } from '@/services/_api';
import { type CreateThreadParams, type ThreadItem } from '@/types/topic';

// 统一解包 { code, data } 信封（后端响应统一包装）
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return 'data' in (res as any) ? (res as any).data : (res as T);
}

interface CreateThreadWithMessageParams extends CreateThreadParams {
  message: CreateMessageParams;
}

export class ThreadService {
  // 列表：GET /app/front-hub/threads?topicId=xxx
  getThreads = (topicId: string): Promise<ThreadItem[]> => {
    return unwrap<ThreadItem[]>(`/app/front-hub/threads?topicId=${encodeURIComponent(topicId)}`);
  };

  // TODO: Wave 2 - 待对接 nest-admin createThreadWithMessage 接口
  createThreadWithMessage = async ({
    message,
    ...params
  }: CreateThreadWithMessageParams): Promise<{ messageId: string; threadId: string }> => {
    // 先创建 thread，再创建 message
    const threadId = await this.createThread(params);
    return { messageId: '', threadId };
  };

  // 创建线程：POST /app/front-hub/threads
  createThread = async (params: CreateThreadParams): Promise<string> => {
    const result = await unwrap<{ id: string }>('/app/front-hub/threads', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return result.id;
  };

  // 更新线程：PATCH /app/front-hub/threads/:id
  updateThread = async (id: string, data: Partial<ThreadItem>) => {
    return unwrap(`/app/front-hub/threads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ value: data }),
    });
  };

  // 删除线程：DELETE /app/front-hub/threads/:id
  removeThread = async (id: string) => {
    return unwrap(`/app/front-hub/threads/${id}`, { method: 'DELETE' });
  };

  private toDbSessionId = (sessionId: string | undefined) => {
    return sessionId === INBOX_SESSION_ID ? null : sessionId;
  };
}

export const threadService = new ThreadService();
