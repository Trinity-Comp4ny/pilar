import { test } from "../fixtures";
import { Tour, type Passo } from "./explorar";

// Tour do app logado (admin do seed). Uma rota por teste, para o shard dividir.
const ID = "00000000-0000-0000-0000-000000000";

type Tela = { modulo: string; tela: string; rota: string; detalhes?: string[]; orcamentoMs?: number; dialogoBase?: boolean };

const TELAS: Tela[] = [
  // Geral
  { modulo: "geral", tela: "inicio", rota: "/inicio" },
  { modulo: "geral", tela: "novidades", rota: "/novidades", orcamentoMs: 90_000 },
  { modulo: "geral", tela: "ajuda", rota: "/ajuda", orcamentoMs: 120_000 },
  { modulo: "geral", tela: "agentes", rota: "/agentes" },
  { modulo: "geral", tela: "chat", rota: "/chat", orcamentoMs: 120_000 },
  { modulo: "geral", tela: "relatorios", rota: "/relatorios" },
  { modulo: "geral", tela: "revisao-ia", rota: "/revisao-ia", orcamentoMs: 120_000 },

  // Comercial
  { modulo: "comercial", tela: "leads", rota: "/gestao/leads", detalhes: ["Patrícia", "Fernanda"], orcamentoMs: 7 * 60_000 },
  { modulo: "comercial", tela: "propostas", rota: "/gestao/propostas", detalhes: ["Projeto estrutural edifício residencial"], orcamentoMs: 7 * 60_000 },
  { modulo: "comercial", tela: "clientes", rota: "/gestao/clientes", detalhes: ["Construtora Horizonte"] },
  { modulo: "comercial", tela: "cliente", rota: `/gestao/clientes/${ID}101` },
  { modulo: "comercial", tela: "agenda", rota: "/gestao/agenda" },
  { modulo: "comercial", tela: "tarefas", rota: "/gestao/tarefas", detalhes: ["Revisar memorial de cálculo estrutural"] },
  { modulo: "comercial", tela: "metas", rota: "/gestao/metas", orcamentoMs: 120_000 },

  // Projetos
  { modulo: "projetos", tela: "projetos", rota: "/projetos", detalhes: ["Edifício Comercial Horizonte"], orcamentoMs: 7 * 60_000 },
  { modulo: "projetos", tela: "projeto", rota: `/projetos/${ID}401`, orcamentoMs: 8 * 60_000 },
  { modulo: "projetos", tela: "projeto-planejamento", rota: `/projetos/${ID}402`, orcamentoMs: 150_000 },
  { modulo: "projetos", tela: "disciplinas", rota: "/projetos/disciplinas" },
  { modulo: "projetos", tela: "cronograma", rota: "/projetos/cronograma" },
  { modulo: "projetos", tela: "calendario", rota: "/projetos/calendario", orcamentoMs: 150_000 },
  { modulo: "projetos", tela: "mapa", rota: "/projetos/mapa", orcamentoMs: 150_000 },
  { modulo: "projetos", tela: "timesheet", rota: "/gestao/timesheet", orcamentoMs: 150_000 },

  // Obras
  { modulo: "obras", tela: "obras", rota: "/obras", detalhes: ["Obra Edifício Horizonte"] },
  { modulo: "obras", tela: "obra", rota: `/obras/${ID}a01`, orcamentoMs: 8 * 60_000 },
  { modulo: "obras", tela: "obra-concluida", rota: `/obras/${ID}a02`, orcamentoMs: 120_000 },
  { modulo: "obras", tela: "clima", rota: "/obras/clima", orcamentoMs: 90_000 },
  { modulo: "obras", tela: "estimativas", rota: "/obras/estimativas" },
  { modulo: "obras", tela: "estimativa-nova", rota: "/obras/estimativas/nova" },
  { modulo: "obras", tela: "precos", rota: "/obras/estimativas/precos", orcamentoMs: 150_000 },
  { modulo: "obras", tela: "fornecedores", rota: "/gestao/fornecedores", detalhes: ["Ferro & Cia Materiais"] },
  { modulo: "obras", tela: "fornecedor", rota: `/gestao/fornecedores/${ID}642`, orcamentoMs: 150_000 },

  // Financeiro
  { modulo: "financeiro", tela: "financeiro", rota: "/gestao/financeiro", orcamentoMs: 8 * 60_000 },
  {
    modulo: "financeiro",
    tela: "lancamentos",
    rota: "/gestao/financeiro?tab=lancamentos&fp=tudo",
    detalhes: ["Aluguel do escritório"],
    orcamentoMs: 7 * 60_000,
  },
  { modulo: "financeiro", tela: "rentabilidade", rota: "/rentabilidade", orcamentoMs: 120_000 },

  // Empresa e conta
  { modulo: "empresa", tela: "equipe", rota: "/gestao/equipe", detalhes: ["Juliana Costa"] },
  { modulo: "empresa", tela: "admin", rota: "/admin" },
  { modulo: "empresa", tela: "config-empresa", rota: "/company", orcamentoMs: 150_000, dialogoBase: true },
  { modulo: "empresa", tela: "config-pagamento", rota: "/billing", orcamentoMs: 150_000, dialogoBase: true },
  { modulo: "empresa", tela: "config-conta", rota: "/profile", orcamentoMs: 120_000, dialogoBase: true },
  { modulo: "empresa", tela: "config-seguranca", rota: "/seguranca", orcamentoMs: 120_000, dialogoBase: true },
  { modulo: "empresa", tela: "comprar-tokens", rota: "/comprar-tokens", orcamentoMs: 90_000 },
  { modulo: "empresa", tela: "checkout", rota: "/checkout", orcamentoMs: 90_000 },

  // Entrada (o seed já passou por elas; a rota mostra o que sobra para quem já entrou)
  { modulo: "entrada", tela: "company-setup", rota: "/company-setup", orcamentoMs: 90_000 },
  { modulo: "entrada", tela: "profile-setup", rota: "/profile-setup", orcamentoMs: 90_000 },
  { modulo: "entrada", tela: "mfa-setup", rota: "/mfa/setup", orcamentoMs: 60_000 },
  { modulo: "entrada", tela: "sem-acesso", rota: "/sem-acesso", orcamentoMs: 45_000 },
];

for (const t of TELAS) {
  test(`${t.modulo} · ${t.tela}`, async ({ page }) => {
    const orcamento = t.orcamentoMs ?? 4 * 60_000;
    test.setTimeout(orcamento + 3 * 60_000);
    await new Tour(page, t.modulo, t.tela, t.rota, { detalhes: t.detalhes, orcamentoMs: orcamento, dialogoBase: t.dialogoBase }).rodar();
  });
}

test("geral · barra lateral e atalhos", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  const teclas: Passo[] = [
    { tipo: "tecla", tecla: "Control+k" },
    { tipo: "tecla", tecla: "Shift+?" },
  ];
  await new Tour(page, "geral", "barra-lateral", "/inicio", {
    escopo: "chrome",
    extras: teclas,
    orcamentoMs: 5 * 60_000,
  }).rodar();
});
