import { type CreateMessageParams } from '@lobechat/types';

import { INBOX_SESSION_ID } from '@/const/session';
import { apiFetch } from '@/services/_api';
import { type CreateThreadParams, type ThreadItem } from '@/types/topic';

interface CreateThreadWithMessageParams extends CreateThreadParams {
  message: CreateMessageParams;
}

export class ThreadService {
  // 列表：GET /api/v1/c-end/threads?topicId=xxx
  getThreads = (topicId: string): Promise<ThreadItem[]> => {
    return apiFetch<ThreadItem[]>(`/api/v1/c-end/threads?topicId=${encodeURIComponent(topicId)}`);
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

  // 创建线程：POST /api/v1/c-end/threads
  createThread = async (params: CreateThreadParams): Promise<string> => {
    const result = await apiFetch<{ id: string }>('/api/v1/c-end/threads', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return result.id;
  };

  // 更新线程：PATCH /api/v1/c-end/threads/:id
  updateThread = async (id: string, data: Partial<ThreadItem>) => {
    return apiFetch(`/api/v1/c-end/threads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ value: data }),
    });
  };

  // 删除线程：DELETE /api/v1/c-end/threads/:id
  removeThread = async (id: string) => {
    return apiFetch(`/api/v1/c-end/threads/${id}`, { method: 'DELETE' });
  };

  private toDbSessionId = (sessionId: string | undefined) => {
    return sessionId === INBOX_SESSION_ID ? null : sessionId;
  };
}

export const threadService = new ThreadService();
