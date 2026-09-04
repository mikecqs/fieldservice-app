// URL pública e confiável desta aplicação — nunca derivada do cabeçalho
// Host/da URL do pedido recebido (esses podem ser manipulados por quem faz
// o pedido, consoante a configuração de rede — "Host Header Injection").
// Usar sempre esta função em qualquer sítio que construa um link enviado
// por email (ex: reset de password) ou um redirect_uri OAuth — confiar num
// valor errado aí permitiria redirecionar a vítima para um domínio à
// escolha de um atacante.
//
// APP_URL (sem prefixo NEXT_PUBLIC_) de propósito: esta função só é chamada
// a partir de código server-only (Server Actions/route handlers), nunca do
// browser — não há motivo para o valor ser incluído no bundle do cliente.
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
