"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyTrendPoint } from "@/type/dashboard";
import { formatWithCommas } from "@/lib/utils";

interface RevenueTrendChartProps {
  data: MonthlyTrendPoint[];
}

/** 만원 단위로 줄여야 축 라벨이 겹치지 않는다. */
const toManwon = (value: number) => Math.round(value / 10_000);

/**
 * 월별 매출 · 인건비 추이.
 *
 * 두 막대의 간격이 곧 마진이다. 간격이 좁아지는 달이 보이면
 * 그 달의 거래처 단가를 다시 볼 신호다.
 */
const RevenueTrendChart = ({ data }: RevenueTrendChartProps) => {
  const chartData = data.map((point) => ({
    month: point.month.slice(5) + "월",
    매출: toManwon(point.revenue),
    인건비: toManwon(point.laborCost),
    마진: toManwon(point.revenue - point.laborCost),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={false}
        />
        <XAxis
          dataKey="month"
          tick={{ fill: "var(--font-2)", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <YAxis
          tick={{ fill: "var(--font-2)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(value: number) => `${formatWithCommas(value)}만`}
        />
        <Tooltip
          formatter={(value, name) => [
            `${formatWithCommas(Number(value))}만원`,
            String(name),
          ]}
          contentStyle={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            fontSize: 13,
            color: "var(--font-1)",
          }}
          cursor={{ fill: "var(--bg-surface-hover)" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "var(--font-2)" }}
          iconType="circle"
        />
        <Bar dataKey="매출" fill="var(--brand)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="인건비" fill="var(--border-strong)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="마진" fill="var(--success)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default RevenueTrendChart;
