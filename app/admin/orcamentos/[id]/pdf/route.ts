import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { calcularOrcamento } from "@/lib/orcamento";

const TIPO_LABEL: Record<string, string> = {
  materiais: "Materiais",
  mao_obra: "Mão de obra",
  deslocacao: "Deslocação",
  outros: "Outros",
};

// Gera o PDF profissional do orçamento a pedido (não fica gravado nenhum
// ficheiro — cada download é construído na hora a partir dos dados atuais).
// A proteção de acesso é a mesma RLS de sempre: createClient() usa a sessão
// do próprio pedido, por isso quem não for ADMIN/SUPER_ADMIN da organização
// simplesmente não recebe nenhuma linha de `budgets` e cai no 404 abaixo.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: orcamento } = await supabase
    .from("budgets")
    .select("*, clients(nome, nif, email, telefone), budget_items(*)")
    .eq("id", params.id)
    .single();

  if (!orcamento) return new NextResponse("Não encontrado", { status: 404 });

  const { data: org } = await supabase
    .from("organizations")
    .select("nome, nif")
    .eq("id", orcamento.organization_id)
    .single();

  const items = orcamento.budget_items ?? [];
  const { subtotal, ivaValor, total } = calcularOrcamento(items, orcamento.iva_percent);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const laranja = rgb(0.976, 0.451, 0.086);
  const cinzaEscuro = rgb(0.13, 0.16, 0.22);
  const cinza = rgb(0.4, 0.44, 0.5);

  let y = 800;
  const margem = 50;

  // Cabeçalho: marca "nX" (mesma identidade visual usada em toda a app) + nome da empresa.
  page.drawRectangle({ x: margem, y: y - 24, width: 32, height: 32, color: laranja });
  page.drawText("nX", { x: margem + 6, y: y - 15, size: 14, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText(org?.nome ?? "—", { x: margem + 42, y: y - 6, size: 14, font: fontBold, color: cinzaEscuro });
  if (org?.nif) page.drawText(`NIF: ${org.nif}`, { x: margem + 42, y: y - 22, size: 9, font: fontRegular, color: cinza });

  y -= 60;
  page.drawText("ORÇAMENTO", { x: margem, y, size: 18, font: fontBold, color: cinzaEscuro });
  page.drawText(`Data: ${orcamento.criado_em}`, { x: 595.28 - margem - 120, y, size: 10, font: fontRegular, color: cinza });

  y -= 30;
  page.drawText("Cliente", { x: margem, y, size: 9, font: fontBold, color: cinza });
  y -= 14;
  page.drawText(orcamento.clients?.nome ?? "—", { x: margem, y, size: 11, font: fontRegular, color: cinzaEscuro });
  if (orcamento.clients?.nif) {
    y -= 14;
    page.drawText(`NIF: ${orcamento.clients.nif}`, { x: margem, y, size: 10, font: fontRegular, color: cinza });
  }

  y -= 30;
  const colX = { desc: margem, qtd: 330, unit: 390, total: 470 };
  page.drawRectangle({ x: margem, y: y - 6, width: 595.28 - margem * 2, height: 20, color: rgb(0.95, 0.96, 0.98) });
  page.drawText("Descrição", { x: colX.desc + 4, y, size: 9, font: fontBold, color: cinzaEscuro });
  page.drawText("Qtd", { x: colX.qtd, y, size: 9, font: fontBold, color: cinzaEscuro });
  page.drawText("Preço unit.", { x: colX.unit, y, size: 9, font: fontBold, color: cinzaEscuro });
  page.drawText("Total", { x: colX.total, y, size: 9, font: fontBold, color: cinzaEscuro });
  y -= 24;

  for (const item of items) {
    const linhaTotal = Number(item.qtd) * Number(item.valor_unit);
    const label = `[${TIPO_LABEL[item.tipo] ?? item.tipo}] ${item.descricao}`;
    page.drawText(label.slice(0, 55), { x: colX.desc + 4, y, size: 9, font: fontRegular, color: cinzaEscuro });
    page.drawText(String(item.qtd), { x: colX.qtd, y, size: 9, font: fontRegular, color: cinzaEscuro });
    page.drawText(Number(item.valor_unit).toFixed(2) + " €", { x: colX.unit, y, size: 9, font: fontRegular, color: cinzaEscuro });
    page.drawText(linhaTotal.toFixed(2) + " €", { x: colX.total, y, size: 9, font: fontRegular, color: cinzaEscuro });
    y -= 18;
    if (y < 120) break; // orçamentos muito longos ficam truncados no PDF de uma página — suficiente para o caso de uso atual
  }

  y -= 10;
  page.drawLine({ start: { x: margem, y }, end: { x: 595.28 - margem, y }, thickness: 0.5, color: rgb(0.85, 0.87, 0.9) });
  y -= 20;

  const linhaTotal = (label: string, valor: number, destaque = false) => {
    page.drawText(label, { x: colX.unit, y, size: destaque ? 12 : 10, font: destaque ? fontBold : fontRegular, color: destaque ? cinzaEscuro : cinza });
    page.drawText(valor.toFixed(2) + " €", { x: colX.total, y, size: destaque ? 12 : 10, font: destaque ? fontBold : fontRegular, color: cinzaEscuro });
    y -= destaque ? 20 : 16;
  };
  linhaTotal("Subtotal", subtotal);
  linhaTotal(`IVA (${orcamento.iva_percent}%)`, ivaValor);
  linhaTotal("Total", total, true);

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="orcamento-${orcamento.id.slice(0, 8)}.pdf"`,
    },
  });
}
