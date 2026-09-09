import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ShieldCheck, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { toDataSourceResult } from "@/types/dataSource";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  trialEstendidoMotivo: string | null;
  diasRestantes: number;
  preservarDados: boolean;
  projetosAtivos: number;
  maxProjetos: number | null;
  obrasAtivas: number;
  maxObras: number | null;
  usuarios: number;
  maxUsuarios: number | null;
  tokensGastos: number;
  tokensTotal: number | null;
}

interface RetencaoRow {
  empresaId: string;
  empresaNome: string;
  leituraDesde: string;
  diasEmLeitura: number;
  preservarDados: boolean;
  aviso60dEnviado: boolean;
  aviso85dEnviado: boolean;
}

const NIVEL_LABEL: Record<string, string> = { bronze: "Bronze", prata: "Prata", ouro: "Ouro" };

function capacidade(usado: number, limite: number | null): string {
  return limite == null ? `${usado}` : `${usado}/${limite}`;
}

function amanha(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
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

  const [liberarAlvo, setLiberarAlvo] = useState<TrialRow | null>(null);
  const [liberarMotivo, setLiberarMotivo] = useState("");

  const [estenderAlvo, setEstenderAlvo] = useState<TrialRow | null>(null);
  const [novaData, setNovaData] = useState("");
  const [estenderMotivo, setEstenderMotivo] = useState("");

  const [preservarAlvo, setPreservarAlvo] = useState<TrialRow | null>(null);
  const [preservarMotivo, setPreservarMotivo] = useState("");

  const [excluirAlvo, setExcluirAlvo] = useState<RetencaoRow | null>(null);
  const [excluirMotivo, setExcluirMotivo] = useState("");
  const [excluirConfirmacao, setExcluirConfirmacao] = useState("");

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
        trialEstendidoMotivo: r.trial_estendido_motivo,
        diasRestantes: r.dias_restantes,
        preservarDados: r.preservar_dados,
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

  const retencaoQuery = useQuery({
    queryKey: ["ultra-admin-retencao"],
    queryFn: async (): Promise<RetencaoRow[]> => {
      const { data, error } = await supabase.rpc("ultra_admin_listar_retencao");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        empresaId: r.empresa_id,
        empresaNome: r.empresa_nome,
        leituraDesde: r.leitura_desde,
        diasEmLeitura: r.dias_em_leitura,
        preservarDados: r.preservar_dados,
        aviso60dEnviado: r.aviso_60d_enviado,
        aviso85dEnviado: r.aviso_85d_enviado,
      }));
    },
    staleTime: 1000 * 30,
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["ultra-admin-trials"] });
  const invalidarRetencao = () => qc.invalidateQueries({ queryKey: ["ultra-admin-retencao"] });

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
      invalidar();
      setOverrideAlvo(null);
      setLiberarAlvo(null);
    },
    onError: (error) => {
      toast.error("Não foi possível atualizar o nível", { description: getSafeErrorMessage(error) });
    },
  });

  const estenderMutation = useMutation({
    mutationFn: async (input: { empresaId: string; novoTrialEndsAt: string; motivo: string }) => {
      const { error } = await supabase.rpc("ultra_admin_estender_trial", {
        p_empresa_id: input.empresaId,
        p_novo_trial_ends_at: input.novoTrialEndsAt,
        p_motivo: input.motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Trial estendido");
      invalidar();
      setEstenderAlvo(null);
    },
    onError: (error) => {
      toast.error("Não foi possível estender o trial", { description: getSafeErrorMessage(error) });
    },
  });

  const preservarMutation = useMutation({
    mutationFn: async (input: { empresaId: string; preservar: boolean; motivo: string }) => {
      const { error } = await supabase.rpc("ultra_admin_marcar_preservar_dados", {
        p_empresa_id: input.empresaId,
        p_preservar: input.preservar,
        p_motivo: input.motivo,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.preservar ? "Dados marcados para preservar" : "Preservação removida");
      invalidar();
      setPreservarAlvo(null);
    },
    onError: (error) => {
      toast.error("Não foi possível atualizar preservar dados", { description: getSafeErrorMessage(error) });
    },
  });

  const excluirMutation = useMutation({
    mutationFn: async (input: { empresaId: string; motivo: string }) => {
      const { error } = await supabase.rpc("excluir_empresa_retencao", {
        p_empresa_id: input.empresaId,
        p_motivo: input.motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados da empresa excluídos");
      invalidarRetencao();
      setExcluirAlvo(null);
    },
    onError: (error) => {
      toast.error("Não foi possível excluir os dados", { description: getSafeErrorMessage(error) });
    },
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);
  const retencaoRows = useMemo(() => retencaoQuery.data ?? [], [retencaoQuery.data]);

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

  const abrirLiberar = (row: TrialRow) => {
    setLiberarAlvo(row);
    setLiberarMotivo("");
  };

  const confirmarLiberar = () => {
    if (!liberarAlvo) return;
    overrideMutation.mutate({ empresaId: liberarAlvo.empresaId, nivel: "ouro", motivo: liberarMotivo });
  };

  const abrirEstender = (row: TrialRow) => {
    setEstenderAlvo(row);
    setNovaData(amanha());
    setEstenderMotivo("");
  };

  const confirmarEstender = () => {
    if (!estenderAlvo || !novaData) return;
    estenderMutation.mutate({
      empresaId: estenderAlvo.empresaId,
      novoTrialEndsAt: `${novaData}T23:59:59-03:00`,
      motivo: estenderMotivo,
    });
  };

  const abrirPreservar = (row: TrialRow) => {
    setPreservarAlvo(row);
    setPreservarMotivo("");
  };

  const confirmarPreservar = () => {
    if (!preservarAlvo) return;
    preservarMutation.mutate({
      empresaId: preservarAlvo.empresaId,
      preservar: !preservarAlvo.preservarDados,
      motivo: preservarMotivo,
    });
  };

  const abrirExcluir = (row: RetencaoRow) => {
    setExcluirAlvo(row);
    setExcluirMotivo("");
    setExcluirConfirmacao("");
  };

  const confirmarExcluir = () => {
    if (!excluirAlvo) return;
    excluirMutation.mutate({ empresaId: excluirAlvo.empresaId, motivo: excluirMotivo });
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
          {r.preservarDados && (
            <span title={"Dados preservados: relógio de retenção suspenso"}>
              <Lock className="h-3.5 w-3.5 text-ink-muted" />
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
      cell: (r) => (
        <span
          className={r.diasRestantes <= 3 ? "text-destructive font-medium" : ""}
          title={r.trialEstendidoMotivo ? `Estendido: ${r.trialEstendidoMotivo}` : undefined}
        >
          {r.diasRestantes}
        </span>
      ),
      getSortValue: (r) => r.diasRestantes,
    },
    {
      key: "acoes",
      header: "",
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              Ações
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => abrirOverride(r)}>Ajustar nível</DropdownMenuItem>
            <DropdownMenuItem onClick={() => abrirLiberar(r)}>Liberar trial completo</DropdownMenuItem>
            <DropdownMenuItem onClick={() => abrirEstender(r)}>Estender trial</DropdownMenuItem>
            <DropdownMenuItem onClick={() => abrirPreservar(r)}>
              {r.preservarDados ? "Remover preservação de dados" : "Preservar dados"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const retencaoColumns: ColumnDef<RetencaoRow>[] = [
    {
      key: "empresaNome",
      header: "Empresa",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="text-ink">{r.empresaNome}</span>
          {r.preservarDados && (
            <span title={"Dados preservados: relógio de retenção suspenso"}>
              <Lock className="h-3.5 w-3.5 text-ink-muted" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: "diasEmLeitura",
      header: "Dias em leitura",
      cell: (r) => (
        <span className={r.diasEmLeitura >= 85 ? "text-destructive font-medium" : "tabular-nums"}>
          {r.diasEmLeitura} / 90
        </span>
      ),
      getSortValue: (r) => r.diasEmLeitura,
    },
    {
      key: "avisos",
      header: "Avisos enviados",
      cell: (r) => (
        <span className="text-sm text-black/60">
          {[r.aviso60dEnviado && "60d", r.aviso85dEnviado && "85d"].filter(Boolean).join(", ") || "—"}
        </span>
      ),
    },
    {
      key: "acoes",
      header: "",
      cell: (r) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={r.preservarDados}
          title={r.preservarDados ? "Dados preservados: remova a preservação antes de excluir" : undefined}
          onClick={() => abrirExcluir(r)}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Excluir dados agora
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <DataTable
        columns={columns}
        data={toDataSourceResult<TrialRow>({ data: rows, isLoading: query.isLoading, error: query.error })}
        rowKey={(r) => r.empresaId}
        defaultSortKey="diasRestantes"
        defaultSortDir="asc"
        emptyMessage="Nenhuma empresa em trial no momento."
        errorTitle="Não foi possível carregar os trials"
      />

      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-medium text-ink">Em retenção (pós-trial)</h3>
          <p className="text-xs text-ink-muted">
            Trial vencido sem plano ativo, em modo somente leitura (SPEC 098 Fase 3). Excluídas automaticamente no dia
            90 pelo cron; o botão abaixo dispara a mesma exclusão manualmente, para testar numa empresa isolada.
          </p>
        </div>
        <DataTable
          columns={retencaoColumns}
          data={toDataSourceResult<RetencaoRow>({
            data: retencaoRows,
            isLoading: retencaoQuery.isLoading,
            error: retencaoQuery.error,
          })}
          rowKey={(r) => r.empresaId}
          defaultSortKey="diasEmLeitura"
          defaultSortDir="desc"
          emptyMessage="Nenhuma empresa em retenção pós-trial no momento."
          errorTitle="Não foi possível carregar a retenção"
        />
      </div>

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

      <FormDialog
        open={!!liberarAlvo}
        onOpenChange={(o) => !o && setLiberarAlvo(null)}
        title={`Liberar trial completo — ${liberarAlvo?.empresaNome ?? ""}`}
        description="Sobe a empresa direto para Ouro (capacidade e cota do plano escolhido), sem passar por CNPJ ou forma de pagamento."
        size="sm"
        onSubmit={confirmarLiberar}
        submitLabel="Liberar"
        isPending={overrideMutation.isPending}
        submitDisabled={!liberarMotivo.trim()}
      >
        <div className="space-y-2">
          <Label htmlFor="liberar-motivo">Motivo</Label>
          <Textarea
            id="liberar-motivo"
            value={liberarMotivo}
            onChange={(e) => setLiberarMotivo(e.target.value)}
            placeholder="Ex.: aprovação manual combinada com o cliente"
            rows={3}
            autoFocus
          />
        </div>
      </FormDialog>

      <FormDialog
        open={!!estenderAlvo}
        onOpenChange={(o) => !o && setEstenderAlvo(null)}
        title={`Estender trial — ${estenderAlvo?.empresaNome ?? ""}`}
        description="Move a data de expiração do trial para frente. Fica registrado com motivo, quem fez e quando."
        size="sm"
        onSubmit={confirmarEstender}
        submitLabel="Estender"
        isPending={estenderMutation.isPending}
        submitDisabled={!novaData || !estenderMotivo.trim()}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="estender-data">Nova data de expiração</Label>
            <DatePicker id="estender-data" value={novaData} onChange={setNovaData} minDate={amanha()} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="estender-motivo">Motivo</Label>
            <Textarea
              id="estender-motivo"
              value={estenderMotivo}
              onChange={(e) => setEstenderMotivo(e.target.value)}
              placeholder="Ex.: negociação em andamento, mais tempo para decidir"
              rows={3}
            />
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={!!preservarAlvo}
        onOpenChange={(o) => !o && setPreservarAlvo(null)}
        title={
          preservarAlvo?.preservarDados
            ? `Remover preservação de dados — ${preservarAlvo?.empresaNome ?? ""}`
            : `Preservar dados — ${preservarAlvo?.empresaNome ?? ""}`
        }
        description={
          preservarAlvo?.preservarDados
            ? "O relógio de retenção pós-trial volta a correr normalmente para esta empresa."
            : "Suspende o relógio de retenção pós-trial (90 dias). A empresa não será excluída enquanto isso estiver marcado."
        }
        size="sm"
        onSubmit={confirmarPreservar}
        submitLabel={preservarAlvo?.preservarDados ? "Remover" : "Preservar"}
        isPending={preservarMutation.isPending}
        submitDisabled={!preservarMotivo.trim()}
      >
        <div className="space-y-2">
          <Label htmlFor="preservar-motivo">Motivo</Label>
          <Textarea
            id="preservar-motivo"
            value={preservarMotivo}
            onChange={(e) => setPreservarMotivo(e.target.value)}
            placeholder="Ex.: prospect em negociação avançada"
            rows={3}
            autoFocus
          />
        </div>
      </FormDialog>

      <FormDialog
        open={!!excluirAlvo}
        onOpenChange={(o) => !o && setExcluirAlvo(null)}
        title={`Excluir dados agora — ${excluirAlvo?.empresaNome ?? ""}`}
        description="Irreversível: dados fiscais são anonimizados (retenção de 5 anos), o resto é apagado de verdade. Use só pra testar o fluxo numa empresa isolada antes do 1º disparo automático do cron."
        size="sm"
        onSubmit={confirmarExcluir}
        submitLabel="Excluir permanentemente"
        submitVariant="destructive"
        isPending={excluirMutation.isPending}
        submitDisabled={!excluirMotivo.trim() || excluirConfirmacao.trim() !== excluirAlvo?.empresaNome}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="excluir-motivo">Motivo</Label>
            <Textarea
              id="excluir-motivo"
              value={excluirMotivo}
              onChange={(e) => setExcluirMotivo(e.target.value)}
              placeholder="Ex.: teste do fluxo de retenção antes do lançamento"
              rows={3}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="excluir-confirmacao">
              Digite <span className="font-medium text-ink">{excluirAlvo?.empresaNome}</span> para confirmar
            </Label>
            <Input
              id="excluir-confirmacao"
              value={excluirConfirmacao}
              onChange={(e) => setExcluirConfirmacao(e.target.value)}
              placeholder={excluirAlvo?.empresaNome}
            />
          </div>
        </div>
      </FormDialog>
    </div>
  );
}
