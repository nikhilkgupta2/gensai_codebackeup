import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ReactNode } from 'react';

import { EmptyState } from '../ui/EmptyState';
import { SectionCard, SectionHeader } from '../ui/Page';

const CHART_COLORS = ['#0f172a', '#2563eb', '#0891b2', '#059669', '#d97706', '#7c3aed', '#dc2626'];

type ChartDatum = Record<string, string | number>;

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#242424]">
      {label ? <p className="mb-1 font-semibold text-slate-900 dark:text-white">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-5">
            <span className="text-slate-500 dark:text-white/60">{item.name}</span>
            <span className="font-semibold text-slate-900 dark:text-white">{Number(item.value).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartShell({
  title,
  description,
  children,
  isEmpty,
}: {
  title: string;
  description: string;
  children: ReactNode;
  isEmpty: boolean;
}) {
  return (
    <SectionCard className="min-w-0">
      <SectionHeader title={title} description={description} />
      <div className="h-72 p-4">
        {isEmpty ? <EmptyState title="Not enough data yet" description="This chart will populate as operational data grows." /> : children}
      </div>
    </SectionCard>
  );
}

export function DonutChartCard({
  title,
  description,
  data,
  dataKey,
  nameKey,
}: {
  title: string;
  description: string;
  data: ChartDatum[];
  dataKey: string;
  nameKey: string;
}) {
  return (
    <ChartShell title={title} description={description} isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey={dataKey} nameKey={nameKey} innerRadius={58} outerRadius={92} paddingAngle={3}>
            {data.map((entry, index) => (
              <Cell key={String(entry[nameKey])} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} cursor={false} />
        </PieChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function MovementTrendChart({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: ChartDatum[];
}) {
  return (
    <ChartShell title={title} description={description} isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={false} />
          <Area type="monotone" dataKey="stockIn" name="Stock in" stroke="#059669" fill="#059669" fillOpacity={0.12} strokeWidth={2} />
          <Area type="monotone" dataKey="stockOut" name="Stock out" stroke="#dc2626" fill="#dc2626" fillOpacity={0.1} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function HorizontalBarChartCard({
  title,
  description,
  data,
  dataKey,
  nameKey,
}: {
  title: string;
  description: string;
  data: ChartDatum[];
  dataKey: string;
  nameKey: string;
}) {
  return (
    <ChartShell title={title} description={description} isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, left: 32, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <YAxis dataKey={nameKey} type="category" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} width={88} />
          <Tooltip content={<ChartTooltip />} cursor={false} />
          <Bar dataKey={dataKey} name="Units" fill="#0f172a" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function VerticalBarChartCard({
  title,
  description,
  data,
  bars,
}: {
  title: string;
  description: string;
  data: ChartDatum[];
  bars: Array<{ key: string; name: string; color: string }>;
}) {
  return (
    <ChartShell title={title} description={description} isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={false} />
          {bars.map((bar) => (
            <Bar key={bar.key} dataKey={bar.key} name={bar.name} fill={bar.color} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function LineChartCard({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: ChartDatum[];
}) {
  return (
    <ChartShell title={title} description={description} isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={false} />
          <Line type="monotone" dataKey="events" name="Activity events" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="units" name="Units moved" stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
