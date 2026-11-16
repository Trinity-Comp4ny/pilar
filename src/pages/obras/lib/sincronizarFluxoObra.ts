// Atualizar uma obra que já segue um fluxo quando o fluxo muda. Regra: só ACRESCENTA o que falta (fase, etapa,
// serviço e tarefa do fluxo que a obra ainda não tem, casados pelo nome) e preenche o prestador de serviço que
// está sem. Nada que a obra já tem é alterado, movido ou apagado: datas, andamento e edições do usuário ficam.
import { planoDoFluxo, type EstruturaFluxo } from "./fluxoObra";

export interface NoDaObra {
  id: string;
  parent_id: string | null;
  nivel: string;
  nome: string;
  ordem: number;
  data_inicio: string | null;
  data_fim: string | null;
  fornecedor_id?: string | null;
}
export interface TarefaDaObra {
  obra_frente_id: string | null;
  titulo: string;
}

interface NovoNoSync {
  chave: string;
  /** Pai que já existe na obra. */
  paiId: string | null;
  /** Pai que também é novo neste plano. */
  paiChave: string | null;
  nivel: "fase" | "etapa" | "servico";
  nome: string;
  ordem: number;
  inicio: string | null;
  fim: string | null;
  fornecedorId: string | null;
}
interface NovaTarefaSync {
  titulo: string;
  servicoId: string | null;
  servicoChave: string | null;
  inicio: string | null;
  prazo: string | null;
}
export interface PlanoSincronizacao {
  nos: NovoNoSync[];
  tarefas: NovaTarefaSync[];
  /** Serviço da obra sem prestador que o fluxo define. */
  prestadores: { id: string; fornecedor_id: string }[];
  /** Fase ou etapa que existe e precisa crescer para conter o que entrou. */
  periodos: { id: string; inicio: string; fim: string }[];
}

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export function resumoDaSincronizacao(p: PlanoSincronizacao) {
  return {
    fases: p.nos.filter((n) => n.nivel === "fase").length,
    etapas: p.nos.filter((n) => n.nivel === "etapa").length,
    servicos: p.nos.filter((n) => n.nivel === "servico").length,
    tarefas: p.tarefas.length,
    prestadores: p.prestadores.length,
  };
}

export function haAlgoParaSincronizar(p: PlanoSincronizacao): boolean {
  return p.nos.length > 0 || p.tarefas.length > 0 || p.prestadores.length > 0;
}

