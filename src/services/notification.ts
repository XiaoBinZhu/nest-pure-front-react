import { apiFetch } from '@/services/_api';


// 统一解包 { code, data } 信封（后端响应统一包装）
async function unwrap<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch<{ code: number; data: T }>(path, options);
  return 'data' in (res as any) ? (res as any).data : (res as T);
}

class NotificationService {
  // 列表：GET /api/v1/c-end/notifications
  list = (
    params: {
      category?: string;
      cursor?: string;
      limit?: number;
      unreadOnly?: boolean;
    } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.category) query.set('category', params.category);
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.unreadOnly) query.set('unreadOnly', 'true');
    const qs = query.toString();
    return unwrap(`/api/v1/c-end/notifications${qs ? `?${qs}` : ''}`);
  };

  // 未读数：GET /api/v1/c-end/notifications/unread-count
  getUnreadCount = (): Promise<number> => {
    return unwrap<number>('/api/v1/c-end/notifications/unread-count');
  };

  // 标记已读：POST /api/v1/c-end/notifications/:id/read
  markAsRead = async (ids: string[]) => {
    // 逐个标记已读（nest-admin 接口为单条 :id/read）
    await Promise.all(
      ids.map((id) =>
        unwrap(`/api/v1/c-end/notifications/${encodeURIComponent(id)}/read`, {
          method: 'POST',
        }),
      ),
    );
  };

  // 全部标记已读：POST /api/v1/c-end/notifications/read-all
  markAllAsRead = () => {
    return unwrap('/api/v1/c-end/notifications/read-all', { method: 'POST' });
  };

  // TODO: Wave 2 - 待对接 nest-admin 归档接口
  archive = (_id: string) => {
    return Promise.resolve();
  };

  // TODO: Wave 2
  archiveAll = () => {
    return Promise.resolve();
  };
}

export const notificationService = new NotificationService();
