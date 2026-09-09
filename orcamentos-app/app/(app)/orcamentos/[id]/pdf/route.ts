import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/auth";
import { calcularOrcamento } from "@/lib/orcamento";
import { embutirLogo } from "@/lib/pdf-logo";

// Helvetica (fonte StandardFonts usada aqui) só suporta a codificação
// WinAnsi — Latin-1 e pouco mais. Qualquer carácter fora disso (emoji,
// CJK, símbolos colados de outra fonte) faz o pdf-lib lançar uma exceção
// a meio da geração, rebentando o pedido inteiro com 500. Substituir por
// "?" garante que o PDF sai sempre, mesmo que algum campo tenha um
// carácter exótico — nunca falha silenciosamente o resto do documento.
function t(texto: string | null | undefined): string {
  if (!texto) return "";
  return Array.from(texto)
    .map((ch) => (ch.codePointAt(0)! <= 0xff ? ch : "?"))
    .join("");
}

// Gera o PDF do orçamento a pedido — nunca fica gravado, cada download é
// construído na hora a partir dos dados atuais. RLS garante que só a
// empresa dona do orçamento consegue sequer obter a linha de `budgets`.
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const empresa = await requireCompany();
  const supabase = await createClient();

  const { data: orcamento } = await supabase
    .from("budgets")
    .select("*, clients(nome, empresa, telefone, email, morada, nif), budget_items(*)")
    .eq("id", id)
    .eq("company_id", empresa.id)
    .maybeSingle();

  if (!orcamento) return new NextResponse("Não encontrado", { status: 404 });

  const cliente = orcamento.clients as {
    nome: string;
    empresa: string | null;
    telefone: string | null;
    email: string | null;
    morada: string | null;
    nif: string | null;
  };
  const items = (orcamento.budget_items ?? []) as {
    descricao: string;
    quantidade: number;
    valor_unitario: number;
  }[];
  const { subtotal, ivaValor, total } = calcularOrcamento(items, orcamento.iva_percent);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const azul = rgb(0.231, 0.357, 0.812);
  const escuro = rgb(0.13, 0.16, 0.22);
  const cinza = rgb(0.4, 0.44, 0.5);

  let y = 800;
  const margem = 50;
  const largura = 595.28;

  const desenhar = (
    texto: string,
    opts: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb> }
  ) => page.drawText(t(texto), opts);

  const logo = await embutirLogo(pdf, supabase, empresa.logo_path);
  if (logo) {
    const alturaLogo = 32;
    const larguraLogo = (logo.width / logo.height) * alturaLogo;
    page.drawImage(logo, { x: margem, y: y - 24, width: larguraLogo, height: alturaLogo });
    desenhar(empresa.nome, { x: margem + larguraLogo + 10, y: y - 6, size: 14, font: fontBold, color: escuro });
    if (empresa.nif) desenhar(`NIF: ${empresa.nif}`, { x: margem + larguraLogo + 10, y: y - 22, size: 9, font: fontRegular, color: cinza });
  } else {
    page.drawRectangle({ x: margem, y: y - 24, width: 32, height: 32, color: azul });
    desenhar(empresa.nome.slice(0, 2).toUpperCase(), { x: margem + 4, y: y - 15, size: 12, font: fontBold, color: rgb(1, 1, 1) });
    desenhar(empresa.nome, { x: margem + 42, y: y - 6, size: 14, font: fontBold, color: escuro });
    if (empresa.nif) desenhar(`NIF: ${empresa.nif}`, { x: margem + 42, y: y - 22, size: 9, font: fontRegular, color: cinza });
  }
  if (empresa.endereco) {
    desenhar(empresa.endereco, { x: largura - margem - 200, y: y - 6, size: 8, font: fontRegular, color: cinza });
  }
  if (empresa.telefone || empresa.email) {
    desenhar([empresa.telefone, empresa.email].filter(Boolean).join(" · "), {
      x: largura - margem - 200,
      y: y - 18,
      size: 8,
      font: fontRegular,
      color: cinza,
    });
  }

  y -= 60;
  desenhar(`ORÇAMENTO Nº ${orcamento.numero}`, { x: margem, y, size: 18, font: fontBold, color: escuro });
  desenhar(`Data: ${String(orcamento.criado_em).slice(0, 10)}`, { x: largura - margem - 120, y, size: 10, font: fontRegular, color: cinza });

  y -= 30;
  desenhar("Cliente", { x: margem, y, size: 9, font: fontBold, color: cinza });
  y -= 14;
  desenhar(cliente?.nome ?? "—", { x: margem, y, size: 11, font: fontRegular, color: escuro });
  if (cliente?.empresa) {
    y -= 14;
    desenhar(cliente.empresa, { x: margem, y, size: 10, font: fontRegular, color: cinza });
  }
  if (cliente?.morada) {
    y -= 14;
    desenhar(cliente.morada, { x: margem, y, size: 10, font: fontRegular, color: cinza });
  }
  if (cliente?.nif) {
    y -= 14;
    desenhar(`NIF: ${cliente.nif}`, { x: margem, y, size: 10, font: fontRegular, color: cinza });
  }

  y -= 30;
  const colX = { desc: margem, qtd: 330, unit: 390, total: 470 };
  page.drawRectangle({ x: margem, y: y - 6, width: largura - margem * 2, height: 20, color: rgb(0.95, 0.96, 0.98) });
  desenhar("Descrição", { x: colX.desc + 4, y, size: 9, font: fontBold, color: escuro });
  desenhar("Qtd", { x: colX.qtd, y, size: 9, font: fontBold, color: escuro });
  desenhar("Preço unit.", { x: colX.unit, y, size: 9, font: fontBold, color: escuro });
  desenhar("Total", { x: colX.total, y, size: 9, font: fontBold, color: escuro });
  y -= 24;

  for (const item of items) {
    const linhaTotal = Number(item.quantidade) * Number(item.valor_unitario);
    desenhar(item.descricao.slice(0, 55), { x: colX.desc + 4, y, size: 9, font: fontRegular, color: escuro });
    desenhar(String(item.quantidade), { x: colX.qtd, y, size: 9, font: fontRegular, color: escuro });
    desenhar(Number(item.valor_unitario).toFixed(2) + " €", { x: colX.unit, y, size: 9, font: fontRegular, color: escuro });
    desenhar(linhaTotal.toFixed(2) + " €", { x: colX.total, y, size: 9, font: fontRegular, color: escuro });
    y -= 18;
    if (y < 200) break; // orçamentos muito longos ficam truncados numa página só — suficiente para o caso de uso atual
  }

  y -= 10;
  page.drawLine({ start: { x: margem, y }, end: { x: largura - margem, y }, thickness: 0.5, color: rgb(0.85, 0.87, 0.9) });
  y -= 20;

  const linhaValor = (label: string, valor: number, destaque = false) => {
    desenhar(label, { x: colX.unit, y, size: destaque ? 12 : 10, font: destaque ? fontBold : fontRegular, color: destaque ? escuro : cinza });
    desenhar(valor.toFixed(2) + " €", { x: colX.total, y, size: destaque ? 12 : 10, font: destaque ? fontBold : fontRegular, color: escuro });
    y -= destaque ? 20 : 16;
  };
  linhaValor("Subtotal", subtotal);
  linhaValor(`IVA (${orcamento.iva_percent}%)`, ivaValor);
  linhaValor("Total", total, true);

  if (orcamento.condicoes) {
    y -= 20;
    desenhar("Condições", { x: margem, y, size: 9, font: fontBold, color: cinza });
    y -= 14;
    for (const linha of quebrarLinhas(orcamento.condicoes, 95)) {
      desenhar(linha, { x: margem, y, size: 9, font: fontRegular, color: escuro });
      y -= 13;
      if (y < 40) break;
    }
  }

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="orcamento-${orcamento.numero}.pdf"`,
    },
  });
}

function quebrarLinhas(texto: string, larguraMaxima: number): string[] {
  const palavras = texto.replace(/\r/g, "").split(/\s+/);
  const linhas: string[] = [];
  let atual = "";

  for (const palavra of palavras) {
    if ((atual + " " + palavra).trim().length > larguraMaxima) {
      if (atual) linhas.push(atual.trim());
      atual = palavra;
    } else {
      atual = (atual + " " + palavra).trim();
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}
