import type { Metadata } from "next";
import { LegalHeader } from "@/components/tareo/LegalHeader";
import { TareoFooter } from "@/components/tareo/TareoFooter";

// Página institucional partilhada entre a Tareo e o Serv (ver CLAUDE.md
// secção 12) — acessível a partir de tareo.pt e de serv.tareo.pt sem
// sessão. Conteúdo escrito para refletir com honestidade o que a app faz
// hoje (ver supabase/schema.sql); os campos de identidade legal (entidade,
// NIF, morada) ficam marcados como pendentes em vez de inventados — ver
// CLAUDE.md secção 10/11. NÃO é aconselhamento jurídico.
export const metadata: Metadata = {
  title: "Política de Privacidade — Tareo",
  description: "Como a Tareo e o Serv tratam os dados pessoais.",
  manifest: undefined,
  robots: { index: false, follow: false, nocache: true },
};

function Seccao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight text-white">{titulo}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function PrivacidadePage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-base text-white">
      <LegalHeader />
      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <span className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Legal
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Política de Privacidade
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Última atualização: setembro de 2026</p>

          <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-200">
            <strong className="text-amber-100">Documento em preparação.</strong> Este texto
            descreve com honestidade o que a Tareo e o Serv fazem hoje, mas ainda não foi
            revisto por um advogado e alguns dados de identificação da entidade responsável
            ainda não estão definidos (assinalados abaixo). Não deve ser considerado uma
            política definitiva nem aconselhamento jurídico.
          </div>

          <Seccao titulo="1. Quem somos">
            <p>
              A Tareo é a empresa que desenvolve produtos digitais para empresas, entre eles o
              <strong className="text-neutral-200"> Serv</strong>, uma plataforma de gestão de
              serviços técnicos no terreno (clientes, pedidos, agenda, orçamentos, faturação).
            </p>
            <p>
              <strong className="text-neutral-200">Entidade responsável pelo tratamento:</strong>{" "}
              <span className="text-amber-300">[nome legal, NIF e morada da entidade — a
              definir]</span>. Enquanto este campo não estiver preenchido, qualquer questão
              sobre os teus dados pode ser colocada através da página de{" "}
              <a href="/contacto" className="underline hover:text-white">Contacto</a>.
            </p>
          </Seccao>

          <Seccao titulo="2. Que dados tratamos">
            <p>
              O Serv é usado por empresas ("clientes Serv") para gerir a sua própria operação.
              Isso significa dois papéis diferentes:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-neutral-200">Dados de quem usa o Serv</strong> (Admin,
                Técnico, Financeiro, Atendimento): nome, email e password (autenticação via
                Supabase Auth), role/permissões, empresa a que pertence.
              </li>
              <li>
                <strong className="text-neutral-200">Dados inseridos pela empresa cliente</strong>{" "}
                sobre os seus próprios clientes finais: nome, telefone, moradas, equipamentos,
                orçamentos, faturação, fotos e materiais registados nas visitas técnicas. Estes
                dados são inseridos e geridos pela empresa cliente — a Tareo atua aqui como
                processador/subcontratante, nunca como responsável por esses dados.
              </li>
              <li>
                <strong className="text-neutral-200">Notificações push</strong> (opcional, só
                Técnico): identificador de subscrição do browser, usado apenas para avisos de
                atraso de agenda.
              </li>
              <li>
                <strong className="text-neutral-200">Integração Google Sheets</strong> (opcional,
                ativada pela própria empresa cliente): exporta os dados operacionais dessa
                empresa para uma folha de cálculo Google própria dela, via OAuth com o âmbito
                mínimo necessário (só `spreadsheets`, nunca acesso geral ao Google Drive).
              </li>
            </ul>
          </Seccao>

          <Seccao titulo="3. Cookies">
            <p>
              Usamos apenas um cookie de sessão, estritamente necessário para manter a sessão
              iniciada (gerido pela Supabase Auth). Não usamos cookies de publicidade, nem
              ferramentas de analítica ou rastreio de terceiros.
            </p>
          </Seccao>

          <Seccao titulo="4. Finalidade e fundamento legal">
            <p>
              Tratamos estes dados para prestar o serviço contratado (execução de contrato) e
              para cumprir obrigações legais aplicáveis, nomeadamente em matéria de faturação.
            </p>
          </Seccao>

          <Seccao titulo="5. Partilha de dados e subcontratantes">
            <p>
              Recorremos aos seguintes fornecedores para operar o serviço, todos sujeitos a
              obrigações de confidencialidade e segurança:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li><strong className="text-neutral-200">Supabase</strong> — base de dados, autenticação e armazenamento de ficheiros.</li>
              <li><strong className="text-neutral-200">Vercel</strong> — alojamento da aplicação.</li>
              <li><strong className="text-neutral-200">Google</strong> — apenas se e quando uma empresa cliente ativar voluntariamente a integração com Google Sheets.</li>
            </ul>
            <p>
              Não vendemos nem partilhamos dados pessoais com terceiros para fins de marketing.
            </p>
          </Seccao>

          <Seccao titulo="6. Transferências internacionais">
            <p>
              Os nossos fornecedores de alojamento e processamento podem envolver
              infraestrutura fora do Espaço Económico Europeu. Quando isso acontecer, exigimos
              que estejam em vigor as salvaguardas adequadas previstas no RGPD.
            </p>
          </Seccao>

          <Seccao titulo="7. Retenção">
            <p>
              Mantemos os dados enquanto a conta/empresa estiver ativa, e depois disso pelo
              período exigido por lei (por exemplo, obrigações fiscais de faturação). Prazos
              exatos por tipo de dado ainda estão a ser definidos.
            </p>
          </Seccao>

          <Seccao titulo="8. Os teus direitos">
            <p>
              Nos termos do RGPD, tens direito a aceder, retificar, apagar, limitar ou opor-te
              ao tratamento dos teus dados, e à portabilidade dos mesmos. Podes também
              apresentar reclamação junto da Comissão Nacional de Proteção de Dados (CNPD).
              Se és cliente final de uma empresa que usa o Serv (não um utilizador direto da
              app), o pedido deve ser feito primeiro a essa empresa, responsável pelos teus
              dados.
            </p>
            <p>
              Para exercer estes direitos junto da Tareo, usa a página de{" "}
              <a href="/contacto" className="underline hover:text-white">Contacto</a>.
            </p>
          </Seccao>

          <Seccao titulo="9. Alterações a esta política">
            <p>
              Podemos atualizar este documento à medida que a Tareo e os seus produtos
              evoluem. A data no topo desta página indica a última atualização.
            </p>
          </Seccao>
        </div>
      </main>
      <TareoFooter />
    </div>
  );
}
