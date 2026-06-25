import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Area,
  Line,
  ComposedChart,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import type { CostStructureSlice, CustomerEfficiencyPoint, RevenueMarginPoint } from "./executiveReportTypes";
import { formatEtbCompact } from "./executiveReportData";

const tooltipStyle = {
  backgroundColor: "rgba(15, 23, 42, 0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#e2e8f0",
  fontSize: 12,
};

const axisTick = { fill: "#64748b", fontSize: 11 };

export function CostStructureChart({ data }: { data: CostStructureSlice[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-12 text-center">No cost data in range.</p>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={96}
            paddingAngle={2}
            stroke="transparent"
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [
              `${formatEtbCompact(value)} ETB (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
              "",
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-3 -mt-2">
        {data.map((d) => (
          <span key={d.key} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CostStructureStackedBar({ data }: { data: CostStructureSlice[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-12 text-center">No cost data in range.</p>
    );
  }

  const row = data.reduce(
    (acc, slice) => ({ ...acc, [slice.key]: slice.value }),
    { name: "Total" } as Record<string, number | string>,
  );

  return (
    <div className="h-[120px] mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[row]} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
          {data.map((slice) => (
            <Bar
              key={slice.key}
              dataKey={slice.key}
              stackId="cost"
              fill={slice.color}
              radius={[4, 4, 4, 4]}
            />
          ))}
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip contentStyle={tooltipStyle} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RevenueMarginChart({ data }: { data: RevenueMarginPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-12 text-center">No revenue trajectory in range.</p>
    );
  }

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="left"
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatEtbCompact(Number(v))}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            domain={[0, "auto"]}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="revenueEtb"
            name="Revenue (ETB)"
            stroke="#22d3ee"
            fill="url(#revenueFill)"
            strokeWidth={2}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="marginPct"
            name="Margin %"
            stroke="#a78bfa"
            strokeWidth={2}
            dot={{ r: 3, fill: "#a78bfa" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CustomerEfficiencyChart({ data }: { data: CustomerEfficiencyPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-12 text-center">No customer efficiency data.</p>
    );
  }

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            type="number"
            dataKey="volumeKg"
            name="Volume"
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
          />
          <YAxis
            type="number"
            dataKey="marginPct"
            name="Margin %"
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            unit="%"
          />
          <ZAxis type="number" dataKey="revenueEtb" range={[80, 400]} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ strokeDasharray: "3 3", stroke: "#334155" }}
            formatter={(value: number, name: string) => {
              if (name === "Volume") return [`${Number(value).toLocaleString()} kg`, name];
              if (name === "Margin %") return [`${Number(value).toFixed(1)}%`, name];
              return [formatEtbCompact(Number(value)) + " ETB", name];
            }}
            labelFormatter={(_, payload) =>
              (payload?.[0]?.payload as CustomerEfficiencyPoint | undefined)?.name ?? ""
            }
          />
          <Scatter data={data} fill="#34d399" fillOpacity={0.75} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
