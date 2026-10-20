import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { ErroIa } from "./ai-erros.ts";
import {
  type Deps,
  ERRO_AUDIO_INDISPONIVEL,
  ERRO_SEM_TOKENS,
  organizarRegistro,
  type RegistroParaOrganizar,
} from "./registro-organizar.ts";
import { extracaoSchema, PERGUNTA_EFETIVO, PERGUNTA_SEM_FALA } from "./registro-esquema.ts";

type Gravado = Parameters<Deps["gravar"]>[0];

function montar(reg: RegistroParaOrganizar | null, sobre: Partial<Deps> = {}) {
  const gravados: Gravado[] = [];
  const debitos: Array<Parameters<Deps["debitar"]>[0]> = [];
  const chamadas = { baixar: 0, transcrever: 0, extrair: 0 };
  const deps: Deps = {
    iniciar: () => Promise.resolve(reg),
    baixarAudio: () => {
      chamadas.baixar++;
      return Promise.resolve({ base64: "AAAA", mime: "audio/webm" });
    },
    transcrever: () => {
      chamadas.transcrever++;
      return Promise.resolve({ transcricao: "cinco da elétrica e três nossos", tokensEntrada: 1000, tokensSaida: 40 });
    },
    extrair: () => {
      chamadas.extrair++;
      return Promise.resolve({
        data: extracaoSchema.parse({
          resumo: "Elétrica (5) e equipe própria (3) na obra.",
          equipes: [
            { nome: "Elétrica", quantidade: 5 },
            { nome: "Equipe própria", quantidade: 3 },
          ],
        }),
        tokensEntrada: 300,
        tokensSaida: 120,
      });
    },
    gravar: (g) => {
      gravados.push(g);
      return Promise.resolve();
    },
    tokensDisponiveis: () => Promise.resolve({ ok: true }),
    debitar: (d) => {
      debitos.push(d);
      return Promise.resolve();
    },
    ...sobre,
  };
  return { deps, gravados, debitos, chamadas };
}

const audio: RegistroParaOrganizar = { id: "r1", empresaId: "e1", textoBruto: null, audioPath: "e1/o1/c1.webm" };

Deno.test("áudio: transcreve, extrai, grava pronto e debita as duas chamadas", async () => {
  const { deps, gravados, debitos, chamadas } = montar(audio);
  const r = await organizarRegistro(deps, "r1");
  assertEquals(r, { resultado: "pronto" });
  assertEquals(chamadas, { baixar: 1, transcrever: 1, extrair: 1 });
  const final = gravados[gravados.length - 1];
  assertEquals(final.status, "pronto");
  assertEquals(final.textoBruto, "cinco da elétrica e três nossos");
  assertEquals(final.extraido?.efetivo_total, 8);
  assertEquals(final.extraido?.pergunta, null);
  assertEquals(debitos.length, 1);
  assertEquals(debitos[0].uso, { tokensEntrada: 1300, tokensSaida: 160, chamadas: 2 });
});

Deno.test(
  "guarda o texto transcrito antes de extrair, ainda como organizando (reprocesso não paga o áudio de novo)",
  async () => {
    const { deps, gravados } = montar(audio);
    await organizarRegistro(deps, "r1");
    assertEquals(gravados[0].textoBruto, "cinco da elétrica e três nossos");
    assertEquals(gravados[0].status, "organizando");
  }
);

Deno.test("texto já existente pula a transcrição e o download do áudio", async () => {
  const { deps, chamadas, debitos } = montar({ ...audio, textoBruto: "Cimento acaba amanhã." });
  const r = await organizarRegistro(deps, "r1");
  assertEquals(r, { resultado: "pronto" });
  assertEquals(chamadas, { baixar: 0, transcrever: 0, extrair: 1 });
  assertEquals(debitos[0].uso.chamadas, 1);
});

Deno.test("texto digitado sem áudio também é organizado", async () => {
  const { deps, chamadas } = montar({ id: "r2", empresaId: "e1", textoBruto: "Chuva à tarde.", audioPath: null });
  assertEquals((await organizarRegistro(deps, "r2")).resultado, "pronto");
  assertEquals(chamadas.baixar, 0);
  assertEquals(chamadas.extrair, 1);
});

