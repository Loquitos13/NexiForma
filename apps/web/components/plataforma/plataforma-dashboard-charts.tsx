"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#a78bfa", "#34d399", "#60a5fa", "#fbbf24", "#f87171", "#2dd4bf", "#c084fc"];

const tooltipStyle = {
  contentStyle: {
    background: "rgba(12, 10, 20, 0.95)",
    border: "1px solid rgba(168, 85, 247, 0.25)",
    borderRadius: "8px",
    fontSize: "12px",
  },
  labelStyle: { color: "#94a3b8" },
};

function ChartShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`nexiforma-chart h-56 w-full select-none outline-none sm:h-64 [&_.recharts-surface]:outline-none ${className ?? ""}`}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}

export function Access24hChart({
  data,
}: {
  data: { hour: string; acessos: number; tenant: number; platform: number }[];
}) {
  return (
    <ChartShell>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="tenantGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="platformGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
          <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 10 }} interval={3} />
          <YAxis tick={{ fill: "#64748b", fontSize: 10 }} allowDecimals={false} width={28} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} />
          <Area
            type="monotone"
            dataKey="tenant"
            name="Tenant"
            stroke="#a78bfa"
            fill="url(#tenantGrad)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="platform"
            name="Plataforma"
            stroke="#34d399"
            fill="url(#platformGrad)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function StatusBarChart({
  data,
  labelKey,
  valueKey = "value",
}: {
  data: { [key: string]: string | number }[];
  labelKey: string;
  valueKey?: string;
}) {
  return (
    <ChartShell className="h-52 sm:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
          <XAxis dataKey={labelKey} tick={{ fill: "#64748b", fontSize: 10 }} />
          <YAxis tick={{ fill: "#64748b", fontSize: 10 }} allowDecimals={false} width={28} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey={valueKey} name="Total" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function StatusPieChart({
  data,
  labelKey,
  valueKey = "value",
}: {
  data: { [key: string]: string | number }[];
  labelKey: string;
  valueKey?: string;
}) {
  return (
    <ChartShell className="h-52 sm:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={labelKey}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={72}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function CrmStackedBar({
  data,
}: {
  data: { nome: string; leads: number; propostas: number; faturas: number }[];
}) {
  const top = data.slice(0, 8);
  return (
    <ChartShell className="h-64 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" horizontal={false} />
          <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="nome"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            width={88}
            tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 12)}…` : v)}
          />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} />
          <Bar dataKey="leads" name="Leads" stackId="crm" fill="#a78bfa" radius={[0, 0, 0, 0]} />
          <Bar dataKey="propostas" name="Propostas" stackId="crm" fill="#60a5fa" />
          <Bar dataKey="faturas" name="Faturas" stackId="crm" fill="#34d399" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
