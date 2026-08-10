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
  return {
    ...b,
    id: b.id,
    title: b.name,
    description: b.description,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

class KnowledgeBaseService {
  createKnowledgeBase = async (params: CreateKnowledgeBaseParams) => {
    const data = await unwrap('/app/front-hub/knowledge/bases', {
      method: 'POST',
      body: JSON.stringify({ name: params.title, description: params.description }),
    });
    return mapBase(data);
  };

  getKnowledgeBaseList = async (_visibility?: 'private' | 'public') => {
    const list = await unwrap<any[]>('/app/front-hub/knowledge/bases');
    return list.map(mapBase);
  };

  getKnowledgeBaseById = async (id: string) => {
    return mapBase(await unwrap(`/app/front-hub/knowledge/bases/${id}`));
  };

  updateKnowledgeBaseList = async (id: string, value: any) => {
    return unwrap(`/app/front-hub/knowledge/bases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: value?.title ?? value?.name, description: value?.description }),
    });
  };

  deleteKnowledgeBase = async (id: string) => {
    return unwrap(`/app/front-hub/knowledge/bases/${id}`, { method: 'DELETE' });
  };

  // workspace 相关能力（transfer/copy/publish/visibility）在个人版后端暂不支持，降级为本地成功
  transferKnowledgeBase = async (
    _id: string,
    _targetWorkspaceId: string | null,
    _targetVisibility?: 'private' | 'public',
  ) => {
    return { success: true };
  };

  copyKnowledgeBaseToWorkspace = async (
    _id: string,
    _targetWorkspaceId: string | null,
    _targetVisibility?: 'private' | 'public',
  ) => {
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

  // ============ C 端扩展：文档/上传/搜索（对接 /app/front-hub/knowledge） ============

  /** 文档列表 */
  listDocs = async (baseId: string, params?: { page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const q = qs.toString();
    return unwrap<{ items: any[]; total: number }>(
      `/app/front-hub/knowledge/bases/${baseId}/documents${q ? `?${q}` : ''}`,
    );
  };

  /** 上传文档并索引（G2 修复：后端契约为 JSON {name, content} 文本，非 multipart） */
  indexDoc = async (baseId: string, file: File) => {
    const content = await file.text();
    return unwrap(`/app/front-hub/knowledge/bases/${baseId}/documents`, {
      method: 'POST',
      body: JSON.stringify({ name: file.name, content }),
    });
  };

  /** 语义检索（pgvector 余弦相似度，后端 SearchDto 字段为 topK，返回裸数组，G2 修复） */
  search = async (baseId: string, query: string, limit = 5) => {
    return unwrap<
      Array<{
        chunkId: string;
        content: string;
        chunkIndex: number;
        docId: string;
        score: number;
        docName: string;
      }>
    >(`/app/front-hub/knowledge/bases/${baseId}/search`, {
      method: 'POST',
      body: JSON.stringify({ query, topK: limit }),
    });
  };
}

export const knowledgeBaseService = new KnowledgeBaseService();
