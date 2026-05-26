import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bell, Check, ClipboardList, PackageCheck, ShieldCheck, Truck, UserPlus } from 'lucide-react';

import type { AuthUser } from '../../lib/auth-store';
import { cn } from '../../lib/cn';
import { listNotifications, markNotificationRead, type NotificationItem } from '../../lib/notification-api';

type NotificationTone = 'amber' | 'blue' | 'green' | 'slate';

const toneClass: Record<NotificationTone, string> = {
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-sky-50 text-sky-700',
  green: 'bg-emerald-50 text-emerald-700',
  slate: 'bg-slate-100 text-slate-600',
};

const iconByType = {
  low_stock: AlertTriangle,
  transfer_approved: Truck,
  transfer_pending: Truck,
  po_approved: ClipboardList,
  po_pending: ClipboardList,
  shipment_delayed: AlertTriangle,
  stock_adjustment: PackageCheck,
  inventory_movement: PackageCheck,
  new_user_added: UserPlus,
  platform_activity: ShieldCheck,
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function toneForNotification(item: NotificationItem): NotificationTone {
  if (item.type.includes('delayed') || item.type === 'low_stock') {
    return 'amber';
  }
  if (item.type.includes('approved')) {
    return 'green';
  }
  if (item.group === 'platform' || item.group === 'users') {
    return 'blue';
  }
  return 'slate';
}

export function NotificationCenter({ user }: { user: AuthUser | null }) {
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => listNotifications(),
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      queryClient.setQueryData<NotificationItem[]>(['notifications'], (current = []) =>
        notificationId ? current.filter((item) => item.id !== notificationId) : [],
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
    },
  });

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const groupedNotifications = notifications.reduce<Record<string, NotificationItem[]>>((groups, item) => {
    groups[item.group] = [...(groups[item.group] ?? []), item];
    return groups;
  }, {});

  return (
    <div className="group relative">
      <button
        className="relative grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
        type="button"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      <div className="invisible absolute right-0 top-11 z-50 w-[min(380px,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">Notifications</p>
            <p className="text-xs text-slate-500">{unreadCount} unread operational update{unreadCount === 1 ? '' : 's'}</p>
          </div>
          <button
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            type="button"
            disabled={unreadCount === 0 || markReadMutation.isPending}
            onClick={() => markReadMutation.mutate(undefined)}
          >
            <Check className="h-3.5 w-3.5" />
            Mark read
          </button>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {notificationsQuery.isLoading ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">No active operational notifications.</p>
          ) : (
            <div className="space-y-1">
              {Object.entries(groupedNotifications).map(([group, items]) => (
                <div key={group}>
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{group}</p>
                  {items.map((item) => {
                    const Icon = iconByType[item.type as keyof typeof iconByType] ?? Bell;
                    const tone = toneForNotification(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => markReadMutation.mutate(item.id)}
                        className={cn(
                          'flex w-full gap-3 rounded-md px-2 py-3 text-left transition hover:bg-slate-50',
                          !item.is_read && 'bg-slate-50',
                        )}
                      >
                        <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-md', toneClass[tone])}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900">{item.title}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.message}</span>
                          <span className="mt-1 block text-[11px] text-slate-400">{formatDate(item.created_at)}</span>
                        </span>
                        {!item.is_read ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" /> : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
