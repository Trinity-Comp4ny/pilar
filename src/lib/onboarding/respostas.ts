import type { Json } from "@/integrations/supabase/types";
import {
  FERRAMENTAS,
  PROJETOS_ATIVOS,
  RESPOSTAS_VAZIAS,
  VERSAO_QUESTIONARIO,
  dorPrincipalDe,
  ehDor,
  MAX_DORES,
  type Dor,
  type Ferramenta,
  type ProjetosAtivos,
  type RespostasOnboarding,
} from "@/lib/onboarding/dores";

/** Linha de `onboarding_respostas`, só com o que o app lê e escreve. */
export interface LinhaRespostas {
  dores: string[];
  dor_principal: string | null;
  texto_livre: string | null;
  contexto: Json;
  etapa_atual: number;
  concluido_em: string | null;
}

/** Valida o que veio do banco na fronteira: nunca confia no shape cru. */
export function lerRespostas(linha: Partial<LinhaRespostas> | null | undefined): RespostasOnboarding {
  if (!linha) return { ...RESPOSTAS_VAZIAS };
  const dores = (linha.dores ?? []).filter(ehDor).slice(0, MAX_DORES);
  const principal = ehDor(linha.dor_principal) ? linha.dor_principal : null;
  const ctx =
    linha.contexto && typeof linha.contexto === "object" && !Array.isArray(linha.contexto) ? linha.contexto : {};
  const c = ctx as Record<string, unknown>;

  const apr = c.aprofundamento as { dor?: unknown; resposta?: unknown } | undefined;
  const projetos = PROJETOS_ATIVOS.find((p) => p.value === c.projetosAtivos)?.value;
  const ferramentas = Array.isArray(c.ferramentas)
    ? c.ferramentas.filter((f): f is Ferramenta => FERRAMENTAS.some((x) => x.value === f))
    : undefined;

  return {
    dores,
    dorPrincipal: dorPrincipalDe(dores, principal),
    textoLivre: linha.texto_livre ?? "",
    contexto: {
      ...(apr && ehDor(apr.dor) && typeof apr.resposta === "string"
        ? { aprofundamento: { dor: apr.dor, resposta: apr.resposta } }
        : {}),
      ...(projetos ? { projetosAtivos: projetos as ProjetosAtivos } : {}),
      ...(ferramentas ? { ferramentas } : {}),
    },
    etapaAtual:
      Number.isInteger(linha.etapa_atual) && (linha.etapa_atual ?? 0) >= 1 ? (linha.etapa_atual as number) : 1,
    concluidoEm: linha.concluido_em ?? null,
  };
}

/** O que gravar em `onboarding_respostas` (sem user_id e empresa_id, que o hook acrescenta). */
export function paraLinha(r: RespostasOnboarding) {
  const dores: Dor[] = r.dores.slice(0, MAX_DORES);
  return {
    versao: VERSAO_QUESTIONARIO,
    dores,
    dor_principal: dorPrincipalDe(dores, r.dorPrincipal),
    texto_livre: r.textoLivre.trim() ? r.textoLivre.trim().slice(0, 1000) : null,
    contexto: r.contexto as Json,
    etapa_atual: r.etapaAtual,
    concluido_em: r.concluidoEm,
  };
}
