import { useMemo, useState } from "react";
import { Info, Tags } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/motion/PageLoader";
import { PilarPage } from "@/components/PilarPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePermissions } from "@/hooks/usePermissions";
import { mesclarAjustes } from "@/lib/estimativaItens";
import { descreverAdicional } from "@/lib/estimativaObra";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { Adicional, AdicionalId } from "@/schemas/estimativaObra";
import { toDataSourceResult } from "@/types/dataSource";
import { EditarPrecoDialog } from "./EditarPrecoDialog";
import { useAjustesDaEmpresa, useNomesDosUsuarios, useParametrosDoMotor, useSalvarAjusteEmpresa } from "./hooks";
import { ChipOrigem } from "./origem";
import { itensDaTabela, referenciaDoItem, unidadeDoPreco, type Ajuste } from "./ajustesDaEmpresa";

const BREADCRUMB = [{ label: "Estimativas", to: "/obras/estimativas" }];

interface Linha {
  id: AdicionalId;
  adicional: Adicional;
  ajuste: Ajuste | undefined;
  /** A empresa tem valor próprio válido para o item. */
  ajustado: boolean;
  /** O valor da empresa, em texto; null enquanto vale a referência. */
  valorDaEmpresa: string | null;
  quando: string | null;
  por: string | null;
}

const reais = (v: number) => formatCurrency(v, { decimals: Number.isInteger(v) ? 0 : 2 });

function registroDe(ajuste: Ajuste | undefined): { quando: string | null; por: string | null } {
  const quando = typeof ajuste?.atualizado_em === "string" ? ajuste.atualizado_em : null;
  const por = typeof ajuste?.atualizado_por === "string" ? ajuste.atualizado_por : null;
  return { quando, por };
}

/**
 * Tabela de preços da empresa (SPEC 137, BEZ-14): o valor de cada item do catálogo e dos adicionais ao lado da
 * referência. O valor da empresa vale antes do SINAPI e da referência do Pilar. Todos da empresa leem; só o admin
 * escreve (a RLS também confere).
 */
