// "Descreva a obra" no passo "O que a obra tem" (SPEC 138, BEZ-83, protótipo v1.1 aprovado). A IA lê o texto e
// propõe itens do catálogo; a pessoa confere, ajusta e só então a lista entra na ficha. Preço e origem saem do motor.
import { AlertTriangle, Check, Info, RefreshCw, Wand2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BusyMark } from "@/components/motion/BusyMark";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/format";
import {
  aplicarInterpretacao,
  frasesDoQueMais,
  MAX_DESCRICAO,
  TOKENS_ESTIMADOS,
  valeParaOTipo,
  type Interpretacao,
  type ItemLido,
} from "./interpretacao";
import type { AdicionalId, Ficha, Premissas } from "@/schemas/estimativaObra";
import type { Insumos } from "./hooks";
import { CampoNumero, Pilula } from "./componentes";
import { Passinhos } from "./ItensDaObra";
import { GRUPOS, type ItemDoCatalogo } from "./itensCatalogo";
import { ChipOrigem } from "./origem";
import { textoDaOrigem, type Contexto } from "./textoDaOrigem";
import { FalhaDaIa, useInterpretarObra, useSaldoDeTokens } from "./useDescreverObra";

type InsumosProntos = Extract<Insumos, { estado: "ok" }>;

const CATALOGO = new Map<AdicionalId, ItemDoCatalogo>(GRUPOS.flatMap((g) => g.itens.map((i) => [i.id, i] as const)));
const EXEMPLOS = ["6 splits de 12.000 BTU e aquecedor solar", "Piscina de 8 x 4 m, área gourmet e elevador"];
const PLACEHOLDER =
  "Ex.: 6 splits de 12.000 BTU e 2 de 18.000, aquecedor solar, painel fotovoltaico de 10 kWp, automação, piscina de 20 m², terreno inclinado com 60 m² de muro de arrimo";

const formatarTokens = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)} mil` : formatNumber(n));

type Estado =
  | { tipo: "parado" }
  | { tipo: "lendo" }
  | { tipo: "lida"; leitura: Interpretacao; itens: ItemLido[]; respostas: Partial<Record<AdicionalId, number>> }
  | { tipo: "falha"; falha: FalhaDaIa };

function Aviso({ tom, children }: { tom: "warning" | "info" | "danger"; children: React.ReactNode }) {
  const classes = {
    warning: "border-warning-mid bg-warning-soft text-warning-strong",
    info: "border-info-mid bg-info-soft text-info-strong",
    danger: "border-danger-mid bg-danger-soft text-danger-strong",
  }[tom];
  const Icone = tom === "info" ? Info : AlertTriangle;
  return (
    <div className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-3 text-sm ${classes}`}>
      <Icone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

interface DescrevaAObraProps {
  ficha: Ficha;
  atualizar: <K extends keyof Ficha>(campo: K, valor: Ficha[K]) => void;
  /** Troca a ficha inteira a partir da atual (a leitura mexe em vários campos de uma vez). */
  aplicar: (fn: (f: Ficha) => Ficha) => void;
  insumos: InsumosProntos;
  premissas: Premissas;
}

function ControleDaQuantidade({
  item,
  quantidade,
  onChange,
}: {
  item: ItemDoCatalogo | undefined;
  quantidade: number;
  onChange: (n: number) => void;
}) {
  if (item?.controle === "contador") {
    return <Passinhos rotulo={item.nome} unidade={item.unidade ?? "un"} valor={quantidade} onChange={onChange} />;
  }
  if (item?.controle === "metros") {
    return (
      <div className="w-36">
        <CampoNumero id={`ia-${item.id}`} valor={quantidade} onChange={onChange} sufixo="m²" />
      </div>
    );
  }
  return <span className="text-sm tabular-nums text-ink-soft">incluído</span>;
}

