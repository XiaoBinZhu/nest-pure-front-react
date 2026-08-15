import { type Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { testService } from '~test-utils';

import { UserService, userService } from './index';

const mockApiFetch = vi.hoisted(() => vi.fn());

vi.mock('@/services/_api', () => ({
  apiFetch: mockApiFetch,
}));

describe('UserService', () => {
  testService(UserService);

  beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should call apiFetch with GET /api/v1/c-end/user/profile', async () => {
      const mockProfile = { id: 1, fullName: 'John Doe' };
      mockApiFetch.mockResolvedValueOnce(mockProfile);

      const result = await userService.getProfile();

      expect(mockApiFetch).toHaveBeenCalledWith('/app/front-hub/user/profile', undefined);
      expect(result).toEqual(mockProfile);
    });
  });

  describe('getPreferences', () => {
    it('should call apiFetch with GET /api/v1/c-end/user/preferences', async () => {
      const mockPreferences = { hideSyncAlert: true };
      mockApiFetch.mockResolvedValueOnce(mockPreferences);

      const result = await userService.getPreferences();

      expect(mockApiFetch).toHaveBeenCalledWith('/app/front-hub/user/preferences', undefined);
      expect(result).toEqual(mockPreferences);
    });
  });

  describe('getSettings', () => {
    it('should call apiFetch with GET /api/v1/c-end/user/settings', async () => {
      const mockSettings = { general: { fontSize: 14 } };
      mockApiFetch.mockResolvedValueOnce(mockSettings);

      const result = await userService.getSettings();

      expect(mockApiFetch).toHaveBeenCalledWith('/app/front-hub/user/settings', undefined);
      expect(result).toEqual(mockSettings);
    });
  });

  describe('updateAvatar', () => {
    it('should call apiFetch with PATCH profile and avatar body', async () => {
      await userService.updateAvatar('https://example.com/avatar.png');

      expect(mockApiFetch).toHaveBeenCalledWith('/app/front-hub/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ avatar: 'https://example.com/avatar.png' }),
      });
    });
  });

  describe('updateFullName', () => {
    it('should call apiFetch with PATCH profile and fullName body', async () => {
      await userService.updateFullName('John Doe');

      expect(mockApiFetch).toHaveBeenCalledWith('/app/front-hub/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ fullName: 'John Doe' }),
      });
    });
  });

  describe('updatePreference', () => {
    it('should call apiFetch with PUT preferences', async () => {
      const preference = { hideSyncAlert: true };

      await userService.updatePreference(preference);

      expect(mockApiFetch).toHaveBeenCalledWith('/app/front-hub/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ preferences: preference }),
      });
    });
  });

  describe('updateUserSettings', () => {
    it('should call apiFetch with PUT settings', async () => {
      const settings = { general: { fontSize: 14 } };

      await userService.updateUserSettings(settings);

      expect(mockApiFetch).toHaveBeenCalledWith('/app/front-hub/user/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
        signal: undefined,
      });
    });

    it('should pass abort signal when provided', async () => {
      const settings = { general: { fontSize: 16 } };
      const abortController = new AbortController();

      await userService.updateUserSettings(settings, abortController.signal);

      expect(mockApiFetch).toHaveBeenCalledWith('/app/front-hub/user/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
        signal: abortController.signal,
      });
    });
  });

  describe('Wave 2 桩方法（待对接 nest-admin 接口）', () => {
    it('getUserRegistrationDuration should resolve stub value', async () => {
      const result = await userService.getUserRegistrationDuration();
      expect(result).toEqual({ createdAt: '', duration: 0, updatedAt: '' });
    });

    it('getUserState should resolve empty state', async () => {
      const result = await userService.getUserState();
      expect(result).toEqual({} as any);
    });

    it('getUserSSOProviders should resolve empty array', async () => {
      const result = await userService.getUserSSOProviders();
      expect(result).toEqual([]);
    });

    it('makeUserOnboarded should resolve', async () => {
      await expect(userService.makeUserOnboarded()).resolves.toEqual({});
    });

    it('updateGuide should resolve', async () => {
      await expect(userService.updateGuide({})).resolves.toEqual({});
    });

    it('resetUserSettings should resolve', async () => {
      await expect(userService.resetUserSettings()).resolves.toBeUndefined();
    });
  });
});
