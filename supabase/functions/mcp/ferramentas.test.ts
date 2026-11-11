import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  DESCRICOES,
  executarFerramenta,
  hojeNoBrasil,
  mesDe,
  NOMES_DAS_FERRAMENTAS,
  termoDeBusca,
} from "./ferramentas.ts";

/**
 * Banco de mentira: guarda cada chamada do query builder e devolve as linhas da tabela.
 * Basta para conferir o que a ferramenta pede ao PostgREST e como ela monta a resposta.
 */
type Chamada = [string, ...unknown[]];

function bancoFalso(tabelas: Record<string, unknown[]>, rpc: Record<string, unknown> = {}) {
  const consultas: { tabela: string; chamadas: Chamada[] }[] = [];
  const rpcs: { nome: string; opcoes: unknown }[] = [];
  const db = {
    from(tabela: string) {
      const registro = { tabela, chamadas: [] as Chamada[] };
      consultas.push(registro);
      const linhas = tabelas[tabela] ?? [];
      const builder: Record<string, unknown> = {};
      for (const metodo of ["select", "is", "eq", "neq", "in", "or", "gte", "lte", "order", "limit"]) {
        builder[metodo] = (...args: unknown[]) => {
          registro.chamadas.push([metodo, ...args]);
          return builder;
        };
      }
      builder.maybeSingle = () => Promise.resolve({ data: linhas[0] ?? null, error: null });
      builder.then = (ok: (v: unknown) => unknown, falha?: (e: unknown) => unknown) =>
        Promise.resolve({ data: linhas, error: null }).then(ok, falha);
      return builder;
    },
    rpc(nome: string, _args: unknown, opcoes: unknown) {
      rpcs.push({ nome, opcoes });
      return Promise.resolve({ data: rpc[nome] ?? null, error: null });
    },
  };
  return { db: db as unknown as SupabaseClient, consultas, rpcs };
}

function dados(resultado: Awaited<ReturnType<typeof executarFerramenta>>) {
  return resultado?.structuredContent as Record<string, unknown>;
}

Deno.test("as seis ferramentas são de leitura e têm schema de objeto", () => {
  assertEquals(NOMES_DAS_FERRAMENTAS, [
    "buscar_projetos",
    "detalhar_projeto",
    "buscar_propostas",
    "buscar_leads",
    "buscar_clientes",
    "resumo_financeiro",
  ]);
  for (const d of DESCRICOES) {
    assertEquals(d.annotations.readOnlyHint, true);
    assertEquals(d.annotations.destructiveHint, false);
    assertEquals(d.inputSchema.type, "object");
  }
});

Deno.test("termo de busca tira o que quebra o filtro do PostgREST", () => {
  assertEquals(termoDeBusca("Casa, (Lote 3)"), "Casa Lote 3");
  assertEquals(termoDeBusca("100%_*:\\\"'."), "100");
  assertEquals(termoDeBusca("   "), null);
  assertEquals(termoDeBusca(undefined), null);
  assertEquals(termoDeBusca("x".repeat(200))?.length, 80);
});

Deno.test("mês de uma data e hoje no fuso do Brasil", () => {
  assertEquals(mesDe("2026-02-14"), { inicio: "2026-02-01", fim: "2026-02-28" });
  assertEquals(mesDe("2028-02-01"), { inicio: "2028-02-01", fim: "2028-02-29" });
  // 02:00 UTC do dia 10 ainda é dia 9 em São Paulo.
  assertEquals(hojeNoBrasil(new Date("2026-11-10T02:00:00Z")), "2026-11-09");
});

Deno.test("ferramenta desconhecida devolve null", async () => {
  const { db } = bancoFalso({});
  assertEquals(await executarFerramenta(db, "apagar_projeto", {}), null);
});

Deno.test("entrada inválida volta como erro legível, sem tocar no banco", async () => {
  const { db, consultas } = bancoFalso({});
  const r = await executarFerramenta(db, "buscar_projetos", { limite: 500 });
  assertEquals(r?.isError, true);
  assertStringIncludes(r?.content[0].text ?? "", "limite");
  const status = await executarFerramenta(db, "buscar_projetos", { status: "Qualquer" });
  assertEquals(status?.isError, true);
  assertEquals(consultas.length, 0);
});

