import { FileText } from "lucide-react";

// Ação única "Ver PDF do Fecho" (Ponto 11) — mesmo componente na ficha do
// Serviço e no PainelFaturacao (partilhado Admin/Financeiro), para nunca
// haver duas implementações diferentes deste botão. Aponta sempre para a
// mesma rota (app/api/servicos/[id]/fecho-pdf/route.ts), que serve
// exatamente o ficheiro já gerado — nunca gera nada na hora.
export function VerPdfFechoLink({ servicoId, className }: { servicoId: string; className?: string }) {
  return (
    <a
      href={`/api/servicos/${servicoId}/fecho-pdf`}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "flex items-center gap-1.5 rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800"
      }
    >
      <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Ver PDF do Fecho
    </a>
  );
}
