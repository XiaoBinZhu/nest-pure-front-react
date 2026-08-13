import { type Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch, clearAuthTokens, setAuthTokens } from '../_api';

global.fetch = vi.fn();

const storage = () => window.localStorage;

const mockJsonResponse = (status: number, body: unknown) => ({
  status,
  ok: status >= 200 && status < 300,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
});

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('apiFetch 响应解包', () => {
  it('nest-admin 包装格式 { code, data, message } 应解包出 data', async () => {
    (fetch as Mock).mockResolvedValueOnce(
      mockJsonResponse(200, { code: 200, data: { items: [], total: 0 }, message: 'success' }),
    );

    const result = await apiFetch<{ items: unknown[]; total: number }>('/api/v1/c-end/sessions');

    expect(result).toEqual({ items: [], total: 0 });
  });

  it('@Bypass 原始格式（无包装）应原样返回', async () => {
    (fetch as Mock).mockResolvedValueOnce(mockJsonResponse(200, { token: 'abc', user: {} }));

    const result = await apiFetch<{ token: string }>('/api/auth/get-session');

    expect(result).toEqual({ token: 'abc', user: {} });
  });

  it('带 token 时应注入 Authorization: Bearer 头', async () => {
    setAuthTokens('my-token');
    (fetch as Mock).mockResolvedValueOnce(
      mockJsonResponse(200, { code: 200, data: null, message: 'success' }),
    );

    await apiFetch('/api/v1/c-end/sessions');

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer my-token' }),
      }),
    );
  });
});

describe('apiFetch 401 无感刷新', () => {
  it('401 → 用 refreshToken 刷新 → 存新 token → 重试原请求并解包', async () => {
    setAuthTokens('old-token', 'old-refresh');

    const refreshResp = mockJsonResponse(200, {
      code: 200,
      data: { token: 'new-token', refreshToken: 'new-refresh', expires: 999 },
      message: 'success',
    });
    const retryResp = mockJsonResponse(200, {
      code: 200,
      data: { items: [1] },
      message: 'success',
    });

    (fetch as Mock)
      .mockResolvedValueOnce(mockJsonResponse(401, { message: 'Unauthorized' })) // 原请求 401
      .mockResolvedValueOnce(refreshResp) // 刷新
      .mockResolvedValueOnce(retryResp); // 重试

    const result = await apiFetch<{ items: unknown[] }>('/api/v1/c-end/sessions');

    // 刷新端点应指向 /system/auth/refresh-token 并携带旧 refreshToken
    const refreshCall = (fetch as Mock).mock.calls[1];
    expect(refreshCall[0]).toContain('/system/auth/refresh-token');
    expect(JSON.parse(refreshCall[1].body)).toEqual({ refreshToken: 'old-refresh' });
    // 重试请求应带新 token
    const retryCall = (fetch as Mock).mock.calls[2];
    expect(retryCall[1].headers.Authorization).toBe('Bearer new-token');
    // localStorage 应更新为新 token
    expect(storage().getItem('accessToken')).toBe('new-token');
    expect(storage().getItem('refreshToken')).toBe('new-refresh');
    // 结果应解包
    expect(result).toEqual({ items: [1] });
  });

  it('刷新失败 → 清除 token 并跳转 /signin', async () => {
    setAuthTokens('old-token', 'old-refresh');
    const hrefSpy = vi.spyOn(window.location, 'href', 'set');

    (fetch as Mock)
      .mockResolvedValueOnce(mockJsonResponse(401, { message: 'Unauthorized' }))
      .mockResolvedValueOnce(mockJsonResponse(400, { message: 'Invalid refresh token' }));

    await expect(apiFetch('/api/v1/c-end/sessions')).rejects.toThrow('Unauthorized');

    expect(storage().getItem('accessToken')).toBeNull();
    expect(storage().getItem('refreshToken')).toBeNull();
    expect(hrefSpy).toHaveBeenCalledWith('/signin');
    hrefSpy.mockRestore();
  });
});

describe('token 存取', () => {
  it('setAuthTokens / clearAuthTokens 读写 localStorage', () => {
    setAuthTokens('t1', 'r1');
    expect(storage().getItem('accessToken')).toBe('t1');
    expect(storage().getItem('refreshToken')).toBe('r1');

    clearAuthTokens();
    expect(storage().getItem('accessToken')).toBeNull();
    expect(storage().getItem('refreshToken')).toBeNull();
  });
});
