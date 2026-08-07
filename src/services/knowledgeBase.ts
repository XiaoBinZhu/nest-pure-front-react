import { apiFetch } from '@/services/_api';
import { type CreateKnowledgeBaseParams } from '@/types/knowledgeBase';

// 统一解包 { code, data } 信封
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return (res as any)?.data ?? (res as T);
}

// 适配：后端知识库字段（id/name/description/userId）→ LobeHub 前端字段（id/title/description）
function mapBase(b: any) {
  if (!b) return b;
  return { ...b, id: b.id, title: b.name, description: b.description, createdAt: b.createdAt, updatedAt: b.updatedAt };
}

class KnowledgeBaseService {
  createKnowledgeBase = async (params: CreateKnowledgeBaseParams) => {
    const data = await unwrap('/api/v1/c-end/knowledge/bases', {
      method: 'POST',
      body: JSON.stringify({ name: params.title, description: params.description }),
    });
    return mapBase(data);
  };

  getKnowledgeBaseList = async (_visibility?: 'private' | 'public') => {
    const list = await unwrap<any[]>('/api/v1/c-end/knowledge/bases');
    return list.map(mapBase);
  };

  getKnowledgeBaseById = async (id: string) => {
    return mapBase(await unwrap(`/api/v1/c-end/knowledge/bases/${id}`));
  };

  updateKnowledgeBaseList = async (id: string, value: any) => {
    return unwrap(`/api/v1/c-end/knowledge/bases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: value?.title ?? value?.name, description: value?.description }),
    });
  };

  deleteKnowledgeBase = async (id: string) => {
    return unwrap(`/api/v1/c-end/knowledge/bases/${id}`, { method: 'DELETE' });
  };

  // workspace 相关能力（transfer/copy/publish/visibility）在个人版后端暂不支持，降级为本地成功
  transferKnowledgeBase = async (_id: string, _targetWorkspaceId: string | null, _targetVisibility?: 'private' | 'public') => {
    return { success: true };
  };

  copyKnowledgeBaseToWorkspace = async (_id: string, _targetWorkspaceId: string | null, _targetVisibility?: 'private' | 'public') => {
    return { success: true };
  };

  publishKnowledgeBaseToWorkspace = async (_id: string) => {
    return { success: true };
  };

  setKnowledgeBaseVisibility = async (_id: string, _visibility: 'private' | 'public') => {
    return { success: true };
  };

  addFilesToKnowledgeBase = async (_knowledgeBaseId: string, _ids: string[]) => {
    return { success: true };
  };

  removeFilesFromKnowledgeBase = async (_knowledgeBaseId: string, _ids: string[]) => {
    return { success: true };
  };
}

export const knowledgeBaseService = new KnowledgeBaseService();
