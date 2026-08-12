import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  csvParaLinhas,
  linhaParaCandidato,
  lineHash,
  parseDataBR,
  encontrarDuplicata,
  type Candidato,
  type ContaPendente,
  type ImportTipoDoc,
} from "@/lib/importFinanceiro";

type DespesaInsert = Database["public"]["Tables"]["despesas"]["Insert"];
type ReceitaInsert = Database["public"]["Tables"]["receitas"]["Insert"];

export interface CategoriaOpt {
  id: string;
  nome: string;
  tipo: string | null;
}
export interface ContaOpt {
  id: string;
  nome: string;
  banco: string | null;
}
export interface ProjetoOpt {
  id: string;
  nome: string;
}

export interface AuxData {
  categorias: CategoriaOpt[];
  contas: ContaOpt[];
  projetos: ProjetoOpt[];
  pendentes: ContaPendente[];
}

/** Item do preview, editável antes de confirmar a importação. */
export interface ItemImport {
  id: string; // uuid client-side, key da tabela
  incluir: boolean;
  data: string;
  descricao: string;
  valor: number;
  tipo: "despesa" | "receita";
  categoriaId: string | null;
  categoriaSugerida: string | null;
  parcelaNumero: number | null;
  parcelaTotal: number | null;
  confianca: number;
  lineHash: string;
  duplicataId: string | null;
  acao: "criar" | "conciliar";
}

export interface ResumoImport {
  criados: number;
  conciliados: number;
  totalDespesa: number;
  totalReceita: number;
}

/**
 * A resposta da edge `ai-import-financeiro` vem de um modelo generativo: não dá
 * para confiar no shape. Validamos na fronteira. `valor` é coagido para número
 * e precisa ser finito (guard de NaN); a data passa pelo mesmo `parseDataBR` do
 * caminho CSV. Lançamento que não casar o schema é descartado com aviso, em vez
 * de entrar quebrado no banco.
 */
const lancamentoIASchema = z.object({
  data: z.string(),
  descricao: z.string().trim().min(1),
  valor: z.coerce.number().refine(Number.isFinite, "valor não numérico"),
  tipo: z.enum(["despesa", "receita"]),
  categoria_sugerida: z.string().nullish(),
  parcela_numero: z.coerce.number().int().nullish(),
  parcela_total: z.coerce.number().int().nullish(),
  confianca: z.coerce.number().nullish(),
});

const respostaIASchema = z.object({
  lancamentos: z.array(z.unknown()).optional(),
  avisos: z.array(z.string()).optional(),
  error: z.string().optional(),
});

interface CandidatoExt extends Candidato {
  confianca: number;
  categoriaSugerida?: string | null;
  parcelaNumero?: number | null;
  parcelaTotal?: number | null;
}

interface Conciliada {
  id: string;
  contaOriginal: string | null;
}

interface LoteDesfazer {
  despesasCriadas: string[];
  receitasCriadas: string[];
  conciliadasDespesas: Conciliada[];
  conciliadasReceitas: Conciliada[];
  /** A conciliação sobrescreveu `conta_id`? Se sim, o desfazer restaura o original. */
  contaSobrescrita: boolean;
}

function casarCategoriaId(nome: string | null, tipo: "despesa" | "receita", categorias: CategoriaOpt[]): string | null {
  if (!nome) return null;
  const alvo = tipo === "despesa" ? "despesa" : "receita";
  const n = nome.trim().toLowerCase();
  const m = categorias.find((c) => c.nome.trim().toLowerCase() === n && (!c.tipo || c.tipo.toLowerCase() === alvo));
  return m?.id ?? null;
}

