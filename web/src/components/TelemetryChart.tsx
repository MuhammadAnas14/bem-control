import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TelemetryReading } from '@bem-control/api-client';

const METRIC_COLORS: Record<string, string> = {
  temperature: '#e07a3f',
  humidity: '#2f7d63',
};

const FALLBACK_COLORS = ['#5b6ee1', '#c2452e', '#8a5cd6'];

export function TelemetryChart({ readings }: { readings: TelemetryReading[] }) {
  const { data, metrics } = useMemo(() => {
    const metricSet = new Set<string>();
    const byTimestamp = new Map<string, Record<string, number | string>>();

    // Readings arrive newest-first from the API; chart left-to-right in time.
    for (const reading of [...readings].reverse()) {
      metricSet.add(reading.metric);
      const key = reading.recordedAt;
      const row = byTimestamp.get(key) ?? { recordedAt: key };
      row[reading.metric] = reading.value;
      byTimestamp.set(key, row);
    }

    return { data: Array.from(byTimestamp.values()), metrics: Array.from(metricSet) };
  }, [readings]);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-300 text-sm text-gray-400">
        No telemetry yet - waiting for the device to publish its first reading.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="recordedAt"
          tickFormatter={(value: string) => new Date(value).toLocaleTimeString()}
          minTickGap={40}
          tick={{ fontSize: 12 }}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip labelFormatter={(value) => new Date(value as string).toLocaleString()} />
        <Legend />
        {metrics.map((metric, i) => (
          <Line
            key={metric}
            type="monotone"
            dataKey={metric}
            stroke={METRIC_COLORS[metric] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
