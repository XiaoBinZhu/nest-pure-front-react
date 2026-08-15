import { apiFetch } from '@/services/_api';

// C 端浏览器 Agent API（对应 nest-admin /app/front-hub/browser）
// 真实 Playwright 浏览器自动化：会话 + 导航/点击/输入/JS 执行/截图/内容

// 统一解包 { code, data } 信封
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return (res as any)?.data ?? (res as T);
}

export interface BrowserSnapshot {
  id: string;
  url?: string;
  title?: string;
  content?: string;
}

export interface BrowserScreenshot {
  id: string;
  screenshot: string; // base64 PNG
}

class BrowserAgentService {
  createSession = async () =>
    unwrap<{ id: string }>('/app/front-hub/browser/sessions', { method: 'POST' });

  navigate = async (id: string, url: string) =>
    unwrap<BrowserSnapshot>(`/app/front-hub/browser/sessions/${id}/navigate`, {
      method: 'POST',
      body: JSON.stringify({ url }),
    });

  click = async (id: string, selector: string) =>
    unwrap<{ id: string; clicked: string }>(`/app/front-hub/browser/sessions/${id}/click`, {
      method: 'POST',
      body: JSON.stringify({ selector }),
    });

  type = async (id: string, selector: string, text: string) =>
    unwrap<{ id: string; typed: string }>(`/app/front-hub/browser/sessions/${id}/type`, {
      method: 'POST',
      body: JSON.stringify({ selector, text }),
    });

  evaluate = async (id: string, expression: string) =>
    unwrap<{ id: string; result: any }>(`/app/front-hub/browser/sessions/${id}/evaluate`, {
      method: 'POST',
      body: JSON.stringify({ expression }),
    });

  screenshot = async (id: string) =>
    unwrap<BrowserScreenshot>(`/app/front-hub/browser/sessions/${id}/screenshot`);

  content = async (id: string) =>
    unwrap<BrowserSnapshot>(`/app/front-hub/browser/sessions/${id}/content`);

  close = async (id: string) =>
    unwrap<{ id: string; closed: boolean }>(`/app/front-hub/browser/sessions/${id}/close`, {
      method: 'POST',
    });
}

export const browserAgentService = new BrowserAgentService();
