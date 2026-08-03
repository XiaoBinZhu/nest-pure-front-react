import { type SendMessageServerParams, type SendMessageServerResponse, type StructureOutputParams } from '@lobechat/types';

import { apiFetch, apiStream } from './_api';

export interface RecordTracingFeedbackParams {
  data?: Record<string, unknown>;
  score?: number;
  signal: 'positive' | 'negative' | 'neutral';
  source: string;
  tracingId: string;
}

class AiChatService {
  // 通过 SSE 流式发送消息（对接 nest-admin /ai/v1/chat/completions）
  // 返回类型保持 SendMessageServerResponse 以兼容 store 层类型窄化
  // 实际为 SSE 流，流解析在 store 层 Wave 2 处理
  sendMessageInServer = async (
    params: SendMessageServerParams,
    abortController: AbortController,
  ): Promise<SendMessageServerResponse> => {
    return apiStream(
      '/ai/v1/chat/completions',
      { ...params, stream: true },
      abortController?.signal,
    ) as unknown as SendMessageServerResponse;
  };

  // 非流式生成 JSON（对接 nest-admin /ai/v1/chat/completions）
  generateJSON = async (params: StructureOutputParams, abortController: AbortController) => {
    return apiFetch('/ai/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ ...params, stream: false }),
      signal: abortController?.signal,
    });
  };

  // 暂时 stub（tracing feedback 待 Wave 2）
  recordTracingFeedback = async (_params: RecordTracingFeedbackParams) => {
    return Promise.resolve();
  };
}

export const aiChatService = new AiChatService();
