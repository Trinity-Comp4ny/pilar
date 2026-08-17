import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { getCorsHeaders, jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { z } from "../_shared/schemas.ts";
import {
  createAuthClient,
  createAdminClient,
  checkRateLimit,
  callGeminiStructured,
  recordAiUsage,
  recordAgentRun,
  type AiRequest,
} from "../_shared/ai-client.ts";

// Spec 023: lê um PDF/imagem de orçamento de fornecedor via Gemini multimodal.
// O modo padrão é 'auto': a IA CLASSIFICA o documento e roteia sozinha, sem o
// usuário ter que dizer se é comparativo ou cesta. Tipos:
//   'cesta'       = UM fornecedor, VÁRIOS materiais (orçamento de compra).
//   'comparativo' = MESMO item, VÁRIAS lojas (planilha de comparação). Roda em
//                   dois passos: extrair + verificar contra o PDF.
//   'item'        = acha o preço de UM item específico (uso pontual).
// Diferente do import financeiro (017, texto-only), o arquivo vai ao Gemini em
// multimodal (inline_data): orçamento costuma ser PDF escaneado/foto.

const MIME_PERMITIDOS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
// Teto de tamanho do arquivo (base64). ~8MB de binário ≈ 11.2M chars base64.
const MAX_BASE64_CHARS = 11_200_000;

const ItemSchema = z.object({
  descricao: z.string().min(1),
  quantidade: z.number().nonnegative().nullable().optional(),
  unidade: z.string().nullable().optional(),
  preco_unitario: z.number().nonnegative().nullable().optional(),
  valor_total: z.number().nonnegative(),
});

// O modelo às vezes devolve o array na raiz em vez do objeto. Este preprocess
// embrulha o array na chave certa antes de validar.
const embrulhaSeArray = (chave: string) => (v: unknown) => (Array.isArray(v) ? { [chave]: v } : v);

const CestaObjSchema = z.object({
  fornecedor_nome: z.string().nullable().optional(),
  itens: z.array(ItemSchema).default([]),
  avisos: z.array(z.string()).default([]),
});
const CestaSchema = z.preprocess(embrulhaSeArray("itens"), CestaObjSchema);

const ItemUnicoSchema = z.object({
  fornecedor_nome: z.string().nullable().optional(),
  valor_total: z.number().nonnegative(),
  prazo_entrega_dias: z.number().int().nonnegative().nullable().optional(),
  condicao_pagamento: z.string().nullable().optional(),
  avisos: z.array(z.string()).default([]),
});

// Comparativo: uma proposta por LOJA (coluna), com preço à vista e parcelado.
const PropostaComparativaSchema = z.object({
  fornecedor_nome: z.string().min(1),
  quantidade: z.number().positive().nullable().optional(),
  unidade: z.string().nullable().optional(),
  valor_a_vista: z.number().nonnegative(),
  valor_parcelado: z.number().nonnegative().nullable().optional(),
  condicao_pagamento: z.string().nullable().optional(),
  confianca: z.number().min(0).max(1).default(0.7),
});
const ComparativoObjSchema = z.object({
  item_nome: z.string().nullable().optional(),
  propostas: z.array(PropostaComparativaSchema).default([]),
  avisos: z.array(z.string()).default([]),
});
const ComparativoSchema = z.preprocess(embrulhaSeArray("propostas"), ComparativoObjSchema);

const ClassificacaoSchema = z.object({
  tipo: z.enum(["comparativo", "cesta"]),
  confianca: z.number().min(0).max(1).default(0.7),
  motivo: z.string().nullable().optional(),
});

function promptClassificar(contexto: string): string {
  return [
    "Você classifica um orçamento de obra em UM de dois tipos, olhando a ESTRUTURA do documento:",
    "- 'comparativo': o MESMO material/serviço aparece com preços de VÁRIAS lojas/fornecedores",
    "  (as colunas são lojas; serve para comparar quem vende mais barato).",
    "- 'cesta': UM fornecedor lista VÁRIOS materiais diferentes, cada um com seu preço",
    "  (um orçamento de compra de uma loja só).",
    "Sinais de 'comparativo': dois ou mais nomes de loja/empresa como cabeçalhos de coluna,",
    "linhas de condição (À VISTA, PARCELADO, Nx no cartão), o mesmo material repetido por loja.",
    "Sinais de 'cesta': um só fornecedor no topo, e uma lista de materiais distintos.",
    "Na dúvida com poucos dados, escolha 'cesta'.",
    contexto ? `Contexto do que se cota: "${contexto}".` : "",
    "Responda APENAS um OBJETO JSON { tipo, confianca (0-1), motivo }. O `motivo` deve ter no máximo uma frase curta.",
  ].join("\n");
}

function promptCesta(): string {
  return [
    "Você extrai os itens de um orçamento de fornecedor (materiais/serviços de obra).",
    "O documento é brasileiro. Devolve APENAS um OBJETO JSON com as chaves `itens`",
    "(array) e `avisos`. NUNCA responda com um array na raiz. Sem comentários.",
    "",
    "Regras:",
    "- Uma entrada por item cotado (linha de material/serviço). Ignore cabeçalhos,",
    "  dados do fornecedor, totais gerais, impostos agregados e rodapés.",
    "- `descricao`: o nome do material/serviço, sem o preço.",
    "- `quantidade`: número (ponto decimal). Se não houver, use null.",
    "- `unidade`: unidade de medida (un, m, m2, m3, kg, sc, vb...). Se não houver, null.",
    "- `preco_unitario`: preço de UMA unidade (número). Se só houver o total, null.",
    "- `valor_total`: valor total DA LINHA (quantidade × preço unitário). Sempre positivo.",
    "- `fornecedor_nome`: empresa que emitiu o orçamento, se identificável; senão null.",
    "- Em `avisos`, liste linhas que pareciam item mas você não conseguiu interpretar.",
  ].join("\n");
}

function promptItem(contexto: string): string {
  const alvo = contexto.trim();
  return [
    "Você analisa um orçamento de fornecedor (obra) para obter o preço de um item ou",
    "serviço que o usuário está cotando entre vários fornecedores.",
    "O documento é brasileiro. Devolve APENAS JSON válido, sem comentários.",
    "",
    alvo
      ? `Referência do que o usuário está cotando: "${alvo}". Use isso APENAS para desambiguar se o documento tiver várias opções de preço. NÃO exija que o nome bata exatamente.`
      : "O usuário quer o preço total deste orçamento.",
    "",
    "Regras:",
    "- Extraia o PREÇO relevante: se houver um único valor/total, use-o; se houver várias opções,",
    "  escolha a que melhor casa com a referência e explique em `avisos`.",
    "- `valor_total`: número positivo. Só use 0 se não houver nenhum preço; explique em `avisos`.",
    "- `fornecedor_nome` / `prazo_entrega_dias` / `condicao_pagamento`: se houver; senão null.",
    "- Em `avisos`, registre a opção escolhida, ambiguidades, ou a ausência de preço.",
  ].join("\n");
}

function promptComparativo(contexto: string): string {
  const alvo = contexto.trim();
  return [
    "Você lê um COMPARATIVO de preços de obra e extrai UMA proposta por FORNECEDOR (loja).",
    "Estrutura típica: as COLUNAS são as lojas/fornecedores; as LINHAS são o material e as",
    "condições de pagamento (TOTAL, VALOR À VISTA, PARCELADO, Nx no cartão). O documento é",
    "brasileiro. Devolve APENAS um OBJETO JSON com `propostas` (array) e `avisos`. NUNCA um",
    "array na raiz. Sem comentários.",
    "",
    alvo ? `O item comparado é: "${alvo}".` : "Identifique o item comparado em `item_nome`.",
    "",
    "Para CADA loja (UMA entrada por loja — NUNCA repita a mesma loja em várias linhas):",
    "- `fornecedor_nome`: o nome da loja (cabeçalho da coluna).",
    "- `quantidade` / `unidade`: da linha do material (ex.: 12, 'tábuas'). Se não houver, null.",
    "- `valor_a_vista`: o preço da linha 'VALOR À VISTA' daquela loja. Se não existir linha à",
    "  vista, use o TOTAL / preço do material.",
    "- `valor_parcelado`: o preço cheio/parcelado (linha TOTAL, 'PARCELADO' ou 'Nx no cartão')",
    "  SOMENTE se for diferente do à vista; se for igual ou não houver, use null.",
    "- `condicao_pagamento`: descreva a condição do parcelado ('3x no cartão', 'cheio'...); senão null.",
    "- `confianca`: 0 a 1 — quão seguro você está da leitura dessa loja.",
    "- NÃO gere uma proposta por condição de pagamento. Consolide as condições numa proposta por",
    "  loja. Ignore células vazias. Traga TODAS as lojas; não invente lojas.",
    "- Em `avisos`, registre ambiguidades ou lojas ilegíveis.",
  ].join("\n");
}

function promptVerificacaoComparativo(extracaoJson: string, contexto: string): string {
  const alvo = contexto.trim();
  return [
    "Você é um REVISOR de extração. Recebe uma extração de um comparativo de preços e o",
    "PRÓPRIO documento. Confira célula por célula e devolva a versão CORRIGIDA, no mesmo",
    "formato (OBJETO JSON com `propostas` e `avisos`, nunca array na raiz). Sem comentários.",
    "",
    alvo ? `Item cotado: "${alvo}".` : "",
    "",
    "Verifique especialmente:",
    "- Cada loja aparece UMA única vez (não duplicada por condição). Consolide à vista + parcelado.",
    "- `valor_a_vista` e `valor_parcelado` batem com as células certas do documento.",
    "- Nenhuma loja do documento ficou de fora; nenhuma loja inventada foi incluída.",
    "- `quantidade` e `unidade` do material corretas.",
    "Corrija o que estiver errado e rebaixe `confianca` das linhas duvidosas.",
    "Em `avisos`, liste objetivamente o que você corrigiu.",
    "",
    "Extração a revisar:",
    extracaoJson,
  ].join("\n");
}

interface ExtracaoResult {
  modo: "comparativo" | "cesta" | "item";
  data: Record<string, unknown>;
  tokensEntrada: number;
  tokensSaida: number;
  chamadas: number;
}

/** Extrai conforme o modo. Comparativo roda em dois passos (extrair + verificar). */
async function extrair(
  modo: "comparativo" | "cesta" | "item",
  files: AiRequest["files"],
  contexto: string,
  empresaId: string
): Promise<ExtracaoResult> {
  if (modo === "comparativo") {
    const extr = await callGeminiStructured(
      {
        systemPrompt: promptComparativo(contexto),
        userMessage: "Extraia uma proposta por loja deste comparativo de preços.",
        empresaId,
        tipo: "cotacao-import",
        files,
      },
      ComparativoSchema,
      { maxRetries: 1, maxOutputTokens: 8192 }
    );
    const ver = await callGeminiStructured(
      {
        systemPrompt: promptVerificacaoComparativo(JSON.stringify(extr.data), contexto),
        userMessage: "Revise a extração acima contra o documento e devolva a versão corrigida.",
        empresaId,
        tipo: "cotacao-import",
        files,
      },
      ComparativoSchema,
      { maxRetries: 0, maxOutputTokens: 8192 }
    );
    return {
      modo,
      data: ver.data as Record<string, unknown>,
      tokensEntrada: extr.tokensEntrada + ver.tokensEntrada,
      tokensSaida: extr.tokensSaida + ver.tokensSaida,
      chamadas: extr.attempts + ver.attempts,
    };
  }

  const systemPrompt = modo === "item" ? promptItem(contexto) : promptCesta();
  const userMessage =
    modo === "item"
      ? "Ache o preço do item cotado neste orçamento de fornecedor."
      : "Extraia os itens deste orçamento de fornecedor.";
  const schema = modo === "item" ? ItemUnicoSchema : CestaSchema;
  const result = await callGeminiStructured(
    { systemPrompt, userMessage, empresaId, tipo: "cotacao-import", files },
    schema,
    { maxRetries: 1, maxOutputTokens: 8192 }
  );
  return {
    modo,
    data: result.data as Record<string, unknown>,
    tokensEntrada: result.tokensEntrada,
    tokensSaida: result.tokensSaida,
    chamadas: result.attempts,
  };
}

serve(
  withSentry("ai-cotacao-import", async (req) => {
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
        return jsonResponse({ error: "Limite mensal de IA atingido" }, 429, req);
      }

      const body = await req.json().catch(() => ({}));
      const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
      const arquivoBase64 = typeof body.arquivoBase64 === "string" ? body.arquivoBase64 : "";
      const modoPedido: "item" | "cesta" | "comparativo" | "auto" =
        body.modo === "item"
          ? "item"
          : body.modo === "cesta"
            ? "cesta"
            : body.modo === "comparativo"
              ? "comparativo"
              : "auto";
      const contexto = typeof body.contexto === "string" ? body.contexto : "";

      if (!arquivoBase64) {
        return jsonResponse({ error: "Nenhum arquivo enviado" }, 400, req);
      }
      if (!MIME_PERMITIDOS.includes(mimeType)) {
        return jsonResponse({ error: "Formato não suportado. Envie PDF, PNG, JPG ou WebP." }, 400, req);
      }
      if (arquivoBase64.length > MAX_BASE64_CHARS) {
        return jsonResponse({ error: "Arquivo grande demais (máx. 8 MB). Reduza ou divida o orçamento." }, 400, req);
      }

      const files = [{ mimeType, dataBase64: arquivoBase64 }];
      const tamanhoKb = Math.round((arquivoBase64.length * 3) / 4 / 1024);
      console.log(
        `[ai-cotacao-import] modo=${modoPedido} lendo ${mimeType} (~${tamanhoKb} KB) para empresa ${empresaId}`
      );

      let tokensEntrada = 0;
      let tokensSaida = 0;
      let chamadas = 0;
      let modoEfetivo: "comparativo" | "cesta" | "item";
      let classificacao: { tipo: string; confianca: number; motivo: string | null } | null = null;

      if (modoPedido === "auto") {
        const clf = await callGeminiStructured(
          {
            systemPrompt: promptClassificar(contexto),
            userMessage: "Classifique este orçamento (comparativo entre lojas ou cesta de um fornecedor).",
            empresaId,
            tipo: "cotacao-import",
            files,
          },
          ClassificacaoSchema,
          { maxRetries: 1, maxOutputTokens: 1024 }
        );
        tokensEntrada += clf.tokensEntrada;
        tokensSaida += clf.tokensSaida;
        chamadas += clf.attempts;
        modoEfetivo = clf.data.tipo;
        classificacao = { tipo: clf.data.tipo, confianca: clf.data.confianca ?? 0.7, motivo: clf.data.motivo ?? null };
        console.log(
          `[ai-cotacao-import] classificado como '${modoEfetivo}' (${clf.data.confianca}) — ${clf.data.motivo ?? ""}`
        );
      } else {
        modoEfetivo = modoPedido;
      }

      const ex = await extrair(modoEfetivo, files, contexto, empresaId);
      tokensEntrada += ex.tokensEntrada;
      tokensSaida += ex.tokensSaida;
      chamadas += ex.chamadas;

      console.log(`[ai-cotacao-import] modo=${ex.modo} concluído em ${chamadas} chamada(s)`);
      await recordAiUsage(adminClient, empresaId, "cotacao-import", tokensEntrada, tokensSaida, chamadas);
      await recordAgentRun(
        adminClient,
        { systemPrompt: "", userMessage: contexto, empresaId, tipo: "cotacao-import" },
        {
          conteudo: { modo: ex.modo, classificacao, ...ex.data },
          resumo: `Cotação de fornecedor (${ex.modo})`,
          tokensEntrada,
          tokensSaida,
        },
        user.id
      );

      return jsonResponse({ modo: ex.modo, classificacao, ...ex.data }, 200, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao ler o orçamento";
      const status = message === "Não autenticado" ? 401 : 400;
      return new Response(JSON.stringify({ error: message }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status,
      });
    }
  })
);
