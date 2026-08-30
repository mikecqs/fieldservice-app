import { Card } from "@/components/ui/Card";

export default function PedidosLoading() {
  return (
    <div className="space-y-3">
      <div className="h-9 w-full max-w-md animate-pulse rounded-md bg-neutral-900" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} padding="sm" className="animate-pulse">
          <div className="h-4 w-1/3 rounded bg-neutral-800" />
          <div className="mt-2 h-3 w-2/3 rounded bg-neutral-800" />
        </Card>
      ))}
    </div>
  );
}
