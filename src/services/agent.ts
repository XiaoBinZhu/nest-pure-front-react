import { type AgentItem, type AgentRankItem, type LobeAgentConfig } from '@lobechat/types';
import { type PartialDeep } from 'type-fest';

import { lambdaClient } from '@/libs/trpc/client';

import { apiFetch } from './_api';

// REST 解包（兼容 nest-admin { code, data } 信封）
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return (res as any)?.data ?? (res as T);
}

export const AVAILABLE_AGENTS_CONTEXT_LIMIT = 10;
export const AVAILABLE_AGENTS_CONTEXT_QUERY_LIMIT = AVAILABLE_AGENTS_CONTEXT_LIMIT + 2;

export interface AvailableAgentItem {
  avatar: string | null;
  backgroundColor: string | null;
  description: string | null;
  id: string;
  title: string | null;
}

/**
 * Market agent model can be either a string or an object with model details
 */
type MarketAgentModel =
  | LobeAgentConfig['model']
  | {
      model: LobeAgentConfig['model'];
      parameters?: Partial<LobeAgentConfig['params']>;
      provider?: LobeAgentConfig['provider'];
    };

type AgentMetaUpdate = Partial<
  Pick<
    AgentItem,
    'avatar' | 'backgroundColor' | 'description' | 'marketIdentifier' | 'tags' | 'title'
  >
>;

/**
 * Normalize market agent config to standard agent config.
 * Handles the case where market returns model as an object instead of string.
 */
const normalizeMarketAgentModel = (config?: PartialDeep<AgentItem>): PartialDeep<AgentItem> => {
  if (!config) return {};

  const model = config.model as MarketAgentModel | undefined;

  // If model is not an object, return config as-is
  if (typeof model !== 'object' || model === null) {
    return config;
  }

  // Extract model info and merge parameters
  const { model: modelName, provider: modelProvider, parameters } = model;
  const existingParams = (config.params ?? {}) as Record<string, any>;
  const mergedParams = { ...parameters, ...existingParams };

  return {
    ...config,
    model: modelName,
    params: Object.keys(mergedParams).length > 0 ? mergedParams : undefined,
    provider: config.provider ?? modelProvider,
  };
};

export interface CreateAgentParams {
  config?: PartialDeep<AgentItem>;
  groupId?: string;
  /**
   * `private` keeps the agent visible only to its creator within the active
   * workspace; `public` (default) makes it visible to every member. The
   * router enforces this — sidebar "Create in Private" forwards `'private'`
   * verbatim, all other creators (templates, marketplace import, etc.)
   * default to `'public'`.
   */
  visibility?: 'private' | 'public';
}

export interface CreateAgentResult {
  agentId: string;
}

export interface CreateAgentOnlyParams {
  config?: PartialDeep<AgentItem>;
  groupId: string;
}

export interface CreateAgentOnlyResult {
  agentId: string;
}

class AgentService {
  /**
   * Check if an agent with the given marketIdentifier already exists
   */
  checkByMarketIdentifier = async (marketIdentifier: string): Promise<boolean> => {
    const id = await unwrap<string | null>(
      `/app/front-hub/agents/identifier/marketIdentifier/${encodeURIComponent(marketIdentifier)}`,
    );
    return !!id;
  };

  /**
   * Get an agent by marketIdentifier
   * @returns agent id if exists, null otherwise
   */
  getAgentByMarketIdentifier = async (marketIdentifier: string): Promise<string | null> => {
    return unwrap<string | null>(
      `/app/front-hub/agents/identifier/marketIdentifier/${encodeURIComponent(marketIdentifier)}`,
    );
  };

  /**
   * Get an agent by forkedFromIdentifier stored in params
   * @returns agent id if exists, null otherwise
   */
  getAgentByForkedFromIdentifier = async (forkedFromIdentifier: string): Promise<string | null> => {
    return unwrap<string | null>(
      `/app/front-hub/agents/identifier/forkedFromIdentifier/${encodeURIComponent(forkedFromIdentifier)}`,
    );
  };

