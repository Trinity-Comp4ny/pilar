import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  classificarErroIa,
  comNovaTentativa,
  corpoErroIa,
  ErroIa,
  esperaAntesDe,
  RESPOSTA_ERRO_IA,
  tipoDoStatus,
} from "./ai-erros.ts";

Deno.test("tipoDoStatus: 429 é limite do provedor, 5xx é indisponível, 4xx é configuração", () => {
  assertEquals(tipoDoStatus(429), "limite_do_provedor");
  assertEquals(tipoDoStatus(500), "provedor_indisponivel");
  assertEquals(tipoDoStatus(503), "provedor_indisponivel");
  assertEquals(tipoDoStatus(408), "tempo_esgotado");
  assertEquals(tipoDoStatus(400), "configuracao");
  assertEquals(tipoDoStatus(403), "configuracao");
});

Deno.test("classificarErroIa: lê ErroIa, erro de rede e o texto do adaptador do gateway", () => {
  assertEquals(classificarErroIa(new ErroIa("saida_truncada", "x")), "saida_truncada");
  assertEquals(classificarErroIa(new TypeError("error sending request")), "provedor_indisponivel");
  assertEquals(classificarErroIa(new Error("AI Gateway error (429) em openai/gpt-5: slow down")), "limite_do_provedor");
  assertEquals(classificarErroIa(new Error("AI Gateway error (502) em x/y: bad gateway")), "provedor_indisponivel");
  assertEquals(classificarErroIa(new Error("AI Gateway timeout após 30000ms em x/y")), "tempo_esgotado");
  assertEquals(classificarErroIa(new Error("AI_GATEWAY_API_KEY não definida")), "configuracao");
  assertEquals(classificarErroIa(new Error("algo inesperado")), "desconhecido");
  assertEquals(classificarErroIa("string solta"), "desconhecido");
});

Deno.test("corpoErroIa: nunca devolve o texto bruto do provedor", () => {
  const bruto = 'Gemini API error (500): {"error":{"message":"internal","project":"projects/123"}}';
  const corpo = corpoErroIa(new ErroIa("provedor_indisponivel", bruto));
  assertEquals(corpo.tipo, "provedor_indisponivel");
  assertEquals(corpo.error, RESPOSTA_ERRO_IA.provedor_indisponivel.mensagem);
  assertEquals(corpo.error.includes("projects/123"), false);
});

Deno.test("RESPOSTA_ERRO_IA: todo tipo tem status de erro e mensagem", () => {
  for (const [tipo, r] of Object.entries(RESPOSTA_ERRO_IA)) {
    assertEquals(r.status >= 400, true, tipo);
    assertEquals(r.mensagem.length > 0, true, tipo);
  }
});

Deno.test("esperaAntesDe: duas novas tentativas no máximo, e só se sobrar tempo", () => {
  const segunda = esperaAntesDe(2, 60_000);
  assertEquals(segunda !== null && segunda >= 600 && segunda <= 750, true);
  const terceira = esperaAntesDe(3, 60_000);
  assertEquals(terceira !== null && terceira >= 1800 && terceira <= 2250, true);
  assertEquals(esperaAntesDe(4, 60_000), null);
  assertEquals(esperaAntesDe(2, 2_000), null);
});

const semEspera = () => Promise.resolve();
const longe = () => Date.now() + 60_000;

Deno.test("comNovaTentativa: 429 e depois sucesso devolve o resultado", async () => {
  let chamadas = 0;
  const repeticoes: string[] = [];
  const r = await comNovaTentativa(
    () => {
      chamadas++;
      if (chamadas === 1) return Promise.reject(new ErroIa("limite_do_provedor", "429"));
      return Promise.resolve("ok");
    },
    { deadline: longe(), dormir: semEspera, aoRepetir: (tipo) => repeticoes.push(tipo) }
  );
  assertEquals(r, "ok");
  assertEquals(chamadas, 2);
  assertEquals(repeticoes, ["limite_do_provedor"]);
});

Deno.test("comNovaTentativa: 5xx persistente para depois de 3 tentativas", async () => {
  let chamadas = 0;
  await assertRejects(
    () =>
      comNovaTentativa(
        () => {
          chamadas++;
          return Promise.reject(new ErroIa("provedor_indisponivel", "503"));
        },
        { deadline: longe(), dormir: semEspera }
      ),
    ErroIa
  );
  assertEquals(chamadas, 3);
});

Deno.test("comNovaTentativa: falha não passageira sai na primeira", async () => {
  for (const tipo of ["tempo_esgotado", "saida_truncada", "configuracao", "bloqueada"] as const) {
    let chamadas = 0;
    await assertRejects(() =>
      comNovaTentativa(
        () => {
          chamadas++;
          return Promise.reject(new ErroIa(tipo, tipo));
        },
        { deadline: longe(), dormir: semEspera }
      )
    );
    assertEquals(chamadas, 1, tipo);
  }
});

Deno.test("comNovaTentativa: sem tempo até o prazo, não tenta de novo", async () => {
  let chamadas = 0;
  await assertRejects(() =>
    comNovaTentativa(
      () => {
        chamadas++;
        return Promise.reject(new ErroIa("limite_do_provedor", "429"));
      },
      { deadline: Date.now() + 1_000, dormir: semEspera }
    )
  );
  assertEquals(chamadas, 1);
});
