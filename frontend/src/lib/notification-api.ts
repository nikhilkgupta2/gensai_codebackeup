import { api, type ApiEnvelope } from './api';

export type NotificationItem = {
  id: string;
  type: string;
  group: string;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
  is_read: boolean;
  created_at: string;
};

export type ActivityFeedItem = {
  id: string;
  type: string;
  group: string;
  title: string;
  message: string;
  created_at: string;
};

export async function listNotifications(includeRead = false) {
  const response = await api.get<ApiEnvelope<NotificationItem[]>>('/notifications', {
    params: { include_read: includeRead },
  });
  return response.data.data ?? [];
}

export async function markNotificationRead(notificationId?: string) {
  const response = await api.post<ApiEnvelope<{ updated: number }>>('/notifications/mark-read', null, {
    params: notificationId ? { notification_id: notificationId } : undefined,
  });
  return response.data.data ?? { updated: 0 };
}

export async function listActivityFeed(limit = 12) {
  const response = await api.get<ApiEnvelope<ActivityFeedItem[]>>('/notifications/activity-feed', {
    params: { limit },
  });
  return response.data.data ?? [];
}
