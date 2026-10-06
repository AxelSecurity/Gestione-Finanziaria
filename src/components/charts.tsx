"use client";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const eur = (v: number) => (v / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function DonutChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
          {data.map((d) => <Cell key={d.name} fill={d.color} />)}
        </Pie>
        <Tooltip formatter={(v) => eur(Number(v))} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MonthlyBars({ data }: { data: { label: string; income: number; expense: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={(v) => eur(v)} width={70} />
        <Tooltip formatter={(v) => eur(Number(v))} />
        <Legend />
        <Bar isAnimationActive={false} dataKey="income" name="Entrate" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar isAnimationActive={false} dataKey="expense" name="Uscite" fill="#f43f5e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function NetWorthLine({ data }: { data: { label: string; net: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={(v) => eur(v)} width={80} />
        <Tooltip formatter={(v) => eur(Number(v))} />
        <Line isAnimationActive={false} type="monotone" dataKey="net" name="Patrimonio netto" stroke="#10b981" strokeWidth={2} dot />
      </LineChart>
    </ResponsiveContainer>
  );
}
