import {
  type AiModelSortMap,
  type AiProviderModelListItem,
  type CreateAiModelParams,
  isAiModelVisible,
  type ToggleAiModelEnableParams,
  type UpdateAiModelParams,
} from 'model-bank';

import { apiFetch } from '@/services/_api';

export interface GetAiProviderModelListParams {
  enabled?: boolean;
  limit?: number;
  offset?: number;
}

export class AiModelService {
  // TODO: Wave 2 - 待对接 nest-admin aiModel 创建接口
  createAiModel = async (_params: CreateAiModelParams) => {
    return;
  };

  // 模型列表：GET /v1/models
  // 后端返回 OpenAI 兼容 { object:'list', data:[{id, object:'model', owned_by}] }，
  // 前端期望裸数组 AiProviderModelListItem[]，此处做兼容解包与字段映射（G9+ 修复）。
  getAiProviderModelList = async (
    id: string,
    params?: GetAiProviderModelListParams,
  ): Promise<AiProviderModelListItem[]> => {
    const query = new URLSearchParams();
    if (id) query.set('providerId', id);
    if (params?.enabled !== undefined) query.set('enabled', String(params.enabled));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    const res = await apiFetch<AiProviderModelListItem[] | { object?: string; data?: unknown[] }>(
      `/v1/models${qs ? `?${qs}` : ''}`,
    );

    const rawList = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
    const models: AiProviderModelListItem[] = rawList.map((m: any) =>
      m && typeof m === 'object' && 'enabled' in m && 'type' in m
        ? (m as AiProviderModelListItem)
        : {
            displayName: m?.id ?? 'unknown',
            enabled: true,
            id: m?.id ?? 'unknown',
            providerId: m?.owned_by || 'ai-gateway',
            source: 'builtin',
            type: 'chat',
          },
    );
    return models.filter(isAiModelVisible);
  };

  // 模型详情：GET /v1/models/:id
  getAiModelById = async (id: string) => {
    return apiFetch(`/v1/models/${encodeURIComponent(id)}`);
  };

  // TODO: Wave 2 - 待对接 nest-admin aiModel toggle 接口
  toggleModelEnabled = async (_params: ToggleAiModelEnableParams) => {
    return;
  };

  // TODO: Wave 2
  updateAiModel = async (_id: string, _providerId: string, _value: UpdateAiModelParams) => {
    return;
  };

  // TODO: Wave 2
  batchUpdateAiModels = async (_id: string, _models: AiProviderModelListItem[]) => {
    return;
  };

  // TODO: Wave 2
  batchToggleAiModels = async (_id: string, _models: string[], _enabled: boolean) => {
    return;
  };

  // TODO: Wave 2
  clearModelsByProvider = async (_providerId: string) => {
    return;
  };

  // TODO: Wave 2
  clearRemoteModels = async (_providerId: string) => {
    return;
  };

  // TODO: Wave 2
  updateAiModelOrder = async (_providerId: string, _items: AiModelSortMap[]) => {
    return;
  };

  // TODO: Wave 2
  deleteAiModel = async (_params: { id: string; providerId: string }) => {
    return;
  };
}

export const aiModelService = new AiModelService();
