import SignupForm from "./SignupForm";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Orçamentos</h1>
        <p className="mb-6 text-sm text-slate-500">Criar conta para a sua empresa</p>
        <SignupForm />
      </div>
    </main>
  );
}