Deno.test("buscar_projetos filtra, junta o cliente e esconde valor de quem não vê financeiro", async () => {
  const { db, consultas } = bancoFalso({
    projetos_safe: [
      {
        id: "p1",
        nome: "Casa A",
        cliente_id: "c1",
        status: "Em andamento",
        valor_contrato: 50000,
        pode_ver_valor: true,
      },
      {
        id: "p2",
        nome: "Casa B",
        cliente_id: null,
        status: "Em andamento",
        valor_contrato: 90000,
        pode_ver_valor: false,
      },
    ],
    clientes: [{ id: "c1", nome: "Maria", sobrenome: "Souza" }],
  });
  const r = dados(await executarFerramenta(db, "buscar_projetos", { busca: "Casa, A", status: "Em andamento" }));
  const projetos = r.projetos as Record<string, unknown>[];
  assertEquals(r.quantidade, 2);
  assertEquals(projetos[0].cliente, "Maria Souza");
  assertEquals(projetos[0].valor_do_contrato, 50000);
  assertEquals(projetos[1].valor_do_contrato, null);

  const chamadas = consultas[0].chamadas;
  assertEquals(consultas[0].tabela, "projetos_safe");
  assertEquals(
    chamadas.find((c) => c[0] === "or"),
    ["or", "nome.ilike.*Casa A*,codigo_projeto.ilike.*Casa A*"]
  );
  assertEquals(
    chamadas.find((c) => c[0] === "eq"),
    ["eq", "status", "Em andamento"]
  );
  assertEquals(
    chamadas.find((c) => c[0] === "limit"),
    ["limit", 20]
  );
});

Deno.test("detalhar_projeto inexistente (ou de outra empresa) avisa sem detalhe", async () => {
  const { db } = bancoFalso({ projetos_safe: [] });
  const r = await executarFerramenta(db, "detalhar_projeto", { projeto_id: "6f1c2d3e-0000-4000-8000-000000000001" });
  assertEquals(r?.isError, true);
  assertStringIncludes(r?.content[0].text ?? "", "não encontrado");
});

Deno.test("detalhar_projeto soma o financeiro do projeto só para quem vê valor", async () => {
  const comValor = bancoFalso({
    projetos_safe: [{ id: "p1", nome: "Casa A", pode_ver_valor: true, valor_contrato: 1000 }],
    projeto_disciplinas: [{ nome: "Estrutural", status: "Em andamento" }],
    escopos_safe: [{ tipo: "aditivo", valor_aditivo: 300, pode_ver_valor: true }],
    lancamentos: [
      { tipo: "receita", status: "Recebido", valor: 400.1 },
      { tipo: "receita", status: "Pendente", valor: 599.9 },
      { tipo: "despesa", status: "Pago", valor: 120.2 },
    ],
  });
  const r = dados(
    await executarFerramenta(comValor.db, "detalhar_projeto", { projeto_id: "6f1c2d3e-0000-4000-8000-000000000001" })
  );
  assertEquals(r.financeiro_do_projeto, {
    receitas_previstas: 1000,
    recebido: 400.1,
    despesas_previstas: 120.2,
    pago: 120.2,
  });
  assertEquals((r.aditivos as Record<string, unknown>[])[0].valor, 300);

  const semValor = bancoFalso({
    projetos_safe: [{ id: "p1", nome: "Casa A", pode_ver_valor: false, valor_contrato: null }],
    lancamentos: [{ tipo: "receita", status: "Recebido", valor: 400 }],
  });
  const s = dados(
    await executarFerramenta(semValor.db, "detalhar_projeto", { projeto_id: "6f1c2d3e-0000-4000-8000-000000000001" })
  );
  assertEquals(s.financeiro_do_projeto, null);
  assertEquals(
    semValor.consultas.some((c) => c.tabela === "lancamentos"),
    false
  );
});