export function DescrevaAObra({ ficha, atualizar, aplicar, insumos, premissas }: DescrevaAObraProps) {
  const [estado, setEstado] = useState<Estado>({ tipo: "parado" });
  const interpretar = useInterpretarObra();
  const saldo = useSaldoDeTokens();
  const texto = ficha.descricao ?? "";
  const lendo = estado.tipo === "lendo";
  const podeLer = texto.trim().length >= 3 && !lendo;

  const ler = () => {
    setEstado({ tipo: "lendo" });
    interpretar.mutate(texto, {
      onSuccess: (leitura) => {
        setEstado({ tipo: "lida", leitura, itens: leitura.itens, respostas: {} });
        void saldo.refetch();
      },
      onError: (e) => {
        setEstado({ tipo: "falha", falha: e instanceof FalhaDaIa ? e : new FalhaDaIa("", "erro") });
        void saldo.refetch();
      },
    });
  };

  const descrever = (frase: string) => {
    atualizar("descricao", frase);
    setEstado({ tipo: "parado" });
  };

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <label htmlFor="est-descricao" className="text-base font-semibold text-ink">
          Descreva a obra
        </label>
        <span className="text-xs tabular-nums text-ink-soft">
          {formatNumber(texto.length)} de {formatNumber(MAX_DESCRICAO)}
        </span>
      </div>
      <Textarea
        id="est-descricao"
        rows={4}
        maxLength={MAX_DESCRICAO}
        value={texto}
        disabled={lendo}
        aria-busy={lendo}
        placeholder={PLACEHOLDER}
        onChange={(e) => atualizar("descricao", e.target.value)}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="max-w-lg text-xs text-ink-soft">
          A IA só transforma o texto em itens da lista abaixo, com a sua confirmação. Ela não define preço nem prazo.
          Usa cerca de {formatarTokens(TOKENS_ESTIMADOS)} tokens.
          {typeof saldo.data === "number" && ` Saldo da empresa: ${formatarTokens(saldo.data)}.`}
        </p>
        {!lendo && (
          <Button
            type="button"
            variant={estado.tipo === "parado" ? "brand" : "outline"}
            size="sm"
            disabled={!podeLer}
            onClick={ler}
          >
            <Wand2 aria-hidden="true" /> {estado.tipo === "lida" ? "Preencher de novo" : "Preencher a lista"}
          </Button>
        )}
      </div>

      {lendo && (
        <div className="mt-3 flex items-center gap-3 text-sm text-ink-soft" role="status">
          <BusyMark className="h-8 w-8" />
          Lendo a descrição e montando a lista...
        </div>
      )}

      {estado.tipo === "falha" && (
        <Falha falha={estado.falha} onTentar={ler} onMao={() => setEstado({ tipo: "parado" })} />
      )}

      {estado.tipo === "lida" && (
        <Leitura
          estado={estado}
          ficha={ficha}
          contexto={{ ficha, parametros: insumos.parametros, insumos, premissas }}
          onEstado={setEstado}
          onExemplo={descrever}
          onUsar={(itens, leitura) => {
            aplicar((f) => aplicarInterpretacao(f, { ...leitura, itens }));
            setEstado({ tipo: "parado" });
            toast.success(itens.length === 1 ? "1 item entrou na ficha" : `${itens.length} itens entraram na ficha`, {
              description: "Confira origem e valor de cada um na lista abaixo.",
            });
          }}
        />
      )}
    </section>
  );
}

function Falha({ falha, onTentar, onMao }: { falha: FalhaDaIa; onTentar: () => void; onMao: () => void }) {
  if (falha.tipo === "bloqueio") {
    return (
      <Aviso tom="warning">
        <p role="alert">{falha.message}</p>
      </Aviso>
    );
  }
  const motivo =
    falha.tipo === "invalida"
      ? "A resposta da IA veio num formato que não consegui usar."
      : "Não consegui falar com a IA agora.";
  const depois =
    falha.tipo === "invalida"
      ? "Seu texto continua aqui. Tente de novo ou preencha a lista à mão, abaixo."
      : "Seu texto continua aqui. Tente de novo em instantes ou preencha a lista à mão, abaixo.";
  return (
    <Aviso tom="danger">
      <p role="alert">
        <strong>{motivo}</strong> {depois}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onTentar}>
          <RefreshCw aria-hidden="true" /> Tentar de novo
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onMao}>
          Preencher à mão
        </Button>
      </div>
    </Aviso>
  );
}

