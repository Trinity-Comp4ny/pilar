import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { toDataSourceResult } from "@/types/dataSource";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialog } from "@/components/FormDialog";
import { formatNumberCompact } from "@/lib/format";
import { getSafeErrorMessage } from "@/lib/safeError";

interface TrialRow {
  empresaId: string;
  empresaNome: string;
  nivel: string;
  nivelOverride: string | null;
  nivelOverrideMotivo: string | null;
  documentoTipo: string | null;
  documentoVerificacao: string | null;
  razaoSocial: string | null;
  razaoSocialDivergente: boolean;
  trialEndsAt: string | null;
  diasRestantes: number;
  projetosAtivos: number;
  maxProjetos: number | null;
  obrasAtivas: number;
  maxObras: number | null;
  usuarios: number;
  maxUsuarios: number | null;
  tokensGastos: number;
  tokensTotal: number | null;
}

const NIVEL_LABEL: Record<string, string> = { bronze: "Bronze", prata: "Prata", ouro: "Ouro" };

function capacidade(usado: number, limite: number | null): string {
  return limite == null ? `${usado}` : `${usado}/${limite}`;
}

// SPEC 098, requisito 25: aba "Trials" cross-tenant. Mesmo padrão de leitura
// direta que TokensPanel (RPC com bypass via is_ultra_admin() em vez de RLS
// de tabela — os fatos vêm de várias tabelas/funções, uma view não dava
// conta sem duplicar a lógica de nivel_confianca()/limites_empresa()).
export function TrialsPanel() {
  const qc = useQueryClient();
  const [overrideAlvo, setOverrideAlvo] = useState<TrialRow | null>(null);
  const [novoNivel, setNovoNivel] = useState<string>("__manter__");
  const [motivo, setMotivo] = useState("");

  const query = useQuery({
    queryKey: ["ultra-admin-trials"],
    queryFn: async (): Promise<TrialRow[]> => {
      const { data, error } = await supabase.rpc("ultra_admin_listar_trials");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        empresaId: r.empresa_id,
        empresaNome: r.empresa_nome,
        nivel: r.nivel,
        nivelOverride: r.nivel_override,
        nivelOverrideMotivo: r.nivel_override_motivo,
        documentoTipo: r.documento_tipo,
        documentoVerificacao: r.documento_verificacao,
        razaoSocial: r.razao_social,
        razaoSocialDivergente: r.razao_social_divergente,
        trialEndsAt: r.trial_ends_at,
        diasRestantes: r.dias_restantes,
        projetosAtivos: r.projetos_ativos,
        maxProjetos: r.max_projetos,
        obrasAtivas: r.obras_ativas,
        maxObras: r.max_obras,
        usuarios: r.usuarios,
        maxUsuarios: r.max_usuarios,
        tokensGastos: r.tokens_gastos,
        tokensTotal: r.tokens_total,
      }));
    },
    staleTime: 1000 * 30,
  });

  const overrideMutation = useMutation({
    mutationFn: async (input: { empresaId: string; nivel: string | null; motivo: string | null }) => {
      // p_nivel/p_motivo aceitam NULL de propósito (limpa o override), mas o tipo
      // gerado da RPC não marca isso (Supabase não infere nullability de argumento
      // de função) — daí o cast, a função real trata NULL explicitamente.
      const { error } = await supabase.rpc("ultra_admin_definir_nivel_override", {
        p_empresa_id: input.empresaId,
        p_nivel: input.nivel,
        p_motivo: input.motivo,
      } as { p_empresa_id: string; p_nivel: string; p_motivo: string });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nível atualizado");
      qc.invalidateQueries({ queryKey: ["ultra-admin-trials"] });
      setOverrideAlvo(null);
    },
    onError: (error) => {
      toast.error("Não foi possível atualizar o nível", { description: getSafeErrorMessage(error) });
    },
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);

  const abrirOverride = (row: TrialRow) => {
    setOverrideAlvo(row);
    setNovoNivel(row.nivelOverride ?? "__manter__");
    setMotivo(row.nivelOverrideMotivo ?? "");
  };

  const confirmarOverride = () => {
    if (!overrideAlvo) return;
    const nivel = novoNivel === "__manter__" ? null : novoNivel;
    overrideMutation.mutate({ empresaId: overrideAlvo.empresaId, nivel, motivo: nivel ? motivo : null });
  };

  const columns: ColumnDef<TrialRow>[] = [
    {
      key: "empresaNome",
      header: "Empresa",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="text-ink">{r.empresaNome}</span>
          {r.razaoSocialDivergente && (
            <span title={`Razão social na Receita: ${r.razaoSocial}`}>
              <AlertTriangle className="h-3.5 w-3.5 text-warning-mid" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: "nivel",
      header: "Nível",
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={r.nivel === "ouro" ? "default" : "secondary"}>{NIVEL_LABEL[r.nivel] ?? r.nivel}</Badge>
          {r.nivelOverride && (
            <span title={r.nivelOverrideMotivo ?? ""}>
              <ShieldCheck className="h-3.5 w-3.5 text-ink-muted" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: "documentoVerificacao",
      header: "Documento",
      cell: (r) =>
        r.documentoTipo ? (
          <span className="text-black/60 text-sm">
            {r.documentoTipo.toUpperCase()} · {r.documentoVerificacao ?? "?"}
          </span>
        ) : (
          <span className="text-black/40 text-sm">—</span>
        ),
    },
    {
      key: "projetosAtivos",
      header: "Projetos",
      cell: (r) => <span className="tabular-nums">{capacidade(r.projetosAtivos, r.maxProjetos)}</span>,
    },
    {
      key: "obrasAtivas",
      header: "Obras",
      cell: (r) => <span className="tabular-nums">{capacidade(r.obrasAtivas, r.maxObras)}</span>,
    },
    {
      key: "usuarios",
      header: "Usuários",
      cell: (r) => <span className="tabular-nums">{capacidade(r.usuarios, r.maxUsuarios)}</span>,
    },
    {
      key: "tokensGastos",
      header: "Tokens (trial)",
      cell: (r) => (
        <span className="tabular-nums">
          {formatNumberCompact(r.tokensGastos)}
          {r.tokensTotal != null ? ` / ${formatNumberCompact(r.tokensTotal)}` : ""}
        </span>
      ),
    },
    {
      key: "diasRestantes",
      header: "Dias restantes",
      cell: (r) => <span className={r.diasRestantes <= 3 ? "text-destructive font-medium" : ""}>{r.diasRestantes}</span>,
      getSortValue: (r) => r.diasRestantes,
    },
    {
      key: "acoes",
      header: "",
      cell: (r) => (
        <Button variant="ghost" size="sm" onClick={() => abrirOverride(r)}>
          Ajustar nível
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={toDataSourceResult<TrialRow>({ data: rows, isLoading: query.isLoading, error: query.error })}
        rowKey={(r) => r.empresaId}
        defaultSortKey="diasRestantes"
        defaultSortDir="asc"
        emptyMessage="Nenhuma empresa em trial no momento."
        errorTitle="Não foi possível carregar os trials"
      />

      <FormDialog
        open={!!overrideAlvo}
        onOpenChange={(o) => !o && setOverrideAlvo(null)}
        title={`Ajustar nível — ${overrideAlvo?.empresaNome ?? ""}`}
        description="Sobe, desce ou libera o nível manualmente. Fica registrado com motivo, quem fez e quando."
        size="sm"
        onSubmit={confirmarOverride}
        submitLabel="Salvar"
        isPending={overrideMutation.isPending}
        submitDisabled={novoNivel !== "__manter__" && !motivo.trim()}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nível</Label>
            <Select value={novoNivel} onValueChange={setNovoNivel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__manter__">Derivar de fato (sem override)</SelectItem>
                <SelectItem value="bronze">Bronze</SelectItem>
                <SelectItem value="prata">Prata</SelectItem>
                <SelectItem value="ouro">Ouro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {novoNivel !== "__manter__" && (
            <div className="space-y-2">
              <Label htmlFor="override-motivo">Motivo</Label>
              <Textarea
                id="override-motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: design partner, liberar antes do CNPJ"
                rows={3}
              />
            </div>
          )}
        </div>
      </FormDialog>
    </div>
  );
}
