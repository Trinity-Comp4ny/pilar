import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada, TETO_TRANSCRIPT } from "../_shared/cerebro/entrada.ts";
import { type Dependencias, processarReuniao } from "../_shared/cerebro/processar.ts";
import type { RespostaModelo } from "../_shared/cerebro/prompt.ts";

// Fixtures sintéticas (repositório público): reproduzem as falhas reais sem dado real.
const TRANSCRIPT = [
  "Me: This meeting is being recorded",
  "Me: A gente perde muito tempo conferindo medição no fim do mês.",
  "Me: Manda no fulano@exemplo.com.br que eu respondo, o Kube resolve isso?",
  "Me: Eu prometo enviar a proposta até sexta.",
].join("\n");

const ENTRADA = { titulo: "Reunião sintética", ocorreu_em: "2026-11-18T14:00:00-03:00", transcript: TRANSCRIPT };

function resposta(over: Partial<RespostaModelo> = {}): RespostaModelo {
  return {
    tipo: "discovery",
    tipo_confianca: 0.8,
    proximo_passo: "Enviar proposta",
    proximo_passo_em: null,
    segmentos: [{ tipo: "discovery", inicio_linha: 0, fim_linha: 3, proporcao_ruido: 0.1 }],
    insights: [
      {
        categoria: "dor",
        texto: "Medição manual toma tempo",
        citacao: "perde muito tempo conferindo medição no fim do mês",
        modulo_pilar: null,
        falante: "incerto",
        texto_duvidoso: false,
      },
    ],
    compromissos: [{ prometido_por: "pilar", para: null, descricao: "Enviar a proposta", prazo: null }],
    ...over,
  };
}

function fakes(modelo: () => Promise<{ data: RespostaModelo; tokensEntrada: number; tokensSaida: number }>) {
  const reg = {
    criada: null as Record<string, unknown> | null,
    analise: null as unknown,
    falhas: 0,
    promptUsuario: "",
  };
  const deps: Dependencias = {
    chamarModelo: (_s, u) => {
      reg.promptUsuario = u;
      return modelo();
    },
    criarReuniao: (r) => {
      reg.criada = r as unknown as Record<string, unknown>;
      return Promise.resolve("r-1");
    },
    gravarAnalise: (_id, l) => {
      reg.analise = l;
      return Promise.resolve();
    },
    marcarFalha: () => {
      reg.falhas++;
      return Promise.resolve();
    },
  };
  return { deps, reg };
}

Deno.test("grava só o texto redigido e manda o mesmo texto ao modelo", async () => {
  const { deps, reg } = fakes(() => Promise.resolve({ data: resposta(), tokensEntrada: 100, tokensSaida: 50 }));
  const r = await processarReuniao(deps, ENTRADA, "u-1");
  assert(r.ok);
  const gravado = String(reg.criada?.transcript_redigido);
  assert(!gravado.includes("fulano@"));
  assert(gravado.includes("CUB"));
  assert(!reg.promptUsuario.includes("fulano@"));
  assertEquals((reg.criada?.redacoes as Record<string, number>).email, 1);
});

Deno.test("citação inventada é descartada e a confiança do tipo cai", async () => {
  const falso = { ...resposta().insights[0], citacao: "queremos um aplicativo de celular urgente" };
  const { deps, reg } = fakes(() =>
    Promise.resolve({ data: resposta({ insights: [resposta().insights[0], falso] }), tokensEntrada: 1, tokensSaida: 1 })
  );
  const r = await processarReuniao(deps, ENTRADA, "u-1");
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.insights, 1);
    assertEquals(r.descartados, 1);
  }
  assertEquals((reg.analise as { tipo_confianca: number }).tipo_confianca, 0.4);
});

Deno.test("falha do modelo marca a reunião como falha e não grava achados", async () => {
  const { deps, reg } = fakes(() => Promise.reject(new Error("503")));
  const r = await processarReuniao(deps, ENTRADA, "u-1");
  assert(!r.ok);
  assertEquals(reg.falhas, 1);
  assertEquals(reg.analise, null);
});

Deno.test("resposta fora do esquema conta como falha do modelo", async () => {
  const { deps, reg } = fakes(() =>
    Promise.resolve({ data: { tipo: "inventado" } as unknown as RespostaModelo, tokensEntrada: 1, tokensSaida: 1 })
  );
  const r = await processarReuniao(deps, ENTRADA, "u-1");
  assert(!r.ok);
  assertEquals(reg.falhas, 1);
});

Deno.test("entrada: transcrição acima do teto é recusada com mensagem clara", () => {
  const r = lerEntrada({ ...ENTRADA, transcript: "x".repeat(TETO_TRANSCRIPT + 1) });
  assert(!r.ok);
  if (!r.ok) assert(r.erro.includes("Divida"));
});

Deno.test("entrada: corpo incompleto é recusado", () => {
  assert(!lerEntrada({ titulo: "só título" }).ok);
  assert(lerEntrada(ENTRADA).ok);
});
