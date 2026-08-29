"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Tipo = { tipo: string; quantidade: number };

export function TiposServicoChart({ dados }: { dados: Tipo[] }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="#262626" vertical={false} />
          <XAxis dataKey="tipo" stroke="#737373" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#737373" fontSize={11} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#e5e5e5" }}
            cursor={{ fill: "#262626" }}
          />
          <Bar dataKey="quantidade" fill="#ffffff" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
