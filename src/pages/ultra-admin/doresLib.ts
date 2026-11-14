import {
  APROFUNDAMENTO,
  DORES,
  FERRAMENTAS,
  PROJETOS_ATIVOS,
  ehDor,
  rotuloDaDor,
  type Dor,
} from "@/lib/onboarding/dores";
import { DISCIPLINAS, PORTES } from "@/lib/perfilEscritorio";
import { lerRespostas, type LinhaRespostas } from "@/lib/onboarding/respostas";

/**
 * "Dores do mercado" (SPEC 165, fase 4): o que cada escritório disse no onboarding inteligente,
 * somado para ler o mercado. Lógica pura sobre as linhas de `onboarding_respostas`, para testar sem tela.
 */

export interface LinhaDores extends Partial<LinhaRespostas> {
  empresa_id: string;
  created_at: string;
  empresas: { nome: string; porte: string | null; disciplinas: string[] | null } | null;
}

/** Resposta já validada, com os dados do escritório ao lado. */
export interface RespostaDoEscritorio {
  empresaId: string;
  empresa: string;
  porte: string | null;
  disciplinas: string[];
  dores: Dor[];
  dorPrincipal: Dor | null;
  textoLivre: string;
  aprofundamento: { dor: Dor; resposta: string } | null;
  projetosAtivos: string | null;
  ferramentas: string[];
  concluidoEm: string | null;
  criadoEm: string;
}

export function lerLinhas(linhas: LinhaDores[]): RespostaDoEscritorio[] {
  return linhas.map((l) => {
    const r = lerRespostas(l);
    return {
      empresaId: l.empresa_id,
      empresa: l.empresas?.nome ?? "Escritório",
      porte: l.empresas?.porte ?? null,
      disciplinas: l.empresas?.disciplinas ?? [],
      dores: r.dores,
      dorPrincipal: r.dorPrincipal,
      textoLivre: r.textoLivre.trim(),
      aprofundamento: r.contexto.aprofundamento ?? null,
      projetosAtivos: r.contexto.projetosAtivos ?? null,
      ferramentas: r.contexto.ferramentas ?? [],
      concluidoEm: r.concluidoEm,
      criadoEm: l.created_at,
    };
  });
}

export interface FiltroDores {
  /** Faixa de porte (`empresas.porte`); vazio = todas. */
  porte: string | null;
}

export function filtrar(respostas: RespostaDoEscritorio[], { porte }: FiltroDores): RespostaDoEscritorio[] {
  return porte ? respostas.filter((r) => r.porte === porte) : respostas;
}

export interface ItemRanking {
  dor: Dor;
  rotulo: string;
  /** Escritórios que marcaram a dor (entre as 3 possíveis). */
  mencoes: number;
  /** Escritórios em que ela é a principal. */
  principal: number;
  /** % dos escritórios com alguma dor marcada. */
  pct: number;
}

/** Só conta quem marcou alguma dor: quem pulou a pergunta não entra na base do percentual. */
export function rankingDeDores(respostas: RespostaDoEscritorio[]): { itens: ItemRanking[]; base: number } {
  const comDor = respostas.filter((r) => r.dores.length > 0);
  const todas: Dor[] = [...DORES.map((d) => d.value as Dor), "outra"];
  const itens = todas
    .map((dor) => {
      const mencoes = comDor.filter((r) => r.dores.includes(dor)).length;
      const principal = comDor.filter((r) => r.dorPrincipal === dor).length;
      return {
        dor,
        rotulo: rotuloDaDor(dor),
        mencoes,
        principal,
        pct: comDor.length ? Math.round((mencoes / comDor.length) * 100) : 0,
      };
    })
    .filter((i) => i.mencoes > 0)
    .sort((a, b) => b.mencoes - a.mencoes || b.principal - a.principal || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  return { itens, base: comDor.length };
}

export interface Distribuicao {
  value: string;
  rotulo: string;
  total: number;
}

function distribuir(valores: string[], opcoes: readonly { value: string; label: string }[]): Distribuicao[] {
  return opcoes
    .map((o) => ({ value: o.value, rotulo: o.label, total: valores.filter((v) => v === o.value).length }))
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total);
}

export const ferramentasEmUso = (respostas: RespostaDoEscritorio[]) =>
  distribuir(
    respostas.flatMap((r) => r.ferramentas),
    FERRAMENTAS
  );

export const projetosAtivosPorFaixa = (respostas: RespostaDoEscritorio[]) =>
  distribuir(
    respostas.flatMap((r) => (r.projetosAtivos ? [r.projetosAtivos] : [])),
    PROJETOS_ATIVOS
  );

export interface GrupoDores {
  value: string;
  rotulo: string;
  escritorios: number;
  /** As três dores mais citadas do grupo. */
  ranking: ItemRanking[];
}

