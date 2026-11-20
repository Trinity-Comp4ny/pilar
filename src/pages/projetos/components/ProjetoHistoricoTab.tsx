import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { useProjetoTimeline, type ProjetoTimelineTipo } from "@/pages/projetos/hooks/useProjetoTimeline";

import { ReadingRing } from "@/components/motion/ReadingRing";

export const TIPO_LABEL: Record<ProjetoTimelineTipo, string> = {
  projeto_iniciado: "Projeto iniciado",
  projeto_concluido: "Projeto concluído",
  status_alterado: "Status alterado",
  disciplina_iniciada: "Disciplina iniciada",
  disciplina_concluida: "Disciplina concluída",
  pausa_iniciada: "Disciplina pausada",
  pausa_retomada: "Disciplina retomada",
  revisao_registrada: "Revisão registrada",
  revisao_concluida: "Revisão concluída",
  visita: "Visita registrada",
  suporte: "Suporte registrado",
  aditivo_criado: "Aditivo criado",
  aditivo_rejeitado: "Aditivo rejeitado",
  aditivo_cobranca: "Cobrança do aditivo registrada",
  aditivo_aceite: "Aceite comercial do cliente registrado",
  portal_entrega_publicada: "Entrega publicada",
  escopo_alterado: "Aditivo aprovado",
  portal_proposta_aprovada: "Proposta aprovada pelo cliente",
  portal_entrega_aprovada: "Entrega aprovada pelo cliente",
  portal_entrega_revisao_solicitada: "Cliente pediu revisão",
  projeto_pausado: "Projeto pausado",
  projeto_retomado: "Projeto retomado",
  portal_acesso_concedido: "Acesso ao portal liberado",
};

const TIPO_TONE: Partial<Record<ProjetoTimelineTipo, string>> = {
  portal_proposta_aprovada: "bg-positive/15 text-positive-strong",
  portal_entrega_aprovada: "bg-positive/15 text-positive-strong",
  portal_entrega_revisao_solicitada: "bg-warning-soft text-warning-strong",
  pausa_iniciada: "bg-warning-soft text-warning-strong",
  projeto_pausado: "bg-warning-soft text-warning-strong",
};

interface Props {
  projetoId: string;
  disciplinas: { id: string; nome: string }[];
  abrirAditivos?: (id?: string) => void;
}

