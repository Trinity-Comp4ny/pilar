// Itens que o CUB não cobre, no passo "O que a obra tem" (SPEC 137, protótipo v1). Cada item mostra, antes de
// calcular, de onde virá o preço: a prévia usa a mesma resolução do cálculo (`previaDoItem`).
import { Check, Minus, Plus } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import type { Ficha, Premissas, ResultadoEstimativa } from "@/schemas/estimativaObra";
import type { Insumos } from "./hooks";
import { Campo, CampoNumero, Pilula } from "./componentes";
import { GRUPOS, itensSemZero, quantidadeNaFicha, type ItemDoCatalogo } from "./itensCatalogo";
import { ChipOrigem } from "./origem";
import { textoDaOrigem, type Contexto } from "./textoDaOrigem";
import type { ErrosDaFicha } from "./lib";

type InsumosProntos = Extract<Insumos, { estado: "ok" }>;
type Atualizar = <K extends keyof Ficha>(campo: K, valor: Ficha[K]) => void;

const MARCENARIA: { valor: Ficha["marcenaria"]; rotulo: string }[] = [
  { valor: "nenhuma", rotulo: "Nenhuma" },
  { valor: "basica", rotulo: "Básica" },
  { valor: "completa", rotulo: "Completa" },
];

const RELEVO: { valor: Ficha["topografia"]; rotulo: string }[] = [
  { valor: "plano", rotulo: "Plano" },
  { valor: "inclinado", rotulo: "Inclinado" },
];