/** Quantos escritórios de cada disciplina marcaram cada dor (a dor aparece uma vez por escritório). */
export function dorPorDisciplina(respostas: RespostaDoEscritorio[]): GrupoDores[] {
  return DISCIPLINAS.map((d) => {
    const doGrupo = respostas.filter((r) => r.disciplinas.includes(d.value) && r.dores.length > 0);
    return {
      value: d.value,
      rotulo: d.label,
      escritorios: doGrupo.length,
      ranking: rankingDeDores(doGrupo).itens.slice(0, 3),
    };
  }).filter((g) => g.escritorios > 0);
}

/** A dor principal de cada faixa de porte: mostra se o problema muda com o tamanho do escritório. */
export function dorPorPorte(respostas: RespostaDoEscritorio[]): GrupoDores[] {
  return PORTES.map((p) => {
    const doGrupo = respostas.filter((r) => r.porte === p.value && r.dores.length > 0);
    return {
      value: p.value,
      rotulo: p.label,
      escritorios: doGrupo.length,
      ranking: rankingDeDores(doGrupo).itens.slice(0, 3),
    };
  }).filter((g) => g.escritorios > 0);
}

/** Respostas de "como resolve hoje" por dor principal, com o texto da opção. */
export function comoResolvem(respostas: RespostaDoEscritorio[]) {
  const porDor = new Map<Dor, Map<string, number>>();
  for (const r of respostas) {
    if (!r.aprofundamento) continue;
    const mapa = porDor.get(r.aprofundamento.dor) ?? new Map<string, number>();
    mapa.set(r.aprofundamento.resposta, (mapa.get(r.aprofundamento.resposta) ?? 0) + 1);
    porDor.set(r.aprofundamento.dor, mapa);
  }
  return [...porDor.entries()]
    .map(([dor, mapa]) => ({
      dor,
      rotulo: rotuloDaDor(dor),
      pergunta: APROFUNDAMENTO[dor].pergunta,
      respostas: [...mapa.entries()]
        .map(([valor, total]) => ({
          valor,
          rotulo: APROFUNDAMENTO[dor].opcoes.find((o) => o.value === valor)?.label ?? valor,
          total,
        }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.respostas.reduce((s, x) => s + x.total, 0) - a.respostas.reduce((s, x) => s + x.total, 0));
}

/** Texto livre, mais novo primeiro, para ler o que cada dono escreveu com as próprias palavras. */
export function textosLivres(respostas: RespostaDoEscritorio[]) {
  return respostas
    .filter((r) => r.textoLivre)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .map((r) => ({
      empresaId: r.empresaId,
      empresa: r.empresa,
      texto: r.textoLivre,
      principal: r.dorPrincipal ? rotuloDaDor(r.dorPrincipal) : null,
      criadoEm: r.criadoEm,
    }));
}

export interface Resumo {
  /** Escritórios que abriram o questionário. */
  iniciaram: number;
  concluiram: number;
  comDor: number;
  comTexto: number;
}

export const resumir = (respostas: RespostaDoEscritorio[]): Resumo => ({
  iniciaram: respostas.length,
  concluiram: respostas.filter((r) => r.concluidoEm).length,
  comDor: respostas.filter((r) => r.dores.length > 0).length,
  comTexto: respostas.filter((r) => r.textoLivre).length,
});

/**
 * Célula de CSV. Texto livre é escrito por terceiros: começa com = + - @ vira fórmula no Excel e no
 * Sheets, então ganha um apóstrofo na frente (OWASP, CSV injection).
 */
export function celulaCsv(valor: unknown): string {
  let texto = valor === null || valor === undefined ? "" : String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function paraCsv(respostas: RespostaDoEscritorio[]): string {
  const cabecalho = [
    "escritorio",
    "porte",
    "disciplinas",
    "dores",
    "dor_principal",
    "como_resolve_hoje",
    "projetos_ativos",
    "ferramentas",
    "texto_livre",
    "concluido_em",
    "iniciado_em",
  ];
  const rotuloOpcao = (r: RespostaDoEscritorio) =>
    r.aprofundamento
      ? (APROFUNDAMENTO[r.aprofundamento.dor].opcoes.find((o) => o.value === r.aprofundamento!.resposta)?.label ??
        r.aprofundamento.resposta)
      : "";
  const linhas = respostas.map((r) =>
    [
      r.empresa,
      r.porte ?? "",
      r.disciplinas.join("; "),
      r.dores.filter(ehDor).map(rotuloDaDor).join("; "),
      r.dorPrincipal ? rotuloDaDor(r.dorPrincipal) : "",
      rotuloOpcao(r),
      r.projetosAtivos ?? "",
      r.ferramentas.map((f) => FERRAMENTAS.find((x) => x.value === f)?.label ?? f).join("; "),
      r.textoLivre,
      r.concluidoEm ?? "",
      r.criadoEm,
    ]
      .map(celulaCsv)
      .join(",")
  );
  return [cabecalho.join(","), ...linhas].join("\n");
}
