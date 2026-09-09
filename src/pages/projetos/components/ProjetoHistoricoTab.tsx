import { useMemo, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { formatDateTime } from "@/lib/format";
import { useProjetoTimeline, type ProjetoTimelineTipo } from "@/hooks/useProjetoTimeline";

const TIPO_LABEL: Record<ProjetoTimelineTipo, string> = {
  projeto_iniciado: "Projeto iniciado",
  projeto_concluido: "Projeto concluído",
  status_alterado: "Status alterado",
  disciplina_iniciada: "Disciplina iniciada",
  disciplina_concluida: "Disciplina concluída",
  pausa_iniciada: "Disciplina pausada",
  pausa_retomada: "Disciplina retomada",
  revisao_registrada: "Revisão registrada",
  revisao_concluida: "Revisão concluída",
  escopo_alterado: "Aditivo aprovado",
  portal_proposta_aprovada: "Proposta aprovada pelo cliente",
  portal_entrega_aprovada: "Entrega aprovada pelo cliente",
  portal_entrega_revisao_solicitada: "Cliente pediu revisão",
};

const TIPO_TONE: Partial<Record<ProjetoTimelineTipo, string>> = {
  portal_proposta_aprovada: "bg-positive/15 text-positive-strong",
  portal_entrega_aprovada: "bg-positive/15 text-positive-strong",
  portal_entrega_revisao_solicitada: "bg-warning-soft text-warning-strong",
  pausa_iniciada: "bg-warning-soft text-warning-strong",
};

interface Props {
  projetoId: string;
  disciplinas: { id: string; nome: string }[];
}

export function ProjetoHistoricoTab({ projetoId, disciplinas }: Props) {
  const { data: eventos = [], isLoading } = useProjetoTimeline(projetoId);
  const [filtroDisciplina, setFiltroDisciplina] = useState<string>("todas");

  const eventosFiltrados = useMemo(() => {
    if (filtroDisciplina === "todas") return eventos;
    return eventos.filter((e) => e.disciplinaId === filtroDisciplina);
  }, [eventos, filtroDisciplina]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (eventos.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Nenhum evento ainda"
        description="Conforme o projeto avança (início, conclusão de disciplina, revisão, aprovação do cliente), a história aparece aqui em ordem."
      />
    );
  }

  return (
    <div className="space-y-3">
      {disciplinas.length > 0 && (
        <div className="flex justify-end">
          <Select value={filtroDisciplina} onValueChange={setFiltroDisciplina}>
            <SelectTrigger className="w-[220px] h-9 text-sm">
              <SelectValue placeholder="Todas as disciplinas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as disciplinas</SelectItem>
              {disciplinas.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {eventosFiltrados.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhum evento para esta disciplina"
          description="Troque o filtro para ver os demais eventos do projeto."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {eventosFiltrados.map((evento, idx) => (
                <li key={`${evento.tipo}-${evento.ocorridoEm}-${idx}`} className="flex flex-col gap-1 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className={TIPO_TONE[evento.tipo]}>
                      {TIPO_LABEL[evento.tipo]}
                    </Badge>
                    {evento.disciplinaNome && (
                      <span className="text-xs text-muted-foreground">{evento.disciplinaNome}</span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(evento.ocorridoEm)}</span>
                  </div>
                  {evento.detalhe && <p className="text-sm text-ink/90">{evento.detalhe}</p>}
                  {evento.autorNome && <p className="text-xs text-muted-foreground">{evento.autorNome}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
