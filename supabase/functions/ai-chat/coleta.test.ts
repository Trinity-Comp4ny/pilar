import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  coletarComercial,
  coletarDados,
  coletarEquipe,
  coletarFinanceiro,
  coletarObras,
  coletarProjetos,
  hojeBrasilia,
  inicioDoMes,
} from "./coleta.ts";

// Coleta read-only dos agentes de consulta: o que o modelo recebe de cada domínio. Valor de
// contrato só para quem pode ver (ADR 0034), atraso só para quem não concluiu, um RDO por obra
// sem N+1, e somas que toleram valor nulo.

type Consulta = { tabela: string; filtros: Array<[string, ...unknown[]]> };
type Resposta = { data?: unknown; error?: { message: string } | null };

/** Supabase falso: cada `from()` encadeia qualquer filtro e resolve pela tabela e filtros. */
function dbFalso(responder: (c: Consulta) => Resposta) {
  const consultas: Consulta[] = [];
  const db = {
    from(tabela: string) {
      const c: Consulta = { tabela, filtros: [] };
      consultas.push(c);
      const proxy: unknown = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === "then") {
              return (ok: (v: unknown) => unknown) =>
                Promise.resolve({ data: null, error: null, ...responder(c) }).then(ok);
            }
            return (...args: unknown[]) => {
              if (prop !== "select") c.filtros.push([prop, ...args]);
              return proxy;
            };
          },
        }
      );
      return proxy;
    },
  };
  return { db: db as unknown as SupabaseClient, consultas };
}

const temFiltro = (c: Consulta, ...f: unknown[]) => c.filtros.some((x) => JSON.stringify(x) === JSON.stringify(f));
// "Hoje" do código é o de Brasília: em UTC, entre 21h e meia-noite já é o dia seguinte.
const HOJE = hojeBrasilia();

Deno.test("inicioDoMes: primeiro dia do mês corrente em yyyy-mm-dd", () => {
  const v = inicioDoMes();
  assert(/^\d{4}-\d{2}-01$/.test(v));
  assertEquals(v.slice(0, 7), hojeBrasilia().slice(0, 7));
});

Deno.test("coletarFinanceiro: soma recebido, pago, pendente, vencido e folha; nulo conta zero", async () => {
  const { db, consultas } = dbFalso((c) => {
    if (c.tabela === "folha_pagamento") return { data: [{ total_receber: 4000 }, { total_receber: null }] };
    const lt = c.filtros.some((f) => f[0] === "lt");
    if (c.tabela === "receitas") {
      if (temFiltro(c, "eq", "status", "Recebido")) return { data: [{ valor: 1000 }, { valor: "500.5" }] };
      return { data: lt ? [{ valor: 300 }] : [{ valor: 700 }, { valor: null }] };
    }
    if (temFiltro(c, "in", "status", ["Pago"])) return { data: [{ valor: 400 }] };
    return { data: lt ? [{ valor: 90 }] : [{ valor: 250 }] };
  });
  const r = await coletarFinanceiro(db, "emp-1");
  assertEquals(r, {
    hoje: HOJE,
    mes_atual: { recebido_no_mes: 1500.5, despesas_pagas_no_mes: 400, saldo_no_mes: 1100.5 },
    a_receber_pendente_total: 700,
    a_pagar_pendente_total: 250,
    a_receber_vencido_total: 300,
    a_pagar_vencido_total: 90,
    custo_folha_mes_atual: 4000,
  });
  // Toda leitura é escopada à empresa; despesa de pagamento de fatura não conta duas vezes.
  assert(consultas.every((c) => temFiltro(c, "eq", "empresa_id", "emp-1")));
  assert(consultas.filter((c) => c.tabela === "despesas").every((c) => temFiltro(c, "eq", "is_fatura_payment", false)));
});

Deno.test("coletarFinanceiro: tudo vazio dá zero, não NaN", async () => {
  const { db } = dbFalso(() => ({ data: null }));
  const r = await coletarFinanceiro(db, "emp-1");
  assertEquals(r.mes_atual, { recebido_no_mes: 0, despesas_pagas_no_mes: 0, saldo_no_mes: 0 });
  assertEquals(r.custo_folha_mes_atual, 0);
});

const projeto = (over: Record<string, unknown>) => ({
  nome: "P",
  status: "Execução",
  prioridade: "Alta",
  valor_contrato: 1000,
  pode_ver_valor: true,
  data_inicio: "2026-01-01",
  data_previsao: null,
  data_final: null,
  cliente_id: null,
  ...over,
});

