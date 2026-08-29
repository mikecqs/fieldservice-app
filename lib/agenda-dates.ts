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

// Hora local "HH:MM:SS" — usada para comparar com colunas `time` (ex:
// services.hora_agendada) ao calcular atrasos. Centralizado aqui para nunca
// se misturar com toISOString() (UTC) nalgum módulo que trate de "agora".
export function nowTimeHHMMSS(d: Date = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Início do dia LOCAL de `d`, devolvido como instante UTC (ISO) — é o que
// permite comparar corretamente contra colunas `timestamptz` (ex:
// service_events.created_at) sem misturar fuso horário: `toISO()` sozinho
// dá a data certa para colunas `date`, mas uma string "AAAA-MM-DD" só, para
// uma coluna timestamptz, seria interpretada à meia-noite UTC, não à meia-
// noite local.
export function startOfLocalDayUTC(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

export const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
