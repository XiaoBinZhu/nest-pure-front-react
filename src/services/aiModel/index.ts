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
    const models = await apiFetch<AiProviderModelListItem[]>(`/v1/models${qs ? `?${qs}` : ''}`);
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
