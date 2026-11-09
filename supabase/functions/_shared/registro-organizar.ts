// SPEC 135: organiza um registro de obra em segundo plano (transcrever, extrair, gravar).
// A orquestração é pura: tudo que toca rede, banco e IA entra por `Deps`, então o teste
// cobre os caminhos (pronto, falhou, sem fala, sem tokens, reprocesso) sem nenhum deles.

import { classificarErroIa } from "./ai-erros.ts";
import { type Extracao, type Extraido, extraidoSemFala, normalizarExtracao } from "./registro-esquema.ts";

export interface RegistroParaOrganizar {
  id: string;
  empresaId: string;
  textoBruto: string | null;
  audioPath: string | null;
}

export interface UsoTokens {
  tokensEntrada: number;
  tokensSaida: number;
  chamadas: number;
}

export interface Deps {
  /** Pega o registro de forma atômica; `null` quando não há o que organizar (já feito ou em curso). */
  iniciar(id: string): Promise<RegistroParaOrganizar | null>;
  baixarAudio(path: string): Promise<{ base64: string; mime: string } | null>;
  transcrever(args: {
    empresaId: string;
    audio: { base64: string; mime: string };
  }): Promise<{ transcricao: string } & Omit<UsoTokens, "chamadas">>;
  extrair(args: { empresaId: string; texto: string }): Promise<{ data: Extracao } & Omit<UsoTokens, "chamadas">>;
  gravar(args: {
    id: string;
    status: "organizando" | "pronto" | "falhou";
    textoBruto: string | null;
    textoOrganizado: string | null;
    extraido: Extraido | null;
    erro: string | null;
  }): Promise<void>;
  /** Saldo de tokens da empresa (gate antes de gastar). */
  tokensDisponiveis(empresaId: string): Promise<{ ok: boolean }>;
  debitar(args: { empresaId: string; registroId: string; uso: UsoTokens }): Promise<void>;
}

export type Resultado = { resultado: "pronto" } | { resultado: "falhou"; erro: string } | { resultado: "ignorado" };

/** Erro gravado quando a empresa está sem saldo de tokens: reprocessar depois resolve. */
export const ERRO_SEM_TOKENS = "sem_tokens";
export const ERRO_AUDIO_INDISPONIVEL = "audio_indisponivel";

export async function organizarRegistro(deps: Deps, registroId: string): Promise<Resultado> {
  const reg = await deps.iniciar(registroId);
  if (!reg) return { resultado: "ignorado" };

  const uso: UsoTokens = { tokensEntrada: 0, tokensSaida: 0, chamadas: 0 };
  let textoBruto = reg.textoBruto?.trim() || null;

  try {
    const saldo = await deps.tokensDisponiveis(reg.empresaId);
    if (!saldo.ok) {
      await deps.gravar({
        id: reg.id,
        status: "falhou",
        textoBruto,
        textoOrganizado: null,
        extraido: null,
        erro: ERRO_SEM_TOKENS,
      });
      return { resultado: "falhou", erro: ERRO_SEM_TOKENS };
    }

    // Passo 1: transcrever. Quem já tem o texto (texto digitado ou reprocesso) pula.
    if (!textoBruto && reg.audioPath) {
      const audio = await deps.baixarAudio(reg.audioPath);
      if (!audio) {
        await deps.gravar({
          id: reg.id,
          status: "falhou",
          textoBruto: null,
          textoOrganizado: null,
          extraido: null,
          erro: ERRO_AUDIO_INDISPONIVEL,
        });
        return { resultado: "falhou", erro: ERRO_AUDIO_INDISPONIVEL };
      }
      const t = await deps.transcrever({ empresaId: reg.empresaId, audio });
      uso.tokensEntrada += t.tokensEntrada;
      uso.tokensSaida += t.tokensSaida;
      uso.chamadas += 1;
      textoBruto = t.transcricao.trim() || null;
      // Guarda o texto já: se a extração falhar, o reprocesso não paga o áudio de novo.
      if (textoBruto) {
        await deps.gravar({
          id: reg.id,
          status: "organizando",
          textoBruto,
          textoOrganizado: null,
          extraido: null,
          erro: null,
        });
      }
    }

    // Áudio sem fala: pronto, com a pergunta de volta.
    if (!textoBruto) {
      await deps.gravar({
        id: reg.id,
        status: "pronto",
        textoBruto: "",
        textoOrganizado: null,
        extraido: extraidoSemFala(),
        erro: null,
      });
      await debitarSeUsou(deps, reg, uso);
      return { resultado: "pronto" };
    }

    // Passo 2: extrair do texto.
    const e = await deps.extrair({ empresaId: reg.empresaId, texto: textoBruto });
    uso.tokensEntrada += e.tokensEntrada;
    uso.tokensSaida += e.tokensSaida;
    uso.chamadas += 1;
    const { textoOrganizado, extraido } = normalizarExtracao(e.data);

    await deps.gravar({
      id: reg.id,
      status: "pronto",
      textoBruto,
      textoOrganizado: textoOrganizado ?? textoBruto,
      extraido,
      erro: null,
    });
    await debitarSeUsou(deps, reg, uso);
    return { resultado: "pronto" };
  } catch (e) {
    const erro = classificarErroIa(e);
    await deps.gravar({
      id: reg.id,
      status: "falhou",
      textoBruto,
      textoOrganizado: null,
      extraido: null,
      erro,
    });
    await debitarSeUsou(deps, reg, uso);
    return { resultado: "falhou", erro };
  }
}

async function debitarSeUsou(deps: Deps, reg: RegistroParaOrganizar, uso: UsoTokens): Promise<void> {
  if (uso.chamadas === 0) return;
  await deps.debitar({ empresaId: reg.empresaId, registroId: reg.id, uso });
}
