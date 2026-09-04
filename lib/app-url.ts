// URL pública e confiável desta aplicação — nunca derivada do cabeçalho
// Host/da URL do pedido recebido (esses podem ser manipulados por quem faz
// o pedido, consoante a configuração de rede — "Host Header Injection").
// Usar sempre esta função em qualquer sítio que construa um link enviado
// por email (ex: reset de password) ou um redirect_uri OAuth — confiar num
// valor errado aí permitiria redirecionar a vítima para um domínio à
// escolha de um atacante.
export function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