Deno.test("áudio sem fala vira pronto com a pergunta e não chama a extração", async () => {
  const { deps, gravados, chamadas } = montar(audio, {
    transcrever: () => Promise.resolve({ transcricao: "  ", tokensEntrada: 800, tokensSaida: 3 }),
  });
  const r = await organizarRegistro(deps, "r1");
  assertEquals(r, { resultado: "pronto" });
  assertEquals(chamadas.extrair, 0);
  const final = gravados[gravados.length - 1];
  assertEquals(final.status, "pronto");
  assertEquals(final.textoBruto, "");
  assertEquals(final.textoOrganizado, null);
  assertEquals(final.extraido?.pergunta, PERGUNTA_SEM_FALA);
});

Deno.test("sem pessoas ditas, o card pergunta quantas trabalharam", async () => {
  const { deps, gravados } = montar(
    { ...audio, textoBruto: "Cimento acaba amanhã." },
    {
      extrair: () =>
        Promise.resolve({
          data: extracaoSchema.parse({ resumo: "Cimento acaba amanhã.", materiais_faltando: ["Cimento"] }),
          tokensEntrada: 100,
          tokensSaida: 20,
        }),
    }
  );
  await organizarRegistro(deps, "r1");
  assertEquals(gravados[gravados.length - 1].extraido?.pergunta, PERGUNTA_EFETIVO);
});

Deno.test(
  "falha da IA na extração: grava falhou com o tipo fechado, guarda o texto e debita o que gastou",
  async () => {
    const { deps, gravados, debitos } = montar(audio, {
      extrair: () => Promise.reject(new ErroIa("saida_invalida", "JSON ruim com dado interno do provedor")),
    });
    const r = await organizarRegistro(deps, "r1");
    assertEquals(r, { resultado: "falhou", erro: "saida_invalida" });
    const final = gravados[gravados.length - 1];
    assertEquals(final.status, "falhou");
    assertEquals(final.erro, "saida_invalida");
    assertEquals(final.textoBruto, "cinco da elétrica e três nossos");
    assertEquals(debitos.length, 1);
    assertEquals(debitos[0].uso.chamadas, 1);
  }
);

Deno.test("falha na transcrição: falhou sem texto e sem débito", async () => {
  const { deps, gravados, debitos } = montar(audio, {
    transcrever: () => Promise.reject(new ErroIa("tempo_esgotado", "estourou")),
  });
  const r = await organizarRegistro(deps, "r1");
  assertEquals(r, { resultado: "falhou", erro: "tempo_esgotado" });
  assertEquals(gravados[gravados.length - 1].textoBruto, null);
  assertEquals(debitos.length, 0);
});

Deno.test("empresa sem tokens: falhou com sem_tokens e nenhuma chamada de IA", async () => {
  const { deps, gravados, chamadas } = montar(audio, { tokensDisponiveis: () => Promise.resolve({ ok: false }) });
  const r = await organizarRegistro(deps, "r1");
  assertEquals(r, { resultado: "falhou", erro: ERRO_SEM_TOKENS });
  assertEquals(chamadas, { baixar: 0, transcrever: 0, extrair: 0 });
  assertEquals(gravados.length, 1);
});

Deno.test("áudio sumiu do bucket: falhou com audio_indisponivel", async () => {
  const { deps, gravados } = montar(audio, { baixarAudio: () => Promise.resolve(null) });
  const r = await organizarRegistro(deps, "r1");
  assertEquals(r, { resultado: "falhou", erro: ERRO_AUDIO_INDISPONIVEL });
  assertEquals(gravados.length, 1);
});

Deno.test("registro já organizado ou em curso é ignorado, sem tocar em nada", async () => {
  const { deps, gravados, chamadas, debitos } = montar(null);
  assertEquals(await organizarRegistro(deps, "r1"), { resultado: "ignorado" });
  assertEquals(gravados.length, 0);
  assertEquals(chamadas, { baixar: 0, transcrever: 0, extrair: 0 });
  assertEquals(debitos.length, 0);
});
