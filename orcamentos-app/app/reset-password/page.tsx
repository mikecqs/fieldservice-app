import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ResetPasswordForm from "./ResetPasswordForm";

// Só faz sentido com uma sessão de recuperação já estabelecida por
// /api/auth/confirm (link do email) — sem isso, mostra logo o motivo em
// vez de deixar submeter um formulário que a Server Action ia recusar.
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-base px-4">
      <div className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-8">
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-white">Definir nova password</h1>
        {user ? (
          <>
            <p className="mb-6 text-sm text-muted">Escolha uma nova password para a sua conta.</p>
            <ResetPasswordForm />
          </>
        ) : (
          <p className="text-sm text-neutral-200">
            Este link de recuperação é inválido ou já expirou.{" "}
            <Link href="/esqueci-password" className="text-white hover:underline">
              Pedir um novo link
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