export function ProjetoHistoricoTab({ projetoId, disciplinas, abrirAditivos }: Props) {
  const [filtroDisciplina, setFiltroDisciplina] = useState("todas");
  const [tipo, setTipo] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const comFiltros = filtroDisciplina !== "todas" || !!tipo || !!inicio || !!fim;
  const {
    data: eventos = [],
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useProjetoTimeline(projetoId, {
    disciplina: filtroDisciplina === "todas" ? undefined : filtroDisciplina,
    tipo: tipo || undefined,
    inicio: inicio || undefined,
    fim: fim || undefined,
  });
  const eventosFiltrados = useMemo(
    () =>
      eventos.filter(
        (evento) =>
          (filtroDisciplina === "todas" || evento.disciplinaId === filtroDisciplina) && (!tipo || evento.tipo === tipo)
      ),
    [eventos, filtroDisciplina, tipo]
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <ReadingRing size={64} />
      </div>
    );
  }

  if (isError && !eventos.length) return <p role="alert">Não foi possível carregar o histórico.</p>;

  if (eventos.length === 0 && !comFiltros) {
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="historico-tipo">Tipo de evento</Label>
            <select
              id="historico-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="h-9 max-w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="">Todos os eventos</option>
              {Object.entries(TIPO_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="historico-inicio">De</Label>
            <Input
              id="historico-inicio"
              type="date"
              max={fim || undefined}
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="historico-fim">Até</Label>
            <Input
              id="historico-fim"
              type="date"
              min={inicio || undefined}
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
          </div>
        </div>
        {disciplinas.length > 0 && (
          <div className="flex justify-end">
            <Select value={filtroDisciplina} onValueChange={setFiltroDisciplina}>
              <SelectTrigger aria-label="Disciplina" className="w-full max-w-[220px] h-9 text-sm">
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
      </div>

      {eventosFiltrados.length === 0 ? (
        <EmptyState
          icon={History}
          title={
            filtroDisciplina !== "todas" ? "Nenhum evento para esta disciplina" : "Nenhum evento para estes filtros"
          }
          description="Troque o filtro para ver os demais eventos do projeto."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {eventosFiltrados.map((evento, idx) => (
                <li
                  key={evento.chave ?? `${evento.tipo}-${evento.ocorridoEm}-${idx}`}
                  className="flex flex-col gap-1 border-l-2 border-brand p-4"
                >
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
                  <DetalhesRegistro evento={evento} abrirAditivos={abrirAditivos} />
                  {evento.autorNome && <p className="text-xs text-muted-foreground">{evento.autorNome}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {hasNextPage && (
        <Button variant="outline" loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
          Carregar eventos anteriores
        </Button>
      )}
    </div>
  );
}

function DetalhesRegistro({
  evento,
  abrirAditivos,
}: {
  evento: import("../hooks/useProjetoTimeline").ProjetoTimelineEvento;
  abrirAditivos?: (id?: string) => void;
}) {
  const dados = evento.dados as
    | {
        versao?: number;
        drive_url?: string;
        resposta?: string;
        resultado?: string;
        responsavel?: string;
        fornecedor?: string;
        local_canal?: string;
        proximo_passo?: string;
        anexo?: string;
        duracao?: number;
        avaliar_cobranca?: boolean;
        comprovante?: string;
        aditivo?: number;
        contrato?: number;
        linhas?: { id?: string; vencimento: string; anterior: number; novo: number }[];
      }
    | undefined;
  if (!dados) return null;
  const link = dados.drive_url ?? dados.anexo;
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      {dados.versao != null && <p>Versão R{String(dados.versao).padStart(2, "0")}</p>}
      {dados.resposta && <p>Resposta do cliente · {dados.resposta}</p>}
      {dados.resultado && <p>Resultado · {dados.resultado}</p>}
      {dados.responsavel && <p>Responsável · {dados.responsavel}</p>}
      {dados.fornecedor && <p>Fornecedor · {dados.fornecedor}</p>}
      {dados.local_canal && (
        <p>
          {evento.tipo === "visita" ? "Local" : "Canal"} · {dados.local_canal}
        </p>
      )}
      {dados.duracao && <p>Duração · {dados.duracao} min</p>}
      {dados.proximo_passo && <p>Próximo passo · {dados.proximo_passo}</p>}
      {dados.avaliar_cobranca && <p>Avaliar cobrança</p>}
      {link?.startsWith("https://") && (
        <a href={link} target="_blank" rel="noreferrer" className="underline">
          Abrir {dados.drive_url ? "arquivo da entrega" : "anexo"}
        </a>
      )}
      {dados.comprovante && <p className="break-words">Comprovante · {dados.comprovante}</p>}
      {dados.aditivo != null && dados.contrato != null && (
        <details>
          <summary className="cursor-pointer">Ver cobrança de {formatCurrency(dados.aditivo)}</summary>
          <p>
            Contrato · {formatCurrency(dados.contrato)} → {formatCurrency(dados.contrato + dados.aditivo)}
          </p>
          <ul>
            {dados.linhas?.map((linha, i) => (
              <li key={linha.id ?? i}>
                {formatDate(linha.vencimento)} · {linha.id && `${formatCurrency(linha.anterior)} → `}
                {formatCurrency(linha.novo)}
              </li>
            ))}
          </ul>
        </details>
      )}
      {abrirAditivos && evento.tipo.startsWith("aditivo_") && (
        <Button variant="link" size="sm" onClick={() => abrirAditivos(evento.origemId)}>
          Ver aditivos
        </Button>
      )}
    </div>
  );
}