export function planejarSincronizacao(
  estrutura: EstruturaFluxo,
  nos: ReadonlyArray<NoDaObra>,
  tarefas: ReadonlyArray<TarefaDaObra>,
  inicio: string
): PlanoSincronizacao {
  // Datas sugeridas para o que entra: as mesmas da cascata do fluxo, a partir do início da obra.
  const datas = new Map(planoDoFluxo(estrutura, inicio).itens.map((i) => [i.chave, i]));
  const filhosDe = (paiId: string | null, nivel: string) =>
    nos.filter((n) => (n.parent_id ?? null) === paiId && n.nivel === nivel);
  const achar = (paiId: string | null, nivel: string, nome: string) =>
    filhosDe(paiId, nivel).find((n) => norm(n.nome) === norm(nome)) ?? null;

  const novos: NovoNoSync[] = [];
  const novasTarefas: NovaTarefaSync[] = [];
  const prestadores: PlanoSincronizacao["prestadores"] = [];
  const ampliar = new Map<string, { inicio: string; fim: string }>();
  const ordemNovos = new Map<string, number>();

  const proximaOrdem = (paiId: string | null, paiChave: string | null, nivel: string) => {
    const k = `${paiId ?? ""}|${paiChave ?? ""}`;
    const atual = ordemNovos.get(k) ?? filhosDe(paiId, nivel).length;
    ordemNovos.set(k, atual + 1);
    return atual;
  };
  const crescer = (id: string | null, ini: string | null, fim: string | null) => {
    if (!id || !ini || !fim) return;
    const no = nos.find((n) => n.id === id);
    if (!no?.data_inicio || !no.data_fim) return;
    const atual = ampliar.get(id) ?? { inicio: no.data_inicio, fim: no.data_fim };
    ampliar.set(id, { inicio: ini < atual.inicio ? ini : atual.inicio, fim: fim > atual.fim ? fim : atual.fim });
  };

  estrutura.forEach((fase, fi) => {
    const chaveFase = `|f${fi}`;
    const faseExistente = achar(null, "fase", fase.nome);
    if (!faseExistente) {
      const d = datas.get(chaveFase);
      novos.push({
        chave: chaveFase,
        paiId: null,
        paiChave: null,
        nivel: "fase",
        nome: fase.nome,
        ordem: proximaOrdem(null, null, "fase"),
        inicio: d?.inicio ?? null,
        fim: d?.fim ?? null,
        fornecedorId: null,
      });
    }
    fase.etapas.forEach((etapa, ei) => {
      const chaveEtapa = `${chaveFase}|e${ei}`;
      const etapaExistente = faseExistente ? achar(faseExistente.id, "etapa", etapa.nome) : null;
      if (!etapaExistente) {
        const d = datas.get(chaveEtapa);
        novos.push({
          chave: chaveEtapa,
          paiId: faseExistente?.id ?? null,
          paiChave: faseExistente ? null : chaveFase,
          nivel: "etapa",
          nome: etapa.nome,
          ordem: proximaOrdem(faseExistente?.id ?? null, faseExistente ? null : chaveFase, "etapa"),
          inicio: d?.inicio ?? null,
          fim: d?.fim ?? null,
          fornecedorId: null,
        });
        if (faseExistente) crescer(faseExistente.id, d?.inicio ?? null, d?.fim ?? null);
      }
      etapa.servicos.forEach((sv, si) => {
        const chaveServico = `${chaveEtapa}|s${si}`;
        const servicoExistente = etapaExistente ? achar(etapaExistente.id, "servico", sv.nome) : null;
        const d = datas.get(chaveServico);
        if (!servicoExistente) {
          novos.push({
            chave: chaveServico,
            paiId: etapaExistente?.id ?? null,
            paiChave: etapaExistente ? null : chaveEtapa,
            nivel: "servico",
            nome: sv.nome,
            ordem: proximaOrdem(etapaExistente?.id ?? null, etapaExistente ? null : chaveEtapa, "servico"),
            inicio: d?.inicio ?? null,
            fim: d?.fim ?? null,
            fornecedorId: sv.fornecedor_id,
          });
          if (etapaExistente) {
            crescer(etapaExistente.id, d?.inicio ?? null, d?.fim ?? null);
            crescer(etapaExistente.parent_id, d?.inicio ?? null, d?.fim ?? null);
          }
          for (const t of sv.tarefas) {
            novasTarefas.push({
              titulo: t,
              servicoId: null,
              servicoChave: chaveServico,
              inicio: d?.inicio ?? null,
              prazo: d?.fim ?? null,
            });
          }
          return;
        }
        if (sv.fornecedor_id && !servicoExistente.fornecedor_id) {
          prestadores.push({ id: servicoExistente.id, fornecedor_id: sv.fornecedor_id });
        }
        const titulos = new Set(
          tarefas.filter((t) => t.obra_frente_id === servicoExistente.id).map((t) => norm(t.titulo))
        );
        for (const t of sv.tarefas) {
          if (titulos.has(norm(t))) continue;
          novasTarefas.push({
            titulo: t,
            servicoId: servicoExistente.id,
            servicoChave: null,
            inicio: servicoExistente.data_inicio ?? d?.inicio ?? null,
            prazo: servicoExistente.data_fim ?? d?.fim ?? null,
          });
        }
      });
    });
  });

  return { nos: novos, tarefas: novasTarefas, prestadores, periodos: [...ampliar].map(([id, p]) => ({ id, ...p })) };
}
