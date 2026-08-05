// REST API 客户端封装
// 统一处理 JWT 注入、401 刷新、错误处理
// 替代原 lambdaClient（tRPC）

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

// 刷新端点：nest-admin 系统级刷新（@Public），返回 { token, refreshToken, expires }
const REFRESH_URL = `${API_BASE}/system/auth/refresh-token`;

// 获取存储的 accessToken
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken') || null;
}

// 登录/注册成功后写入 token 与 refreshToken（供 REST 层注入与无感刷新）
export function setAuthTokens(token: string, refreshToken?: string | null) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('accessToken', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  } catch {
    // ignore localStorage errors (quota exceeded / private mode)
  }
}

// 登出/刷新失败时清除 token
export function clearAuthTokens() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  } catch {
    // ignore localStorage errors
  }
}

// nest-admin 统一响应包装为 { code, data, message }（@Bypass 端点返回原始格式）。
// 解包出 data，供调用方直接消费业务数据。
function unwrapData<T = any>(json: any): T {
  if (json && typeof json === 'object' && 'code' in json && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

// 统一 fetch 封装
export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // 尝试刷新 token
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      const refreshRes = await fetch(REFRESH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (refreshRes.ok) {
        const data = unwrapData<{ token?: string; refreshToken?: string }>(await refreshRes.json());
        // nest-admin 返回 { token, refreshToken, expires }
        if (!data.token) {
          throw new Error('Refresh failed: no token in response');
        }
        setAuthTokens(data.token, data.refreshToken);
        // 重试原请求
        headers.Authorization = `Bearer ${data.token}`;
        const retryRes = await fetch(`${API_BASE}${path}`, { ...options, headers });
        if (!retryRes.ok) throw new Error(`HTTP ${retryRes.status}`);
        return unwrapData<T>(await retryRes.json());
      }
    }
    // 刷新失败，清除 token
    clearAuthTokens();
    window.location.href = '/signin';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  // 解包 nest-admin 统一包装 { code, data, message }，@Bypass 端点原样返回
  const text = await res.text();
  return unwrapData<T>(text ? JSON.parse(text) : null);
}

// SSE 流式请求封装（用于 AI 对话）
export async function apiStream(
  path: string,
  body: any,
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.body!;
}
