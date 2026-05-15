"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  AdherencePoint,
  CompletionPoint,
  SymptomCount,
  ZoneOverTimePoint,
} from "@/lib/analytics";

type Props = {
  zoneOverTime: ZoneOverTimePoint[];
  adherenceOverTime: AdherencePoint[];
  completionByRecoveryDay: CompletionPoint[];
  topSymptoms: SymptomCount[];
  // Query string carrying the active filters; the chart cards append
  // ?chart=… to build export URLs. A function can't cross the
  // server→client boundary, so we pass plain data.
  exportBaseQs: string;
};

const ZONE_COLORS = {
  green: "#4ade80",
  yellow: "#facc15",
  orange: "#fb923c",
  red: "#ef4444",
} as const;

const ACCENT = "#2C7585";

function pctTick(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function ChartCard({
  title,
  exportHref,
  empty,
  children,
}: {
  title: string;
  exportHref: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-fv-bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fv-text-primary">{title}</h2>
        <a
          href={exportHref}
          className="text-xs font-semibold text-fv-accent-strong"
        >
          Export CSV
        </a>
      </div>
      {empty ? (
        <p className="py-12 text-center text-sm text-fv-text-secondary">
          No data for the selected range.
        </p>
      ) : (
        children
      )}
    </section>
  );
}

export function AnalyticsCharts({
  zoneOverTime,
  adherenceOverTime,
  completionByRecoveryDay,
  topSymptoms,
  exportBaseQs,
}: Props) {
  const exportLink = (chart: string) =>
    `/analytics/export?chart=${chart}&${exportBaseQs}`;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Zone-flag rate over time — stacked area */}
      <ChartCard
        title="Zone-flag rate over time"
        exportHref={exportLink("zone-over-time")}
        empty={zoneOverTime.length === 0}
      >
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={zoneOverTime}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" fontSize={11} />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip />
            <Legend />
            {(["green", "yellow", "orange", "red"] as const).map((z) => (
              <Area
                key={z}
                type="monotone"
                dataKey={z}
                stackId="zones"
                stroke={ZONE_COLORS[z]}
                fill={ZONE_COLORS[z]}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Adherence rate over time — line */}
      <ChartCard
        title="Medication adherence over time"
        exportHref={exportLink("adherence-over-time")}
        empty={adherenceOverTime.length === 0}
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={adherenceOverTime}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" fontSize={11} />
            <YAxis
              domain={[0, 1]}
              tickFormatter={pctTick}
              fontSize={11}
            />
            <Tooltip formatter={(value) => pctTick(Number(value) || 0)} />
            <Line
              type="monotone"
              dataKey="rate"
              name="Adherence"
              stroke={ACCENT}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Check-in completion by recovery day — bar */}
      <ChartCard
        title="Check-in completion by recovery day"
        exportHref={exportLink("completion-by-recovery-day")}
        empty={completionByRecoveryDay.length === 0}
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={completionByRecoveryDay}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="recovery_day" fontSize={11} />
            <YAxis
              domain={[0, 1]}
              tickFormatter={pctTick}
              fontSize={11}
            />
            <Tooltip formatter={(value) => pctTick(Number(value) || 0)} />
            <Bar dataKey="rate" name="Completion" fill={ACCENT} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Symptom frequency — horizontal bar */}
      <ChartCard
        title="Top reported symptoms"
        exportHref={exportLink("symptom-frequency")}
        empty={topSymptoms.length === 0}
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={topSymptoms} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" fontSize={11} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="symptom"
              width={120}
              fontSize={11}
            />
            <Tooltip />
            <Bar dataKey="occurrences" name="Reports" fill={ACCENT} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
