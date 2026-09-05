import type { createClient } from "@/lib/supabase/server";

type SessionClient = Awaited<ReturnType<typeof createClient>>;

// Finding 1 (auditoria de segurança) — as policies de RLS desta app só
// validam que a PRÓPRIA linha pertence à organização de quem escreve
// (`with check (organization_id = my_org())`); nunca validam a organização
// de uma FK que essa linha referencia (client_id, address_id,
// equipment_id...). Sem este check explícito, um ADMIN de uma empresa
// conseguia gravar, por exemplo, um Pedido/Orçamento/Equipamento na PRÓPRIA
// organização mas apontando client_id/address_id para um cliente de OUTRA
// empresa — o FK do Postgres só exige que a linha exista em `clients`,
// nunca que pertença à mesma organização.
//
// Usa sempre o cliente de sessão (nunca createAdminClient()): é a mesma
// RLS de leitura já confiada em todo o resto da app, e usar o cliente admin
// aqui obrigaria a repetir à mão o filtro que a RLS já garante — um erro
// nessa repetição reabriria exatamente o buraco que esta função fecha.
// Tabelas onde já se confirmou o mesmo padrão de coluna organization_id —
// lista fechada de propósito (nunca um nome de tabela vindo de fora), para
// esta função nunca ser chamada por engano contra uma tabela sem essa
// coluna ou sem RLS por organização.
type TabelaOrgScoped =
  | "clients"
  | "client_addresses"
  | "client_equipment"
  | "services"
  | "budgets"
  | "requests"
  | "purchases";

export async function pertenceAOrg(
  supabase: SessionClient,
  tabela: TabelaOrgScoped,
  id: string,
  organizationId: string
): Promise<boolean> {
  if (!id) return false;
  const { data } = await supabase.from(tabela).select("id").eq("id", id).eq("organization_id", organizationId).maybeSingle();
  return !!data;
}

// Mesmo objetivo, mas já lança o erro com a mensagem indicada — usar
// diretamente nas Server Actions em vez de repetir o `if (!ok) throw` em
// cada uma.
export async function assertPertenceAOrg(
  supabase: SessionClient,
  tabela: TabelaOrgScoped,
  id: string,
  organizationId: string,
  mensagem: string
): Promise<void> {
  if (!(await pertenceAOrg(supabase, tabela, id, organizationId))) {
    throw new Error(mensagem);
  }
}

// Caso próprio de profiles: não chega pertencer à organização, tem de ser
// mesmo um Técnico — mesmo filtro já usado em todos os <select> de técnico
// da app (ex: app/admin/orcamentos/[id]/page.tsx). Sem isto, atribuir um
// serviço a um `user_id` bastava pertencer à organização, podendo ser um
// FINANCE/ATENDIMENTO ou até outro ADMIN.
export async function assertTecnicoPertenceOrg(
  supabase: SessionClient,
  tecnicoId: string,
  organizationId: string,
  mensagem = "Técnico inválido."
): Promise<void> {
  if (!tecnicoId) throw new Error(mensagem);
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", tecnicoId)
    .eq("organization_id", organizationId)
    .eq("role", "TECHNICIAN")
    .maybeSingle();
  if (!data) throw new Error(mensagem);
}

// Caso mais comum: confirma que uma morada pertence ao MESMO cliente E à
// mesma organização — nunca só uma das duas condições (um address_id podia
// pertencer a um cliente da própria empresa mas ser de outro cliente, ou
// pertencer ao client_id certo mas ter ficado associado à organização
// errada por um bug anterior).
export async function assertMoradaPertenceCliente(
  supabase: SessionClient,
  addressId: string,
  clientId: string,
  organizationId: string,
  mensagem = "A morada selecionada não pertence ao cliente selecionado."
): Promise<void> {
  const { data } = await supabase
    .from("client_addresses")
    .select("id")
    .eq("id", addressId)
    .eq("client_id", clientId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) throw new Error(mensagem);
}
