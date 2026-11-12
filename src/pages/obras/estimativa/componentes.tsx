import { AlertTriangle, Info, Minus, Plus } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ResultadoEstimativa } from "@/schemas/estimativaObra";
import { lerNumero } from "./lib";

const paraTexto = (n: number) => (Number.isFinite(n) ? String(n).replace(".", ",") : "");

interface CampoProps {
  id: string;
  rotulo: string;
  erro?: string;
  dica?: string;
  children: ReactNode;
  className?: string;
}

/** Rótulo, controle, dica e erro do campo, ligados por id para o leitor de tela. */
export function Campo({ id, rotulo, erro, dica, children, className }: CampoProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-soft">
        {rotulo}
      </label>
      {children}
      {erro ? (
        <p id={`${id}-erro`} role="alert" className="mt-1.5 text-xs text-danger-mid">
          {erro}
        </p>
      ) : (
        dica && <p className="mt-1.5 text-xs text-ink-soft">{dica}</p>
      )}
    </div>
  );
}

interface CampoNumeroProps {
  id: string;
  valor: number;
  onChange: (n: number) => void;
  sufixo?: string;
  erro?: string;
  className?: string;
}

const igual = (a: number, b: number) => Object.is(a, b);

/**
 * Campo numérico que deixa o usuário apagar e digitar. Guarda o texto digitado e só troca por `valor` quando
 * ele mudou por fora e deixou de bater com o texto (ex.: ficha carregada). Se quem usa recusa o número
 * digitado e mantém o valor antigo, o texto fica como está, para dar tempo de terminar de digitar.
 */
export function CampoNumero({ id, valor, onChange, sufixo, erro, className }: CampoNumeroProps) {
  const [texto, setTexto] = useState(() => paraTexto(valor));
  const [visto, setVisto] = useState(valor);
  let mostrado = texto;
  if (!igual(valor, visto)) {
    setVisto(valor);
    if (!igual(lerNumero(texto), valor)) {
      mostrado = paraTexto(valor);
      setTexto(mostrado);
    }
  }
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={mostrado}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined}
        className={cn("tabular-nums", sufixo && "pr-10", erro && "border-danger-mid", className)}
        onChange={(e) => {
          setTexto(e.target.value);
          onChange(lerNumero(e.target.value));
        }}
      />
      {sufixo && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-soft">
          {sufixo}
        </span>
      )}
    </div>
  );
}

interface ContadorProps {
  rotulo: string;
  valor: number;
  onChange: (n: number) => void;
  max?: number;
  erro?: string;
}

/** Quartos, banheiros, vagas: o − e o + andam de um em um, o número do meio não é digitado. */
export function Contador({ rotulo, valor, onChange, max = 99, erro }: ContadorProps) {
  const id = useId();
  const atual = Number.isFinite(valor) ? valor : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2">
        <span id={id} className="text-sm text-ink">
          {rotulo}
        </span>
        <span className="flex items-center gap-1.5" role="group" aria-labelledby={id}>
          <button
            type="button"
            aria-label={`Menos ${rotulo.toLowerCase()}`}
            disabled={atual <= 0}
            onClick={() => onChange(atual - 1)}
            className="grid h-8 w-8 place-items-center rounded-full border text-ink hover:bg-muted disabled:opacity-40"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <output className="min-w-6 text-center text-sm font-semibold tabular-nums text-ink" aria-live="polite">
            {atual}
          </output>
          <button
            type="button"
            aria-label={`Mais ${rotulo.toLowerCase()}`}
            disabled={atual >= max}
            onClick={() => onChange(atual + 1)}
            className="grid h-8 w-8 place-items-center rounded-full border text-ink hover:bg-muted disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </span>
      </div>
      {erro && (
        <p role="alert" className="mt-1 text-xs text-danger-mid">
          {erro}
        </p>
      )}
    </div>
  );
}

interface PilulaProps {
  ativa: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
}

/** Opção de escolha única ou liga e desliga, em pílula. `aria-pressed` diz o estado ao leitor de tela. */
export function Pilula({ ativa, onClick, children, disabled, title }: PilulaProps) {
  return (
    <button
      type="button"
      aria-pressed={ativa}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        ativa ? "border-brand bg-brand font-medium text-ink" : "bg-card text-ink-soft hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

/** Avisos que mudam a leitura do número: ficam abertos. Os demais são contexto e ficam num resumo de uma linha. */
const AVISOS_DE_ATENCAO = new Set(["uf_vizinha", "mes_antigo", "coerencia", "ajuste_ignorado"]);

const ACAO_DO_AVISO =
  "rounded-md py-0.5 font-medium text-ink underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function resumoDoContexto(avisos: ResultadoEstimativa["avisos"]): string {
  const aDefinir = avisos.filter((a) => a.codigo === "adicional_a_definir").length;
  const partes: string[] = [];
  if (aDefinir > 0)
    partes.push(aDefinir === 1 ? "1 item sem valor, fora do total" : `${aDefinir} itens sem valor, fora do total`);
  if (avisos.some((a) => a.codigo === "faixa_provisoria")) partes.push("faixa ampliada");
  if (avisos.some((a) => a.codigo === "parametros_nao_validados")) partes.push("parâmetros em validação");
  return partes.length > 0 ? partes.join(" · ") : `${avisos.length} observações sobre o cálculo`;
}

/**
 * Avisos do cálculo. Os de atenção (UF vizinha, mês antigo, coerência da ficha, ajuste ignorado) aparecem inteiros;
 * os de contexto (item a definir, faixa ampliada, parâmetros em validação) viram uma linha, com o texto completo
 * em "Ver detalhes": a lista longa logo no topo escondia o custo (feedback de 12/11).
 */
export function AvisosEstimativa({
  avisos,
  onInformarPendentes,
}: {
  avisos: ResultadoEstimativa["avisos"];
  /** Abre o "Informar valor" do primeiro item sem valor. Ausente para quem só lê. */
  onInformarPendentes?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const idDetalhes = useId();
  const atencao = avisos.filter((a) => AVISOS_DE_ATENCAO.has(a.codigo));
  const contexto = avisos.filter((a) => !AVISOS_DE_ATENCAO.has(a.codigo));
  if (avisos.length === 0) return null;
  return (
    <div className="space-y-2" aria-label="Avisos da estimativa" role="region">
      {atencao.length > 0 && (
        <ul className="space-y-1.5 rounded-xl border border-warning-mid bg-warning-soft px-3 py-3 text-sm text-warning-strong">
          {atencao.map((a, i) => (
            <li key={`${a.codigo}-${i}`} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{a.mensagem}</span>
            </li>
          ))}
        </ul>
      )}
      {contexto.length > 0 && (
        <div className="rounded-xl border bg-card px-3 py-2 text-sm text-ink-soft">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p>{resumoDoContexto(contexto)}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {onInformarPendentes && contexto.some((a) => a.codigo === "adicional_a_definir") && (
                  <button type="button" className={ACAO_DO_AVISO} onClick={onInformarPendentes}>
                    Informar valores
                  </button>
                )}
                <button
                  type="button"
                  className={ACAO_DO_AVISO}
                  aria-expanded={aberto}
                  aria-controls={idDetalhes}
                  onClick={() => setAberto((v) => !v)}
                >
                  {aberto ? "Ocultar" : "Ver detalhes"}
                </button>
              </div>
            </div>
          </div>
          {aberto && (
            <ul id={idDetalhes} className="mt-2 space-y-1.5 border-t pt-2">
              {contexto.map((a, i) => (
                <li key={`${a.codigo}-${i}`}>{a.mensagem}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