Deno.test("buscar_leads traz o nome da etapa do funil e respeita pode_ver_valor", async () => {
  const { db } = bancoFalso({
    leads_safe: [
      { id: "l1", nome: "Ana", sobrenome: null, etapa_id: "e1", valor_estimado: 8000, pode_ver_valor: false },
    ],
    lead_etapas: [{ id: "e1", nome: "Qualificação" }],
  });
  const lead = (dados(await executarFerramenta(db, "buscar_leads", {})).leads as Record<string, unknown>[])[0];
  assertEquals(lead.contato, "Ana");
  assertEquals(lead.etapa_do_funil, "Qualificação");
  assertEquals(lead.valor_estimado, null);
});

Deno.test("buscar_clientes não pede dado bancário nem documento", async () => {
  const { db, consultas } = bancoFalso({ clientes: [] });
  await executarFerramenta(db, "buscar_clientes", { busca: "maria" });
  const select = String(consultas[0].chamadas.find((c) => c[0] === "select")?.[1]);
  for (const sensivel of ["chaves_pix", "contas_bancarias", "cpf_cnpj"]) {
    assertEquals(select.includes(sensivel), false);
  }
});

Deno.test("resumo_financeiro sem acesso ao financeiro não lê lançamentos", async () => {
  const { db, consultas, rpcs } = bancoFalso(
    { lancamentos: [{ tipo: "receita", valor: 1 }] },
    { can_view_financeiro: false }
  );
  const r = dados(await executarFerramenta(db, "resumo_financeiro", {}));
  assertEquals(r.sem_acesso, true);
  assertEquals(consultas.length, 0);
  // RPC por GET: o pre-request do banco recusa POST de app externo.
  assertEquals(rpcs[0].opcoes, { get: true });
});

Deno.test("resumo_financeiro soma previsto, realizado, em aberto e atrasado", async () => {
  const { db, consultas } = bancoFalso(
    {
      lancamentos: [
        { tipo: "receita", status: "Recebido", valor: 1000, data_vencimento: "2026-01-05" },
        { tipo: "receita", status: "Pendente", valor: 500.5, data_vencimento: "2026-01-10" },
        { tipo: "despesa", status: "Pago", valor: 300, data_vencimento: "2026-01-03" },
        { tipo: "despesa", status: "Atrasado", valor: 200.25, data_vencimento: "2026-01-04" },
      ],
    },
    { can_view_financeiro: true }
  );
  const r = dados(await executarFerramenta(db, "resumo_financeiro", { inicio: "2026-01-01", fim: "2026-01-31" }));
  assertEquals(r.periodo, { inicio: "2026-01-01", fim: "2026-01-31", criterio: "data de vencimento" });
  assertEquals(r.receitas, { previstas: 1500.5, recebidas: 1000, a_receber: 500.5, atrasadas: 500.5 });
  assertEquals(r.despesas, { previstas: 500.25, pagas: 300, a_pagar: 200.25, atrasadas: 200.25 });
  assertEquals(r.saldo_previsto, 1000.25);
  assertEquals(r.saldo_realizado, 700);
  assertEquals((r.proximos_recebimentos as unknown[]).length, 1);

  const chamadas = consultas[0].chamadas;
  assertEquals(
    chamadas.find((c) => c[0] === "gte"),
    ["gte", "data_vencimento", "2026-01-01"]
  );
  assertEquals(
    chamadas.find((c) => c[0] === "neq"),
    ["neq", "status", "Cancelado"]
  );
});

Deno.test("resumo_financeiro recusa período invertido ou maior que um ano", async () => {
  const { db } = bancoFalso({}, { can_view_financeiro: true });
  const invertido = await executarFerramenta(db, "resumo_financeiro", { inicio: "2026-02-01", fim: "2026-01-01" });
  assertEquals(invertido?.isError, true);
  const longo = await executarFerramenta(db, "resumo_financeiro", { inicio: "2024-01-01", fim: "2026-01-01" });
  assertEquals(longo?.isError, true);
  const formato = await executarFerramenta(db, "resumo_financeiro", { inicio: "01/02/2026" });
  assertEquals(formato?.isError, true);
});