Deno.test("coletarProjetos: ativos com cliente, atraso e valor para quem vê dinheiro", async () => {
  const { db, consultas } = dbFalso((c) => {
    if (c.tabela === "clientes") return { data: [{ id: "c1", nome: "Lima" }] };
    return {
      data: [
        projeto({ nome: "Atrasado", data_previsao: "2000-01-01", cliente_id: "c1", valor_contrato: 5000 }),
        projeto({
          nome: "Concluído no prazo",
          data_previsao: "2000-01-01",
          data_final: "1999-12-01",
          valor_contrato: null,
        }),
        projeto({ nome: "Arquivado", status: "Cancelado", valor_contrato: 99999 }),
        projeto({ nome: "Cliente sumido", cliente_id: "cX" }),
      ],
    };
  });
  const r = await coletarProjetos(db, "emp-1");
  assertEquals(r.total_projetos, 4);
  assertEquals(r.projetos_ativos, 3);
  assertEquals(r.por_status, { Execução: 3, Cancelado: 1 });
  assertEquals(r.valor_em_contratos_ativos, 6000);
  assertEquals(r.projetos_com_prazo_estourado, 1);
  const detalhe = r.projetos_ativos_detalhe as Array<Record<string, unknown>>;
  assertEquals(detalhe[0], {
    nome: "Atrasado",
    status: "Execução",
    prioridade: "Alta",
    cliente: "Lima",
    valor_contrato: 5000,
    data_inicio: "2026-01-01",
    data_previsao_entrega: "2000-01-01",
    data_conclusao: null,
    atrasado: true,
  });
  assertEquals(detalhe[1].atrasado, false);
  assertEquals(detalhe[2].cliente, null);
  // Lê a view segura, nunca a tabela com valor revogado; busca clientes de uma vez.
  assertEquals(consultas[0].tabela, "projetos_safe");
  assert(temFiltro(consultas[1], "in", "id", ["c1", "cX"]));
});

Deno.test("coletarProjetos: quem não vê dinheiro recebe o aviso e nenhum valor", async () => {
  const { db, consultas } = dbFalso(() => ({ data: [projeto({ pode_ver_valor: false, valor_contrato: 777 })] }));
  const r = await coletarProjetos(db, "emp-1");
  assertEquals(r.valor_em_contratos_ativos, undefined);
  assert(String(r.valores_ocultos).includes("não vê valores"));
  const d = (r.projetos_ativos_detalhe as Array<Record<string, unknown>>)[0];
  assert(!("valor_contrato" in d));
  // Sem cliente nenhum, não consulta a tabela de clientes.
  assertEquals(consultas.length, 1);
});

Deno.test("coletarProjetos: erro de leitura vira erro explícito (não '0 projetos')", async () => {
  const { db } = dbFalso(() => ({ data: null, error: { message: "permission denied for column valor_contrato" } }));
  await assertRejects(() => coletarProjetos(db, "emp-1"), Error, "falha ao ler projetos: permission denied");
});

Deno.test("coletarProjetos: lista de ativos é limitada a 30", async () => {
  const { db } = dbFalso(() => ({ data: Array.from({ length: 45 }, (_, i) => projeto({ nome: `P${i}` })) }));
  const r = await coletarProjetos(db, "emp-1");
  assertEquals(r.projetos_ativos, 45);
  assertEquals((r.projetos_ativos_detalhe as unknown[]).length, 30);
});

Deno.test("coletarComercial: conta por status e limita a lista de clientes a 50", async () => {
  const { db, consultas } = dbFalso((c) => {
    if (c.tabela === "propostas") return { data: [{ status: "Enviada" }, { status: "Enviada" }, { status: "Aceita" }] };
    if (c.tabela === "leads") return { data: [{ status: "Novo" }] };
    return {
      data: Array.from({ length: 60 }, (_, i) => ({
        nome: `C${i}`,
        email: null,
        contato: null,
        tipo_pessoa: "PJ",
        origem: "site",
      })),
    };
  });
  const r = await coletarComercial(db, "emp-1");
  assertEquals(r.total_propostas, 3);
  assertEquals(r.propostas_por_status, { Enviada: 2, Aceita: 1 });
  assertEquals(r.leads_por_status, { Novo: 1 });
  assertEquals(r.total_clientes, 60);
  assertEquals((r.clientes as unknown[]).length, 50);
  assertEquals((r.clientes as Array<Record<string, unknown>>)[0], {
    nome: "C0",
    email: null,
    contato: null,
    tipo: "PJ",
    origem: "site",
  });
  assert(consultas.every((c) => temFiltro(c, "is", "deleted_at", null)));
});

