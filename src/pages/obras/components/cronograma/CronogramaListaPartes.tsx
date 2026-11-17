import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type NivelCronograma } from "@/pages/obras/lib/obraArvore";
import { useFornecedoresLite } from "@/pages/obras/hooks/useFornecedoresLite";
import { useMoneyMask } from "@/hooks/useMoneyMask";

export const NOVO_LABEL: Record<NivelCronograma | "tarefa", string> = {
  fase: "Nova fase",
  etapa: "Nova etapa",
  servico: "Novo serviço",
  tarefa: "Nova tarefa",
};

const NOVO_PLACEHOLDER: Record<NivelCronograma | "tarefa", string> = {
  fase: "Nome da fase (ex.: Estrutura)",
  etapa: "Nome da etapa (ex.: Fundação)",
  servico: "Nome do serviço (ex.: Sapatas)",
  tarefa: "Nome da tarefa (ex.: Concretar sapata S1)",
};

const SEM_PRESTADOR = "__nenhum__";

/** Padding à esquerda da linha pelo nível na árvore. */
export const recuo = (profundidade: number, extra = 0) => `calc(var(--recuo) * ${profundidade} + ${extra}px)`;

/** Prestador padrão do serviço (o eletricista, o encanador de sempre): nome, ou seletor para quem edita. */
export function PrestadorDoServico({
  valor,
  canEdit,
  onChange,
}: {
  valor: string | null;
  canEdit: boolean;
  onChange: (id: string | null) => void;
}) {
  const { data: fornecedores = [] } = useFornecedoresLite();
  const nome = fornecedores.find((f) => f.id === valor)?.nome;
  if (!canEdit) return <span className="hidden truncate text-xs text-muted-foreground md:block">{nome ?? "—"}</span>;
  return (
    <div className="hidden min-w-0 md:block">
      <Select value={valor ?? SEM_PRESTADOR} onValueChange={(v) => onChange(v === SEM_PRESTADOR ? null : v)}>
        <SelectTrigger className="h-7 px-2 text-xs" aria-label="Prestador do serviço">
          <SelectValue placeholder="Prestador" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SEM_PRESTADOR}>Sem prestador</SelectItem>
          {fornecedores.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Orçado e realizado do nó (já somados dos filhos). Realizado acima do orçado fica em vermelho. */
export function ValoresDoNo({ valores }: { valores?: { previsto: number; realizado: number } }) {
  const formatCurrency = useMoneyMask();
  const estourou = !!valores && valores.previsto > 0 && valores.realizado > valores.previsto;
  return (
    <>
      <span className="hidden truncate text-right text-xs tabular-nums text-muted-foreground md:block">
        {valores && valores.previsto > 0 ? formatCurrency(valores.previsto) : "—"}
      </span>
      <span
        className={cn(
          "hidden truncate text-right text-xs tabular-nums md:block",
          estourou ? "font-medium text-danger-strong" : "text-muted-foreground"
        )}
      >
        {valores && valores.realizado > 0 ? formatCurrency(valores.realizado) : "—"}
      </span>
    </>
  );
}

export function NomeEditavel({
  valor,
  onSalvar,
  onCancelar,
}: {
  valor: string;
  onSalvar: (v: string) => void;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState(valor);
  const salvar = () => {
    const limpo = texto.trim();
    if (!limpo) return onCancelar();
    onSalvar(limpo);
  };
  return (
    <Input
      autoFocus
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={salvar}
      onKeyDown={(e) => {
        if (e.key === "Enter") salvar();
        if (e.key === "Escape") onCancelar();
      }}
      className="h-7 min-w-0 flex-1 text-[13px]"
      aria-label="Nome"
    />
  );
}

export function NovoItem({
  nivel,
  profundidade,
  onCriar,
  onFechar,
}: {
  nivel: NivelCronograma | "tarefa";
  profundidade: number;
  onCriar: (nome: string) => Promise<boolean>;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  const criar = async () => {
    const limpo = nome.trim();
    if (!limpo || salvando) return;
    setSalvando(true);
    const ok = await onCriar(limpo);
    setSalvando(false);
    // Fica aberto para criar o próximo em sequência.
    if (ok) setNome("");
  };

  return (
    <div
      className="flex min-h-10 items-center gap-2 border-b px-3 py-1"
      style={{ paddingLeft: recuo(profundidade, 40) }}
    >
      <Input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") criar();
          if (e.key === "Escape") onFechar();
        }}
        placeholder={NOVO_PLACEHOLDER[nivel]}
        className="h-8 max-w-md flex-1 text-[13px]"
        aria-label={NOVO_LABEL[nivel]}
      />
      <Button size="xs" variant="brand" onClick={criar} disabled={!nome.trim() || salvando}>
        Criar
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={onFechar} aria-label="Fechar">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function BotaoNovo({
  nivel,
  profundidade,
  onClick,
}: {
  nivel: NivelCronograma | "tarefa";
  profundidade: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-full items-center gap-1 border-b text-left text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-ink"
      style={{ paddingLeft: recuo(profundidade, 40) }}
    >
      <Plus className="h-3.5 w-3.5" />
      {NOVO_LABEL[nivel]}
    </button>
  );
}
