import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgIdAndRole } from "@/lib/auth";
import { gerarPdfFecho } from "@/lib/pdf-fecho";

// "Ver PDF do Fecho" — única rota que serve o documento gerado por
// lib/pdf-fecho.ts, para nunca haver duas implementações diferentes deste
// botão (ficha do Serviço e PainelFaturacao, partilhado por Admin e
// Financeiro, apontam sempre para aqui).
//
// Auditoria de segurança (Ponto 1) — a proteção NÃO depende só da policy do
// Storage (isso continua a ser uma segunda camada, nunca a única): esta
// rota valida sempre, de forma explícita, ANTES de tocar em Storage —
//   1. sessão autenticada (getOrgIdAndRole redireciona para /login se não
//      houver sessão nenhuma);
//   2. organização do utilizador — nunca confiada em nada vindo do pedido,
//      só do JWT da própria sessão;
//   3. role explicitamente na lista permitida (403 caso contrário — nunca
//      cai em silêncio para o 404 de "não encontrado", que seria confuso
//      para um pedido de permissão em vez de um pedido de dado inexistente);
//   4. que o Serviço pedido pertence mesmo a essa organização (query
//      filtrada por id E organization_id em conjunto — nunca só por id);
//   5. o download do Storage usa a MESMA sessão (nunca createAdminClient()
//      aqui — só a geração em lib/pdf-fecho.ts usa privilégio de serviço),
//      por isso a policy de Storage ("admin manages fechos storage"/
//      "finance reads fechos storage") continua a aplicar-se por cima,
//      como segunda camada independente.
// Um utilizador nunca consegue obter o PDF de outro Serviço só por mudar o
// [id] da URL — ou o passo 4 falha (404), ou (se por algum motivo o passo 4
// tivesse uma falha) a policy de Storage do passo 5 continuaria a bloquear.
const ROLES_PERMITIDOS = ["ADMIN", "SUPER_ADMIN", "FINANCE"];

async function autorizarEObterServico(id: string) {
  const supabase = await createClient();
  const { organizationId, role } = await getOrgIdAndRole();

  if (!ROLES_PERMITIDOS.includes(role)) {
    return { erro: new NextResponse("Sem permissão para consultar este PDF.", { status: 403 }) } as const;
  }

  const { data: servico } = await supabase
    .from("services")
    .select("id, organization_id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!servico) {
    return { erro: new NextResponse("Serviço não encontrado.", { status: 404 }) } as const;
  }

  return { supabase, organizationId, servico } as const;
}

function paginaFecho(opts: { mensagem: string; mostrarErro?: boolean }) {
  const html = `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>PDF do Fecho</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#e5e5e5;font-family:system-ui,-apple-system,sans-serif;">
  <div style="text-align:center;max-width:420px;padding:24px;">
    <p style="font-size:15px;margin:0 0 8px;">${opts.mensagem}</p>
    ${opts.mostrarErro ? '<p style="font-size:13px;color:#f87171;margin:0 0 16px;">Não foi possível gerar o PDF. Tenta novamente ou contacta o suporte se persistir.</p>' : ""}
    <form method="post" style="margin-top:16px;">
      <button type="submit" style="background:#fff;color:#0a0a0a;border:none;border-radius:6px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;">
        Gerar PDF do Fecho agora
      </button>
    </form>
  </div>
</body>
</html>`;
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const autorizado = await autorizarEObterServico(params.id);
  if ("erro" in autorizado) return autorizado.erro;
  const { supabase, organizationId, servico } = autorizado;

  const path = `${organizationId}/${servico.id}/fecho.pdf`;
  const { data: blob, error } = await supabase.storage.from("fechos").download(path);

  if (error || !blob) {
    // Ponto 4 — nunca um 404 seco: página simples e clara, com um botão para
    // gerar o PDF na hora (nunca bloqueia nada, é só uma chamada manual à
    // mesma função "best effort" usada nos 4 pontos automáticos do ciclo).
    const falhouAntes = new URL(req.url).searchParams.get("erro") === "1";
    return paginaFecho({
      mensagem: "PDF do Fecho ainda não disponível para este serviço.",
      mostrarErro: falhouAntes,
    });
  }

  const bytes = await blob.arrayBuffer();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="fecho-${servico.id}.pdf"`,
    },
  });
}

// Regeneração manual (Ponto 4) — mesma gerarPdfFecho best-effort dos 4
// pontos automáticos do ciclo; não há nenhuma "operação principal" aqui além
// de gerar o PDF, por isso não há nada para essa falha bloquear. Volta
// sempre a redirecionar para o GET acima (303, para o form não reenviar o
// POST se a página for recarregada) — mostra o PDF se tiver resultado, ou a
// mesma página com o motivo se tiver falhado outra vez.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const autorizado = await autorizarEObterServico(params.id);
  if ("erro" in autorizado) return autorizado.erro;
  const { servico } = autorizado;

  const resultado = await gerarPdfFecho(servico.id);
  if (!resultado.ok) {
    console.error(`[pdf-fecho] Falha na regeneração manual (serviceId: ${servico.id}):`, resultado.error);
  }

  const destino = new URL(req.url);
  destino.search = resultado.ok ? "" : "?erro=1";
  return NextResponse.redirect(destino, { status: 303 });
}
