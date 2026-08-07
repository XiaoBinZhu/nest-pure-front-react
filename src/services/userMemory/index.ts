import {
  type ActivityListParams,
  type ActivityListResult,
  type AddActivityMemoryResult,
  type AddContextMemoryResult,
  type AddExperienceMemoryResult,
  type AddIdentityMemoryResult,
  type AddPreferenceMemoryResult,
  type ExperienceListParams,
  type ExperienceListResult,
  type IdentityListParams,
  type IdentityListResult,
  type LayersEnum,
  type QueryTaxonomyOptionsParams,
  type QueryTaxonomyOptionsResult,
  type RemoveIdentityMemoryResult,
  type SearchMemoryParams,
  type SearchMemoryResult,
  type UpdateIdentityMemoryResult,
} from '@lobechat/types';

import { apiFetch } from '@/services/_api';

// 统一解包 { code, data } 信封
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return (res as any)?.data ?? (res as T);
}

// layer 参数映射（LobeHub LayersEnum 与后端 MemoryLayer 一致）
function layerOf(layer?: LayersEnum | string): string | undefined {
  return layer;
}

class UserMemoryService {
  addActivityMemory = async (params: any): Promise<AddActivityMemoryResult> => {
    return unwrap('/api/v1/c-end/memory/activities', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  };

  addContextMemory = async (params: any): Promise<AddContextMemoryResult> => {
    return unwrap('/api/v1/c-end/memory/contexts', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  };

  addExperienceMemory = async (params: any): Promise<AddExperienceMemoryResult> => {
    return unwrap('/api/v1/c-end/memory/experiences', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  };

  addIdentityMemory = async (params: any): Promise<AddIdentityMemoryResult> => {
    return unwrap('/api/v1/c-end/memory/identities', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  };

  addPreferenceMemory = async (params: any): Promise<AddPreferenceMemoryResult> => {
    return unwrap('/api/v1/c-end/memory/preferences', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  };

  removeIdentityMemory = async (params: any): Promise<RemoveIdentityMemoryResult> => {
    return unwrap(`/api/v1/c-end/memory/identities/${params?.id}`, { method: 'DELETE' });
  };

  getMemoryDetail = async (params: { id: string; layer: LayersEnum }) => {
    const qs = new URLSearchParams({ id: params.id });
    if (params.layer) qs.set('layer', params.layer);
    return unwrap(`/api/v1/c-end/memory/detail?${qs.toString()}`);
  };

  getPersona = async () => {
    return unwrap('/api/v1/c-end/memory/profile');
  };

  queryExperiences = async (params?: ExperienceListParams): Promise<ExperienceListResult> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.q) qs.set('q', params.q);
    if (params?.status?.length) qs.set('status', params.status.join(','));
    const query = qs.toString();
    return unwrap(`/api/v1/c-end/memory/experiences${query ? `?${query}` : ''}`);
  };

  queryActivities = async (params?: ActivityListParams): Promise<ActivityListResult> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.q) qs.set('q', params.q);
    if (params?.status?.length) qs.set('status', params.status.join(','));
    const query = qs.toString();
    return unwrap(`/api/v1/c-end/memory/activities${query ? `?${query}` : ''}`);
  };

  queryIdentities = async (params?: IdentityListParams): Promise<IdentityListResult> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.q) qs.set('q', params.q);
    if (params?.types?.length) qs.set('types', params.types.join(','));
    const query = qs.toString();
    return unwrap(`/api/v1/c-end/memory/identities${query ? `?${query}` : ''}`);
  };

  retrieveMemory = async (params: SearchMemoryParams): Promise<SearchMemoryResult> => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return unwrap(`/api/v1/c-end/memory/search${query ? `?${query}` : ''}`);
  };

  retrieveMemoryForTopic = async (topicId: string): Promise<SearchMemoryResult> => {
    const topic = await unwrap<{ title?: string; topicId?: string }>(`/api/v1/c-end/topics/${topicId}`).catch(
      () => null,
    );
    const q = topic?.title || '';
    return unwrap(`/api/v1/c-end/memory/search?q=${encodeURIComponent(q)}`);
  };

  searchMemory = async (params: SearchMemoryParams): Promise<SearchMemoryResult> => {
    return this.retrieveMemory(params);
  };

  queryTags = async (params?: { layers?: LayersEnum[]; page?: number; size?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.size) qs.set('pageSize', String(params.size));
    const query = qs.toString();
    return unwrap(`/api/v1/c-end/memory/tags${query ? `?${query}` : ''}`);
  };

  queryIdentityRoles = async (params?: { page?: number; size?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.size) qs.set('pageSize', String(params.size));
    const query = qs.toString();
    return unwrap(`/api/v1/c-end/memory/identities/roles${query ? `?${query}` : ''}`);
  };

  queryTaxonomyOptions = async (params?: QueryTaxonomyOptionsParams): Promise<QueryTaxonomyOptionsResult> => {
    return unwrap('/api/v1/c-end/memory/taxonomy-options');
  };

  queryIdentitiesForInjection = async (params?: { limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return unwrap(`/api/v1/c-end/memory/identities/for-injection${query ? `?${query}` : ''}`);
  };

  queryMemories = async (params?: {
    categories?: string[];
    layer?: LayersEnum;
    order?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
    q?: string;
    sort?: string;
    status?: string[];
    tags?: string[];
    types?: string[];
  }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.q) qs.set('q', params.q);
    const layer = params?.layer || params?.types?.[0] || params?.categories?.[0];
    if (layer) qs.set('layer', layerOf(layer) as string);
    if (params?.order) qs.set('order', params.order);
    const query = qs.toString();
    return unwrap(`/api/v1/c-end/memory/query${query ? `?${query}` : ''}`);
  };

  updateIdentityMemory = async (params: any): Promise<UpdateIdentityMemoryResult> => {
    return unwrap(`/api/v1/c-end/memory/identities/${params?.id}`, {
      method: 'PUT',
      body: JSON.stringify(params?.data ?? params),
    });
  };
}

export const userMemoryService = new UserMemoryService();
export { memoryCRUDService } from './crud';
export { memoryExtractionService } from './extraction';
