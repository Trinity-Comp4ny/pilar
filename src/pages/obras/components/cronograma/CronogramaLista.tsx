import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CloudRain,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { estadoTarefaCronograma, SENSIVEL_CLIMA_OPCOES } from "@/lib/obras";
import { NIVEL_FILHO, NIVEL_LABEL, type NivelCronograma, type NoArvore } from "@/pages/obras/lib/obraArvore";
import type { ObraFrenteRow } from "@/pages/obras/hooks/useObraFrentes";
import type { ObraTarefa } from "@/pages/obras/hooks/useObraTarefas";
import type { PessoaOpcao } from "@/pages/meu-trabalho/hooks";
import { EtiquetasCell, ResponsavelCell } from "@/pages/meu-trabalho/components/CelulasLista";
import { ESTADO_FILL, ESTADO_LABEL } from "./estado";
import type { CronogramaAcoes } from "./useCronogramaAcoes";

type Arvore = NoArvore<ObraFrenteRow, ObraTarefa>;

/** Colunas da lista no desktop; no mobile a linha vira nome + prazo + menu. */
const GRID = "md:grid md:grid-cols-[minmax(0,1fr)_140px_110px_136px_136px_96px_32px] md:items-center md:gap-2";
/** Recuo por nível: menor no mobile, senão o nome some em 390px. */
const recuo = (profundidade: number, extra = 0) => `calc(var(--recuo) * ${profundidade} + ${extra}px)`;
const SEM_CLIMA = "__nenhum__";

