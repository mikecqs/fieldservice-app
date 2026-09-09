"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function DashboardChart({
  dados,
}: {
  dados: { mes: string; criados: number; aceites: number }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
          <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#a3a3a3" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#a3a3a3" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ backgroundColor: "#171717", border: "1px solid #262626", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#ffffff" }}
            itemStyle={{ color: "#a3a3a3" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#a3a3a3" }} />
          <Bar dataKey="criados" name="Criados" fill="#404040" radius={[4, 4, 0, 0]} />
          <Bar dataKey="aceites" name="Aceites" fill="#ffffff" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
