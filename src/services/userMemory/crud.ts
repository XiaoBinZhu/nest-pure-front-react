import { type NewUserMemoryIdentity } from '@lobechat/types';

import { apiFetch } from '@/services/_api';

// 统一解包 { code, data } 信封
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return (res as any)?.data ?? (res as T);
}

class MemoryCRUDService {
  // ============ Identity CRUD ============
  deleteAll = async (): Promise<{ deletedCount: number; profileKept: boolean }> => {
    return unwrap('/app/front-hub/memory', { method: 'DELETE' });
  };

  createIdentity = async (data: NewUserMemoryIdentity) => {
    return unwrap('/app/front-hub/memory/identities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  deleteIdentity = async (id: string) => {
    return unwrap(`/app/front-hub/memory/identities/${id}`, { method: 'DELETE' });
  };

  getIdentities = async () => {
    const page = await unwrap<{ items: any[]; total: number }>(
      '/app/front-hub/memory/identities?page=1&pageSize=100',
    );
    return page.items;
  };

  updateIdentity = async (id: string, data: Partial<NewUserMemoryIdentity>) => {
    return unwrap(`/app/front-hub/memory/identities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  };

  // ============ Context CRUD ============

  deleteContext = async (id: string) => {
    return unwrap(`/app/front-hub/memory/contexts/${id}`, { method: 'DELETE' });
  };

  getContexts = async () => {
    const page = await unwrap<{ items: any[]; total: number }>(
      '/app/front-hub/memory/contexts?page=1&pageSize=100',
    );
    return page.items;
  };

  updateContext = async (
    id: string,
    data: { currentStatus?: string; description?: string; title?: string },
  ) => {
    return unwrap(`/app/front-hub/memory/contexts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  };

  // ============ Activity CRUD ============

  deleteActivity = async (id: string) => {
    return unwrap(`/app/front-hub/memory/activities/${id}`, { method: 'DELETE' });
  };

  getActivities = async () => {
    const page = await unwrap<{ items: any[]; total: number }>(
      '/app/front-hub/memory/activities?page=1&pageSize=100',
    );
    return page.items;
  };

  updateActivity = async (
    id: string,
    data: { narrative?: string; notes?: string; status?: string },
  ) => {
    return unwrap(`/app/front-hub/memory/activities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  };

  // ============ Experience CRUD ============

  deleteExperience = async (id: string) => {
    return unwrap(`/app/front-hub/memory/experiences/${id}`, { method: 'DELETE' });
  };

  getExperiences = async () => {
    const page = await unwrap<{ items: any[]; total: number }>(
      '/app/front-hub/memory/experiences?page=1&pageSize=100',
    );
    return page.items;
  };

  updateExperience = async (
    id: string,
    data: { action?: string; keyLearning?: string; situation?: string },
  ) => {
    return unwrap(`/app/front-hub/memory/experiences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  };

  // ============ Preference CRUD ============

  deletePreference = async (id: string) => {
    return unwrap(`/app/front-hub/memory/preferences/${id}`, { method: 'DELETE' });
  };

  getPreferences = async () => {
    const page = await unwrap<{ items: any[]; total: number }>(
      '/app/front-hub/memory/preferences?page=1&pageSize=100',
    );
    return page.items;
  };

  updatePreference = async (
    id: string,
    data: { conclusionDirectives?: string; suggestions?: string },
  ) => {
    return unwrap(`/app/front-hub/memory/preferences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  };
}

export const memoryCRUDService = new MemoryCRUDService();
