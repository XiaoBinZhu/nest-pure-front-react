import { apiFetch, apiStream } from '@/services/_api';

// C 端 Agent 团队 API（对应 nest-admin /app/front-hub/teams）
// 数据按 userId 隔离

async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return (res as any)?.data ?? (res as T);
}

export interface TeamMember {
  name: string;
  role?: string;
  systemPrompt?: string;
}

export interface AgentTeam {
  id: string;
  name: string;
  description?: string;
  supervisorPrompt?: string;
  members: TeamMember[];
  runCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamRun {
  id: string;
  teamId: string;
  task: string;
  plan?: Array<{ member: string; subTask: string }>;
  results?: Array<{ member: string; role: string; result: string; success: boolean }>;
  summary?: string;
  status: 'running' | 'completed' | 'failed';
  createdAt: string;
}

export type TeamEvent =
  | {
      event: 'team_start';
      data: { teamId: string; task: string; plan: Array<{ member: string; subTask: string }> };
    }
  | { event: 'member_action'; data: { agent: string; thought: string; action: string } }
  | { event: 'member_result'; data: { agent: string; result: string } }
  | { event: 'team_done'; data: { summary: string } }
  | { event: 'error'; data: { code: string; message: string } };

class AgentTeamService {
  listTeams = async () => unwrap<AgentTeam[]>('/app/front-hub/teams');

  createTeam = async (data: {
    name: string;
    description?: string;
    supervisorPrompt?: string;
    members: TeamMember[];
  }) =>
    unwrap<AgentTeam>('/app/front-hub/teams', {
      method: 'POST',
      body: JSON.stringify(data),
    });

  getTeam = async (id: string) => unwrap<AgentTeam>(`/app/front-hub/teams/${id}`);

  updateTeam = async (id: string, data: Partial<AgentTeam>) =>
    unwrap(`/app/front-hub/teams/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

  deleteTeam = async (id: string) => unwrap(`/app/front-hub/teams/${id}`, { method: 'DELETE' });

  listRuns = async (teamId: string) => unwrap<TeamRun[]>(`/app/front-hub/teams/${teamId}/runs`);

  getRun = async (teamId: string, runId: string) =>
    unwrap<TeamRun>(`/app/front-hub/teams/${teamId}/runs/${runId}`);

  runTeam = async (
    teamId: string,
    task: string,
    onEvent: (evt: TeamEvent) => void,
    signal?: AbortSignal,
  ) => {
    const stream = await apiStream(`/app/front-hub/teams/${teamId}/run`, { task }, signal);
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
        onEvent({ event, data } as TeamEvent);
      }
    }
  };
}

export const agentTeamService = new AgentTeamService();
