// SPEC 136, requisito 11 (BEZ-19): a estimativa vira obra. Daqui sai a árvore fase › etapa › serviço do cronograma
// da obra, com datas, e o previsto de cada etapa para a conta da obra (obra_orcamento_etapa).
//
// O orçamento da estimativa é por etapa de custo (Estrutura, Instalações elétricas e hidráulicas...) e o cronograma
// é por etapa de execução (Pilares e vigas, Lajes, Elétrica...). O previsto de cada fase vai para as etapas do
// cronograma daquela fase: a etapa de custo com o mesmo nome vai inteira para a etapa do cronograma; o que não casa
// por nome se divide por igual entre as etapas da fase que ficaram sem valor. A soma do previsto é o subtotal da
// estimativa (base do CUB mais itens com valor). A taxa de administração não entra: na obra ela é receita do
// escritório sobre cada despesa, não custo da obra. Item a definir não entra.
import { distribuir } from "@/lib/estimativaObra";
import type { ResultadoEstimativa } from "@/schemas/estimativaObra";

interface PeriodoNome {
  nome: string;
  inicio: string;
  fim: string;
}

interface EtapaDaObra extends PeriodoNome {
  /** Previsto da etapa em reais. */
  previsto: number;
  servicos: PeriodoNome[];
}

export interface FaseDaObra extends PeriodoNome {
  etapas: EtapaDaObra[];
}

export interface ObraDaEstimativa {
  fases: FaseDaObra[];
  /** Soma do previsto das etapas, em reais: o subtotal da estimativa. */
  previstoTotal: number;
  inicio: string;
  fim: string;
  etapas: number;
  servicos: number;
}

const centavos = (v: number) => Math.round(v * 100);
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
/** O motor nomeia a etapa gerada por um item tirando a quantidade do rótulo: "Piscina (29 m²)" vira "Piscina". */
const nomeDaEtapaDoItem = (rotulo: string) => rotulo.replace(/ \(.*\)$/, "");

export function obraDaEstimativa(r: ResultadoEstimativa): ObraDaEstimativa {
  const fases: FaseDaObra[] = r.fases.map((f) => {
    const custos = [
      ...r.etapas.filter((e) => e.fase === f.id).map((e) => ({ nome: e.nome, cents: centavos(e.valor) })),
      ...r.adicionais
        .filter((a) => a.fase === f.id && a.valor !== null)
        .map((a) => ({ nome: nomeDaEtapaDoItem(a.rotulo), cents: centavos(a.valor ?? 0) })),
    ];

    // Fase com custo e sem etapa no cronograma: uma etapa com o nome da fase segura o previsto.
    const cronograma = f.etapas.length > 0 ? f.etapas : [{ nome: f.nome, inicio: f.inicio, fim: f.fim, servicos: [] }];

    const casado = cronograma.map(() => 0);
    let sobra = 0;
    for (const c of custos) {
      const i = cronograma.findIndex((e) => normalizar(e.nome) === normalizar(c.nome));
      if (i >= 0) casado[i] += c.cents;
      else sobra += c.cents;
    }
    // Etapa de item a definir não recebe a sobra: ela não tem preço, e o valor das outras etapas não é dela.
    const aDefinir = new Set(
      r.adicionais
        .filter((x) => x.fase === f.id && x.valor === null)
        .map((x) => normalizar(nomeDaEtapaDoItem(x.rotulo)))
    );
    const semValor = cronograma.map((e, i) => (casado[i] === 0 && !aDefinir.has(normalizar(e.nome)) ? 1 : 0));
    const pesosDaSobra = semValor.some((p) => p > 0)
      ? semValor
      : cronograma.map((e) => (aDefinir.has(normalizar(e.nome)) ? 0 : 1));
    const daSobra = distribuir(sobra, pesosDaSobra);

    return {
      nome: f.nome,
      inicio: f.inicio,
      fim: f.fim,
      etapas: cronograma.map((e, i) => ({
        nome: e.nome,
        inicio: e.inicio,
        fim: e.fim,
        previsto: (casado[i] + daSobra[i]) / 100,
        servicos: e.servicos.map((s) => ({ nome: s.nome, inicio: s.inicio, fim: s.fim })),
      })),
    };
  });

  const todas = fases.flatMap((f) => f.etapas);
  return {
    fases,
    previstoTotal: todas.reduce((s, e) => s + centavos(e.previsto), 0) / 100,
    inicio: fases[0]?.inicio ?? "",
    fim: fases.reduce((m, f) => (f.fim > m ? f.fim : m), fases[0]?.fim ?? ""),
    etapas: todas.length,
    servicos: todas.reduce((s, e) => s + e.servicos.length, 0),
  };
}
