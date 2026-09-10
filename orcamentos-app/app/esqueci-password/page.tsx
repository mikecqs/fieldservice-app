import EsqueciPasswordForm from "./EsqueciPasswordForm";

export default async function EsqueciPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-base px-4">
      <div className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-8">
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-white">Recuperar password</h1>
        <p className="mb-6 text-sm text-muted">
          Indique o email da sua conta para receber um link de recuperação.
        </p>
        {erro === "link_invalido" && (
          <p className="mb-4 text-sm text-red-400">
            O link de recuperação é inválido ou já expirou. Pode pedir um novo abaixo.
          </p>
        )}
        <EsqueciPasswordForm />
      </div>
    </main>
  );
}
