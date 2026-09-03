// Lista fixa dos métodos de pagamento aceites ao liquidar um serviço já
// faturado — mesmo `check` em `services.faturacao_metodo_pagamento`
// (supabase/schema.sql). Usada tanto pelo <select> em PainelFaturacao.tsx
// como pela validação server-side em marcarLiquidado() (app/admin/
// faturacao/actions.ts), mesmo padrão de lib/pedido-opcoes.ts.
export const METODOS_PAGAMENTO: string[] = [
  "Numerário",
  "Transferência Bancária",
  "Multibanco",
  "Cheque",
];