function montarItens(cands: CandidatoExt[], aux: AuxData): ItemImport[] {
  return cands.map((c) => {
    const dup = encontrarDuplicata(c, aux.pendentes);
    return {
      id: crypto.randomUUID(),
      incluir: true,
      data: c.data,
      descricao: c.descricao,
      valor: c.valor,
      tipo: c.tipo,
      categoriaId: casarCategoriaId(c.categoriaSugerida ?? null, c.tipo, aux.categorias),
      categoriaSugerida: c.categoriaSugerida ?? null,
      parcelaNumero: c.parcelaNumero ?? null,
      parcelaTotal: c.parcelaTotal ?? null,
      confianca: c.confianca,
      lineHash: c.lineHash,
      duplicataId: dup,
      acao: dup ? "conciliar" : "criar",
    };
  });
}

async function fetchAux(): Promise<AuxData> {
  const [cat, contas, proj, desp, rec] = await Promise.all([
    supabase.from("categorias_financeiras").select("id, nome, tipo").is("deleted_at", null),
    supabase.from("contas").select("id, nome, banco").is("deleted_at", null),
    supabase.from("projetos").select("id, nome").is("deleted_at", null),
    supabase
      .from("despesas")
      .select("id, valor, data_vencimento")
      .in("status", ["Pendente", "Atrasado"])
      .is("deleted_at", null),
    supabase
      .from("receitas")
      .select("id, valor, data_vencimento")
      .in("status", ["Pendente", "Atrasado"])
      .is("deleted_at", null),
  ]);

  const pendentes: ContaPendente[] = [
    ...(desp.data ?? [])
      .filter((d) => d.data_vencimento)
      .map((d) => ({ id: d.id, valor: Number(d.valor), data: d.data_vencimento as string, tipo: "despesa" as const })),
    ...(rec.data ?? [])
      .filter((r) => r.data_vencimento)
      .map((r) => ({ id: r.id, valor: Number(r.valor), data: r.data_vencimento as string, tipo: "receita" as const })),
  ];

  return {
    categorias: (cat.data as CategoriaOpt[]) ?? [],
    contas: (contas.data as ContaOpt[]) ?? [],
    projetos: (proj.data as ProjetoOpt[]) ?? [],
    pendentes,
  };
}

