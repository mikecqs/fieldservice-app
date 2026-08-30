"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

// Error boundary genérico para toda a área /admin (Next.js exige "use
// client" aqui). Não substitui nenhum tratamento de erro que já exista nas
// Server Actions — só evita um ecrã em branco quando algo falha a meio de
// uma navegação/render de um Server Component desta área.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-10">
      <Card className="text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-400" aria-hidden="true" />
        <h1 className="text-sm font-semibold text-white">Ocorreu um erro a carregar esta página.</h1>
        <p className="mt-1 text-xs text-neutral-500">
          {error.digest ? `Referência: ${error.digest}` : "Tenta novamente."}
        </p>
        <Button variant="primary" size="sm" onClick={reset} className="mt-4">
          Tentar novamente
        </Button>
      </Card>
    </div>
  );
}
