"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatCompactMoney, formatMoney } from "@/lib/format";

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Dòng tooltip hiển thị tiền thay vì số trần */
function moneyRow(value: unknown, name: unknown, item: { color?: string; payload?: { fill?: string } }, config: ChartConfig) {
  const key = String(name);
  return (
    <div className="flex w-full items-center gap-2">
      <span className="size-2 shrink-0 rounded-[2px]" style={{ background: item.color ?? item.payload?.fill }} />
      <span className="text-muted-foreground">{config[key]?.label ?? key}</span>
      <span className="ml-auto font-medium text-foreground tabular">{formatMoney(Number(value))}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Doanh thu theo ngày, chồng theo cơ sở
// ---------------------------------------------------------------------------

export type RevenuePoint = { date: string } & Record<string, number | string>;

const RANGES = { "7": "7 ngày", "30": "30 ngày", "90": "90 ngày" } as const;

export function RevenueChart({
  data,
  series,
  className,
}: {
  data: RevenuePoint[];
  series: { key: string; label: string }[];
  className?: string;
}) {
  const [range, setRange] = useState<keyof typeof RANGES>("30");
  const config = useMemo<ChartConfig>(
    () => Object.fromEntries(series.map((s, i) => [s.key, { label: s.label, color: PALETTE[i % PALETTE.length] }])),
    [series],
  );
  const visible = data.slice(-Number(range));
  const total = visible.reduce((sum, p) => sum + series.reduce((s, x) => s + Number(p[x.key] ?? 0), 0), 0);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Doanh thu</CardTitle>
        <CardDescription>
          <span className="font-medium text-foreground tabular">{formatMoney(total)}</span> trong {RANGES[range]} qua,
          tính tiền đã thu trừ tiền hoàn
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={range}
            onValueChange={(v) => v && setRange(v as keyof typeof RANGES)}
          >
            {Object.entries(RANGES).map(([key, label]) => (
              <ToggleGroupItem key={key} value={key} className="px-2.5 text-xs">
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <AreaChart data={visible} margin={{ left: 4, right: 8, top: 8 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={`var(--color-${s.key})`} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={`var(--color-${s.key})`} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={28}
              tickFormatter={shortDate}
            />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => formatCompactMoney(Number(v))} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(label) => shortDate(String(label))}
                  formatter={(value, name, item) => moneyRow(value, name, item, config)}
                />
              }
            />
            {series.map((s) => (
              <Area
                key={s.key}
                dataKey={s.key}
                type="monotone"
                stackId="revenue"
                stroke={`var(--color-${s.key})`}
                strokeWidth={2}
                fill={`url(#fill-${s.key})`}
              />
            ))}
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Biểu đồ tròn (nguồn đơn, hình thức thanh toán)
// ---------------------------------------------------------------------------

export function DonutChart({
  title,
  description,
  data,
  money,
  centerLabel,
  className,
}: {
  title: string;
  description?: string;
  data: { key: string; label: string; value: number }[];
  money?: boolean;
  centerLabel: string;
  className?: string;
}) {
  const config = Object.fromEntries(
    data.map((d, i) => [d.key, { label: d.label, color: PALETTE[i % PALETTE.length] }]),
  ) satisfies ChartConfig;
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ChartContainer config={config} className="mx-auto aspect-square h-44">
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  nameKey="key"
                  formatter={money ? (value, name, item) => moneyRow(value, name, item, config) : undefined}
                />
              }
            />
            <Pie data={data} dataKey="value" nameKey="key" innerRadius={52} outerRadius={76} strokeWidth={3} paddingAngle={2}>
              {data.map((d) => (
                <Cell key={d.key} fill={`var(--color-${d.key})`} />
              ))}
              <Label
                content={({ viewBox }) =>
                  viewBox && "cx" in viewBox ? (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-xl font-semibold">
                        {money ? formatCompactMoney(total) : total}
                      </tspan>
                      <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                        {centerLabel}
                      </tspan>
                    </text>
                  ) : null
                }
              />
            </Pie>
          </PieChart>
        </ChartContainer>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {data.map((d) => (
            <li key={d.key} className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-[2px]" style={{ background: `var(--color-${d.key})` }} />
              <span className="truncate text-muted-foreground">{d.label}</span>
              <span className="ml-auto font-medium tabular">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function SourceChart({
  data,
  description,
  className,
}: {
  data: { key: string; label: string; count: number }[];
  description: string;
  className?: string;
}) {
  return (
    <DonutChart
      title="Khách đặt qua"
      description={description}
      centerLabel="đơn"
      className={className}
      data={data.map((d) => ({ key: d.key, label: d.label, value: d.count }))}
    />
  );
}

// ---------------------------------------------------------------------------
// Cột chồng theo cơ sở (trang doanh thu)
// ---------------------------------------------------------------------------

export function StackedBarChart({
  title,
  description,
  data,
  series,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  data: ({ label: string } & Record<string, number | string>)[];
  series: { key: string; label: string }[];
  className?: string;
}) {
  const config = useMemo<ChartConfig>(
    () => Object.fromEntries(series.map((s, i) => [s.key, { label: s.label, color: PALETTE[i % PALETTE.length] }])),
    [series],
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        <ChartContainer config={config} className="aspect-auto h-72 w-full">
          <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => formatCompactMoney(Number(v))} />
            <ChartTooltip
              cursor={{ fill: "var(--color-muted)" }}
              content={<ChartTooltipContent formatter={(value, name, item) => moneyRow(value, name, item, config)} />}
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="a"
                fill={`var(--color-${s.key})`}
                radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                maxBarSize={36}
              />
            ))}
            {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Lượt thuê theo tháng (trang mẫu váy, khách hàng)
// ---------------------------------------------------------------------------

export function MonthlyBarChart({
  data,
  title,
  description,
  valueLabel,
  money,
  className,
}: {
  data: { month: string; value: number }[];
  title: string;
  description?: string;
  valueLabel: string;
  money?: boolean;
  className?: string;
}) {
  const config = { value: { label: valueLabel, color: "var(--chart-1)" } } satisfies ChartConfig;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        <ChartContainer config={config} className="aspect-auto h-52 w-full">
          <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={money ? 44 : 28}
              allowDecimals={false}
              tickFormatter={(v) => (money ? formatCompactMoney(Number(v)) : String(v))}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideIndicator
                  formatter={money ? (value, name, item) => moneyRow(value, name, item, config) : undefined}
                />
              }
            />
            <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 2, 2]} maxBarSize={40} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
