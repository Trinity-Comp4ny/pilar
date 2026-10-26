import { useState } from "react";
import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { Ficha, Padrao } from "@/schemas/estimativaObra";
import type { VersaoEstimativa } from "./hooks";
import { Campo, CampoNumero, Pilula } from "./componentes";
import { PADRAO_INFO } from "./lib";

export type CampoPremissa = "adm" | "faixa" | "equipe";

interface Limite {
  rotulo: string;
  min: number;
  max: number;
  inteiro?: boolean;
  sufixo: string;
  erro: string;
}

const LIMITES: Record<CampoPremissa, Limite> = {
  adm: { rotulo: "Taxa de administração", min: 0, max: 40, sufixo: "%", erro: "Use um valor entre 0% e 40%" },
  faixa: { rotulo: "Margem da faixa (±)", min: 1, max: 50, sufixo: "%", erro: "Use um valor entre 1% e 50%" },
  equipe: {
    rotulo: "Equipe na obra",
    min: 1,
    max: 200,
    inteiro: true,
    sufixo: "pessoas",
    erro: "Use um número inteiro de 1 a 200",
  },
};

const valido = (l: Limite, n: number) =>
  Number.isFinite(n) && n >= l.min && n <= l.max && (!l.inteiro || Number.isInteger(n));

interface Props {
  ficha: Ficha;
  valores: Record<CampoPremissa, number>;
  disponiveis: Padrao[];
  onPadrao: (p: Padrao) => void;
  onPremissa: (campo: CampoPremissa, valor: number) => void;
  versoes: VersaoEstimativa[];
  carregandoVersoes: boolean;
  onSalvarVersao: () => void;
}

/**
 * Premissas da estimativa: padrão, administração, faixa e equipe recalculam na hora. Valor fora do limite
 * não entra no cálculo e mostra o motivo; o último valor bom segue valendo.
 */
export function PremissasPainel({
  ficha,
  valores,
  disponiveis,
  onPadrao,
  onPremissa,
  versoes,
  carregandoVersoes,
  onSalvarVersao,
}: Props) {
  const [invalidos, setInvalidos] = useState<Partial<Record<CampoPremissa, string>>>({});

  const mudar = (campo: CampoPremissa, n: number) => {
    if (valido(LIMITES[campo], n)) {
      setInvalidos((e) => ({ ...e, [campo]: undefined }));
      onPremissa(campo, n);
    } else {
      setInvalidos((e) => ({ ...e, [campo]: LIMITES[campo].erro }));
    }
  };

  return (
    <aside className="space-y-4" aria-label="Premissas e versões">
      <section className="space-y-4 rounded-2xl border bg-card p-4 md:p-5">
        <div>
          <h3 className="text-base font-semibold text-ink">Premissas</h3>
          <p className="text-xs text-ink-soft">Mude e o valor recalcula na hora.</p>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-soft" id="premissa-padrao">
            Padrão
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="premissa-padrao">
            {(Object.keys(PADRAO_INFO) as Padrao[]).map((p) => (
              <Pilula
                key={p}
                ativa={ficha.padrao === p}
                disabled={!disponiveis.includes(p)}
                title={disponiveis.includes(p) ? PADRAO_INFO[p].exemplo : "Sem tabela de preço para este subtipo"}
                onClick={() => onPadrao(p)}
              >
                {PADRAO_INFO[p].nome}
              </Pilula>
            ))}
          </div>
        </div>

        {(Object.keys(LIMITES) as CampoPremissa[]).map((campo) => (
          <Campo key={campo} id={`premissa-${campo}`} rotulo={LIMITES[campo].rotulo} erro={invalidos[campo]}>
            <CampoNumero
              id={`premissa-${campo}`}
              valor={valores[campo]}
              onChange={(n) => mudar(campo, n)}
              sufixo={LIMITES[campo].sufixo}
              erro={invalidos[campo]}
            />
          </Campo>
        ))}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4 md:p-5">
        <h3 className="text-base font-semibold text-ink">Versões</h3>
        {carregandoVersoes ? (
          <p className="text-sm text-ink-soft">Carregando as versões.</p>
        ) : versoes.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Nenhuma versão salva. Salve uma versão antes de mandar a estimativa ao cliente: ela fica guardada e não
            muda.
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {versoes.map((v) => (
              <li key={v.id} className="space-y-0.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">v{v.versao}</span>
                  <span className="tabular-nums text-ink">
                    {v.resultado ? formatCurrency(v.resultado.provavel, { decimals: 0 }) : "-"}
                  </span>
                </div>
                {v.nota && <p className="text-ink-soft">{v.nota}</p>}
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                  {formatDateTime(v.criadoEm)}
                  {!v.parametrosValidados && <Badge variant="warning">parâmetros em validação</Badge>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" size="sm" className="w-full" onClick={onSalvarVersao}>
          <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Salvar como nova versão
        </Button>
      </section>
    </aside>
  );
}
