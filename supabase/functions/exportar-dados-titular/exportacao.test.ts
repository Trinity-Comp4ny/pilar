import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { type Fontes, LIMITES, montarExportacao } from "./exportacao.ts";

const vazio: Fontes = {
  perfil: null,
  preferenciasNotificacao: [],
  consentimentosCookies: [],
  aceitesTermos: [],
  consentimentosCobranca: [],
  notificacoes: [],
  conversasIa: [],
  feedbacks: [],
  horasLancadas: [],
  usoIa: [],
  acoes: [],
  pedidosExportacao: [],
  pedidosExclusao: [],
};

Deno.test("todas as seções aparecem, mesmo vazias", () => {
  const e = montarExportacao(vazio, "2026-10-13T12:00:00Z");
  assertEquals(Object.keys(e), [
    "sobre",
    "perfil",
    "preferencias_de_notificacao",
    "consentimentos",
    "notificacoes_recebidas",
    "conversas_com_ia",
    "feedbacks_enviados",
    "horas_lancadas",
    "uso_de_ia",
    "historico_de_acoes",
    "pedidos_lgpd",
  ]);
  assertEquals(e.notificacoes_recebidas, []);
  assertEquals(e.consentimentos, { cookies: [], termos: [], cobranca: [] });
  assertEquals(e.sobre.gerado_em, "2026-10-13T12:00:00Z");
});

Deno.test("segredo, dado de terceiro e caminho interno nunca saem", () => {
  const e = montarExportacao(
    {
      ...vazio,
      perfil: { nome: "Ana", email: "ana@x.com", token_hash: "h" },
      acoes: [{ action: "update", target_table: "projetos", diff: { valor: 1 }, metadata: { outro: "x" } }],
      feedbacks: [{ titulo: "bug", print_path: "feedback-prints/a.png", sentry_event_id: "abc" }],
    },
    "agora"
  );
  assertEquals(e.perfil, { nome: "Ana", email: "ana@x.com" });
  assertEquals(e.historico_de_acoes, [{ action: "update", target_table: "projetos" }]);
  assertEquals(e.feedbacks_enviados, [{ titulo: "bug" }]);
});

Deno.test("conversa com a IA leva as mensagens dela", () => {
  const e = montarExportacao(
    { ...vazio, conversasIa: [{ id: "s1", titulo: "Orçamento", mensagens: [{ role: "user", content: "oi" }] }] },
    "agora"
  );
  assertEquals(e.conversas_com_ia, [{ id: "s1", titulo: "Orçamento", mensagens: [{ role: "user", content: "oi" }] }]);
});

Deno.test("limites por seção são aplicados e declarados no arquivo", () => {
  const muitas = Array.from({ length: LIMITES.acoes + 10 }, (_, i) => ({ action: `a${i}` }));
  const e = montarExportacao({ ...vazio, acoes: muitas }, "agora");
  assertEquals(e.historico_de_acoes.length, LIMITES.acoes);
  assertEquals(e.sobre.limites.acoes, LIMITES.acoes);
});
