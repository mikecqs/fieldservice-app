"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Ponto = { dia: string; servicos: number; faturacao: number; orcamentos: number };

const METRICAS = [
  { key: "servicos", label: "Serviços" },
  { key: "faturacao", label: "Faturação" },
  { key: "orcamentos", label: "Orçamentos" },
] as const;

export function EvolucaoChart({ dados }: { dados: Ponto[] }) {
  const [metrica, setMetrica] = useState<(typeof METRICAS)[number]["key"]>("servicos");

  const formatarData = (iso: unknown) => {
    const d = new Date(`${String(iso)}T00:00:00`);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <div>
      <div className="mb-3 flex overflow-hidden rounded-md border border-neutral-700 text-xs w-fit">
        {METRICAS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetrica(m.key)}
            className={`px-3 py-1.5 ${metrica === m.key ? "bg-white text-neutral-950" : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="#262626" vertical={false} />
            <XAxis dataKey="dia" tickFormatter={formatarData} stroke="#737373" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#737373" fontSize={11} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              labelFormatter={formatarData}
              contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#e5e5e5" }}
            />
            <Line type="monotone" dataKey={metrica} stroke="#ffffff" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
