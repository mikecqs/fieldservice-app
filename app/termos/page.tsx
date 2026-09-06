import type { Metadata } from "next";
import { LegalHeader } from "@/components/tareo/LegalHeader";
import { TareoFooter } from "@/components/tareo/TareoFooter";

// Página institucional partilhada entre a Tareo e o Serv (ver CLAUDE.md
// secção 12) — acessível a partir de tareo.pt e de serv.tareo.pt sem
// sessão. Mesmo aviso de rascunho/placeholders que app/privacidade —
// NÃO é aconselhamento jurídico.
export const metadata: Metadata = {
  title: "Termos de Utilização — Tareo",
  description: "Condições de utilização dos produtos da Tareo, incluindo o Serv.",
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

export default function TermosPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-base text-white">
      <LegalHeader />
      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <span className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Legal
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Termos de Utilização
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Última atualização: setembro de 2026</p>

          <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-200">
            <strong className="text-amber-100">Documento em preparação.</strong> Este texto
            ainda não foi revisto por um advogado e alguns dados de identificação da entidade
            responsável ainda não estão definidos (assinalados abaixo). Não deve ser
            considerado uma versão definitiva.
          </div>

          <Seccao titulo="1. Aceitação">
            <p>
              Estes termos regem a utilização dos produtos da Tareo, incluindo o{" "}
              <strong className="text-neutral-200">Serv</strong>. Ao criar ou utilizar uma
              conta, aceitas estes termos e a nossa{" "}
              <a href="/privacidade" className="underline hover:text-white">Política de Privacidade</a>.
            </p>
          </Seccao>

          <Seccao titulo="2. Quem presta o serviço">
            <p>
              <strong className="text-neutral-200">Entidade responsável:</strong>{" "}
              <span className="text-amber-300">[nome legal, NIF e morada da entidade — a
              definir]</span>.
            </p>
          </Seccao>

          <Seccao titulo="3. Contas e responsabilidade">
            <p>
              Cada empresa cliente é responsável por manter as suas credenciais de acesso em
              segurança e por toda a atividade realizada através dos utilizadores que criar
              (Admin, Técnico, Financeiro, Atendimento). A empresa cliente é também responsável
              pela exatidão e licitude dos dados dos seus próprios clientes finais que insere
              no Serv.
            </p>
          </Seccao>

          <Seccao titulo="4. Utilização aceitável">
            <p>
              O serviço destina-se a uso profissional legítimo de gestão operacional. Não é
              permitido usar o Serv para armazenar ou processar dados que a empresa cliente não
              esteja legalmente autorizada a tratar, nem tentar contornar as permissões e
              isolamento entre empresas da plataforma.
            </p>
          </Seccao>

          <Seccao titulo="5. Disponibilidade do serviço">
            <p>
              Fazemos esforços razoáveis para manter o serviço disponível e a funcionar
              corretamente, mas não garantimos disponibilidade contínua e ininterrupta. Podem
              ocorrer interrupções para manutenção, correções ou atualizações.
            </p>
          </Seccao>

          <Seccao titulo="6. Preços e faturação">
            <p>
              As condições comerciais (preços, planos, faturação) são acordadas
              separadamente com cada empresa cliente e ainda estão a ser definidas de forma
              geral para este produto.
            </p>
          </Seccao>

          <Seccao titulo="7. Propriedade intelectual">
            <p>
              O software, design e marca do Serv e da Tareo pertencem à Tareo. A empresa
              cliente mantém a titularidade de todos os dados que insere na plataforma.
            </p>
          </Seccao>

          <Seccao titulo="8. Limitação de responsabilidade">
            <p>
              Na medida permitida por lei, a Tareo não é responsável por danos indiretos
              resultantes da utilização ou impossibilidade de utilização do serviço. Nada
              nestes termos limita responsabilidade que não possa ser legalmente limitada.
            </p>
          </Seccao>

          <Seccao titulo="9. Cessação">
            <p>
              Qualquer uma das partes pode cessar a utilização do serviço nos termos acordados.
              Após a cessação, os dados da empresa cliente podem ser eliminados após um período
              razoável, salvo obrigação legal de retenção.
            </p>
          </Seccao>

          <Seccao titulo="10. Lei aplicável">
            <p>Estes termos regem-se pela lei portuguesa.</p>
          </Seccao>

          <Seccao titulo="11. Alterações">
            <p>
              Podemos atualizar estes termos à medida que o serviço evolui. A data no topo
              desta página indica a última atualização.
            </p>
          </Seccao>

          <Seccao titulo="12. Contacto">
            <p>
              Para questões sobre estes termos, usa a página de{" "}
              <a href="/contacto" className="underline hover:text-white">Contacto</a>.
            </p>
          </Seccao>
        </div>
      </main>
      <TareoFooter />
    </div>
  );
}
