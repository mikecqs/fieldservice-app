import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/auth";
import { calcularOrcamento } from "@/lib/orcamento";
import { embutirLogo } from "@/lib/pdf-logo";
import { textoSeguroPdf } from "@/lib/pdf-texto";

const LARGURA = 595.28; // A4
const ALTURA = 841.89;
const MARGEM = 56;

const PRETO = rgb(0.09, 0.09, 0.11);
const CINZA_ESCURO = rgb(0.35, 0.37, 0.4);
const CINZA_CLARO = rgb(0.55, 0.57, 0.6);
const LINHA = rgb(0.87, 0.88, 0.9);

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
  const page = pdf.addPage([LARGURA, ALTURA]);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const t = (texto: string) => textoSeguroPdf(texto);
  const larguraTexto = (texto: string, font: PDFFont, size: number) => font.widthOfTextAtSize(t(texto), size);

  const desenhar = (
    texto: string,
    opts: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb> }
  ) => page.drawText(t(texto), opts);

  const desenharDireita = (
    texto: string,
    opts: { xDireita: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb> }
  ) => {
    const largura = larguraTexto(texto, opts.font, opts.size);
    desenhar(texto, { x: opts.xDireita - largura, y: opts.y, size: opts.size, font: opts.font, color: opts.color });
  };

  const direita = LARGURA - MARGEM;
  let y = ALTURA - MARGEM;

  // --- Cabeçalho: identidade da empresa à esquerda, nº/data à direita ------
  const logo = await embutirLogo(pdf, supabase, empresa.logo_path);
  if (logo) {
    const alturaLogo = 26;
    const larguraLogo = (logo.width / logo.height) * alturaLogo;
    page.drawImage(logo, { x: MARGEM, y: y - 24, width: larguraLogo, height: alturaLogo });
    desenhar(empresa.nome, { x: MARGEM + larguraLogo + 10, y: y - 9, size: 13, font: fontBold, color: PRETO });
    if (empresa.nif) {
      desenhar(`NIF ${empresa.nif}`, { x: MARGEM + larguraLogo + 10, y: y - 22, size: 8, font: fontRegular, color: CINZA_CLARO });
    }
  } else {
    desenhar(empresa.nome, { x: MARGEM, y: y - 9, size: 16, font: fontBold, color: PRETO });
    if (empresa.nif) {
      desenhar(`NIF ${empresa.nif}`, { x: MARGEM, y: y - 24, size: 8, font: fontRegular, color: CINZA_CLARO });
    }
  }

  desenharDireita("ORÇAMENTO", { xDireita: direita, y: y - 2, size: 8, font: fontRegular, color: CINZA_CLARO });
  desenharDireita(orcamento.numero, { xDireita: direita, y: y - 19, size: 15, font: fontBold, color: PRETO });
  desenharDireita(`Data ${String(orcamento.criado_em).slice(0, 10)}`, {
    xDireita: direita,
    y: y - 34,
    size: 9,
    font: fontRegular,
    color: CINZA_ESCURO,
  });

  y -= 56;
  page.drawLine({ start: { x: MARGEM, y }, end: { x: direita, y }, thickness: 1, color: PRETO });
  y -= 26;

  // --- Cliente ---------------------------------------------------------------
  desenhar("CLIENTE", { x: MARGEM, y, size: 8, font: fontRegular, color: CINZA_CLARO });
  y -= 15;
  desenhar(cliente?.nome ?? "—", { x: MARGEM, y, size: 11, font: fontBold, color: PRETO });
  const linhaCliente2 = [cliente?.empresa, cliente?.nif ? `NIF ${cliente.nif}` : null].filter(Boolean).join("  ·  ");
  if (linhaCliente2) {
    y -= 14;
    desenhar(linhaCliente2, { x: MARGEM, y, size: 9, font: fontRegular, color: CINZA_ESCURO });
  }
  if (cliente?.morada) {
    y -= 14;
    desenhar(cliente.morada, { x: MARGEM, y, size: 9, font: fontRegular, color: CINZA_ESCURO });
  }

  y -= 34;

  // --- Itens: tabela minimalista (linha fina, sem fundo pesado) -------------
  const colX = { desc: MARGEM, qtd: direita - 220, unit: direita - 150, total: direita };
  desenhar("Descrição", { x: colX.desc, y, size: 8, font: fontRegular, color: CINZA_CLARO });
  desenhar("Qtd", { x: colX.qtd, y, size: 8, font: fontRegular, color: CINZA_CLARO });
  desenharDireita("Preço unit.", { xDireita: colX.unit + 60, y, size: 8, font: fontRegular, color: CINZA_CLARO });
  desenharDireita("Total", { xDireita: colX.total, y, size: 8, font: fontRegular, color: CINZA_CLARO });
  y -= 8;
  page.drawLine({ start: { x: MARGEM, y }, end: { x: direita, y }, thickness: 1, color: PRETO });
  y -= 20;

  for (const item of items) {
    const linhaTotal = Number(item.quantidade) * Number(item.valor_unitario);
    desenhar(item.descricao.slice(0, 60), { x: colX.desc, y, size: 10, font: fontRegular, color: PRETO });
    desenhar(String(item.quantidade), { x: colX.qtd, y, size: 10, font: fontRegular, color: CINZA_ESCURO });
    desenharDireita(`${Number(item.valor_unitario).toFixed(2)} €`, {
      xDireita: colX.unit + 60,
      y,
      size: 10,
      font: fontRegular,
      color: CINZA_ESCURO,
    });
    desenharDireita(`${linhaTotal.toFixed(2)} €`, { xDireita: colX.total, y, size: 10, font: fontRegular, color: PRETO });
    y -= 12;
    page.drawLine({ start: { x: MARGEM, y }, end: { x: direita, y }, thickness: 0.5, color: LINHA });
    y -= 16;
    if (y < 220) break; // orçamentos muito longos ficam truncados numa página só — suficiente para o caso de uso atual
  }

  y -= 8;

  // --- Totais ------------------------------------------------------------------
  const linhaValor = (label: string, valor: number, destaque = false) => {
    desenhar(label, { x: colX.unit - 30, y, size: destaque ? 11 : 9, font: destaque ? fontBold : fontRegular, color: destaque ? PRETO : CINZA_CLARO });
    desenharDireita(`${valor.toFixed(2)} €`, {
      xDireita: colX.total,
      y,
      size: destaque ? 12 : 10,
      font: destaque ? fontBold : fontRegular,
      color: PRETO,
    });
    y -= destaque ? 20 : 17;
  };
  linhaValor("Subtotal", subtotal);
  linhaValor(`IVA (${orcamento.iva_percent}%)`, ivaValor);
  y -= 4;
  page.drawLine({ start: { x: colX.unit - 30, y: y + 16 }, end: { x: direita, y: y + 16 }, thickness: 1, color: PRETO });
  linhaValor("Total", total, true);

  // --- Condições -----------------------------------------------------------
  if (orcamento.condicoes) {
    y -= 24;
    desenhar("CONDIÇÕES", { x: MARGEM, y, size: 8, font: fontRegular, color: CINZA_CLARO });
    y -= 15;
    for (const linha of quebrarLinhas(orcamento.condicoes, 100)) {
      desenhar(linha, { x: MARGEM, y, size: 9, font: fontRegular, color: CINZA_ESCURO });
      y -= 13;
      if (y < 50) break;
    }
  }

  // --- Rodapé: validade ------------------------------------------------------
  desenhar(`Orçamento válido por ${orcamento.validade_dias} dias a partir da data de emissão.`, {
    x: MARGEM,
    y: 40,
    size: 8,
    font: fontRegular,
    color: CINZA_CLARO,
  });

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
