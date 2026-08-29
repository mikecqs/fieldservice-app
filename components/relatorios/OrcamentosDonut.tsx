"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export function OrcamentosDonut({ aceites, recusados, pendentes }: { aceites: number; recusados: number; pendentes: number }) {
  const dados = [
    { name: "Aceites", value: aceites, color: "#34d399" },
    { name: "Recusados", value: recusados, color: "#f87171" },
    { name: "Pendentes", value: pendentes, color: "#a3a3a3" },
  ].filter((d) => d.value > 0);

  if (dados.length === 0) {
    return <p className="flex h-40 items-center justify-center text-sm text-neutral-500">Sem orçamentos no período.</p>;
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={dados} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none">
              {dados.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#e5e5e5" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1.5 text-sm">
        {dados.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-neutral-300">{d.name}</span>
            <span className="font-medium text-neutral-100">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
