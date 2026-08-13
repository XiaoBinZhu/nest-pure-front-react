import { apiFetch, apiStream } from '@/services/_api';

// C 端 UI 生成 API（对应 nest-admin /app/front-hub/generation）
// SSE 事件：code_chunk {text,language} → preview_ready {html,componentCode,framework} → error {code,message}

// 统一解包 { code, data } 信封
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return (res as any)?.data ?? (res as T);
}

export interface GenerationHistoryItem {
  id: string;
  message: string;
  framework: string;
  code: string;
  previewHtml?: string;
  status: string;
  createdAt: string;
}

export interface GenerationTemplate {
  id: string;
  name: string;
  description: string;
  framework: string;
}

export type GenerationEvent =
  | { event: 'code_chunk'; data: { text: string; language: string } }
  | { event: 'preview_ready'; data: { html: string; componentCode: string; framework: string } }
  | { event: 'error'; data: { code: string; message: string } };

class GenerationPortalService {
  // ============ 生成（SSE 流式） ============
  generate = async (
    message: string,
    framework: string,
    onEvent: (evt: GenerationEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> => {
    const stream = await apiStream(
      '/app/front-hub/generation/generate',
      { message, framework },
      signal,
    );
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const blocks = buf.split('\n\n');
      buf = blocks.pop() || '';
      for (const block of blocks) {
        if (!block.startsWith('event:')) continue;
        const lines = block.split('\n');
        const event = lines[0].replace('event: ', '');
        const dataLine = lines.find((l) => l.startsWith('data: '));
        let data: any = {};
        try {
          data = dataLine ? JSON.parse(dataLine.replace('data: ', '')) : {};
        } catch {
          // ignore
        }
        onEvent({ event, data } as GenerationEvent);
      }
    }
  };

  // ============ 对话式修改（SSE 流式） ============
  refine = async (
    historyId: string,
    message: string,
    currentCode: string,
    framework: string,
    onEvent: (evt: GenerationEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> => {
    const stream = await apiStream(
      '/app/front-hub/generation/refine',
      { historyId, message, currentCode, framework },
      signal,
    );
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const blocks = buf.split('\n\n');
      buf = blocks.pop() || '';
      for (const block of blocks) {
        if (!block.startsWith('event:')) continue;
        const lines = block.split('\n');
        const event = lines[0].replace('event: ', '');
        const dataLine = lines.find((l) => l.startsWith('data: '));
        let data: any = {};
        try {
          data = dataLine ? JSON.parse(dataLine.replace('data: ', '')) : {};
        } catch {
          // ignore
        }
        onEvent({ event, data } as GenerationEvent);
      }
    }
  };

  // ============ 历史 ============
  listHistory = async (page = 1, pageSize = 20) =>
    unwrap<{ items: GenerationHistoryItem[]; total: number }>(
      `/app/front-hub/generation/history?page=${page}&pageSize=${pageSize}`,
    );

  getHistory = async (id: string) =>
    unwrap<GenerationHistoryItem>(`/app/front-hub/generation/history/${id}`);

  // ============ 预设模板 ============
  getTemplates = async () =>
    unwrap<{ list: GenerationTemplate[] }>('/app/front-hub/generation/templates');
}

export const generationPortalService = new GenerationPortalService();
