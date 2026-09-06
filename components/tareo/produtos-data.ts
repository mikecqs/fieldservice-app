// Catálogo de produtos apresentados na landing institucional da Tareo
// (app/tareo). Cada entrada é um cartão independente em Produtos.tsx —
// acrescentar "Produto 04" é só adicionar um objeto aqui, nunca implica
// tocar no layout da secção. Produto 01 já tem nome real ("Serv", ver
// components/ServMark.tsx e app/layout.tsx) — 02/03 continuam
// genéricos/provisórios, sem nome comercial definitivo.
//
// `href`: só o Produto 01 aponta para algo real (o próprio /login desta
// app, que já existe e funciona). Os restantes ainda não têm nenhuma
// página própria neste repositório — em vez de inventar uma rota, ficam
// sem `href` e o cartão mostra "Em breve".
export type Produto = {
  numero: string;
  nome: string;
  descricao: string;
  features?: string[];
  cta: string;
  href?: string;
};

export const produtos: Produto[] = [
  {
    numero: "01",
    nome: "Serv",
    descricao:
      "Uma plataforma completa para empresas que trabalham com clientes, equipas e serviços no terreno.",
    features: [
      "Clientes",
      "Pedidos",
      "Agenda",
      "Serviços",
      "Manutenções",
      "Orçamentos",
      "Faturação",
      "Relatórios",
    ],
    cta: "Conhecer produto",
    href: "/login",
  },
  {
    numero: "02",
    nome: "Orçamentos",
    descricao:
      "Uma ferramenta simples para técnicos e pequenas empresas criarem, enviarem e acompanharem orçamentos profissionais.",
    cta: "Conhecer produto",
  },
  {
    numero: "03",
    nome: "Imobiliário",
    descricao:
      "Uma ferramenta para criar landing pages profissionais para empresas e profissionais do setor imobiliário.",
    cta: "Conhecer produto",
  },
];
