import SignupForm from "./SignupForm";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-base px-4">
      <div className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-8">
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-white">Orçamentos</h1>
        <p className="mb-6 text-sm text-muted">Criar conta para a sua empresa</p>
        <SignupForm />
      </div>
    </main>
  );
}
