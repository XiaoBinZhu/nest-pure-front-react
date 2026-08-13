import {
  type SendMessageServerParams,
  type SendMessageServerResponse,
  type StructureOutputParams,
} from '@lobechat/types';

import { messageService } from '@/services/message';
import { topicService } from '@/services/topic';

import { apiFetch } from './_api';

export interface RecordTracingFeedbackParams {
  data?: Record<string, unknown>;
  score?: number;
  signal: 'positive' | 'negative' | 'neutral';
  source: string;
  tracingId: string;
}

class AiChatService {
  /**
   * 持久化消息（G9 修复，22-spec v1.8.0）
   *
   * LobeHub 的 send-message 协议 = 落库（话题 + 用户消息 + 助手占位）+ 返回元数据；
   * AI 回复由本地 agent runtime 通过 chatService → /v1/chat/completions（JWT 双轨）流式生成。
   * 此前直接把 LobeHub 协议体 POST 到 OpenAI 端点导致 403 Model disabled。
   */
  sendMessageInServer = async (
    params: SendMessageServerParams,
    _abortController: AbortController,
  ): Promise<SendMessageServerResponse> => {
    const { agentId, newUserMessage, newAssistantMessage, newTopic, topicId, threadId } = params;
    const sessionId = agentId; // 以 agentId 为会话键，后端按 userId+agentId 派生 UUID 虚拟会话

    // 1. 新建话题（首次发送）
    let finalTopicId = topicId;
    let isCreateNewTopic = false;
    if (!finalTopicId) {
      const title =
        newTopic?.title ||
        (typeof newUserMessage.content === 'string'
          ? newUserMessage.content.slice(0, 30)
          : '新话题');
      finalTopicId = await topicService.createTopic({
        sessionId,
        title,
        favorite: false,
      });
      isCreateNewTopic = true;
    }

    // 2. 用户消息 + 助手占位消息
    const content =
      typeof newUserMessage.content === 'string'
        ? newUserMessage.content
        : JSON.stringify(newUserMessage.content);
    const userMessage = await messageService.createMessage({
      sessionId,
      topicId: finalTopicId,
      role: 'user',
      content,
      ...(threadId ? { threadId } : {}),
    });
    const assistantMessage = await messageService.createMessage({
      sessionId,
      topicId: finalTopicId,
      role: 'assistant',
      content: '',
      model: newAssistantMessage?.model,
      ...(threadId ? { threadId } : {}),
    });

    // 3. 话题列表（store 用于更新侧边栏）
    const topics = await topicService.getTopics({ agentId: sessionId, pageSize: 50 });

    return {
      topicId: finalTopicId,
      isCreateNewTopic,
      topics,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      messages: [userMessage, assistantMessage],
    } as unknown as SendMessageServerResponse;
  };

  // 非流式生成 JSON（对接 nest-admin /v1/chat/completions）
  generateJSON = async (params: StructureOutputParams, abortController: AbortController) => {
    return apiFetch('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ ...params, stream: false }),
      signal: abortController?.signal,
    });
  };

  // 暂时 stub（tracing feedback 待 Wave 2）
  recordTracingFeedback = async (_params: RecordTracingFeedbackParams) => {
    return;
  };
}

export const aiChatService = new AiChatService();