const NOVO_LABEL: Record<NivelCronograma | "tarefa", string> = {
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

/** Onde o campo "novo item" está aberto: id do pai (null = nova fase). */
type Adicionando = { parentId: string | null } | null;

interface ListaProps {
  fases: Arvore[];
  soltas: ObraTarefa[];
  servicos: ObraFrenteRow[];
  caminho: (id: string) => string;
  recolhidos: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onExpandir: (id: string) => void;
  canEdit: boolean;
  pessoas: PessoaOpcao[];
  acoes: CronogramaAcoes;
  adicionando: Adicionando;
  setAdicionando: (a: Adicionando) => void;
}

export function CronogramaLista(props: ListaProps) {
  const { fases, soltas, canEdit, adicionando, setAdicionando } = props;
  const [excluir, setExcluir] = useState<
    { tipo: "no"; arvore: Arvore } | { tipo: "tarefa"; tarefa: ObraTarefa } | null
  >(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white [--recuo:10px] md:[--recuo:20px]">
      <div className={cn(GRID, "hidden border-b bg-muted/30 px-3 py-2")}>
        {["Fase, etapa, serviço e tarefa", "Responsável", "Etiquetas", "Início", "Fim", "Avanço", ""].map((c, i) => (
          <span key={i} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {c}
          </span>
        ))}
      </div>

      {fases.map((f) => (
        <NoBloco key={f.no.id} arvore={f} profundidade={0} {...props} onExcluir={setExcluir} />
      ))}

      {canEdit &&
        (adicionando?.parentId === null ? (
          <NovoItem
            nivel="fase"
            profundidade={0}
            onCriar={(nome) => props.acoes.criarNo("fase", null, nome)}
            onFechar={() => setAdicionando(null)}
          />
        ) : (
          <BotaoNovo nivel="fase" profundidade={0} onClick={() => setAdicionando({ parentId: null })} />
        ))}

      {soltas.length > 0 && (
        <div className="border-t bg-muted/20">
          <div className="px-3 pb-1 pt-3 text-xs font-semibold text-ink">
            Sem serviço
            <span className="ml-2 font-normal text-muted-foreground">
              tarefas do campo ou de etapas excluídas; mova para um serviço
            </span>
          </div>
          {soltas.map((t) => (
            <TarefaLinha key={t.id} tarefa={t} profundidade={0} {...props} onExcluir={setExcluir} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={excluir !== null}
        onOpenChange={(v) => !v && setExcluir(null)}
        onConfirm={async () => {
          if (!excluir) return;
          const ok =
            excluir.tipo === "no"
              ? await props.acoes.excluirNo(excluir.arvore.no.id)
              : await props.acoes.excluirTarefa(excluir.tarefa.id);
          if (ok) setExcluir(null);
        }}
        title={
          excluir?.tipo === "no" ? `Excluir ${NIVEL_LABEL[excluir.arvore.nivel].toLowerCase()}?` : "Excluir tarefa?"
        }
        itemName={excluir?.tipo === "no" ? excluir.arvore.no.nome : excluir?.tarefa.titulo}
        description={
          excluir?.tipo === "no" ? descricaoExclusao(excluir.arvore) : "A tarefa sai da obra e da gestão de tarefas."
        }
        variant="destructive"
        confirmText="Excluir"
        loading={props.acoes.excluindo}
      />
    </div>
  );
}

function contarAbaixo(a: Arvore): { etapas: number; servicos: number } {
  let etapas = 0;
  let servicos = 0;
  const visitar = (n: Arvore) => {
    for (const f of n.filhos) {
      if (f.nivel === "etapa") etapas++;
      if (f.nivel === "servico") servicos++;
      visitar(f);
    }
  };
  visitar(a);
  return { etapas, servicos };
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

function descricaoExclusao(a: Arvore): string {
  const { etapas, servicos } = contarAbaixo(a);
  const partes = [
    etapas > 0 ? plural(etapas, "etapa", "etapas") : null,
    servicos > 0 ? plural(servicos, "serviço", "serviços") : null,
  ].filter(Boolean);
  const leva = partes.length > 0 ? `Também exclui ${partes.join(" e ")} abaixo. ` : "";
  const tarefas =
    a.total > 0
      ? `${plural(a.total, "tarefa continua", "tarefas continuam")} na obra, em "Sem serviço".`
      : "Nenhuma tarefa é apagada.";
  return `${leva}${tarefas}`;
}

// --- Nó (fase, etapa, serviço) ---------------------------------------------

type ComExcluir = {
  onExcluir: (alvo: { tipo: "no"; arvore: Arvore } | { tipo: "tarefa"; tarefa: ObraTarefa }) => void;
};

function NoBloco({
  arvore,
  profundidade,
  ...props
}: ListaProps & ComExcluir & { arvore: Arvore; profundidade: number }) {
  const { recolhidos, canEdit, adicionando, setAdicionando, acoes, onExpandir } = props;
  const aberto = !recolhidos.has(arvore.no.id);
  const filho = NIVEL_FILHO[arvore.nivel];

  const abrirNovo = () => {
    onExpandir(arvore.no.id);
    setAdicionando({ parentId: arvore.no.id });
  };

  return (
    <>
      <NoLinha arvore={arvore} profundidade={profundidade} aberto={aberto} onNovoFilho={abrirNovo} {...props} />
      {aberto && (
        <>
          {arvore.filhos.map((f) => (
            <NoBloco key={f.no.id} arvore={f} profundidade={profundidade + 1} {...props} />
          ))}
          {arvore.tarefas.map((t) => (
            <TarefaLinha key={t.id} tarefa={t} profundidade={profundidade + 1} {...props} />
          ))}
          {canEdit &&
            (adicionando?.parentId === arvore.no.id ? (
              <NovoItem
                nivel={filho}
                profundidade={profundidade + 1}
                onCriar={(nome) =>
                  filho === "tarefa" ? acoes.criarTarefa(arvore.no, nome) : acoes.criarNo(filho, arvore.no.id, nome)
                }
                onFechar={() => setAdicionando(null)}
              />
            ) : (
              <BotaoNovo nivel={filho} profundidade={profundidade + 1} onClick={abrirNovo} />
            ))}
        </>
      )}
    </>
  );
}

const NOME_CLASSE: Record<NivelCronograma, string> = {
  fase: "text-sm font-semibold text-ink",
  etapa: "text-sm font-medium text-ink",
  servico: "text-[13px] text-ink",
};

const LINHA_CLASSE: Record<NivelCronograma, string> = {
  fase: "bg-muted/40",
  etapa: "bg-muted/15",
  servico: "",
};

function NoLinha({
  arvore,
  profundidade,
  aberto,
  onNovoFilho,
  onToggle,
  canEdit,
  acoes,
  onExcluir,
}: ListaProps & ComExcluir & { arvore: Arvore; profundidade: number; aberto: boolean; onNovoFilho: () => void }) {
  const { no, nivel } = arvore;
  const [editando, setEditando] = useState(false);
  const temFilhos = arvore.filhos.length > 0 || arvore.tarefas.length > 0;
  const filho = NIVEL_FILHO[nivel];

  const salvarInicio = (v: string) => {
    if (v && no.data_fim && v > no.data_fim) {
      toast.error("O início não pode ser depois do fim");
      return;
    }
    acoes.atualizarNo({ id: no.id, data_inicio: v || null });
  };
  const salvarFim = (v: string) => {
    if (v && no.data_inicio && v < no.data_inicio) {
      toast.error("O fim não pode ser antes do início");
      return;
    }
    acoes.atualizarNo({ id: no.id, data_fim: v || null });
  };

  // Sem data própria, o campo mostra o período somado de baixo como dica.
  const dicaInicio = !no.data_inicio && arvore.periodo ? formatDate(arvore.periodo.inicio) : "Início";
  const dicaFim = !no.data_fim && arvore.periodo ? formatDate(arvore.periodo.fim) : "Fim";

  return (
    <div
      className={cn(GRID, "group flex min-h-11 items-center gap-2 border-b px-3 py-1.5", LINHA_CLASSE[nivel])}
      data-testid={`no-${no.id}`}
    >
      <div className="relative flex min-w-0 flex-1 items-center gap-1" style={{ paddingLeft: recuo(profundidade) }}>
        <button
          type="button"
          onClick={() => onToggle(no.id)}
          disabled={!temFilhos}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-25"
          aria-label={aberto ? `Recolher ${no.nome}` : `Expandir ${no.nome}`}
        >
          {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <span className="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground md:inline">
          {NIVEL_LABEL[nivel]}
        </span>
        {editando ? (
          <NomeEditavel
            valor={no.nome}
            onSalvar={(nome) => {
              setEditando(false);
              if (nome !== no.nome) acoes.atualizarNo({ id: no.id, nome });
            }}
            onCancelar={() => setEditando(false)}
          />
        ) : (
          <button
            type="button"
            className={cn("min-w-0 truncate text-left", NOME_CLASSE[nivel], canEdit && "hover:underline")}
            onClick={() => (canEdit ? setEditando(true) : onToggle(no.id))}
            title={canEdit ? "Clique para renomear" : no.nome}
          >
            {no.nome}
          </button>
        )}
        {canEdit && (
          // Só ícone e sobreposto à direita: ocupando espaço mesmo invisível, o botão
          // com rótulo espremia o nome até zero em 1280px.
          <Button
            variant="outline"
            size="icon"
            aria-label={`Adicionar ${(NIVEL_LABEL[filho as NivelCronograma] ?? "Tarefa").toLowerCase()} em ${no.nome}`}
            title={`Adicionar ${(NIVEL_LABEL[filho as NivelCronograma] ?? "Tarefa").toLowerCase()}`}
            className="pointer-events-none absolute right-0 top-1/2 hidden h-6 w-6 -translate-y-1/2 rounded-md bg-white text-muted-foreground opacity-0 shadow-sm transition-opacity md:inline-flex group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100"
            onClick={onNovoFilho}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <span className="hidden md:block" />
      <span className="hidden md:block" />

      <div className="hidden md:block">
        <DatePicker
          value={no.data_inicio ?? ""}
          onChange={salvarInicio}
          placeholder={dicaInicio}
          disabled={!canEdit}
          maxDate={no.data_fim ?? undefined}
          className="h-7 w-full px-2 text-xs"
        />
      </div>
      <div className="w-[128px] shrink-0 md:w-auto">
        <DatePicker
          value={no.data_fim ?? ""}
          onChange={salvarFim}
          placeholder={dicaFim}
          disabled={!canEdit}
          minDate={no.data_inicio ?? undefined}
          className="h-7 w-full px-2 text-xs"
        />
      </div>

      <div className="hidden min-w-0 items-center gap-1.5 md:flex" title={ESTADO_LABEL[arvore.estado]}>
        <span className={cn("h-2 w-2 shrink-0 rounded-full", ESTADO_FILL[arvore.estado])} aria-hidden />
        <span className="truncate text-xs tabular-nums text-muted-foreground">
          {arvore.total > 0 ? `${arvore.progresso}% · ${arvore.concluidas}/${arvore.total}` : "sem tarefas"}
        </span>
      </div>

      {canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`Ações de ${no.nome}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onNovoFilho}>
              <Plus className="mr-2 h-4 w-4" />
              {NOVO_LABEL[filho]}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditando(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => acoes.moverNo(no.id, -1)}>
              <ArrowUp className="mr-2 h-4 w-4" />
              Subir
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => acoes.moverNo(no.id, 1)}>
              <ArrowDown className="mr-2 h-4 w-4" />
              Descer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onExcluir({ tipo: "no", arvore })}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir {NIVEL_LABEL[nivel].toLowerCase()}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="hidden md:block" />
      )}
    </div>
  );
}

// --- Tarefa -----------------------------------------------------------------

function TarefaLinha({
  tarefa,
  profundidade,
  canEdit,
  acoes,
  pessoas,
  servicos,
  caminho,
  onExcluir,
}: ListaProps & ComExcluir & { tarefa: ObraTarefa; profundidade: number }) {
  const navigate = useNavigate();
  const [editando, setEditando] = useState(false);
  const concluida = tarefa.status === "concluida";
  const estado = estadoTarefaCronograma(tarefa);
  const responsaveis = tarefa.responsaveis
    .map((r) => r.pessoa)
    .filter((p): p is { id: string; nome: string } => !!p)
    .map((p) => ({ ...p, avatarUrl: pessoas.find((x) => x.id === p.id)?.avatarUrl ?? null }));

  const salvarInicio = (v: string) => {
    if (v && tarefa.prazo && v > tarefa.prazo) {
      toast.error("O início não pode ser depois do prazo");
      return;
    }
    acoes.atualizarTarefa({ id: tarefa.id, data_inicio: v || null });
  };
  const salvarPrazo = (v: string) => {
    if (v && tarefa.data_inicio && v < tarefa.data_inicio) {
      toast.error("O prazo não pode ser antes do início");
      return;
    }
    acoes.atualizarTarefa({ id: tarefa.id, prazo: v || null });
  };

  return (
    <div
      className={cn(GRID, "group flex min-h-10 items-center gap-2 border-b px-3 py-1")}
      data-testid={`tarefa-${tarefa.id}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2" style={{ paddingLeft: recuo(profundidade, 4) }}>
        <Checkbox
          checked={concluida}
          disabled={!canEdit}
          onCheckedChange={(v) =>
            acoes.atualizarTarefa({ id: tarefa.id, status: v === true ? "concluida" : "a_fazer" })
          }
          aria-label={concluida ? `Reabrir ${tarefa.titulo}` : `Concluir ${tarefa.titulo}`}
        />
        {editando ? (
          <NomeEditavel
            valor={tarefa.titulo}
            onSalvar={(titulo) => {
              setEditando(false);
              if (titulo !== tarefa.titulo) acoes.atualizarTarefa({ id: tarefa.id, titulo });
            }}
            onCancelar={() => setEditando(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => canEdit && setEditando(true)}
            className={cn(
              "min-w-0 truncate text-left text-[13px]",
              concluida ? "text-muted-foreground line-through" : "text-ink",
              canEdit && "hover:underline"
            )}
            title={canEdit ? "Clique para renomear" : tarefa.titulo}
          >
            {tarefa.titulo}
          </button>
        )}
        {tarefa.sensivel_clima && (
          <CloudRain className="h-3.5 w-3.5 shrink-0 text-info-mid" aria-label="Sensível ao clima" />
        )}
      </div>

      <div className="hidden min-w-0 md:block">
        <ResponsavelCell
          responsaveis={responsaveis}
          pessoas={pessoas}
          editavel={canEdit}
          onChange={(ids) => acoes.definirResponsaveis(tarefa.id, ids)}
        />
      </div>
      <div className="hidden min-w-0 md:block">
        <EtiquetasCell
          labels={tarefa.labels ?? []}
          editavel={canEdit}
          onChange={(labels) => acoes.atualizarTarefa({ id: tarefa.id, labels })}
        />
      </div>
      <div className="hidden md:block">
        <DatePicker
          value={tarefa.data_inicio ?? ""}
          onChange={salvarInicio}
          placeholder="Início"
          disabled={!canEdit}
          maxDate={tarefa.prazo ?? undefined}
          className="h-7 w-full px-2 text-xs"
        />
      </div>
      <div className="w-[128px] shrink-0 md:w-auto">
        <DatePicker
          value={tarefa.prazo ?? ""}
          onChange={salvarPrazo}
          placeholder="Prazo"
          disabled={!canEdit}
          minDate={tarefa.data_inicio ?? undefined}
          className={cn("h-7 w-full px-2 text-xs", estado === "atrasada" && "font-medium text-negative-strong")}
        />
      </div>
      <div className="hidden min-w-0 items-center gap-1.5 md:flex">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", ESTADO_FILL[estado])} aria-hidden />
        <span className="truncate text-xs text-muted-foreground">{ESTADO_LABEL[estado]}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`Ações de ${tarefa.titulo}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => navigate(`/gestao/tarefas?tarefa=${tarefa.id}`)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir na gestão de tarefas
          </DropdownMenuItem>
          {canEdit && (
            <>
              <DropdownMenuItem onClick={() => setEditando(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Renomear
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <CloudRain className="mr-2 h-4 w-4" />
                  Sensível ao clima
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={tarefa.sensivel_clima ?? SEM_CLIMA}
                    onValueChange={(v) =>
                      acoes.atualizarTarefa({ id: tarefa.id, sensivel_clima: v === SEM_CLIMA ? null : v })
                    }
                  >
                    <DropdownMenuRadioItem value={SEM_CLIMA}>Não sensível</DropdownMenuRadioItem>
                    {SENSIVEL_CLIMA_OPCOES.map((o) => (
                      <DropdownMenuRadioItem key={o.value} value={o.value}>
                        {o.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {servicos.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Mover para serviço</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                    {servicos.map((s) => (
                      <DropdownMenuItem
                        key={s.id}
                        disabled={s.id === tarefa.obra_frente_id}
                        onClick={() => acoes.atualizarTarefa({ id: tarefa.id, obra_frente_id: s.id })}
                      >
                        {caminho(s.id)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onExcluir({ tipo: "tarefa", tarefa })}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir tarefa
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// --- Peças pequenas ---------------------------------------------------------

function NomeEditavel({
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

function NovoItem({
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
      <Button size="sm" variant="brand" className="h-8" onClick={criar} disabled={!nome.trim() || salvando}>
        Criar
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onFechar} aria-label="Fechar">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function BotaoNovo({
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
