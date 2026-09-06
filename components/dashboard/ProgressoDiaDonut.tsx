"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export function ProgressoDiaDonut({
  concluidos,
  pendentes,
  cancelados,
  pct,
}: {
  concluidos: number;
  pendentes: number;
  cancelados: number;
  pct: number;
}) {
  const dados = [
    { name: "Concluídos", value: concluidos, color: "#34d399" },
    { name: "Por realizar", value: pendentes, color: "#f59e0b" },
    { name: "Cancelados", value: cancelados, color: "#525252" },
  ].filter((d) => d.value > 0);

  if (dados.length === 0) {
    return <p className="flex h-32 items-center justify-center text-sm text-neutral-500">Sem serviços planeados para hoje.</p>;
  }

  return (
    <div className="relative h-32 w-32 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={dados} dataKey="value" nameKey="name" innerRadius={40} outerRadius={58} paddingAngle={2} stroke="none">
            {dados.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#e5e5e5" }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-white">{pct}%</span>
      </div>
    </div>
  );
}
