import { apiFetch } from '@/services/_api';

// C 端工作台 + 产物中心 API（对应 nest-admin /app/front-hub/workspace 与 /artifacts）
// 数据按 userId 隔离（scope=self）

// 统一解包 { code, data } 信封
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return (res as any)?.data ?? (res as T);
}

export interface WorkspaceTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDetail extends WorkspaceTask {
  artifacts: Artifact[];
}

export interface WorkspaceLog {
  id: string;
  taskId: string;
  level: string;
  message: string;
  step?: number;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Artifact {
  id: string;
  title: string;
  type: string;
  subtype?: string;
  currentVersion: number;
  taskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactDetail extends Artifact {
  versions: Array<{ version: number; createdAt: string; changeLog?: string; source: string }>;
  content: string;
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  line: number;
  content: string;
}

class WorkspaceService {
  // ============ 任务 ============
  listTasks = async (params?: { status?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString();
    return unwrap<{ items: WorkspaceTask[]; total: number }>(
      `/app/front-hub/workspace/tasks${query ? `?${query}` : ''}`,
    );
  };

  createTask = async (data: { title: string; description?: string }) => {
    return unwrap<WorkspaceTask>('/app/front-hub/workspace/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  getTask = async (id: string) => {
    return unwrap<TaskDetail>(`/app/front-hub/workspace/tasks/${id}`);
  };

  updateTask = async (id: string, data: Partial<WorkspaceTask>) => {
    return unwrap(`/app/front-hub/workspace/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  };

  deleteTask = async (id: string) => {
    return unwrap(`/app/front-hub/workspace/tasks/${id}`, { method: 'DELETE' });
  };

  getTaskStats = async () => {
    return unwrap<{ total: number; running: number; completed: number; failed: number }>(
      '/app/front-hub/workspace/stats',
    );
  };

  // ============ 日志 ============
  listLogs = async (
    taskId: string,
    params?: { level?: string; page?: number; pageSize?: number },
  ) => {
    const qs = new URLSearchParams();
    if (params?.level) qs.set('level', params.level);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString();
    return unwrap<{ items: WorkspaceLog[]; total: number }>(
      `/app/front-hub/workspace/tasks/${taskId}/logs${query ? `?${query}` : ''}`,
    );
  };

  appendLog = async (taskId: string, data: { level?: string; message: string; step?: number }) => {
    return unwrap<WorkspaceLog>(`/app/front-hub/workspace/tasks/${taskId}/logs`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  // ============ 产物 ============
  listArtifacts = async (params?: {
    type?: string;
    taskId?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.taskId) qs.set('taskId', params.taskId);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString();
    return unwrap<{ items: Artifact[]; total: number }>(
      `/app/front-hub/artifacts${query ? `?${query}` : ''}`,
    );
  };

  createArtifact = async (data: {
    title: string;
    type?: string;
    subtype?: string;
    content: string;
    taskId?: string;
  }) => {
    return unwrap<{ id: string; version: number }>('/app/front-hub/artifacts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  getArtifact = async (id: string) => {
    return unwrap<ArtifactDetail>(`/app/front-hub/artifacts/${id}`);
  };

  listVersions = async (id: string) => {
    return unwrap<{
      list: Array<{
        version: number;
        createdAt: string;
        changeLog?: string;
        source: string;
        size: number;
      }>;
    }>(`/app/front-hub/artifacts/${id}/versions`);
  };

  getVersionContent = async (id: string, v: number) => {
    return unwrap<{ version: number; content: string; changeLog?: string }>(
      `/app/front-hub/artifacts/${id}/versions/${v}`,
    );
  };

  diffVersions = async (id: string, v1: number, v2: number) => {
    return unwrap<{ v1: number; v2: number; diff: DiffLine[] }>(
      `/app/front-hub/artifacts/${id}/diff?v1=${v1}&v2=${v2}`,
    );
  };

  editArtifact = async (id: string, data: { content: string; changeLog?: string }) => {
    return unwrap<{ id: string; version: number; changeLog?: string }>(
      `/app/front-hub/artifacts/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    );
  };

  deleteArtifact = async (id: string) => {
    return unwrap(`/app/front-hub/artifacts/${id}`, { method: 'DELETE' });
  };

  downloadArtifact = async (id: string, version?: number): Promise<string> => {
    const token = localStorage.getItem('accessToken');
    const url = `/app/front-hub/artifacts/${id}/download${version ? `?version=${version}` : ''}`;
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  };
}

export const workspaceService = new WorkspaceService();