Deno.test("coletarComercial e coletarEquipe: vazio vira zero", async () => {
  const { db } = dbFalso(() => ({ data: null }));
  const c = await coletarComercial(db, "emp-1");
  assertEquals([c.total_propostas, c.total_leads, c.total_clientes], [0, 0, 0]);
  const e = await coletarEquipe(db, "emp-1");
  assertEquals(e, { total_pessoas: 0, equipe: [] });
});

Deno.test("coletarEquipe: mapeia contrato e limita a 50", async () => {
  const { db } = dbFalso(() => ({
    data: Array.from({ length: 55 }, (_, i) => ({
      nome: `P${i}`,
      cargo: "Projetista",
      tipo_contrato: "PJ",
      status: "ativo",
    })),
  }));
  const r = await coletarEquipe(db, "emp-1");
  assertEquals(r.total_pessoas, 55);
  assertEquals((r.equipe as unknown[]).length, 50);
  assertEquals((r.equipe as unknown[])[0], { nome: "P0", cargo: "Projetista", contrato: "PJ", status: "ativo" });
});

Deno.test("coletarObras: um RDO por obra (o mais recente), atraso e projeto", async () => {
  const { db, consultas } = dbFalso((c) => {
    if (c.tabela === "obra_rdo") {
      return {
        data: [
          { obra_id: "o1", data: "2026-11-06", clima: "sol", condicao_trabalho: "boa", efetivo: 12, ocorrencias: null },
          {
            obra_id: "o1",
            data: "2026-11-05",
            clima: "chuva",
            condicao_trabalho: "ruim",
            efetivo: 3,
            ocorrencias: "x",
          },
        ],
      };
    }
    return {
      data: [
        {
          id: "o1",
          nome: "Bloco A",
          status: "em_andamento",
          data_fim_prevista: "2000-01-01",
          data_fim_real: null,
          projetos: { nome: "Hospital" },
        },
        {
          id: "o2",
          nome: "Bloco B",
          status: "concluida",
          data_fim_prevista: "2000-01-01",
          data_fim_real: "2000-01-02",
          projetos: null,
        },
      ],
    };
  });
  const r = await coletarObras(db, "emp-1");
  assertEquals(r.total_obras, 2);
  assertEquals(r.obras_atrasadas, 1);
  assertEquals(r.por_status, { em_andamento: 1, concluida: 1 });
  const [a, b] = r.obras_detalhe as Array<Record<string, unknown>>;
  assertEquals(a.projeto, "Hospital");
  assertEquals((a.ultimo_rdo as Record<string, unknown>).data, "2026-11-06");
  assertEquals(b.ultimo_rdo, null);
  assertEquals(b.atrasada, false);
  assertEquals(consultas.filter((c) => c.tabela === "obra_rdo").length, 1);
  assert(temFiltro(consultas[1], "in", "obra_id", ["o1", "o2"]));
});

Deno.test("coletarObras: sem obras não consulta RDO", async () => {
  const { db, consultas } = dbFalso(() => ({ data: null }));
  const r = await coletarObras(db, "emp-1");
  assertEquals(r.total_obras, 0);
  assertEquals(consultas.length, 1);
});

Deno.test("coletarDados: cada agente lê o seu domínio; geral junta os cinco", async () => {
  const tabelasDe = async (agente: Parameters<typeof coletarDados>[0]) => {
    const { db, consultas } = dbFalso(() => ({ data: [] }));
    const r = await coletarDados(agente, db, "emp-1");
    return { r, tabelas: new Set(consultas.map((c) => c.tabela)) };
  };
  assert((await tabelasDe("financeiro")).tabelas.has("folha_pagamento"));
  assert((await tabelasDe("projetos")).tabelas.has("projetos_safe"));
  assert((await tabelasDe("comercial")).tabelas.has("propostas"));
  assert((await tabelasDe("obras")).tabelas.has("obras"));
  assertEquals([...(await tabelasDe("equipe")).tabelas], ["pessoas"]);
  const geral = await tabelasDe("geral");
  assertEquals(Object.keys(geral.r).sort(), ["comercial", "equipe", "financeiro", "obras", "projetos"]);
});

Deno.test("hojeBrasilia: depois das 21h de Brasília ainda é o mesmo dia", () => {
  // 23h30 de 07/11 em Brasília = 02h30 UTC de 08/11.
  assertEquals(hojeBrasilia(new Date("2026-11-08T02:30:00Z")), "2026-11-07");
  assertEquals(hojeBrasilia(new Date("2026-11-08T03:30:00Z")), "2026-11-08");
});

Deno.test("inicioDoMes: vira o mês pelo horário de Brasília", () => {
  assertEquals(inicioDoMes(new Date("2026-12-01T01:00:00Z")), "2026-11-01");
  assertEquals(inicioDoMes(new Date("2026-12-01T04:00:00Z")), "2026-12-01");
});