function Leitura({
  estado,
  ficha,
  contexto,
  onEstado,
  onExemplo,
  onUsar,
}: {
  estado: Extract<Estado, { tipo: "lida" }>;
  ficha: Ficha;
  contexto: Contexto;
  onEstado: (e: Estado) => void;
  onExemplo: (frase: string) => void;
  onUsar: (itens: ItemLido[], leitura: Interpretacao) => void;
}) {
  const { leitura, itens, respostas } = estado;
  const perguntasComItem = leitura.perguntas.filter((p) => p.id !== null);
  const perguntasSemItem = leitura.perguntas.filter((p) => p.id === null);
  const frases = frasesDoQueMais(leitura);

  // As respostas das perguntas entram na lista de quem confirma; resposta em item já lido vale mais que a leitura.
  const dasRespostas: ItemLido[] = Object.entries(respostas).flatMap(([id, n]) =>
    n && n > 0 ? [{ id: id as AdicionalId, quantidade: n, trecho: "" }] : []
  );
  const finais = [...itens.filter((i) => !dasRespostas.some((r) => r.id === i.id)), ...dasRespostas];
  const aplicaveis = finais.filter((i) => valeParaOTipo(i.id, ficha.tipo));
  const semEfeito = finais.filter((i) => !valeParaOTipo(i.id, ficha.tipo));

  const nadaReconhecido = finais.length === 0 && perguntasComItem.length === 0 && frases.length === 0;
  if (nadaReconhecido) {
    return (
      <div className="mt-3 rounded-xl border border-dashed p-4">
        <p className="text-sm font-semibold text-ink">Não reconheci nenhum item da lista</p>
        <p className="mb-3 mt-1 text-sm text-ink-soft">
          O texto não cita nada que o CUB não cubra (ar-condicionado, aquecedor solar, energia solar, automação,
          piscina, gourmet, paisagismo, elevador, subsolo, marcenaria ou terreno inclinado). Descreva assim:
        </p>
        <div className="flex flex-wrap gap-2">
          {EXEMPLOS.map((e) => (
            <Pilula key={e} ativa={false} onClick={() => onExemplo(e)}>
              {e}
            </Pilula>
          ))}
        </div>
        <ForaDoCatalogo leitura={leitura} />
      </div>
    );
  }

  const mudarQuantidade = (id: AdicionalId, n: number) =>
    onEstado({ ...estado, itens: itens.map((i) => (i.id === id ? { ...i, quantidade: n } : i)) });

  return (
    <div className="mt-3 rounded-xl border border-highlight-mid-border bg-highlight-soft p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">O que entendi</h3>
        <span className="text-xs text-ink-soft">
          {aplicaveis.length === 1 ? "1 item" : `${aplicaveis.length} itens`}
          {leitura.perguntas.length > 0 &&
            `, ${leitura.perguntas.length === 1 ? "1 pergunta" : `${leitura.perguntas.length} perguntas`}`}
        </span>
      </div>
      <p className="mb-2 mt-1 text-xs text-ink-soft">
        Confira a lista. Só entram itens do catálogo; o preço sai da tabela, nunca da IA.
      </p>

      {aplicaveis.length === 0 ? (
        <p className="py-2 text-sm text-ink-soft">
          Nenhum item na lista. Corrija a descrição ou preencha à mão abaixo.
        </p>
      ) : (
        <ul>
          {aplicaveis.map((item) => (
            <LinhaLida
              key={item.id}
              item={item}
              contexto={contexto}
              onQuantidade={(n) => mudarQuantidade(item.id, n)}
              onRemover={() =>
                onEstado({
                  ...estado,
                  itens: itens.filter((i) => i.id !== item.id),
                  respostas: { ...respostas, [item.id]: 0 },
                })
              }
            />
          ))}
        </ul>
      )}

      {semEfeito.length > 0 && (
        <Aviso tom="warning">
          Piscina e área gourmet só valem para obra residencial. Ficam fora da ficha: troque o tipo da obra no passo 1
          se for o caso.
        </Aviso>
      )}
      <ForaDoCatalogo leitura={leitura} />
      {frases.length > 0 && (
        <Aviso tom="info">
          <ul className="space-y-0.5">
            {frases.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </Aviso>
      )}

      {leitura.perguntas.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-ink">Faltou saber</h4>
          <p className="mb-2 text-xs text-ink-soft">Pergunta sem resposta deixa o item de fora da lista.</p>
          <div className="space-y-3">
            {perguntasComItem.map((p) => {
              const id = p.id as AdicionalId;
              const item = CATALOGO.get(id);
              return (
                <div key={`${id}-${p.pergunta}`}>
                  <label htmlFor={`ia-resp-${id}`} className="mb-1.5 block text-sm font-medium text-ink-soft">
                    {p.pergunta}
                  </label>
                  <div className="max-w-[14rem]">
                    <CampoNumero
                      id={`ia-resp-${id}`}
                      valor={respostas[id] ?? 0}
                      onChange={(n) => onEstado({ ...estado, respostas: { ...respostas, [id]: n } })}
                      sufixo={item?.unidade === "kWp" ? "kWp" : item?.unidade === "m²" ? "m²" : undefined}
                    />
                  </div>
                </div>
              );
            })}
            {perguntasSemItem.map((p) => (
              <p key={p.pergunta} className="text-sm text-ink-soft">
                {p.pergunta} <span className="text-xs">Marque na lista abaixo depois de usar esta.</span>
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onUsar(aplicaveis, leitura)}
          disabled={aplicaveis.length === 0 && frases.length === 0}
        >
          <Check aria-hidden="true" /> Usar esta lista
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onEstado({ tipo: "parado" })}>
          Corrigir a descrição
        </Button>
      </div>
    </div>
  );
}

function ForaDoCatalogo({ leitura }: { leitura: Interpretacao }) {
  if (leitura.fora_do_catalogo.length === 0) return null;
  return (
    <Aviso tom="warning">
      <strong>Não encontrei no catálogo:</strong> {leitura.fora_do_catalogo.map((f) => `"${f.texto}"`).join(", ")}. Fica
      fora da lista e do total. Se for importante, informe o valor depois, na estimativa.
    </Aviso>
  );
}

function LinhaLida({
  item,
  contexto,
  onQuantidade,
  onRemover,
}: {
  item: ItemLido;
  contexto: Contexto;
  onQuantidade: (n: number) => void;
  onRemover: () => void;
}) {
  const catalogo = CATALOGO.get(item.id);
  const nome = catalogo?.nome ?? item.id;
  const comItem = aplicarInterpretacao(contexto.ficha, {
    itens: [item],
    ambientes: {},
    marcenaria: null,
    relevo: null,
  });
  const origem = catalogo ? textoDaOrigem(item.id, catalogo, { ...contexto, ficha: comItem }) : null;
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-card py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1 basis-56">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-ink">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {nome}
          {origem && <ChipOrigem tipo={origem.tipo} className="px-2 py-0 text-[11px]" />}
        </p>
        {item.trecho && <p className="ml-5 mt-0.5 text-xs text-ink-soft">&quot;{item.trecho}&quot;</p>}
      </div>
      <span className="flex items-center gap-2">
        <ControleDaQuantidade item={catalogo} quantidade={item.quantidade} onChange={onQuantidade} />
        <Button type="button" variant="ghost" size="sm" aria-label={`Remover ${nome}`} onClick={onRemover}>
          <X aria-hidden="true" />
        </Button>
      </span>
    </li>
  );
}