  /**
   * Create a new agent with session.
   * Automatically normalizes market agent config (handles model as object).
   */
  createAgent = async (params: CreateAgentParams): Promise<CreateAgentResult> => {
    const normalizedConfig = normalizeMarketAgentModel(params.config);
    const created = await unwrap<{ id: string }>(`/app/front-hub/agents`, {
      method: 'POST',
      body: JSON.stringify({
        title: (normalizedConfig as any)?.title || '新助手',
        description: (normalizedConfig as any)?.description,
        systemPrompt:
          (normalizedConfig as any)?.systemRole || (normalizedConfig as any)?.systemPrompt,
        model: (normalizedConfig as any)?.model,
        slug: (normalizedConfig as any)?.slug,
        tags: (normalizedConfig as any)?.meta?.tags,
        config: normalizedConfig as any,
      }),
    });
    return { agentId: created.id };
  };

  /**
   * Publish a private agent to the workspace. Caller should refresh the
   * sidebar list afterwards so the agent moves from the Private bucket to
   * the shared list. The inverse (public → private) goes through
   * {@link setAgentVisibility}.
   */
  publishAgentToWorkspace = async (id: string, accessLevel?: 'use' | 'edit'): Promise<void> => {
    await lambdaClient.agent.publishAgentToWorkspace.mutate({ accessLevel, id });
  };

  /**
   * Bidirectional visibility switch (LOBE-11551). The server only allows the
   * agent's creator or a workspace owner to pull a published agent back to
   * private, and rejects builtin agents (LobeAI etc.) outright.
   */
  setAgentVisibility = async (id: string, visibility: 'private' | 'public'): Promise<void> => {
    await lambdaClient.agent.setAgentVisibility.mutate({ id, visibility });
  };

  /**
   * Create a virtual agent without session.
   * Used for Group Agent Builder to create virtual agents for groups.
   */
  createAgentOnly = async (params: CreateAgentOnlyParams): Promise<CreateAgentOnlyResult> => {
    const normalizedConfig = normalizeMarketAgentModel(params.config);

    return lambdaClient.agent.createAgentOnly.mutate({
      config: normalizedConfig as any,
      groupId: params.groupId,
    });
  };

  createAgentKnowledgeBase = async (
    agentId: string,
    knowledgeBaseId: string,
    enabled?: boolean,
  ) => {
    return lambdaClient.agent.createAgentKnowledgeBase.mutate({
      agentId,
      enabled,
      knowledgeBaseId,
    });
  };

  deleteAgentKnowledgeBase = async (agentId: string, knowledgeBaseId: string) => {
    return lambdaClient.agent.deleteAgentKnowledgeBase.mutate({ agentId, knowledgeBaseId });
  };

  toggleKnowledgeBase = async (agentId: string, knowledgeBaseId: string, enabled?: boolean) => {
    return lambdaClient.agent.toggleKnowledgeBase.mutate({
      agentId,
      enabled,
      knowledgeBaseId,
    });
  };

  createAgentFiles = async (agentId: string, fileIds: string[], enabled?: boolean) => {
    return lambdaClient.agent.createAgentFiles.mutate({ agentId, enabled, fileIds });
  };

  deleteAgentFile = async (agentId: string, fileId: string) => {
    return lambdaClient.agent.deleteAgentFile.mutate({ agentId, fileId });
  };

  toggleFile = async (agentId: string, fileId: string, enabled?: boolean) => {
    return lambdaClient.agent.toggleFile.mutate({
      agentId,
      enabled,
      fileId,
    });
  };

  getFilesAndKnowledgeBases = async (agentId: string, visibility?: 'private' | 'public') => {
    return lambdaClient.agent.getKnowledgeBasesAndFiles.query(
      visibility ? { agentId, visibility } : { agentId },
    );
  };

  /**
   * Get an agent by id (REST 化，LobeAgentConfig 兼容)
   */
  getAgentConfigById = async (agentId: string) => {
    return unwrap<Record<string, any>>(
      `/app/front-hub/agents/${encodeURIComponent(agentId)}/config`,
    );
  };

