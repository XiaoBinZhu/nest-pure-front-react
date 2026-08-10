import type { OnboardingUserInfo } from '@lobechat/context-engine';
import { type MarkdownPatchHunk } from '@lobechat/markdown-patch';
import { type PartialDeep } from 'type-fest';

import { apiFetch } from '@/services/_api';
import {
  type SaveUserQuestionInput,
  type SSOProvider,
  type UserAgentOnboarding,
  type UserAgentOnboardingContext,
  type UserGuide,
  type UserInitializationState,
  type UserOnboarding,
  type UserPreference,
} from '@/types/user';
import { type UserSettings } from '@/types/user/settings';

// 统一解包 { code, data } 信封（后端响应统一包装，前端各 service 均需解包）
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return 'data' in (res as any) ? (res as any).data : (res as T);
}

export class UserService {
  // 活动摘要：GET /app/front-hub/user/activity-summary
  getUserActivitySummary = async (): Promise<{
    lastUserMessageAt: Date | null;
    userCreatedAt: Date | null;
  }> => {
    return unwrap('/app/front-hub/user/activity-summary');
  };

  // 用户资料：GET /app/front-hub/user/profile
  getProfile = async () => {
    return unwrap('/app/front-hub/user/profile');
  };

  // 更新资料：PATCH /app/front-hub/user/profile
  updateProfile = async (data: Record<string, any>) => {
    return unwrap('/app/front-hub/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  };

  // 偏好：GET /app/front-hub/user/preferences
  getPreferences = async () => {
    return unwrap('/app/front-hub/user/preferences');
  };

  // 更新偏好：PUT /app/front-hub/user/preferences（后端契约 body 需 { preferences } 包装，合并更新）
  updatePreferences = async (preference: Partial<UserPreference>) => {
    return unwrap('/app/front-hub/user/preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences: preference }),
    });
  };

  // 设置：GET /app/front-hub/user/settings
  getSettings = async () => {
    return unwrap('/app/front-hub/user/settings');
  };

  // 更新设置：PUT /app/front-hub/user/settings
  updateSettings = async (value: PartialDeep<UserSettings>, signal?: AbortSignal) => {
    return unwrap('/app/front-hub/user/settings', {
      method: 'PUT',
      body: JSON.stringify(value),
      signal,
    });
  };

  // TODO: Wave 2 - 待对接 nest-admin 注册时长接口
  getUserRegistrationDuration = async (): Promise<{
    createdAt: string;
    duration: number;
    updatedAt: string;
  }> => {
    return Promise.resolve({ createdAt: '', duration: 0, updatedAt: '' });
  };

  // TODO: Wave 2 - 待对接 nest-admin SSO 接口
  getUserSSOProviders = async (): Promise<SSOProvider[]> => {
    return Promise.resolve([]);
  };

  // TODO: Wave 2 - 待对接 nest-admin onboarding 接口
  getOrCreateOnboardingState = async (): Promise<{
    agentId: string;
    agentOnboarding: UserAgentOnboarding;
    context: UserAgentOnboardingContext;
    feedbackSubmitted: boolean;
    topicId: string;
  }> => {
    return Promise.resolve({} as any);
  };

  // TODO: Wave 2
  getOnboardingBootstrapState = async (): Promise<{
    agentId: string;
    agentOnboarding: UserAgentOnboarding;
    context: UserAgentOnboardingContext;
    feedbackSubmitted: boolean;
    hasMessages: boolean;
    topicId: string | null;
  }> => {
    return Promise.resolve({} as any);
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方对 .topicId/.messages 的访问
  sendOnboardingFirstMessage = async (_input: { agentId: string }): Promise<any> => {
    return Promise.resolve({ topicId: '', messages: [] } as any);
  };

  // TODO: Wave 2
  getOnboardingAgentContext = async (): Promise<{
    personaContent: string | null;
    phaseGuidance: string;
    soulContent: string | null;
    userInfo?: OnboardingUserInfo;
  }> => {
    return Promise.resolve({} as any);
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方对返回值的类型期望
  saveUserQuestion = async (_params: SaveUserQuestionInput): Promise<any> => {
    return Promise.resolve({} as any);
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方对返回值的类型期望
  // 用户初始化状态：GET /app/front-hub/user/init-state（settings/preferences/onboarding 聚合）
  getUserState = async (): Promise<UserInitializationState> => {
    return unwrap('/app/front-hub/user/init-state');
  };

  // 更新引导状态：PATCH /app/front-hub/user/onboarding
  updateOnboarding = async (onboarding: UserOnboarding) => {
    return unwrap('/app/front-hub/user/onboarding', {
      method: 'PATCH',
      body: JSON.stringify({
        state: onboarding,
        completed: !!onboarding.finishedAt,
      }),
    });
  };

  // 完成引导：PATCH onboarding completed=true
  finishOnboarding = async (): Promise<any> => {
    return unwrap('/app/front-hub/user/onboarding', {
      method: 'PATCH',
      body: JSON.stringify({
        state: { finishedAt: new Date().toISOString(), version: 1 },
        completed: true,
      }),
    });
  };

  // 标记已引导（兼容旧调用）
  makeUserOnboarded = async () => {
    return this.finishOnboarding();
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方对 .content/.id 的访问
  readOnboardingDocument = async (_type: 'soul' | 'persona'): Promise<any> => {
    return Promise.resolve({ content: '', id: '' } as any);
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方对 .id/.applied 的访问
  patchOnboardingDocument = async (
    _type: 'soul' | 'persona',
    _hunks: MarkdownPatchHunk[],
  ): Promise<any> => {
    return Promise.resolve({ id: '', applied: 0 } as any);
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方对 UserAgentOnboarding 的类型期望
  resetAgentOnboarding = async (): Promise<any> => {
    return Promise.resolve({} as any);
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方对 UserAgentOnboarding 的类型期望
  updateAgentOnboarding = async (_agentOnboarding: UserAgentOnboarding): Promise<any> => {
    return Promise.resolve(_agentOnboarding as any);
  };

  // 更新头像：PATCH /app/front-hub/user/profile
  updateAvatar = async (avatar: string) => {
    return unwrap('/app/front-hub/user/profile', {
      method: 'PATCH',
      body: JSON.stringify({ avatar }),
    });
  };

  // 更新兴趣：PATCH /app/front-hub/user/profile
  updateInterests = async (interests: string[]) => {
    return unwrap('/app/front-hub/user/profile', {
      method: 'PATCH',
      body: JSON.stringify({ interests }),
    });
  };

  // 更新全名：PATCH /app/front-hub/user/profile
  updateFullName = async (fullName: string) => {
    return unwrap('/app/front-hub/user/profile', {
      method: 'PATCH',
      body: JSON.stringify({ fullName }),
    });
  };

  // 更新用户名：PATCH /app/front-hub/user/profile
  updateUsername = async (username: string) => {
    return unwrap('/app/front-hub/user/profile', {
      method: 'PATCH',
      body: JSON.stringify({ username }),
    });
  };

  // 更新偏好（兼容原方法名）：PUT /app/front-hub/user/preferences
  updatePreference = async (preference: Partial<UserPreference>) => {
    return this.updatePreferences(preference);
  };

  // 更新引导状态（onboarding 完成/向导关闭）：存 preference.guide
  updateGuide = async (guide: Partial<UserGuide>) => {
    return unwrap('/app/front-hub/user/preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences: { guide } }),
    });
  };

  // 更新设置（兼容原方法名）：PUT /app/front-hub/user/settings
  updateUserSettings = async (value: PartialDeep<UserSettings>, signal?: AbortSignal) => {
    return this.updateSettings(value, signal);
  };

  // TODO: Wave 2 - 待对接 nest-admin reset 接口
  resetUserSettings = async () => {
    return Promise.resolve();
  };
}

export const userService = new UserService();