export default function PrecosEmpresa() {
  usePageTitle("Tabela de preços · Estimativas");
  const { isAdmin } = usePermissions();
  const { user } = useAuth();
  const parametros = useParametrosDoMotor();
  const ajustes = useAjustesDaEmpresa();
  const salvar = useSalvarAjusteEmpresa();
  const [editando, setEditando] = useState<Linha | null>(null);
  const [voltando, setVoltando] = useState<Linha | null>(null);

  const linhas = useMemo<Linha[]>(() => {
    if (!parametros.data || ajustes.data === undefined) return [];
    const p = parametros.data.parametros;
    const mesclados = mesclarAjustes(p, ajustes.data, []);
    return itensDaTabela(p).map(({ id, adicional }) => {
      const emp = mesclados[id];
      const ajuste = ajustes.data?.adicionais[id];
      const ajustado = !!emp?.ajustado;
      let valor: string | null = null;
      if (ajustado && emp) {
        valor =
          emp.valorUnitario !== null
            ? `${reais(emp.valorUnitario)} por ${unidadeDoPreco(adicional)}`
            : descreverAdicional(emp.adicional);
      }
      return { id, adicional, ajuste, ajustado, valorDaEmpresa: valor, ...registroDe(ajuste) };
    });
  }, [parametros.data, ajustes.data]);

  const ids = useMemo(() => linhas.flatMap((l) => (l.ajustado && l.por ? [l.por] : [])), [linhas]);
  const nomes = useNomesDosUsuarios(ids);

  const colunas: ColumnDef<Linha>[] = [
    {
      key: "item",
      header: "Item",
      cell: (l) => (
        <span>
          <span className="font-medium text-ink">{l.adicional.rotulo}</span>
          {l.adicional.nota && <span className="block text-xs text-ink-soft">{l.adicional.nota}</span>}
        </span>
      ),
      mobile: "title",
    },
    { key: "unidade", header: "Unidade", cell: (l) => unidadeDoPreco(l.adicional) },
    {
      key: "referencia",
      header: "Referência",
      cell: (l) => {
        const r = referenciaDoItem(l.adicional);
        return (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ChipOrigem tipo={r.tipo} />
            <span className="text-xs text-ink-soft">{r.texto}</span>
          </span>
        );
      },
      mobile: "badge",
    },
    {
      key: "empresa",
      header: "Valor da sua empresa",
      cell: (l) =>
        l.valorDaEmpresa ? (
          <span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium tabular-nums text-ink">{l.valorDaEmpresa}</span>
              <Badge variant="highlight">ajustado</Badge>
            </span>
            {l.quando && (
              <span className="block text-xs text-ink-soft">
                {formatDateTime(l.quando)}
                {l.por && nomes.data?.[l.por] ? ` · ${nomes.data[l.por]}` : ""}
              </span>
            )}
          </span>
        ) : (
          <span className="text-ink-soft">usa a referência</span>
        ),
      mobile: "subtitle",
    },
  ];
  if (isAdmin) {
    colunas.push({
      key: "acoes",
      header: "",
      align: "end",
      cell: (l) => (
        <span className="flex justify-end gap-2">
          {l.ajustado && (
            <Button variant="ghost" size="sm" onClick={() => setVoltando(l)}>
              Voltar à referência
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditando(l)}>
            {l.ajustado ? "Editar" : "Definir valor"}
          </Button>
        </span>
      ),
    });
  }

  const gravar = (linha: Linha, ajuste: Ajuste | null, sucesso: string) =>
    salvar.mutate(
      { id: linha.id, ajuste },
      {
        onSuccess: () => {
          toast.success(sucesso);
          setEditando(null);
          setVoltando(null);
        },
        onError: (e) =>
          toast.error("Não foi possível salvar o valor", {
            description: e instanceof Error ? e.message : "Tente de novo em instantes.",
          }),
      }
    );

  if (parametros.isLoading || ajustes.isLoading) return <PageLoader size="page" />;

  const erro = parametros.error ?? ajustes.error;
  if (erro) {
    return (
      <PilarPage title="Tabela de preços" breadcrumbs={BREADCRUMB}>
        <EmptyState
          icon={Tags}
          title="Não foi possível carregar a tabela de preços"
          description={erro instanceof Error ? erro.message : "Tente de novo em instantes."}
        />
      </PilarPage>
    );
  }

  return (
    <PilarPage title="Tabela de preços" breadcrumbs={BREADCRUMB}>
      <p className="-mt-2 max-w-2xl text-sm text-ink-soft">
        O valor da sua empresa vale antes de qualquer referência (SINAPI ou provisória do Pilar) em toda estimativa
        nova. Versões já salvas guardam o valor da época.
      </p>

      {!isAdmin && (
        <p className="flex items-start gap-2 rounded-xl border border-info-mid bg-info-soft px-3 py-3 text-sm text-info-strong">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Só quem administra a empresa muda estes valores. Peça a um administrador para ajustar.</span>
        </p>
      )}

      <div className="rounded-2xl border bg-card">
        <DataTable
          columns={colunas}
          data={toDataSourceResult<Linha>({ data: linhas })}
          rowKey={(l) => l.id}
          rowLabel={(l) => l.adicional.rotulo}
        />
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-info-mid bg-info-soft px-3 py-3 text-sm text-info-strong">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Item com origem "A definir" só entra no total depois que alguém informa um valor, aqui ou na própria
          estimativa. Cada linha mostra quando e por quem o valor foi mudado.
        </span>
      </p>

      <EditarPrecoDialog
        item={editando ? { rotulo: editando.adicional.rotulo, adicional: editando.adicional } : null}
        atual={editando?.ajuste}
        salvando={salvar.isPending}
        registro={() => ({ atualizadoEm: new Date().toISOString(), atualizadoPor: user?.id ?? "" })}
        onFechar={() => setEditando(null)}
        onSalvar={(ajuste) => editando && gravar(editando, ajuste, "Valor da empresa salvo")}
      />

      <ConfirmDialog
        open={voltando !== null}
        onOpenChange={(aberto) => !aberto && setVoltando(null)}
        onConfirm={() => voltando && gravar(voltando, null, "Voltou à referência")}
        title="Voltar à referência?"
        itemName={voltando?.adicional.rotulo}
        description="A empresa deixa de ter valor próprio para este item. As próximas estimativas usam o SINAPI ou a referência do Pilar."
        confirmText="Voltar à referência"
        loading={salvar.isPending}
      />
    </PilarPage>
  );
}
