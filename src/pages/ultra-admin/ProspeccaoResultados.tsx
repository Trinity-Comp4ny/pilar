import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/motion/PageLoader";
import { useResultados, type Dimensao, type LinhaResultado } from "./prospeccaoApi";
import { AMOSTRA_MINIMA, SEGMENTOS, taxa } from "./prospeccaoLib";

const TITULO: Record<Dimensao, string> = {
  segmento: "Por segmento",
  modelo: "Por modelo de mensagem (teste A/B)",
  regiao: "Por região",
};

const ROTULO_MODELO: Record<string, string> = {
  pessoa_a: "Com nome · A",
  pessoa_b: "Com nome · B",
  empresa_a: "Sem nome · A",
  empresa_b: "Sem nome · B",
};

function rotulo(dimensao: Dimensao, chave: string): string {
  if (dimensao === "segmento") return SEGMENTOS[chave]?.rotulo ?? chave;
  if (dimensao === "modelo") return ROTULO_MODELO[chave] ?? chave;
  return chave;
}

function Tabela({ dimensao, linhas }: { dimensao: Dimensao; linhas: LinhaResultado[] }) {
  return (
    <Card className="overflow-x-auto p-0">
      <h3 className="px-4 pt-4 text-sm font-semibold">{TITULO[dimensao]}</h3>
      <table className="w-full text-sm">
        <thead className="text-left text-ink-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Grupo</th>
            <th className="px-4 py-2 text-right font-medium">Enviados</th>
            <th className="px-4 py-2 text-right font-medium">Respostas</th>
            <th className="px-4 py-2 text-right font-medium">Reuniões</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.chave} className="border-t border-line">
              <td className="px-4 py-2">
                {rotulo(dimensao, l.chave)}
                {l.enviados < AMOSTRA_MINIMA && <span className="ml-2 text-xs text-ink-muted">amostra pequena</span>}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{l.enviados}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {l.respostas} <span className="text-ink-muted">({taxa(l.respostas, l.enviados)})</span>
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {l.reunioes} <span className="text-ink-muted">({taxa(l.reunioes, l.enviados)})</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** Aba Resultados: taxa de resposta e de reunião por segmento, modelo e região. */
export function ProspeccaoResultados() {
  const { data, isPending } = useResultados();
  if (isPending) return <PageLoader />;
  const linhas = data ?? [];
  if (linhas.length === 0) {
    return (
      <EmptyState
        title="Ainda sem envios"
        description="Quando você registrar envios e respostas na aba Hoje, as taxas aparecem aqui."
      />
    );
  }
  const dimensoes: Dimensao[] = ["segmento", "modelo", "regiao"];
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Resposta conta qualquer retorno (inclusive sem interesse). Com menos de {AMOSTRA_MINIMA} envios por grupo, a
        taxa ainda não decide nada: segmento adjacente só vira ICP com número que se sustente.
      </p>
      {dimensoes.map((d) => (
        <Tabela key={d} dimensao={d} linhas={linhas.filter((l) => l.dimensao === d)} />
      ))}
    </div>
  );
}
