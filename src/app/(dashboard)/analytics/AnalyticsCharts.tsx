"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CompletionPoint } from "@/lib/analytics";

export type RecoveryCurvePoint = { day: number; score: number };

const ACCENT = "#2C7585";
const GRID = "#E8EDEE";
const TICK = "#5C7178";

const axis = {
  axisLine: false,
  tickLine: false,
  tick: { fontSize: 11, fill: TICK },
} as const;

const tooltipStyle = {
  borderRadius: 10,
  border: `1px solid ${GRID}`,
  fontSize: 12,
} as const;

const ZONE_LABEL: Record<number, string> = {
  0: "Green",
  1: "Yellow",
  2: "Orange",
  3: "Red",
};

function pctTick(v: number): string {
  return `${Math.round(v * 100)}%`;
}

// Average check-in zone by recovery day — lower curve = healthier.
export function RecoveryCurveChart({
  data,
}: {
  data: RecoveryCurvePoint[];
}) {
  if (data.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-fv-text-secondary">
        No check-ins for this procedure yet.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="recoveryFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.3} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="day"
          {...axis}
          tickFormatter={(d) => `Day ${d}`}
        />
        <YAxis
          domain={[0, 3]}
          ticks={[0, 1, 2, 3]}
          tickFormatter={(v: number) => ZONE_LABEL[v] ?? String(v)}
          width={56}
          {...axis}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => (Number(value) || 0).toFixed(2)}
          labelFormatter={(d) => `Recovery day ${d}`}
        />
        <Area
          type="monotone"
          dataKey="score"
          name="Avg zone"
          stroke={ACCENT}
          strokeWidth={2.5}
          fill="url(#recoveryFill)"
          dot={{ r: 3, fill: ACCENT }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Check-in completion rate by recovery day.
export function CompletionChart({ data }: { data: CompletionPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-fv-text-secondary">
        No data for the selected range.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="recovery_day"
          {...axis}
          tickFormatter={(d) => `Day ${d}`}
        />
        <YAxis domain={[0, 1]} tickFormatter={pctTick} width={40} {...axis} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: GRID, opacity: 0.4 }}
          formatter={(value) => pctTick(Number(value) || 0)}
        />
        <Bar
          dataKey="rate"
          name="Completion"
          fill={ACCENT}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
