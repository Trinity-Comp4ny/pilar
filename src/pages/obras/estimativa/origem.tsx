// Origem do preço de cada linha da estimativa (SPEC 137, ADR 0064): chip, painel de detalhe e diálogo para
// informar o valor. Só apresentação; quem decide a origem é o motor (`src/lib/estimativaItens.ts`).
import { Info } from "lucide-react";
import { useState, type ReactNode } from "react";
import { FormDialog } from "@/components/FormDialog";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatValorToInput, parseCurrencyString } from "@/lib/currencyUtils";
import { rotuloMesBase, rotuloRegime } from "@/lib/estimativaObra";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ResultadoEstimativa } from "@/schemas/estimativaObra";
import { ORIGEM_INFO, type TipoDeOrigem } from "./origemInfo";

type Adicional = ResultadoEstimativa["adicionais"][number];
type Fonte = ResultadoEstimativa["fonte"];

const reais2 = (v: number) => formatCurrency(v, { decimals: 2 });

/** Etiqueta da origem. Com `onClick` vira botão que abre o detalhe; sem ele é só rótulo. */
export function ChipOrigem({
  tipo,
  onClick,
  rotuloDoItem,
  className,
}: {
  tipo: TipoDeOrigem;
  onClick?: () => void;
  rotuloDoItem?: string;
  className?: string;
}) {
  const { rotulo, variante } = ORIGEM_INFO[tipo];
  const aparencia = cn(tipo === "a_definir" && "border-dashed border-border-strong text-ink-soft", className);
  if (!onClick) {
    return (
      <Badge variant={variante} className={cn("font-medium", aparencia)}>
        {rotulo}
      </Badge>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Origem do preço${rotuloDoItem ? ` de ${rotuloDoItem.toLowerCase()}` : ""}: ${rotulo}. Ver detalhe`}
      className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Badge variant={variante} className={cn("cursor-pointer gap-1 font-medium", aparencia)}>
        {rotulo}
        <Info className="h-3 w-3" aria-hidden="true" />
      </Badge>
    </button>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 text-sm last:border-b-0">
      <dt className="shrink-0 text-ink-soft">{rotulo}</dt>
      <dd className="min-w-0 break-words text-right text-ink">{children}</dd>
    </div>
  );
}

const NIVEL_SINAPI = {
  coletado: "Coletado em pesquisa de preço no mês",
  derivado: "Derivado de preços coletados em outros estados e meses (coeficiente de representatividade)",
} as const;

interface Detalhe {
  chip: TipoDeOrigem;
  titulo: string;
  valor: number | null;
  linhas: [string, ReactNode][];
  nota: string;
}

function detalheDaBase(r: ResultadoEstimativa): Detalhe {
  const f: Fonte = r.fonte;
  return {
    chip: "cub",
    titulo: `Base do CUB (${r.area.toLocaleString("pt-BR")} m²)`,
    valor: r.base,
    linhas: [
      ["Tabela", `${f.texto.split(" · ")[0]}, ${r.subtipoNome.toLowerCase()}`],
      ["UF e mês", `${f.uf} · ${rotuloMesBase(f.mesBase)}${f.origem === "uf_vizinha" ? " (UF vizinha)" : ""}`],
      ["Regime", rotuloRegime(f.regime)],
      ["Valor", `${reais2(f.valorM2)} por m²`],
      ["Como entra", `${r.area.toLocaleString("pt-BR")} m² × ${reais2(f.valorM2)}`],
    ],
    nota: "O CUB cobre estrutura, alvenaria, instalações básicas e o acabamento do padrão. O que ele não cobre aparece como item à parte.",
  };
}

function detalheDoItem(a: Adicional): Detalhe {
  const o = a.origem;
  const quantidade = a.quantidade.toLocaleString("pt-BR");
  const base = { titulo: a.rotulo, valor: a.valor };
  const porUnidade =
    a.valorUnitario !== null ? `${reais2(a.valorUnitario)}${a.unidade ? ` por ${a.unidade}` : ""}` : null;
  switch (o.tipo) {
    case "sinapi":
      return {
        ...base,
        chip: "sinapi",
        linhas: [
          ["Código SINAPI", <b key="c">{o.codigo} (insumo)</b>],
          [
            "Descrição",
            <span key="d" className="text-xs">
              {o.descricao}
            </span>,
          ],
          ["UF e mês", `${o.uf} · ${rotuloMesBase(o.mesBase)}`],
          ["Regime", rotuloRegime(o.regime)],
          ["Preço", `${reais2(o.valorUnitario)} por ${o.unidade === "UN" ? "unidade" : o.unidade.toLowerCase()}`],
          ["Origem do preço", NIVEL_SINAPI[o.nivel]],
          ["Quantidade", `${quantidade}${a.unidade ? ` ${a.unidade}` : ""}`],
        ],
        nota: "O SINAPI traz preço de insumo de linha corrente, sem instalação e sem administração. Se o seu equipamento for de linha superior, informe o valor.",
      };
    case "empresa":
      return {
        ...base,
        chip: "empresa",
        linhas: [
          ["Origem", "Tabela de preços da sua empresa"],
          ["Item", a.rotulo],
          ...(porUnidade ? ([["Valor da sua empresa", porUnidade]] as [string, ReactNode][]) : []),
        ],
        nota: "O valor da sua empresa vale antes de qualquer referência. Mude na tabela de preços da empresa.",
      };
    case "usuario":
      return {
        ...base,
        chip: "usuario",
        linhas: [
          ["Origem", "Valor informado por você nesta estimativa"],
          ["Nota", o.nota || "sem nota"],
          ...(porUnidade ? ([["Valor", porUnidade]] as [string, ReactNode][]) : []),
          ["Quantidade", `${quantidade}${a.unidade ? ` ${a.unidade}` : ""}`],
        ],
        nota: "Este valor vale só nesta estimativa e fica gravado na versão. Para usar em todas, salve na tabela de preços da empresa.",
      };
    case "referencia_pilar":
      return {
        ...base,
        chip: "referencia_pilar",
        linhas: [
          ["Origem", "Referência provisória do Pilar"],
          ["Item", a.rotulo],
          ...(a.nota ? ([["Valor usado", a.nota]] as [string, ReactNode][]) : []),
          ["Fonte pública", "nenhuma"],
        ],
        nota: "Este número ainda não foi validado com obras reais nem tem fonte pública. Ele alarga a faixa de custo. Informe o valor ou use a tabela de preços da empresa.",
      };
    case "a_definir":
      return {
        ...base,
        chip: "a_definir",
        linhas: [
          ["Origem", "Sem preço"],
          ["Item", a.rotulo],
          ["Por quê", a.nota ?? "sem preço de referência"],
        ],
        nota: "Este item está fora do total e da faixa. Informe o valor para ele entrar na conta.",
      };
  }
}

interface DialogoOrigemProps {
  /** `null` fecha. "base" mostra a fonte do CUB; um id mostra a linha do item. */
  aberto: "base" | Adicional | null;
  resultado: ResultadoEstimativa;
  onFechar: () => void;
  /** Ação "Informar valor" ou "Trocar o valor"; ausente para quem só lê. */
  onInformar?: (item: Adicional) => void;
}

/** Detalhe da origem do preço: código, UF, mês e regime quando é SINAPI, e o que fazer quando não há fonte. */
export function DialogoOrigem({ aberto, resultado, onFechar, onInformar }: DialogoOrigemProps) {
  const detalhe = aberto === null ? null : aberto === "base" ? detalheDaBase(resultado) : detalheDoItem(aberto);
  const item = aberto !== null && aberto !== "base" ? aberto : null;
  const podeInformar = !!item && !!onInformar && item.quantidade > 0;
  const acao =
    item?.origem.tipo === "a_definir"
      ? "Informar valor"
      : item?.origem.tipo === "usuario"
        ? "Trocar o valor"
        : "Usar outro valor";
  return (
    <Dialog open={detalhe !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-w-lg">
        {detalhe && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <ChipOrigem tipo={detalhe.chip} />
                <span className="text-sm text-ink-soft">
                  {detalhe.valor === null ? "fora do total" : formatCurrency(detalhe.valor, { decimals: 0 })}
                </span>
              </div>
              <DialogTitle>{detalhe.titulo}</DialogTitle>
              <DialogDescription className="sr-only">De onde vem o preço desta linha.</DialogDescription>
            </DialogHeader>
            <dl>
              {detalhe.linhas.map(([rotulo, valor]) => (
                <Linha key={rotulo} rotulo={rotulo}>
                  {valor}
                </Linha>
              ))}
            </dl>
            <p className="rounded-xl border border-info-mid bg-info-soft px-3 py-3 text-sm text-info-strong">
              {detalhe.nota}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={onFechar}>
                Fechar
              </Button>
              {podeInformar && (
                <Button variant="brand" onClick={() => onInformar(item)}>
                  {acao}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DialogoInformarValorProps {
  /** Linha do item; `null` fecha. */
  item: Adicional | null;
  /** Valor e nota já informados, para trocar. */
  atual?: { valor_unitario: number; nota?: string };
  onFechar: () => void;
  onConfirmar: (valorUnitario: number, nota: string) => void;
  /** Tira o valor informado e volta à fonte seguinte (empresa, SINAPI ou provisória). */
  onRemover?: () => void;
}

const LIMITE_DO_VALOR = 1_000_000_000;

/** O valor que a pessoa informa vale só nesta estimativa e vira a origem "Você informou". */
export function DialogoInformarValor({ item, atual, onFechar, onConfirmar, onRemover }: DialogoInformarValorProps) {
  return (
    <FormularioDoValor
      key={item?.id ?? "fechado"}
      item={item}
      atual={atual}
      onFechar={onFechar}
      onConfirmar={onConfirmar}
      onRemover={onRemover}
    />
  );
}

function FormularioDoValor({ item, atual, onFechar, onConfirmar, onRemover }: DialogoInformarValorProps) {
  const [valor, setValor] = useState(() => (atual ? formatValorToInput(atual.valor_unitario) : ""));
  const [nota, setNota] = useState(atual?.nota ?? "");
  const [tentou, setTentou] = useState(false);
  const numero = parseCurrencyString(valor);
  const erro = !(numero > 0)
    ? "Informe um valor maior que zero"
    : numero >= LIMITE_DO_VALOR
      ? "Esse valor é alto demais"
      : undefined;
  const porUnidade = item?.unidade ? `por ${item.unidade}` : "total do item";
  return (
    <FormDialog
      open={item !== null}
      onOpenChange={(aberto) => !aberto && onFechar()}
      title={item ? `Informar valor: ${item.rotulo}` : "Informar valor"}
      description='O valor passa a valer nesta estimativa e a origem vira "Você informou". Nada vai para a tabela de preços da empresa sem você pedir.'
      submitLabel="Usar este valor"
      onSubmit={() => {
        if (erro) {
          setTentou(true);
          return;
        }
        onConfirmar(numero, nota.trim());
      }}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="valor-informado" className="mb-1.5 block text-sm font-medium text-ink-soft">
            Valor ({porUnidade})
          </label>
          <MoneyInput
            id="valor-informado"
            value={valor}
            onChange={setValor}
            aria-invalid={tentou && erro ? true : undefined}
            aria-describedby={tentou && erro ? "valor-informado-erro" : undefined}
          />
          {tentou && erro ? (
            <p id="valor-informado-erro" role="alert" className="mt-1.5 text-xs text-danger-mid">
              {erro}
            </p>
          ) : (
            item && (
              <p className="mt-1.5 text-xs text-ink-soft">
                {item.unidade
                  ? `${item.quantidade.toLocaleString("pt-BR")} ${item.unidade} na estimativa. O total é a quantidade vezes o valor.`
                  : "O valor vale para o item inteiro."}
              </p>
            )
          )}
        </div>
        <div>
          <label htmlFor="valor-nota" className="mb-1.5 block text-sm font-medium text-ink-soft">
            Nota <span className="font-normal">(opcional)</span>
          </label>
          <Input
            id="valor-nota"
            value={nota}
            maxLength={200}
            placeholder="Ex.: orçamento do integrador, 15/10"
            onChange={(e) => setNota(e.target.value)}
          />
        </div>
        {atual && onRemover && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemover}>
            Remover o valor informado
          </Button>
        )}
      </div>
    </FormDialog>
  );
}