  /**
   * @deprecated use getAgentConfigById instead
   */
  getSessionConfig = async (sessionId: string) => {
    return unwrap<Record<string, any>>(
      `/app/front-hub/agents/${encodeURIComponent(sessionId)}/config`,
    );
  };

  /**
   * Update agent config and return the updated agent data
   */
  updateAgentConfig = async (
    agentId: string,
    config: PartialDeep<LobeAgentConfig>,
    signal?: AbortSignal,
  ) => {
    return unwrap<Record<string, any>>(
      `/app/front-hub/agents/${encodeURIComponent(agentId)}/config`,
      {
        method: 'PUT',
        body: JSON.stringify({ value: config }),
        signal,
      },
    );
  };

  /**
   * Update agent meta and return the updated agent data
   */
  updateAgentMeta = async (agentId: string, meta: AgentMetaUpdate, signal?: AbortSignal) => {
    return unwrap<Record<string, any>>(
      `/app/front-hub/agents/${encodeURIComponent(agentId)}/config`,
      {
        method: 'PUT',
        body: JSON.stringify({ value: { ...meta, meta } }),
        signal,
      },
    );
  };

  /**
   * Get a builtin agent by slug, creating it if it doesn't exist.
   * This is a generic interface for all builtin agents (page-copilot, inbox, etc.)
   */
  getBuiltinAgent = async (slug: string) => {
    return unwrap<Record<string, any>>(`/app/front-hub/agents/builtin/${encodeURIComponent(slug)}`);
  };

  /**
   * Remove an agent and its associated session
   */
  removeAgent = async (agentId: string) => {
    return unwrap(`/app/front-hub/agents/${encodeURIComponent(agentId)}`, { method: 'DELETE' });
  };

  /**
   * Query non-virtual agents with optional keyword filter.
   * Returns agents with minimal info (id, title, description, avatar, backgroundColor).
   */
  queryAgents = async (params?: {
    keyword?: string;
    limit?: number;
    offset?: number;
  }): Promise<AvailableAgentItem[]> => {
    const qs = new URLSearchParams();
    if (params?.keyword) qs.set('keyword', params.keyword);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const q = qs.toString();
    return unwrap<AvailableAgentItem[]>(`/app/front-hub/agents/query${q ? `?${q}` : ''}`);
  };

  /**
   * Count non-virtual agents with optional keyword and date filters,
   * matching queryAgents conditions.
   */
  countAgents = async (_params?: {
    endDate?: string;
    keyword?: string;
    range?: [string, string];
    startDate?: string;
  }) => {
    return unwrap<number>(`/app/front-hub/agents/count`);
  };

  /**
   * Pin or unpin an agent
   */
  updateAgentPinned = async (agentId: string, pinned: boolean) => {
    return unwrap(`/app/front-hub/agents/${encodeURIComponent(agentId)}/pinned`, {
      method: 'PATCH',
      body: JSON.stringify({ pinned }),
    });
  };

  /**
   * Duplicate an agent.
   * Returns the new agent ID.
   */
  duplicateAgent = async (
    agentId: string,
    newTitle?: string,
  ): Promise<{ agentId: string } | null> => {
    return unwrap<{ agentId: string }>(
      `/app/front-hub/agents/${encodeURIComponent(agentId)}/duplicate`,
      {
        method: 'POST',
        body: JSON.stringify({ newTitle }),
      },
    );
  };

  /**
   * Rank the user's agents by topic count (agent usage ranking).
   */
  rankAgents = async (limit?: number): Promise<AgentRankItem[]> => {
    return unwrap<AgentRankItem[]>(`/app/front-hub/agents/rank${limit ? `?limit=${limit}` : ''}`);
  };

  transferAgent = async (
    agentId: string,
    targetWorkspaceId: string | null,
    targetVisibility?: 'private' | 'public',
    targetAccessLevel?: 'edit' | 'use',
  ): Promise<{ agentId: string; slug: string | null }> => {
    return lambdaClient.agent.transferAgent.mutate({
      agentId,
      targetAccessLevel,
      targetVisibility,
      targetWorkspaceId,
    });
  };
}

export const agentService = new AgentService();
