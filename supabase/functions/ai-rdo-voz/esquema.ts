import { z } from "../_shared/schemas.ts";

// Confirmado ao vivo contra a API (01/09): audio/webm (formato padrão do
// MediaRecorder no Chrome) é aceito e transcrito normalmente.
export const MIME_PERMITIDOS = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/aac",
] as const;
// ~3min de fala em opus/aac a até ~400kbps ainda cabe folgado aqui.
export const MAX_BASE64_CHARS = 12_000_000;
// Cadastro de fornecedor/tarefa não é caso real hoje com centenas de linhas;
// teto defensivo pra não deixar o prompt crescer sem limite.
export const MAX_LISTA_ITENS = 200;

export const TIPOS_IMPEDIMENTO = ["falta_material", "clima", "pendencia_projeto", "mao_de_obra", "outro"] as const;
export const RESULTADOS_TAREFA = ["avancou", "concluiu", "parou"] as const;

// Cadastro enviado pelo front: vai para o prompt, então nome curto e id curto.
const Ref = z.object({ id: z.string().min(1).max(64), nome: z.string().max(200) });

/** Lista de referência tolerante: o que não for item válido some, e o resto é cortado no teto. */
const refLista = z
  .unknown()
  .transform((v) =>
    (Array.isArray(v) ? v : []).flatMap((i) => {
      const r = Ref.safeParse(i);
      return r.success ? [r.data] : [];
    })
  )
  .transform((l) => l.slice(0, MAX_LISTA_ITENS));

export const entradaSchema = z.object({
  audioBase64: z
    .string({ required_error: "Nenhum áudio enviado", invalid_type_error: "Nenhum áudio enviado" })
    .min(1, "Nenhum áudio enviado")
    .max(MAX_BASE64_CHARS, "Áudio grande demais. Grave um trecho mais curto."),
  mimeType: z.enum(MIME_PERMITIDOS, {
    errorMap: () => ({ message: "Formato de áudio não suportado neste navegador." }),
  }),
  fornecedores: refLista,
  tarefasAbertas: refLista,
});

export function lerEntrada(corpo: unknown) {
  // Ordem das mensagens igual à de antes: falta de áudio vem primeiro.
  const base = corpo && typeof corpo === "object" ? corpo : {};
  const r = entradaSchema.safeParse(base);
  if (r.success) return { ok: true as const, data: r.data };
  const ordem = ["audioBase64", "mimeType"];
  const issue = [...r.error.issues].sort(
    (a, b) => ordem.indexOf(String(a.path[0])) - ordem.indexOf(String(b.path[0]))
  )[0];
  return { ok: false as const, error: issue.message };
}

/**
 * Lista de sugestões que descarta o item inválido em vez de reprovar a resposta
 * inteira. Antes, um único id inventado pelo modelo reprovava o schema: depois da
 * nova tentativa, o engenheiro perdia a transcrição do áudio todo por causa de uma
 * sugestão opcional.
 */
function listaTolerante<T extends z.ZodTypeAny>(item: T) {
  return z.unknown().transform((v) =>
    (Array.isArray(v) ? v : []).flatMap((i) => {
      const r = item.safeParse(i);
      return r.success ? [r.data as z.output<T>] : [];
    })
  );
}

export function montarSugestoesSchema(idsFornecedores: ReadonlySet<string>, idsTarefas: ReadonlySet<string>) {
  // Fornecedor fora do cadastro: a sugestão fica, sem o vínculo (o nome continua).
  const fornecedorId = z.unknown().transform((v) => (typeof v === "string" && idsFornecedores.has(v) ? v : null));
  const tarefaId = z.string().refine((v) => idsTarefas.has(v), "tarefa_id fora da lista enviada");

  return z
    .object({
      efetivo_por_fornecedor: listaTolerante(
        z.object({
          fornecedor_id: fornecedorId,
          fornecedor_nome: z.string(),
          quantidade: z.number().int().positive(),
        })
      ),
      impedimentos: listaTolerante(z.object({ descricao: z.string(), tipo: z.enum(TIPOS_IMPEDIMENTO) })),
      visitas: listaTolerante(
        z.object({
          fornecedor_id: fornecedorId,
          fornecedor_nome: z.string(),
          observacao: z.string().nullable().default(null),
        })
      ),
      // Tarefa fora da lista não tem como virar sugestão: o item sai.
      tarefas: listaTolerante(z.object({ tarefa_id: tarefaId, resultado: z.enum(RESULTADOS_TAREFA) })),
    })
    .default({});
}

export function montarSchema(idsFornecedores: ReadonlySet<string>, idsTarefas: ReadonlySet<string>) {
  return z.object({
    transcricao: z.string(),
    clima: z.enum(["ensolarado", "nublado", "chuvoso", "chuva_forte"]).nullable().default(null),
    condicao_trabalho: z.enum(["normal", "parcial", "paralisada"]).nullable().default(null),
    efetivo: z.number().int().nonnegative().nullable().default(null),
    atividades: z.string().nullable().default(null),
    ocorrencias: z.string().nullable().default(null),
    pendencias: z.string().nullable().default(null),
    sugestoes: montarSugestoesSchema(idsFornecedores, idsTarefas),
  });
}
