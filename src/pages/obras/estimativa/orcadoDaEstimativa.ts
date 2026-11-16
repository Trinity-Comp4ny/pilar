// Preencher o orçado de uma obra que já existe com o previsto de uma estimativa: o mesmo previsto que a estimativa
// leva para a obra quando vira obra (`obraDaEstimativa`), casado com as fases e etapas que a obra TEM, pelo nome.
// Fase da estimativa que a obra não tem fica de fora e é avisada. O valor de etapa que não casa por nome se divide
// entre as etapas da fase que ficaram sem valor; se não sobrou etapa livre, vai para a própria fase (o previsto da
// fase vale no lugar da soma das etapas dela). Valor que o usuário já digitou só muda se pedir para substituir.
import { distribuir } from "@/lib/estimativaObra";
import type { ResultadoEstimativa } from "@/schemas/estimativaObra";
import { obraDaEstimativa } from "./obraDaEstimativa";

export interface NoDoOrcado {
  id: string;
  parent_id: string | null;
  nivel: string;
  nome: string;
}

interface LinhaDoOrcado {
  id: string;
  /** "Fase › Etapa" ou só "Fase". */
  caminho: string;
  anterior: number;
  novo: number;
  /** Já tinha valor e ele foi mantido (não pediu para substituir). */
  mantido: boolean;
}

export interface PlanoDoOrcado {
  linhas: LinhaDoOrcado[];
  /** Fases da estimativa que a obra não tem, com o valor que ficou sem destino. */
  semCorrespondencia: { fase: string; valor: number }[];
  /** Soma do que será gravado (linhas não mantidas). */
  totalNovo: number;
}

const centavos = (v: number) => Math.round(v * 100);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export function planejarOrcadoDaEstimativa(
  resultado: ResultadoEstimativa,
  nos: ReadonlyArray<NoDoOrcado>,
  previstoAtual: ReadonlyMap<string, number>,
  substituir: boolean
): PlanoDoOrcado {
  const { fases } = obraDaEstimativa(resultado);
  const fasesDaObra = nos.filter((n) => n.nivel === "fase");
  const etapasDe = (faseId: string) => nos.filter((n) => n.parent_id === faseId && n.nivel === "etapa");

  const linhas: LinhaDoOrcado[] = [];
  const semCorrespondencia: PlanoDoOrcado["semCorrespondencia"] = [];

  const registrar = (no: NoDoOrcado, caminho: string, valorCent: number) => {
    const anterior = previstoAtual.get(no.id) ?? 0;
    const mantido = anterior > 0 && !substituir;
    linhas.push({ id: no.id, caminho, anterior, novo: mantido ? anterior : valorCent / 100, mantido });
  };

  for (const fe of fases) {
    const fase = fasesDaObra.find((f) => norm(f.nome) === norm(fe.nome));
    const totalCent = fe.etapas.reduce((s, e) => s + centavos(e.previsto), 0);
    if (!fase) {
      if (totalCent > 0) semCorrespondencia.push({ fase: fe.nome, valor: totalCent / 100 });
      continue;
    }
    const etapas = etapasDe(fase.id);
    if (etapas.length === 0) {
      if (totalCent > 0) registrar(fase, fase.nome, totalCent);
      continue;
    }

    const doObra = new Map<string, number>();
    let sobra = 0;
    for (const e of fe.etapas) {
      const alvo = etapas.find((x) => norm(x.nome) === norm(e.nome));
      if (alvo) doObra.set(alvo.id, (doObra.get(alvo.id) ?? 0) + centavos(e.previsto));
      else sobra += centavos(e.previsto);
    }
    const livres = etapas.filter((x) => !doObra.has(x.id));
    if (sobra > 0 && livres.length > 0) {
      const partes = distribuir(
        sobra,
        livres.map(() => 1)
      );
      livres.forEach((x, i) => doObra.set(x.id, partes[i]));
    } else if (sobra > 0) {
      // Nenhuma etapa livre para receber: o total da fase fica na fase.
      registrar(fase, fase.nome, totalCent);
    }
    for (const x of etapas) {
      const v = doObra.get(x.id);
      if (v !== undefined && v > 0) registrar(x, `${fase.nome} › ${x.nome}`, v);
    }
  }

  return {
    linhas,
    semCorrespondencia,
    totalNovo: linhas.filter((l) => !l.mantido).reduce((s, l) => s + centavos(l.novo), 0) / 100,
  };
}