export function useImportFinanceiro() {
  const auxQuery = useQuery({ queryKey: ["import-financeiro-aux"], queryFn: fetchAux, staleTime: 60_000 });
  const [gravando, setGravando] = useState(false);
  const ultimoLote = useRef<LoteDesfazer | null>(null);
  const [temDesfazer, setTemDesfazer] = useState(false);

  /**
   * Caminho determinístico: CSV ou Excel parseado no client, sem IA. Excel é
   * convertido em CSV (primeira aba) e cai no mesmo pipeline do CSV. O SheetJS
   * é carregado sob demanda para não pesar o bundle inicial.
   */
  const extrairArquivo = useCallback(async (file: File, aux: AuxData) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    let texto: string;
    if (ext === "xlsx" || ext === "xls") {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const primeira = wb.SheetNames[0];
      if (!primeira) throw new Error("Planilha sem abas legíveis.");
      texto = XLSX.utils.sheet_to_csv(wb.Sheets[primeira]);
    } else {
      texto = await file.text();
    }
    const { linhas, avisos } = csvParaLinhas(texto);
    const cands: CandidatoExt[] = linhas.map((l) => ({ ...linhaParaCandidato(l), confianca: 1 }));
    return { itens: montarItens(cands, aux), avisos };
  }, []);

  /** Caminho IA: texto (extraído do PDF localmente) estruturado pela edge function. */
  const extrairTextoIA = useCallback(async (texto: string, tipoDoc: ImportTipoDoc, aux: AuxData) => {
    const { data, error } = await supabase.functions.invoke("ai-import-financeiro", {
      body: { tipo: tipoDoc, texto },
    });
    if (error) throw new Error(error.message ?? "Falha ao extrair do documento");

    const parsed = respostaIASchema.safeParse(data);
    if (!parsed.success) throw new Error("Resposta do documento em formato inesperado");
    const res = parsed.data;
    if (res.error) throw new Error(res.error);

    const avisos = [...(res.avisos ?? [])];
    const cands: CandidatoExt[] = [];
    for (const bruto of res.lancamentos ?? []) {
      const lancamento = lancamentoIASchema.safeParse(bruto);
      if (!lancamento.success) {
        avisos.push("Lançamento ignorado: formato inválido na resposta do documento.");
        continue;
      }
      const l = lancamento.data;
      const dataISO = parseDataBR(l.data);
      if (!dataISO) {
        avisos.push(`Lançamento ignorado: data inválida (${l.descricao}).`);
        continue;
      }
      const valor = Math.abs(l.valor);
      cands.push({
        data: dataISO,
        descricao: l.descricao,
        valor,
        tipo: l.tipo,
        lineHash: lineHash({ data: dataISO, valor, descricao: l.descricao }),
        confianca: l.confianca ?? 0.5,
        categoriaSugerida: l.categoria_sugerida ?? null,
        parcelaNumero: l.parcela_numero ?? null,
        parcelaTotal: l.parcela_total ?? null,
      });
    }
    return { itens: montarItens(cands, aux), avisos };
  }, []);

  const gravarLote = useCallback(
    async (itens: ItemImport[], opts: { contaId: string | null; projetoId: string | null }): Promise<ResumoImport> => {
      setGravando(true);
      try {
        const incluidos = itens.filter((i) => i.incluir);
        const { data: empresaId, error: eErr } = await supabase.rpc("get_user_empresa_id");
        if (eErr || !empresaId) throw new Error("Empresa não identificada");

        const batchId = crypto.randomUUID();
        const contaId = opts.contaId || null;
        const projetoId = opts.projetoId || null;

        const despesasInsert: DespesaInsert[] = [];
        const receitasInsert: ReceitaInsert[] = [];
        const conciliarDespesas: { id: string; data: string }[] = [];
        const conciliarReceitas: { id: string; data: string }[] = [];
        let totalDespesa = 0;
        let totalReceita = 0;

        for (const it of incluidos) {
          if (it.tipo === "despesa") totalDespesa += it.valor;
          else totalReceita += it.valor;

          if (it.acao === "conciliar" && it.duplicataId) {
            (it.tipo === "despesa" ? conciliarDespesas : conciliarReceitas).push({ id: it.duplicataId, data: it.data });
            continue;
          }

          if (it.tipo === "despesa") {
            despesasInsert.push({
              empresa_id: empresaId,
              descricao: it.descricao,
              valor: it.valor,
              data_vencimento: it.data,
              categoria_id: it.categoriaId,
              projeto_id: projetoId,
              conta_id: contaId,
              status: "Pendente",
              parcela_numero: it.parcelaNumero,
              parcela_total: it.parcelaTotal,
              import_batch_id: batchId,
              import_line_hash: it.lineHash,
            });
          } else {
            receitasInsert.push({
              empresa_id: empresaId,
              descricao: it.descricao,
              valor: it.valor,
              data_vencimento: it.data,
              categoria_id: it.categoriaId,
              projeto_id: projetoId,
              conta_id: contaId,
              status: "Pendente",
              parcela_numero: it.parcelaNumero,
              parcela_total: it.parcelaTotal,
              import_batch_id: batchId,
              import_line_hash: it.lineHash,
            });
          }
        }

        const lote: LoteDesfazer = {
          despesasCriadas: [],
          receitasCriadas: [],
          conciliadasDespesas: [],
          conciliadasReceitas: [],
          contaSobrescrita: !!contaId,
        };

        // Quando a conciliação vai sobrescrever `conta_id`, capturamos a conta
        // original de cada registro antes do update, para o desfazer restaurar.
        const contaOrigDespesas = new Map<string, string | null>();
        const contaOrigReceitas = new Map<string, string | null>();
        if (contaId) {
          if (conciliarDespesas.length) {
            const { data, error } = await supabase
              .from("despesas")
              .select("id, conta_id")
              .in("id", conciliarDespesas.map((c) => c.id));
            if (error) throw error;
            for (const d of data ?? []) contaOrigDespesas.set(d.id, d.conta_id);
          }
          if (conciliarReceitas.length) {
            const { data, error } = await supabase
              .from("receitas")
              .select("id, conta_id")
              .in("id", conciliarReceitas.map((c) => c.id));
            if (error) throw error;
            for (const r of data ?? []) contaOrigReceitas.set(r.id, r.conta_id);
          }
        }

        if (despesasInsert.length) {
          const { data, error } = await supabase.from("despesas").insert(despesasInsert).select("id");
          if (error) throw error;
          lote.despesasCriadas = (data ?? []).map((d) => d.id);
        }
        if (receitasInsert.length) {
          const { data, error } = await supabase.from("receitas").insert(receitasInsert).select("id");
          if (error) throw error;
          lote.receitasCriadas = (data ?? []).map((r) => r.id);
        }

        for (const c of conciliarDespesas) {
          const patch: Database["public"]["Tables"]["despesas"]["Update"] = {
            status: "Pago",
            data_pagamento: c.data,
          };
          if (contaId) patch.conta_id = contaId;
          const { error } = await supabase.from("despesas").update(patch).eq("id", c.id);
          if (error) throw error;
          lote.conciliadasDespesas.push({ id: c.id, contaOriginal: contaOrigDespesas.get(c.id) ?? null });
        }
        for (const c of conciliarReceitas) {
          const patch: Database["public"]["Tables"]["receitas"]["Update"] = {
            status: "Recebido",
            data_recebimento: c.data,
          };
          if (contaId) patch.conta_id = contaId;
          const { error } = await supabase.from("receitas").update(patch).eq("id", c.id);
          if (error) throw error;
          lote.conciliadasReceitas.push({ id: c.id, contaOriginal: contaOrigReceitas.get(c.id) ?? null });
        }

        ultimoLote.current = lote;
        setTemDesfazer(true);
        await auxQuery.refetch();

        return {
          criados: lote.despesasCriadas.length + lote.receitasCriadas.length,
          conciliados: lote.conciliadasDespesas.length + lote.conciliadasReceitas.length,
          totalDespesa,
          totalReceita,
        };
      } finally {
        setGravando(false);
      }
    },
    [auxQuery]
  );

  const desfazer = useCallback(async () => {
    const b = ultimoLote.current;
    if (!b) return;
    if (b.despesasCriadas.length) {
      const { error } = await supabase.from("despesas").delete().in("id", b.despesasCriadas);
      if (error) throw error;
    }
    if (b.receitasCriadas.length) {
      const { error } = await supabase.from("receitas").delete().in("id", b.receitasCriadas);
      if (error) throw error;
    }
    for (const c of b.conciliadasDespesas) {
      const patch: Database["public"]["Tables"]["despesas"]["Update"] = { status: "Pendente", data_pagamento: null };
      if (b.contaSobrescrita) patch.conta_id = c.contaOriginal;
      const { error } = await supabase.from("despesas").update(patch).eq("id", c.id);
      if (error) throw error;
    }
    for (const c of b.conciliadasReceitas) {
      const patch: Database["public"]["Tables"]["receitas"]["Update"] = { status: "Pendente", data_recebimento: null };
      if (b.contaSobrescrita) patch.conta_id = c.contaOriginal;
      const { error } = await supabase.from("receitas").update(patch).eq("id", c.id);
      if (error) throw error;
    }
    ultimoLote.current = null;
    setTemDesfazer(false);
    await auxQuery.refetch();
  }, [auxQuery]);

  return { auxQuery, extrairArquivo, extrairTextoIA, gravarLote, desfazer, gravando, temDesfazer };
}