export function Passinhos({
  rotulo,
  unidade,
  valor,
  onChange,
}: {
  rotulo: string;
  unidade: string;
  valor: number;
  onChange: (n: number) => void;
}) {
  const id = useId();
  return (
    <span
      className="flex min-w-[9.5rem] items-center justify-between gap-2 rounded-xl border bg-card py-1 pl-3 pr-1"
      role="group"
      aria-labelledby={id}
    >
      <span id={id} className="text-xs text-ink-soft">
        {unidade}
      </span>
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Menos ${rotulo.toLowerCase()}`}
          disabled={valor <= 0}
          onClick={() => onChange(valor - 1)}
          className="grid h-8 w-8 place-items-center rounded-full border text-ink hover:bg-muted disabled:opacity-40"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <output className="min-w-6 text-center text-sm font-semibold tabular-nums text-ink" aria-live="polite">
          {valor}
        </output>
        <button
          type="button"
          aria-label={`Mais ${rotulo.toLowerCase()}`}
          disabled={valor >= 100_000}
          onClick={() => onChange(valor + 1)}
          className="grid h-8 w-8 place-items-center rounded-full border text-ink hover:bg-muted disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </span>
    </span>
  );
}

function Controle({
  item,
  ficha,
  atualizar,
  erros,
}: {
  item: ItemDoCatalogo;
  ficha: Ficha;
  atualizar: Atualizar;
  erros: ErrosDaFicha;
}) {
  const quantidade = quantidadeNaFicha(item, ficha);
  const ligado = quantidade > 0;

  if (item.controle === "contador") {
    return (
      <Passinhos
        rotulo={item.nome}
        unidade={item.unidade ?? "un"}
        valor={quantidade}
        onChange={(n) => atualizar("itens", itensSemZero(ficha.itens, item.id, n))}
      />
    );
  }
  if (item.controle === "metros") {
    return (
      <div className="w-36">
        <CampoNumero
          id={`item-${item.id}`}
          valor={ficha.piscina}
          onChange={(n) => atualizar("piscina", n)}
          sufixo="m²"
          erro={erros.piscina}
        />
      </div>
    );
  }
  if (item.controle === "marcenaria") {
    return (
      <span className="flex flex-wrap gap-1.5" role="group" aria-label="Marcenaria e móveis planejados">
        {MARCENARIA.map((m) => (
          <Pilula key={m.valor} ativa={ficha.marcenaria === m.valor} onClick={() => atualizar("marcenaria", m.valor)}>
            {m.rotulo}
          </Pilula>
        ))}
      </span>
    );
  }
  if (item.controle === "relevo") {
    return (
      <span className="flex flex-wrap gap-1.5" role="group" aria-label="Relevo do terreno">
        {RELEVO.map((r) => (
          <Pilula key={r.valor} ativa={ficha.topografia === r.valor} onClick={() => atualizar("topografia", r.valor)}>
            {r.rotulo}
          </Pilula>
        ))}
      </span>
    );
  }

  const alternar = () => {
    if (item.id === "gourmet") atualizar("gourmet", !ficha.gourmet);
    else if (item.id === "paisagismo") atualizar("paisagismo", !ficha.paisagismo);
    else if (item.id === "elevador") atualizar("elevador", !ficha.elevador);
    else if (item.id === "subsolo") atualizar("subsolo", !ficha.subsolo);
    else atualizar("itens", itensSemZero(ficha.itens, item.id, ligado ? 0 : 1));
  };
  return (
    <Pilula ativa={ligado} onClick={alternar}>
      {ligado ? (
        <>
          <Check className="h-3.5 w-3.5" aria-hidden="true" /> Incluído
        </>
      ) : (
        <>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Incluir
        </>
      )}
      <span className="sr-only">{item.nome}</span>
    </Pilula>
  );
}

function LinhaDoItem({
  item,
  contexto,
  atualizar,
  erros,
}: {
  item: ItemDoCatalogo;
  contexto: Contexto;
  atualizar: Atualizar;
  erros: ErrosDaFicha;
}) {
  // O relevo não tem preço próprio: ele liga o muro de arrimo e a terraplenagem, que têm a origem deles.
  const origem = item.controle === "relevo" ? null : textoDaOrigem(item.id, item, contexto);
  const inclinado = item.controle === "relevo" && contexto.ficha.topografia === "inclinado";
  return (
    <div className="border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-sm font-medium text-ink">{item.nome}</p>
          {origem && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
              <ChipOrigem tipo={origem.tipo} className="px-2 py-0 text-[11px]" />
              {origem.texto}
            </div>
          )}
          {item.controle === "relevo" && (
            <p className="mt-1 text-xs text-ink-soft">Soma o muro de arrimo e deixa terraplenagem a definir.</p>
          )}
        </div>
        <Controle item={item} ficha={contexto.ficha} atualizar={atualizar} erros={erros} />
      </div>
      {inclinado && (
        <div className="mt-3 sm:max-w-[calc(50%-0.5rem)]">
          <Campo
            id="est-arrimo"
            rotulo="Muro de arrimo"
            dica="Comprimento vezes altura média, em m². Sem a medida, o item fica a definir. Terraplenagem e fundação especial dependem de levantamento topográfico e sondagem."
            erro={erros.arrimo}
          >
            <CampoNumero
              id="est-arrimo"
              valor={contexto.ficha.arrimo}
              onChange={(n) => atualizar("arrimo", n)}
              sufixo="m²"
              erro={erros.arrimo}
            />
          </Campo>
        </div>
      )}
    </div>
  );
}

/** Resumo do que já entrou e de quanto tem fonte, para a pessoa ver o efeito das escolhas antes de continuar. */
function Resumo({ resultado }: { resultado: ResultadoEstimativa | null }) {
  if (!resultado) return null;
  const itens = resultado.adicionais.filter((a) => a.id !== "fundacao");
  const semPreco = itens.filter((a) => a.aDefinir).length;
  const verificavel = resultado.origens?.verificavelPct;
  return (
    <p className="rounded-xl border border-info-mid bg-info-soft px-3 py-3 text-sm text-info-strong" role="status">
      <strong>{itens.length === 1 ? "1 item" : `${itens.length} itens`}</strong> até aqui
      {semPreco > 0 && (
        <>
          , <strong>{semPreco} sem preço</strong>: ficam fora do total até você informar o valor
        </>
      )}
      .{verificavel !== undefined && ` ${Math.round(verificavel)}% do total já tem fonte verificável.`}
    </p>
  );
}

interface ItensDaObraProps {
  ficha: Ficha;
  atualizar: Atualizar;
  erros: ErrosDaFicha;
  insumos: InsumosProntos;
  premissas: Premissas;
  resultado: ResultadoEstimativa | null;
}

export function ItensDaObra({ ficha, atualizar, erros, insumos, premissas, resultado }: ItensDaObraProps) {
  const contexto: Contexto = { ficha, parametros: insumos.parametros, insumos, premissas };
  const residencial = ficha.tipo === "residencial";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-ink-soft">
        <span>Origem do preço:</span>
        {(["sinapi", "empresa", "usuario", "referencia_pilar", "a_definir"] as const).map((t) => (
          <ChipOrigem key={t} tipo={t} className="px-2 py-0 text-[11px]" />
        ))}
      </div>
      {GRUPOS.map((g) => {
        const itens = g.itens.filter((i) => !i.so || residencial);
        if (itens.length === 0) return null;
        return (
          <section
            key={g.titulo}
            aria-label={g.titulo}
            className={cn("rounded-2xl border bg-card px-4 pb-1 pt-3 md:px-5")}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-base font-semibold text-ink">{g.titulo}</h3>
              {g.nota && <p className="max-w-md text-xs text-ink-soft">{g.nota}</p>}
            </div>
            {itens.map((item) => (
              <LinhaDoItem key={item.id} item={item} contexto={contexto} atualizar={atualizar} erros={erros} />
            ))}
          </section>
        );
      })}
      <Resumo resultado={resultado} />
    </div>
  );
}
