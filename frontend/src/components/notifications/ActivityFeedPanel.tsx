import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, ClipboardList, PackageCheck, Truck, UserPlus } from 'lucide-react';

import { listActivityFeed, type ActivityFeedItem } from '../../lib/notification-api';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { LoadingState } from '../ui/LoadingState';
import { SectionCard, SectionHeader } from '../ui/Page';

const iconByGroup = {
  inventory: PackageCheck,
  warehouse: Truck,
  procurement: ClipboardList,
  users: UserPlus,
  platform: Activity,
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function toneForItem(item: ActivityFeedItem) {
  if (item.type.includes('delayed') || item.type.includes('adjustment')) {
    return 'amber' as const;
  }
  if (item.type.includes('stock_out')) {
    return 'red' as const;
  }
  if (item.type.includes('approved') || item.type.includes('stock_in')) {
    return 'green' as const;
  }
  return 'blue' as const;
}

export function ActivityFeedPanel() {
  const activityQuery = useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => listActivityFeed(12),
    staleTime: 30_000,
  });
  const activity = activityQuery.data ?? [];

  return (
    <SectionCard className="mt-4">
      <SectionHeader title="Activity feed" description="Role-scoped operational updates from inventory, procurement, warehouse, and user events." />
      {activityQuery.isLoading ? (
        <div className="p-5">
          <LoadingState label="Loading activity feed..." />
        </div>
      ) : activity.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No activity yet" description="Operational activity will appear here as teams work in IMS." />
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {activity.map((item) => {
            const Icon = iconByGroup[item.group as keyof typeof iconByGroup] ?? AlertTriangle;
            return (
              <div key={item.id} className="flex gap-3 px-4 py-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <Badge tone={toneForItem(item)}>{item.group}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(item.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
