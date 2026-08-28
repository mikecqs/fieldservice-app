function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Segunda-feira da semana que contém `d`.
export function mondayOf(d: Date) {
  const diaSemana = d.getDay() === 0 ? 7 : d.getDay();
  return addDays(d, -(diaSemana - 1));
}

// Grelha de mês: começa na segunda da semana do dia 1, termina no domingo da
// semana do último dia — sempre um múltiplo de 7 dias, como um calendário a sério.
export function monthGridRange(d: Date) {
  const inicioMes = new Date(d.getFullYear(), d.getMonth(), 1);
  const fimMes = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { desde: mondayOf(inicioMes), ate: addDays(mondayOf(addDays(fimMes, 7)), -1) };
}

export const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
