import { useState } from "react";
import { Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data/DataTable";
import { toDataSourceResult } from "@/types/dataSource";
import type { ColumnDef } from "@/components/data/DataTable";
import { formatNumberCompact, formatDateTime } from "@/lib/format";
import { useUsoEquipe, type MembroUsoToken, type SolicitacaoTokenPendente } from "../useUsoEquipe";

// Campo de teto por usuário: sem linha em ai_token_limite_usuario = sem limite
// (consome livre do pool da empresa, comportamento original). Editar aqui só
// grava um NÚMERO POSITIVO ou remove a linha — nunca zero, nunca negativo.
function LimiteCell({
  membro,
  onSalvar,
  onRemover,
  salvando,
}: {
  membro: MembroUsoToken;
  onSalvar: (valor: number) => void;
  onRemover: () => void;
  salvando: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(membro.limiteMensal ? String(membro.limiteMensal) : "");

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => {
          setValor(membro.limiteMensal ? String(membro.limiteMensal) : "");
          setEditando(true);
        }}
        className="inline-flex items-center gap-1.5 text-sm text-black/70 hover:text-ink"
      >
        {membro.limiteMensal ? (
          <span className="tabular-nums">{formatNumberCompact(membro.limiteMensal)} / mês</span>
        ) : (
          <span className="text-black/40">sem limite</span>
        )}
        <Pencil size={12} className="text-black/30" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min={1}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="ex: 500000"
        className="h-8 w-32 text-sm"
        autoFocus
      />
      <Button
        size="sm"
        variant="brand"
        className="h-8 w-8 p-0 rounded-full"
        disabled={salvando || !valor || Number(valor) <= 0}
        onClick={() => {
          onSalvar(Number(valor));
          setEditando(false);
        }}
      >
        <Check size={14} />
      </Button>
      {membro.limiteMensal !== null && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 rounded-full text-black/40 hover:text-danger-mid"
          disabled={salvando}
          onClick={() => {
            onRemover();
            setEditando(false);
          }}
          title="Remover limite"
        >
          <X size={14} />
        </Button>
      )}
    </div>
  );
}

function PedidoPendente({
  solicitacao,
  onAprovar,
  onNegar,
  resolvendo,
}: {
  solicitacao: SolicitacaoTokenPendente;
  onAprovar: (novoLimite: number | null) => void;
  onNegar: () => void;
  resolvendo: boolean;
}) {
  const [aprovando, setAprovando] = useState(false);
  const [valor, setValor] = useState(solicitacao.limiteSugerido ? String(solicitacao.limiteSugerido) : "");

  return (
    <Card className="border border-black/5">
      <CardContent className="pt-4 pb-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">{solicitacao.nome}</p>
            <p className="text-xs text-black/45">{formatDateTime(solicitacao.criadaEm)}</p>
          </div>
          {solicitacao.limiteSugerido && (
            <span className="text-xs text-black/55 tabular-nums whitespace-nowrap">
              sugeriu {formatNumberCompact(solicitacao.limiteSugerido)}
            </span>
          )}
        </div>
        {solicitacao.mensagem && <p className="text-sm text-black/70">"{solicitacao.mensagem}"</p>}

        {aprovando ? (
          <div className="flex items-center gap-1.5 pt-1">
            <Input
              type="number"
              min={1}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="vazio = sem limite"
              className="h-8 w-40 text-sm"
              autoFocus
            />
            <Button
              size="sm"
              variant="brand"
              className="h-8 rounded-full"
              disabled={resolvendo}
              onClick={() => onAprovar(valor ? Number(valor) : null)}
            >
              Confirmar
            </Button>
            <Button size="sm" variant="ghost" className="h-8 rounded-full" onClick={() => setAprovando(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="brand"
              className="h-8 rounded-full"
              disabled={resolvendo}
              onClick={() => setAprovando(true)}
            >
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-full text-black/60"
              disabled={resolvendo}
              onClick={onNegar}
            >
              Negar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const membroColumns: ColumnDef<MembroUsoToken>[] = [
  {
    key: "nome",
    header: "Membro",
    cell: (m) => <span className="text-ink">{m.nome}</span>,
  },
  {
    key: "tokensCiclo",
    header: "Consumo (mês)",
    cell: (m) => <span className="tabular-nums text-black/70">{formatNumberCompact(m.tokensCiclo)}</span>,
    getSortValue: (m) => m.tokensCiclo,
  },
];

// Aba "Equipe" dentro de Uso: só renderizada para quem canDo(ctx, 'pessoas')
// (admin, ou coordenador com acesso de equipe concedido — ADR 0034). Consumo
// vem de v_uso_tokens_usuario_ciclo; teto é opcional e nunca reserva token de
// ninguém (spec 094): ausência de linha = time inteiro consome o pool livre.
export function EquipeTokensSection() {
  const { membros, isLoadingMembros, errorMembros, solicitacoes, definirLimite, resolverSolicitacao } = useUsoEquipe();

  const columns: ColumnDef<MembroUsoToken>[] = [
    ...membroColumns,
    {
      key: "limiteMensal",
      header: "Limite mensal",
      cell: (m) => (
        <LimiteCell
          membro={m}
          salvando={definirLimite.isPending}
          onSalvar={(valor) => definirLimite.mutate({ userId: m.userId, limiteMensal: valor })}
          onRemover={() => definirLimite.mutate({ userId: m.userId, limiteMensal: null })}
        />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-ink">Equipe</h3>
        <p className="text-sm text-black/55">
          Consumo de tokens por pessoa neste ciclo. Defina um limite mensal só para travar alguém especificamente — sem
          limite, cada um consome livre do saldo da empresa.
        </p>
      </div>

      {solicitacoes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-ink">Pedidos pendentes</h4>
          {solicitacoes.map((s) => (
            <PedidoPendente
              key={s.id}
              solicitacao={s}
              resolvendo={resolverSolicitacao.isPending}
              onNegar={() => resolverSolicitacao.mutate({ solicitacaoId: s.id, aprovar: false })}
              onAprovar={(novoLimite) => resolverSolicitacao.mutate({ solicitacaoId: s.id, aprovar: true, novoLimite })}
            />
          ))}
        </div>
      )}

      <DataTable
        columns={columns}
        data={toDataSourceResult<MembroUsoToken>({ data: membros, isLoading: isLoadingMembros, error: errorMembros })}
        rowKey={(m) => m.userId}
        defaultSortKey="tokensCiclo"
        defaultSortDir="desc"
        emptyMessage="Nenhum membro na empresa ainda."
        errorTitle="Não foi possível carregar o consumo da equipe"
      />
    </div>
  );
}
