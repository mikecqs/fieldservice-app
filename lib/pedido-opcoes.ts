// Onda 3 (Etapa 11) — fonte única para as duas listas fixas do Pedido, que
// viviam duplicadas em vários ficheiros (mesmo padrão de lib/mao-obra.ts,
// Onda 2). Valores inalterados — isto é só um refactor de organização,
// nunca uma mudança de comportamento.
//
// TIPOS_SERVICO também é usado pelo popup da Agenda (ServicoModal.tsx) ao
// criar um serviço novo diretamente — é a mesma lista conceptual de tipos,
// só usada em dois contextos (Pedido e Serviço).
//
// ORIGENS_PEDIDO tem também um `check` equivalente em `requests.origem`
// (supabase/schema.sql) — essa parte do schema não foi tocada nesta etapa;
// esta constante só evita que a validação em criarPedido() (app/admin/
// pedidos/actions.ts) e os <select> da UI tivessem cada um a sua própria
// cópia, que podiam divergir em silêncio (criarPedido() rejeita uma origem
// fora da lista sem mostrar erro nenhum).
// Sem `as const` de propósito: NovoPedidoForm espera `string[]` (mutável) e
// ORIGENS_VALIDAS.includes(origem) compara contra um `origem: string` —
// mantém-se exatamente o mesmo tipo (string[]) que as declarações locais
// já tinham, sem precisar de alterar nenhuma assinatura nos consumidores.
export const TIPOS_SERVICO: string[] = ["Agendamento", "Orçamento", "Manutenção", "Instalação"];

export const ORIGENS_PEDIDO: string[] = ["Telefone", "Loja", "Email", "Outro"];
