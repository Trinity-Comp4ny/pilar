import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { getCorsHeaders, jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { z } from "../_shared/schemas.ts";
import {
  createAuthClient,
  createAdminClient,
  checkRateLimit,
  verificarTokens,
  mensagemBloqueioTokens,
  callGeminiStructured,
  debitarTokens,
  GEMINI_MODEL,
  recordAgentRun,
} from "../_shared/ai-client.ts";

// Spec 080: transcreve um áudio curto do RDO e extrai os campos de texto
// livre + enum simples do diário (clima, condição, efetivo total, atividades,
// ocorrências, pendências). O áudio em si nunca é persistido: só passa pela
// memória do request.
//
// Spec 086: além disso, sugere efetivo por fornecedor, impedimento, visita e
// tarefa — cada um CASADO contra o cadastro real (fornecedores/tarefas
// abertas) enviado no request. Sugestão nunca vira dado sozinha: o front só
// insere no formulário quando o usuário clica "Adicionar" em cada item.

// Confirmado ao vivo contra a API (01/09): audio/webm (formato padrão do
// MediaRecorder no Chrome) é aceito e transcrito normalmente.
const MIME_PERMITIDOS = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/aac"];
// ~3min de fala em opus/aac a até ~400kbps ainda cabe folgado aqui.
const MAX_BASE64_CHARS = 12_000_000;
// Cadastro de fornecedor/tarefa não é caso real hoje com centenas de linhas;
// teto defensivo pra não deixar o prompt crescer sem limite.
const MAX_LISTA_ITENS = 200;

const TIPOS_IMPEDIMENTO = ["falta_material", "clima", "pendencia_projeto", "mao_de_obra", "outro"] as const;
const RESULTADOS_TAREFA = ["avancou", "concluiu", "parou"] as const;

const RefLista = z.object({ id: z.string(), nome: z.string() }).array();

function montarSugestoesSchema(idsFornecedores: ReadonlySet<string>, idsTarefas: ReadonlySet<string>) {
  const fornecedorId = z
    .string()
    .nullable()
    .default(null)
    .refine((v) => v == null || idsFornecedores.has(v), "fornecedor_id fora da lista enviada");
  const tarefaId = z.string().refine((v) => idsTarefas.has(v), "tarefa_id fora da lista enviada");

  return z.object({
    efetivo_por_fornecedor: z
      .array(
        z.object({
          fornecedor_id: fornecedorId,
          fornecedor_nome: z.string(),
          quantidade: z.number().int().positive(),
        })
      )
      .default([]),
    impedimentos: z.array(z.object({ descricao: z.string(), tipo: z.enum(TIPOS_IMPEDIMENTO) })).default([]),
    visitas: z
      .array(
        z.object({
          fornecedor_id: fornecedorId,
          fornecedor_nome: z.string(),
          observacao: z.string().nullable().default(null),
        })
      )
      .default([]),
    tarefas: z.array(z.object({ tarefa_id: tarefaId, resultado: z.enum(RESULTADOS_TAREFA) })).default([]),
  });
}

function montarSchema(idsFornecedores: ReadonlySet<string>, idsTarefas: ReadonlySet<string>) {
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

function promptExtracao(
  fornecedores: Array<{ id: string; nome: string }>,
  tarefasAbertas: Array<{ id: string; nome: string }>
): string {
  const listaFornecedores =
    fornecedores.length > 0
      ? fornecedores.map((f) => `  - id="${f.id}" nome="${f.nome}"`).join("\n")
      : "  (nenhum fornecedor cadastrado)";
  const listaTarefas =
    tarefasAbertas.length > 0
      ? tarefasAbertas.map((t) => `  - id="${t.id}" titulo="${t.nome}"`).join("\n")
      : "  (nenhuma tarefa aberta no cronograma)";

  return [
    "Você transcreve um áudio de um responsável de obra brasileiro relatando o dia",
    "(RDO — relatório diário de obra) e extrai, do que foi DITO, um objeto JSON.",
    "Devolva APENAS um OBJETO JSON com as chaves abaixo. Sem comentários, sem markdown.",
    "",
    "- `transcricao`: transcrição literal do áudio, em português.",
    "- `clima`: um de 'ensolarado', 'nublado', 'chuvoso', 'chuva_forte', SOMENTE se",
    "  o clima foi mencionado explicitamente; senão `null`.",
    "- `condicao_trabalho`: um de 'normal', 'parcial', 'paralisada', SOMENTE se a",
    "  fala indicar claramente o ritmo do trabalho no dia; senão `null`.",
    "- `efetivo`: número TOTAL de pessoas na obra no dia, SOMENTE se dá pra somar",
    "  do que foi dito; senão `null`.",
    "- `atividades`: resumo curto (1-3 frases) do que foi feito/avançado no dia,",
    "  SOMENTE se algo foi relatado; senão `null`. NÃO repita a transcrição inteira,",
    "  resuma o que foi feito.",
    "- `ocorrencias`: algo fora do normal que aconteceu no dia (evento, imprevisto),",
    "  SOMENTE se mencionado; senão `null`.",
    "- `pendencias`: o que ficou pendente para os próximos dias, SOMENTE se",
    "  mencionado; senão `null`.",
    "- `sugestoes`: um objeto com 4 arrays — cada item é uma SUGESTÃO que um",
    "  humano vai revisar antes de confirmar, então prefira omitir a arriscar",
    "  inventar. Array vazio `[]` quando nada bate. Cada item usa EXATAMENTE",
    "  as chaves listadas abaixo — nunca troque, renomeie ou invente chave.",
    "",
    "  `efetivo_por_fornecedor`: array de objetos",
    "  `{ fornecedor_id, fornecedor_nome, quantidade }`, um item por GRUPO de",
    "  pessoas mencionado:",
    "  - `fornecedor_id`: o `id` exato da lista de fornecedores abaixo, SOMENTE",
    "    se o grupo está claramente ligado a um deles; senão `null`.",
    "  - `fornecedor_nome`: nome do grupo — nome do fornecedor dito, ou algo",
    "    como 'Equipe própria' pra gente da própria obra.",
    "  - `quantidade`: número de pessoas daquele grupo.",
    "  NUNCA invente um `fornecedor_id` que não está na lista.",
    "",
    "  Fornecedores cadastrados:",
    listaFornecedores,
    "",
    "  `impedimentos`: array de objetos `{ descricao, tipo }`, um item por",
    "  impedimento relatado (algo que travou o serviço):",
    "  - `descricao`: o que travou, em texto curto.",
    `  - \`tipo\`: um dos 5 valores exatos: ${TIPOS_IMPEDIMENTO.join(", ")}.`,
    "",
    "  `visitas`: array de objetos `{ fornecedor_id, fornecedor_nome,",
    "  observacao }`, um item por visitante mencionado (cliente, dono da",
    "  obra, arquiteto, fiscal — alguém que esteve lá sem trabalhar):",
    "  - `fornecedor_id`: o `id` exato da lista de fornecedores acima, SOMENTE",
    "    se bater; senão `null`.",
    "  - `fornecedor_nome`: nome de quem visitou, como foi dito.",
    "  - `observacao`: motivo da visita, SOMENTE se mencionado; senão `null`.",
    "",
    "  `tarefas`: array de objetos `{ tarefa_id, resultado }`, um item SOMENTE",
    "  quando a fala menciona claramente uma tarefa que já existe na lista",
    "  abaixo:",
    "  - `tarefa_id`: o `id` exato da lista de tarefas abaixo — NUNCA invente",
    "    id nem gere item pra tarefa que não está na lista.",
    "  - `resultado`: um dos 3 valores exatos: avancou, concluiu, parou.",
    "",
    "  Tarefas abertas do cronograma:",
    listaTarefas,
    "",
    "Regra de ouro: na dúvida se algo foi realmente dito ou se um id bate",
    "certo, prefira omitir a inventar. As chaves de cada objeto são sempre as",
    "listadas acima, nunca sinônimos.",
  ].join("\n");
}

serve(
  withSentry("ai-rdo-voz", async (req) => {
    if (req.method === "OPTIONS") {
      return optionsResponse(req);
    }

    try {
      const authClient = createAuthClient(req);
      const adminClient = createAdminClient();

      const {
        data: { user },
        error: userError,
      } = await authClient.auth.getUser();
      if (userError || !user) throw new Error("Não autenticado");

      const { data: profile } = await authClient.from("profiles").select("empresa_id").eq("id", user.id).single();
      if (!profile) throw new Error("Perfil não encontrado");
      const empresaId = profile.empresa_id as string;

      const canProceed = await checkRateLimit(adminClient, empresaId);
      if (!canProceed) {
        return jsonResponse(
          { error: "Muitas chamadas de IA em sequência. Aguarde um minuto e tente de novo." },
          429,
          req
        );
      }

      const gateTokens = await verificarTokens(adminClient, empresaId, user.id);
      if (!gateTokens.ok && gateTokens.motivo) {
        return jsonResponse({ error: mensagemBloqueioTokens(gateTokens.motivo), motivo: gateTokens.motivo }, 402, req);
      }

      const body = await req.json().catch(() => ({}));
      const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
      const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64 : "";

      if (!audioBase64) {
        return jsonResponse({ error: "Nenhum áudio enviado" }, 400, req);
      }
      if (!MIME_PERMITIDOS.includes(mimeType)) {
        return jsonResponse({ error: "Formato de áudio não suportado neste navegador." }, 400, req);
      }
      if (audioBase64.length > MAX_BASE64_CHARS) {
        return jsonResponse({ error: "Áudio grande demais. Grave um trecho mais curto." }, 400, req);
      }

      const fornecedores = (RefLista.safeParse(body.fornecedores).success ? body.fornecedores : []).slice(
        0,
        MAX_LISTA_ITENS
      );
      const tarefasAbertas = (RefLista.safeParse(body.tarefasAbertas).success ? body.tarefasAbertas : []).slice(
        0,
        MAX_LISTA_ITENS
      );
      const idsFornecedores = new Set<string>(fornecedores.map((f: { id: string }) => f.id));
      const idsTarefas = new Set<string>(tarefasAbertas.map((t: { id: string }) => t.id));

      const files = [{ mimeType, dataBase64: audioBase64 }];
      const tamanhoKb = Math.round((audioBase64.length * 3) / 4 / 1024);
      console.log(`[ai-rdo-voz] transcrevendo ${mimeType} (~${tamanhoKb} KB) para empresa ${empresaId}`);

      const result = await callGeminiStructured(
        {
          systemPrompt: promptExtracao(fornecedores, tarefasAbertas),
          userMessage: "Transcreva e extraia os campos do RDO a partir deste áudio.",
          empresaId,
          tipo: "rdo-voz",
          files,
        },
        montarSchema(idsFornecedores, idsTarefas),
        { maxRetries: 1, maxOutputTokens: 3072 }
      );

      const runId = await recordAgentRun(
        adminClient,
        { systemPrompt: "", userMessage: "[áudio, não persistido]", empresaId, tipo: "rdo-voz" },
        {
          conteudo: result.data,
          resumo: "RDO por voz",
          tokensEntrada: result.tokensEntrada,
          tokensSaida: result.tokensSaida,
        },
        user.id
      );
      await debitarTokens(adminClient, {
        empresaId,
        userId: user.id,
        agentKey: "rdo-voz",
        agentRunId: runId,
        model: GEMINI_MODEL,
        tokensInput: result.tokensEntrada,
        tokensOutput: result.tokensSaida,
        idempotencyKey: crypto.randomUUID(),
        calls: result.attempts,
      });

      return jsonResponse(result.data, 200, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao transcrever o áudio";
      const status = message === "Não autenticado" ? 401 : 400;
      return new Response(JSON.stringify({ error: message }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status,
      });
    }
  })
);
