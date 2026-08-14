import { apiFetch } from '@/services/_api';

// C 端协议中心 API（对应 nest-admin /app/front-hub/protocol）
// Agent Card（A2A）+ MCP Server 注册表 + MCP 协议同步（listTools → ToolRegistry）

// 统一解包 { code, data } 信封
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return (res as any)?.data ?? (res as T);
}

export interface McpServer {
  id: string;
  userId: number;
  name: string;
  url: string;
  auth?: Record<string, any>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface McpSyncResult {
  serverId: string;
  syncedTools: Array<{ name: string; description?: string; schema?: Record<string, any> }>;
}

class ProtocolHubService {
  listMcpServers = async () => unwrap<McpServer[]>('/app/front-hub/protocol/mcp');

  createMcpServer = async (data: { name: string; url: string; auth?: Record<string, any> }) =>
    unwrap<McpServer>('/app/front-hub/protocol/mcp', {
      method: 'POST',
      body: JSON.stringify(data),
    });

  syncMcpTools = async (id: string) =>
    unwrap<McpSyncResult>(`/app/front-hub/protocol/mcp/${id}/sync`, { method: 'POST' });

  deleteMcpServer = async (id: string) =>
    unwrap<{ success?: boolean }>(`/app/front-hub/protocol/mcp/${id}`, { method: 'DELETE' });

  getAgentCard = async (agentId: string) =>
    unwrap<Record<string, any>>(`/app/front-hub/protocol/agents/${agentId}/card`);
}

export const protocolHubService = new ProtocolHubService();
