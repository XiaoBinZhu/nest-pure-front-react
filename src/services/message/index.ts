import {
  type ChatMessageError,
  type ChatMessagePluginError,
  type ChatTranslate,
  type ChatTTS,
  type CreateMessageParams,
  type CreateMessageResult,
  type HeterogeneousToolStateSnapshot,
  type MessageMetadata,
  type MessagePluginItem,
  type ModelRankItem,
  type UIChatMessage,
  type UpdateMessageParams,
  type UpdateMessageRAGParams,
  type UpdateMessageResult,
} from '@lobechat/types';
import { type HeatmapsProps } from '@lobehub/charts';

import { apiFetch } from '../_api';

import { abortableRequest } from '../utils/abortableRequest';

/**
 * Query context for message operations
 * Contains identifiers needed for querying/filtering messages after mutations
 */
export interface MessageQueryContext {
  agentId?: string;
  groupId?: string;
  threadId?: string | null;
  topicId?: string | null;
  topicShareId?: string;
}

interface MessageReadQueryContext {
  agentId?: string | null;
  groupId?: string | null;
  /**
   * Skip the Work-summary assembly on the server — set by mid-stream
   * refetches (tool_end / step_complete) so each tool round doesn't re-run
   * the per-type Work queries. See `QueryMessageParams.skipWorks`.
   */
  skipWorks?: boolean;
  threadId?: string | null;
  topicId?: string | null;
  topicShareId?: string;
}

export type MessageBatchOperation =
  | {
      message: CreateMessageParams;
      type: 'createMessage';
    }
  | {
      id: string;
      type: 'updateMessage';
      value: Partial<UpdateMessageParams>;
    }
  | {
      id: string;
      type: 'updateToolMessage';
      value: {
        content?: string;
        heterogeneousToolState?: HeterogeneousToolStateSnapshot;
        metadata?: Record<string, any>;
        pluginError?: any;
        pluginState?: Record<string, any>;
      };
    };

export interface MessageBatchMutationResult {
  results?: Array<{
    error?: string;
    id?: string;
    index: number;
    success: boolean;
    type: MessageBatchOperation['type'];
  }>;
  success?: boolean;
}

export class MessageBatchMutationError extends Error {
  constructor(public readonly result: MessageBatchMutationResult) {
    const failed = result.results?.filter((item) => !item.success) ?? [];
    const reasons = [...new Set(failed.map((item) => item.error).filter(Boolean))];
    super(
      `Message batch mutation failed for ${failed.length || 'unknown'} operation(s)` +
        (reasons.length > 0 ? `: ${reasons.join('; ')}` : ''),
    );
  }
}

const getBatchMutationAbortKey = (operations: MessageBatchOperation[]) => {
  if (operations.length !== 1) return;

  const [operation] = operations;
  if (operation.type === 'updateToolMessage') return `tool-message-${operation.id}`;
};

export class MessageService {
  // 批量操作：POST /api/v1/c-end/messages/batch
  batchMutate = async (operations: MessageBatchOperation[], signal?: AbortSignal) => {
    const input = {
      operations: operations.map((operation) => {
        if (operation.type === 'createMessage') {
          return {
            message: operation.message,
            type: operation.type,
          };
        }

        return {
          id: operation.id,
          type: operation.type,
          value: operation.value,
        };
      }),
    } as any;

    return apiFetch<MessageBatchMutationResult>('/api/v1/c-end/messages/batch', {
      method: 'POST',
      body: JSON.stringify(input),
      signal,
    });
  };

  batchMutateOrThrow = async (operations: MessageBatchOperation[]) => {
    const execute = async (signal?: AbortSignal) => {
      const result = (await (signal
        ? this.batchMutate(operations, signal)
        : this.batchMutate(operations))) as MessageBatchMutationResult;
      const hasFailedOperation = result.results?.some((item) => !item.success) ?? false;
      const hasCompleteResults = result.results?.length === operations.length;

      if (result.success !== true || !hasCompleteResults || hasFailedOperation) {
        throw new MessageBatchMutationError(result);
      }

      return result;
    };

    const abortKey = getBatchMutationAbortKey(operations);

    return abortKey ? abortableRequest.execute(abortKey, execute) : execute();
  };

