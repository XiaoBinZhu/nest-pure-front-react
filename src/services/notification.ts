import { apiFetch } from '@/services/_api';

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
    return apiFetch(`/api/v1/c-end/notifications${qs ? `?${qs}` : ''}`);
  };

  // 未读数：GET /api/v1/c-end/notifications/unread-count
  getUnreadCount = (): Promise<number> => {
    return apiFetch<number>('/api/v1/c-end/notifications/unread-count');
  };

  // 标记已读：POST /api/v1/c-end/notifications/:id/read
  markAsRead = async (ids: string[]) => {
    // 逐个标记已读（nest-admin 接口为单条 :id/read）
    await Promise.all(
      ids.map((id) =>
        apiFetch(`/api/v1/c-end/notifications/${encodeURIComponent(id)}/read`, {
          method: 'POST',
        }),
      ),
    );
  };

  // 全部标记已读：POST /api/v1/c-end/notifications/read-all
  markAllAsRead = () => {
    return apiFetch('/api/v1/c-end/notifications/read-all', { method: 'POST' });
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
