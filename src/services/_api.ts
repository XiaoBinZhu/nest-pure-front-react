// REST API 客户端封装
// 统一处理 JWT 注入、401 刷新、错误处理
// 替代原 lambdaClient（tRPC）

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

// 获取存储的 accessToken
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken') || null;
}

// 统一 fetch 封装
export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  // 仅在有 body 时设置 Content-Type：无 body 请求（如 DELETE）带 JSON Content-Type
  // 会被 Fastify 拒绝（Body cannot be empty when content-type is set to 'application/json'）
  const hasBody = options.body != null && options.body !== '';
  const headers: Record<string, string> = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
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
    // 尝试刷新 token（nest-admin 实际路径 /system/auth/refresh-token）
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      const refreshRes = await fetch(`${API_BASE}/system/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        // nest-admin LoginToken 字段为 token / refreshToken（非 accessToken）
        localStorage.setItem('accessToken', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        // 重试原请求
        headers.Authorization = `Bearer ${data.token}`;
        const retryRes = await fetch(`${API_BASE}${path}`, { ...options, headers });
        if (!retryRes.ok) throw new Error(`HTTP ${retryRes.status}`);
        return retryRes.json();
      }
    }
    // 刷新失败，清除 token
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/signin';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  return res.json();
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