  // 创建消息：POST /api/v1/c-end/messages
  createMessage = async (params: CreateMessageParams): Promise<CreateMessageResult> => {
    return apiFetch<CreateMessageResult>('/api/v1/c-end/messages', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  };

  // 列表：GET /api/v1/c-end/messages?sessionId=xxx
  getMessages = async (params: MessageReadQueryContext): Promise<UIChatMessage[]> => {
    const query = new URLSearchParams();
    if (params.agentId) query.set('sessionId', params.agentId);
    if (params.topicId) query.set('topicId', params.topicId);
    if (params.threadId) query.set('threadId', params.threadId);
    if (params.groupId) query.set('groupId', params.groupId);
    const qs = query.toString();
    const data = await apiFetch<UIChatMessage[]>(
      `/api/v1/c-end/messages${qs ? `?${qs}` : ''}`,
    );
    return data as unknown as UIChatMessage[];
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方对 .issues/.hiddenCount/.patch 的访问
  diagnoseTopic = async (_params: { agentId?: string | null; topicId: string }): Promise<any> => {
    return Promise.resolve({ hiddenCount: 0, issues: [], patch: {} } as any);
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方对 .restoredMessageIds 的访问
  repairTopic = async (_params: { agentId?: string | null; topicId: string }): Promise<any> => {
    return Promise.resolve({ restoredMessageIds: [] } as any);
  };

  // 计数：GET /api/v1/c-end/messages/count
  countMessages = async (params?: {
    endDate?: string;
    range?: [string, string];
    startDate?: string;
  }): Promise<number> => {
    const query = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params).flatMap(([k, v]) =>
            Array.isArray(v) ? [[k, v[0]], [k, v[1]]] : v != null ? [[k, String(v)]] : [],
          ),
        ).toString()
      : '';
    return apiFetch<number>(`/api/v1/c-end/messages/count${query}`);
  };

  // TODO: Wave 2 - 待对接 nest-admin 统计接口
  countWords = async (_params?: {
    endDate?: string;
    range?: [string, string];
    startDate?: string;
  }): Promise<number> => {
    return Promise.resolve(0);
  };

  // TODO: Wave 2
  rankModels = async (): Promise<ModelRankItem[]> => {
    return Promise.resolve([]);
  };

  // TODO: Wave 2
  getHeatmaps = async (): Promise<HeatmapsProps['data']> => {
    return Promise.resolve([] as HeatmapsProps['data']);
  };

  // TODO: Wave 2
  getTokenHeatmaps = async (): Promise<HeatmapsProps['data']> => {
    return Promise.resolve([] as HeatmapsProps['data']);
  };

  // 更新消息（含 error）：PATCH /api/v1/c-end/messages/:id
  updateMessageError = async (id: string, value: ChatMessageError, ctx?: MessageQueryContext) => {
    const error = value.type
      ? value
      : { body: value, message: value.message, type: 'ApplicationRuntimeError' };

    return apiFetch(`/api/v1/c-end/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...ctx, value: { error } }),
    });
  };

  // TODO: Wave 2 - 待对接 nest-admin plugin 接口
  updateMessagePluginArguments = async (
    _id: string,
    _value: string | Record<string, any>,
  ) => {
    return Promise.resolve();
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方对 .success/.messages 的访问
  updateToolArguments = async (
    _toolCallId: string,
    _value: string | Record<string, unknown>,
    _ctx?: MessageQueryContext,
  ): Promise<any> => {
    return Promise.resolve({ success: false, messages: [] } as any);
  };

  // 更新消息：PATCH /api/v1/c-end/messages/:id
  updateMessage = async (
    id: string,
    value: Partial<UpdateMessageParams>,
    ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    return apiFetch<UpdateMessageResult>(`/api/v1/c-end/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...ctx, value }),
    });
  };

  // TODO: Wave 2
  updateMessageTranslate = async (_id: string, _translate: Partial<ChatTranslate> | false) => {
    return Promise.resolve();
  };

  // TODO: Wave 2
  updateMessageTTS = async (_id: string, _tts: Partial<ChatTTS> | false) => {
    return Promise.resolve();
  };

  // TODO: Wave 2
  updateMessageMetadata = async (
    _id: string,
    _value: Partial<MessageMetadata>,
    _ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    return Promise.resolve() as unknown as Promise<UpdateMessageResult>;
  };

  // TODO: Wave 2
  updateMessagePluginState = async (
    _id: string,
    _value: Record<string, any>,
    _ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    return Promise.resolve() as unknown as Promise<UpdateMessageResult>;
  };

  // TODO: Wave 2
  updateMessagePluginError = async (
    _id: string,
    _error: ChatMessagePluginError | null,
    _ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    return Promise.resolve() as unknown as Promise<UpdateMessageResult>;
  };

  // TODO: Wave 2
  updateMessagePlugin = async (
    _id: string,
    _value: Partial<Omit<MessagePluginItem, 'id'>>,
    _ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    return Promise.resolve() as unknown as Promise<UpdateMessageResult>;
  };

  // TODO: Wave 2
  updateMessageRAG = async (
    _id: string,
    _data: UpdateMessageRAGParams,
    _ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    return Promise.resolve() as unknown as Promise<UpdateMessageResult>;
  };

  // TODO: Wave 2
  updateToolMessage = async (
    _id: string,
    _value: {
      content?: string;
      heterogeneousToolState?: HeterogeneousToolStateSnapshot;
      metadata?: Record<string, any>;
      pluginError?: any;
      pluginState?: Record<string, any>;
    },
    _ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    return Promise.resolve() as unknown as Promise<UpdateMessageResult>;
  };

  // 删除消息：DELETE /api/v1/c-end/messages/:id
  removeMessage = async (id: string, _ctx?: MessageQueryContext): Promise<UpdateMessageResult> => {
    return apiFetch<UpdateMessageResult>(`/api/v1/c-end/messages/${id}`, { method: 'DELETE' });
  };

  // TODO: Wave 2 - 待对接 nest-admin 批量删除接口
  removeMessages = async (
    _ids: string[],
    _ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    return Promise.resolve() as unknown as Promise<UpdateMessageResult>;
  };

  // TODO: Wave 2
  removeMessagesByAssistant = async (_sessionId: string, _topicId?: string) => {
    return Promise.resolve();
  };

  // TODO: Wave 2
  removeMessagesByGroup = async (_groupId: string, _topicId?: string) => {
    return Promise.resolve();
  };

  // TODO: Wave 2
  addFilesToMessage = async (
    _id: string,
    _fileIds: string[],
    _ctx?: MessageQueryContext,
  ): Promise<UpdateMessageResult> => {
    return Promise.resolve() as unknown as Promise<UpdateMessageResult>;
  };

  // =============== Compression ===============

  // TODO: Wave 2 - 待对接 nest-admin 压缩接口
  createCompressionGroup = async (_params: {
    agentId: string;
    groupId?: string | null;
    messageIds: string[];
    threadId?: string | null;
    topicId: string;
  }): Promise<{
    messageGroupId: string;
    messages: UIChatMessage[];
    messagesToSummarize: UIChatMessage[];
  }> => {
    return {
      messageGroupId: '',
      messages: [],
      messagesToSummarize: [],
    };
  };

  // TODO: Wave 2
  finalizeCompression = async (_params: {
    agentId: string;
    content: string;
    groupId?: string | null;
    messageGroupId: string;
    sourceGroupIds?: string[];
    threadId?: string | null;
    topicId: string;
  }): Promise<{ messages?: UIChatMessage[] }> => {
    return { messages: [] };
  };

  // TODO: Wave 2
  updateMessageGroupMetadata = async (_params: {
    context: {
      agentId: string;
      groupId?: string | null;
      threadId?: string | null;
      topicId: string;
    };
    expanded?: boolean;
    messageGroupId: string;
  }): Promise<{ messages: UIChatMessage[] }> => {
    return { messages: [] };
  };

  // TODO: Wave 2
  cancelCompression = async (_params: {
    agentId: string;
    groupId?: string | null;
    messageGroupId: string;
    threadId?: string | null;
    topicId: string;
  }): Promise<{ messages: UIChatMessage[] }> => {
    return { messages: [] };
  };
}

export const messageService = new MessageService();
