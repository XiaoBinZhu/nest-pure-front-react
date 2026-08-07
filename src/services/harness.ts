import { apiFetch, apiStream } from '@/services/_api';

// C 端 Harness 代码智能体 API（对应 nest-admin /api/v1/c-end/harness）
// 数据按 userId 隔离（scope=self）

// 统一解包 { code, data } 信封
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return (res as any)?.data ?? (res as T);
}

export interface HarnessSession {
  id: string;
  userId: number;
  name: string;
  mode: 'chat' | 'code' | 'browser';
  model: string;
  context?: { fileTreeSummary?: string; lastMessage?: string };
  createdAt: string;
  updatedAt: string;
}

export interface HarnessSessionDetail extends HarnessSession {
  fileTree: HarnessFileNode[];
}

export interface HarnessFileNode {
  name: string;
  path: string;
  type: 'dir' | 'file';
  size?: number;
  children?: HarnessFileNode[];
}

export interface HarnessCommand {
  id: string;
  sessionId: string;
  command: string;
  exitCode?: number;
  output?: string;
  approved: boolean;
  createdAt: string;
}

export interface HarnessToolInfo {
  name: string;
  description: string;
  risk: string;
  args: string;
}

// SSE 事件类型
export type HarnessEvent =
  | { event: 'harness_state'; data: { sessionId: string; model: string; mode: string } }
  | { event: 'harness_content'; data: { text: string } }
  | { event: 'harness_tool_call'; data: { tool: string; args: any; callId: string } }
  | { event: 'harness_tool_result'; data: { tool: string; callId: string; success: boolean; result: any } }
  | { event: 'harness_file_change'; data: { action: string; path: string; size?: number } }
  | { event: 'harness_terminal'; data: { command: string; exitCode: number; output: string } }
  | { event: 'harness_approval'; data: { callId: string; tool: string; args: any; risk: string; description: string } }
  | { event: 'harness_done'; data: { steps: number } }
  | { event: 'error'; data: { code: string; message: string; recoverable?: boolean } };

class HarnessService {
  // ============ 会话 ============
  listSessions = async () => unwrap<HarnessSession[]>('/api/v1/c-end/harness/sessions');

  createSession = async (data: { name?: string; mode?: string; model?: string }) =>
    unwrap<HarnessSession>('/api/v1/c-end/harness/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });

  getSession = async (id: string) =>
    unwrap<HarnessSessionDetail>(`/api/v1/c-end/harness/sessions/${id}`);

  updateSession = async (id: string, data: { name?: string; mode?: string; model?: string }) =>
    unwrap(`/api/v1/c-end/harness/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

  deleteSession = async (id: string) =>
    unwrap(`/api/v1/c-end/harness/sessions/${id}`, { method: 'DELETE' });

  // ============ 对话（SSE 流式，onEvent 回调） ============
  chat = async (sessionId: string, message: string, onEvent: (evt: HarnessEvent) => void, signal?: AbortSignal) => {
    const stream = await apiStream(`/api/v1/c-end/harness/sessions/${sessionId}/chat`, { message }, signal);
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
        onEvent({ event, data } as HarnessEvent);
      }
    }
  };

  // ============ 虚拟文件系统 ============
  listFiles = async (sessionId: string) =>
    unwrap<HarnessFileNode[]>(`/api/v1/c-end/harness/sessions/${sessionId}/files`);

  getFileContent = async (sessionId: string, path: string) => {
    const p = encodeURIComponent(path);
    return unwrap<{ path: string; content: string; size: number }>(
      `/api/v1/c-end/harness/sessions/${sessionId}/files/content?path=${p}`,
    );
  };

  saveFile = async (sessionId: string, path: string, content: string) =>
    unwrap<{ path: string; action: string }>(`/api/v1/c-end/harness/sessions/${sessionId}/files`, {
      method: 'PUT',
      body: JSON.stringify({ path, content }),
    });

  deleteFile = async (sessionId: string, path: string) => {
    const p = encodeURIComponent(path);
    return unwrap(`/api/v1/c-end/harness/sessions/${sessionId}/files?path=${p}`, { method: 'DELETE' });
  };

  // ============ 终端 ============
  listCommands = async (sessionId: string) =>
    unwrap<HarnessCommand[]>(`/api/v1/c-end/harness/sessions/${sessionId}/commands`);

  // ============ 工具元信息 ============
  getTools = async (mode?: string) => {
    const q = mode ? `?mode=${mode}` : '';
    return unwrap<{ mode: string; tools: HarnessToolInfo[] }>(`/api/v1/c-end/harness/tools${q}`);
  };
}

export const harnessService = new HarnessService();
