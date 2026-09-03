// Estrutura fixa do Google Sheet criado para cada empresa. A ordem desta
// lista é a ordem das folhas no ficheiro.
export const SHEET_NAMES = [
  "Dashboard",
  "Clientes",
  "Pedidos",
  "Orçamentos",
  "Agendamentos",
  "Serviços",
  "Visitas",
  "Materiais",
  "Faturação",
  "Técnicos",
  "Histórico",
  "Estatísticas",
] as const;

export type SheetName = (typeof SHEET_NAMES)[number];

export type DataSheetName = Exclude<SheetName, "Dashboard" | "Estatísticas">;

export const HEADERS: Record<DataSheetName, string[]> = {
  Clientes: ["ID", "Nome", "Empresa", "NIF", "Telefone", "Email", "Morada(s)", "Criado em", "Eliminado"],
  Pedidos: ["ID", "Cliente", "Tipo", "Descrição", "Origem", "Estado", "Info em falta", "Criado em"],
  Orçamentos: ["ID", "Nº", "Cliente", "Pedido (ID)", "Estado", "Criado em", "Enviado em", "Follow-up em", "IVA %", "Valor total"],
  Agendamentos: ["ID (Serviço)", "Cliente", "Tipo", "Técnico(s)", "Data", "Hora início", "Hora fim", "Estado", "Prioridade"],
  Serviços: [
    "ID", "Cliente", "Tipo", "Descrição", "Estado", "Prioridade", "Técnico(s)", "Data", "Hora início", "Hora fim",
    "Valor", "Estado faturação", "Pedido (ID)", "Orçamento (ID)", "Criado em",
  ],
  Visitas: [
    "ID", "Serviço (ID)", "Cliente", "Data", "Hora início real", "Hora fim real", "Resultado", "Trabalho realizado",
    "Mão de obra", "Valor calculado", "Técnico",
  ],
  Materiais: ["ID", "Tipo", "Serviço (ID)", "Visita (ID)", "Cliente", "Nome", "Quantidade", "Preço unitário", "Valor", "Eliminado"],
  Faturação: [
    "Serviço (ID)", "Cliente", "Estado faturação", "Valor faturado", "Data faturação", "Referência",
    "Método de pagamento", "Data liquidação",
  ],
  Técnicos: ["ID", "Nome", "Email", "Eliminado"],
  Histórico: ["ID", "Data/Hora", "Entidade", "Entidade (ID)", "Evento", "Descrição", "Utilizador"],
};

// entity_type (da fila de sincronização) → folha(s) onde tem linha própria.
// "service" escreve em três folhas a partir da mesma leitura. Usado tanto
// para saber onde procurar a linha a marcar "Eliminado", como (via rows.ts)
// para saber quantas linhas produzir por upsert.
export const ENTITY_SHEETS: Record<string, DataSheetName[]> = {
  client: ["Clientes"],
  request: ["Pedidos"],
  budget: ["Orçamentos"],
  service: ["Agendamentos", "Serviços", "Faturação"],
  visit: ["Visitas"],
  material_planned: ["Materiais"],
  material_used: ["Materiais"],
  technician: ["Técnicos"],
};
