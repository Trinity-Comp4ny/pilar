import { tarefaAtrasada } from "../lib/tarefaAtrasada";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useMinhaPessoa } from "@/hooks/useMinhaPessoa";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDateLocal } from "@/lib/businessDays";
import { formatDate } from "@/lib/format";
import { TarefaDialog } from "@/components/tarefas/TarefaDialog";
import { usePessoasEmpresa, useTarefaMutations, type TarefaInput, type TarefaItem } from "@/hooks/tarefas/useTarefas";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/tarefas/status";
import { useEtapas } from "@/hooks/tarefas/useEtapas";
import type { ProjetoDisciplinaDB } from "@/types/projetos";

export type NovaTarefaProjeto = { disciplinaId?: string; titulo?: string; descricao?: string; entregaId?: string };

export function ProjetoTarefasTab({
  projeto,
  disciplinas,
  tarefas,
  novaExterna,
  fecharNovaExterna,
  apenasAtrasadas,
  setApenasAtrasadas,
  onRetry,
}: {
  projeto: { id: string; nome: string };
  disciplinas: ProjetoDisciplinaDB[];
  tarefas: TarefaItem[] | undefined;
  novaExterna: NovaTarefaProjeto | null;
  fecharNovaExterna: () => void;
  apenasAtrasadas: boolean;
  setApenasAtrasadas: (valor: boolean) => void;
  onRetry?: () => void;
}) {
  const { isAdmin, role } = usePermissions();
  const { profile } = useAuth();
  const { data: minhaPessoa } = useMinhaPessoa();
  const { data: pessoas = [] } = usePessoasEmpresa();
  const { data: etapas = [] } = useEtapas();
  const { criar, atualizar } = useTarefaMutations();
  const [edicao, setEdicao] = useState<TarefaItem | null>(null);
  const [nova, setNova] = useState<NovaTarefaProjeto | null>(null);
  const [responsavel, setResponsavel] = useState("todos");
  const [status, setStatus] = useState("todos");
  const hoje = formatDateLocal(new Date());
  const podeCriar = isAdmin || !!minhaPessoa;
  const novaAtual = novaExterna ?? nova;

  const fechar = () => {
    fecharNovaExterna();
    setNova(null);
    setEdicao(null);
  };

  const salvar = async (input: TarefaInput) => {
    try {
      let id = edicao?.id;
      if (id) await atualizar.mutateAsync({ id, input });
      else id = await criar.mutateAsync({ ...input, portal_entrega_id: novaAtual?.entregaId });
      fechar();
      toast.success(edicao ? "Tarefa atualizada." : "Tarefa criada.");
      return id;
    } catch {
      toast.error("Não foi possível salvar a tarefa. Tente novamente.");
      return null;
    }
  };

  const grupos = new Map<string | null, TarefaItem[]>();
  for (const tarefa of tarefas ?? []) {
    if (responsavel !== "todos" && !tarefa.responsaveis.some((pessoa) => pessoa.id === responsavel)) continue;
    if (status !== "todos" && (tarefa.etapa_id ?? tarefa.status) !== status) continue;
    if (apenasAtrasadas && !tarefaAtrasada(tarefa, hoje)) continue;
    const chave = tarefa.projeto_disciplina_id ?? null;
    const grupo = grupos.get(chave) ?? [];
    grupo.push(tarefa);
    grupos.set(chave, grupo);
  }

  const podeEditar =
    !edicao ||
    isAdmin ||
    role === "coordenador" ||
    (!!profile?.id && edicao.created_by === profile.id) ||
    edicao.responsaveis.some((pessoa) => pessoa.id === minhaPessoa?.id);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={responsavel} onValueChange={setResponsavel}>
          <SelectTrigger className="w-44" aria-label="Filtrar por responsável">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            {pessoas.map((pessoa) => (
              <SelectItem key={pessoa.id} value={pessoa.id}>
                {pessoa.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label="Filtrar por status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {etapas.map((etapa) => (
              <SelectItem key={etapa.id} value={etapa.id}>
                {etapa.nome}
              </SelectItem>
            ))}
            {STATUS_ORDER.map((bucket) => (
              <SelectItem key={bucket} value={bucket}>
                {STATUS_LABEL[bucket]} · sem coluna
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={apenasAtrasadas ? "secondary" : "outline"}
          aria-pressed={apenasAtrasadas}
          onClick={() => setApenasAtrasadas(!apenasAtrasadas)}
        >
          Em atraso
        </Button>
        {podeCriar && (
          <Button variant="brand" className="ml-auto" onClick={() => setNova({})}>
            Nova tarefa
          </Button>
        )}
      </div>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          Erro ao carregar tarefas. Tentar novamente
        </Button>
      ) : !tarefas ? (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando tarefas…
        </p>
      ) : (
        [...disciplinas, { id: null, nome: "Sem disciplina" }].map(({ id, nome }) => {
          const itens = grupos.get(id) ?? [];
          if (!itens.length && (!podeCriar || apenasAtrasadas || status !== "todos" || responsavel !== "todos"))
            return null;
          return (
            <Card key={id ?? "sem-disciplina"} className="px-4">
              <div className="flex items-center justify-between gap-2 py-2">
                <h3 className="text-sm font-semibold">
                  {nome} <span className="font-normal text-muted-foreground">· {itens.length}</span>
                </h3>
                {podeCriar && id && (
                  <Button variant="ghost" size="sm" onClick={() => setNova({ disciplinaId: id })}>
                    Adicionar tarefa
                  </Button>
                )}
              </div>
              {itens.map((tarefa) => (
                <button
                  key={tarefa.id}
                  type="button"
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 border-t px-1 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => setEdicao(tarefa)}
                >
                  <span className="min-w-40 flex-1 font-medium">
                    {tarefa.titulo}
                    {tarefa.portal_entrega_id && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">Revisão do cliente</span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {tarefa.responsaveis.map((pessoa) => pessoa.nome).join(", ") || "Sem responsável"}
                  </span>
                  <span className={tarefaAtrasada(tarefa, hoje) ? "text-destructive" : "text-muted-foreground"}>
                    {tarefa.prazo ? formatDate(tarefa.prazo) : "Sem prazo"}
                  </span>
                  <span>
                    {etapas.find((etapa) => etapa.id === tarefa.etapa_id)?.nome ?? STATUS_LABEL[tarefa.status]}
                  </span>
                </button>
              ))}
            </Card>
          );
        })
      )}
      {tarefas && grupos.size === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma tarefa corresponde à visualização atual.</p>
      )}
      {(edicao || novaAtual) && (
        <TarefaDialog
          open
          onOpenChange={(aberto) => {
            if (!aberto) fechar();
          }}
          tarefa={edicao}
          projetoFixoId={projeto.id}
          defaultDisciplinaId={novaAtual?.disciplinaId}
          defaultTitulo={novaAtual?.titulo}
          defaultDescricao={novaAtual?.descricao}
          pessoas={pessoas}
          projetos={[projeto]}
          etapas={etapas}
          defaultResponsavelId={minhaPessoa?.id ?? null}
          podeEscolherResponsavel={isAdmin}
          autorNome={minhaPessoa?.nome ?? "Eu"}
          onSave={salvar}
          saving={criar.isPending || atualizar.isPending}
          readOnly={edicao ? !podeEditar : !podeCriar}
        />
      )}
    </div>
  );
}
