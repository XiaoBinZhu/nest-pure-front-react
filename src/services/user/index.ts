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

export class UserService {
  // 活动摘要：GET /api/v1/c-end/user/activity-summary
  getUserActivitySummary = async (): Promise<{
    lastUserMessageAt: Date | null;
    userCreatedAt: Date | null;
  }> => {
    return apiFetch('/api/v1/c-end/user/activity-summary');
  };

  // 用户资料：GET /api/v1/c-end/user/profile
  getProfile = async () => {
    return apiFetch('/api/v1/c-end/user/profile');
  };

  // 更新资料：PATCH /api/v1/c-end/user/profile
  updateProfile = async (data: Record<string, any>) => {
    return apiFetch('/api/v1/c-end/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  };

  // 偏好：GET /api/v1/c-end/user/preferences
  getPreferences = async () => {
    return apiFetch('/api/v1/c-end/user/preferences');
  };

  // 更新偏好：PUT /api/v1/c-end/user/preferences
  updatePreferences = async (preference: Partial<UserPreference>) => {
    return apiFetch('/api/v1/c-end/user/preferences', {
      method: 'PUT',
      body: JSON.stringify(preference),
    });
  };

  // 设置：GET /api/v1/c-end/user/settings
  getSettings = async () => {
    return apiFetch('/api/v1/c-end/user/settings');
  };

  // 更新设置：PUT /api/v1/c-end/user/settings
  updateSettings = async (value: PartialDeep<UserSettings>, signal?: AbortSignal) => {
    return apiFetch('/api/v1/c-end/user/settings', {
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

  // TODO: Wave 2 - 待对接 nest-admin user state 接口
  getUserState = async (): Promise<UserInitializationState> => {
    return Promise.resolve({} as UserInitializationState);
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
  finishOnboarding = async (): Promise<any> => {
    return Promise.resolve({} as any);
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方对 .content/.id 的访问
  readOnboardingDocument = async (_type: 'soul' | 'persona'): Promise<any> => {
    return Promise.resolve({ content: '', id: '' } as any);
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方对 .id 的访问
  updateOnboardingDocument = async (_type: 'soul' | 'persona', _content: string): Promise<any> => {
    return Promise.resolve({ id: '' } as any);
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方对 .id/.applied 的访问
  patchOnboardingDocument = async (
    _type: 'soul' | 'persona',
    _hunks: MarkdownPatchHunk[],
  ): Promise<any> => {
    return Promise.resolve({ id: '', applied: 0 } as any);
  };

  // TODO: Wave 2
  makeUserOnboarded = async () => {
    return Promise.resolve();
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方对 UserAgentOnboarding 的类型期望
  resetAgentOnboarding = async (): Promise<any> => {
    return Promise.resolve({} as any);
  };

  // TODO: Wave 2 - 返回 any 以兼容调用方对 UserAgentOnboarding 的类型期望
  updateAgentOnboarding = async (_agentOnboarding: UserAgentOnboarding): Promise<any> => {
    return Promise.resolve(_agentOnboarding as any);
  };

  // TODO: Wave 2
  updateOnboarding = async (_onboarding: UserOnboarding) => {
    return Promise.resolve();
  };

  // 更新头像：PATCH /api/v1/c-end/user/profile
  updateAvatar = async (avatar: string) => {
    return apiFetch('/api/v1/c-end/user/profile', {
      method: 'PATCH',
      body: JSON.stringify({ avatar }),
    });
  };

  // 更新兴趣：PATCH /api/v1/c-end/user/profile
  updateInterests = async (interests: string[]) => {
    return apiFetch('/api/v1/c-end/user/profile', {
      method: 'PATCH',
      body: JSON.stringify({ interests }),
    });
  };

  // 更新全名：PATCH /api/v1/c-end/user/profile
  updateFullName = async (fullName: string) => {
    return apiFetch('/api/v1/c-end/user/profile', {
      method: 'PATCH',
      body: JSON.stringify({ fullName }),
    });
  };

  // 更新用户名：PATCH /api/v1/c-end/user/profile
  updateUsername = async (username: string) => {
    return apiFetch('/api/v1/c-end/user/profile', {
      method: 'PATCH',
      body: JSON.stringify({ username }),
    });
  };

  // 更新偏好（兼容原方法名）：PUT /api/v1/c-end/user/preferences
  updatePreference = async (preference: Partial<UserPreference>) => {
    return this.updatePreferences(preference);
  };

  // TODO: Wave 2 - 待对接 nest-admin guide 接口
  updateGuide = async (_guide: Partial<UserGuide>) => {
    return Promise.resolve();
  };

  // 更新设置（兼容原方法名）：PUT /api/v1/c-end/user/settings
  updateUserSettings = async (value: PartialDeep<UserSettings>, signal?: AbortSignal) => {
    return this.updateSettings(value, signal);
  };

  // TODO: Wave 2 - 待对接 nest-admin reset 接口
  resetUserSettings = async () => {
    return Promise.resolve();
  };
}

export const userService = new UserService();
