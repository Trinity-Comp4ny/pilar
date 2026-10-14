import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FlaskConical, Lock, MoreHorizontal, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PilarPage } from "@/components/PilarPage";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FormDialog } from "@/components/FormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDate, formatNumberCompact } from "@/lib/format";
import { getSafeErrorMessage } from "@/lib/safeError";
import { toDataSourceResult } from "@/types/dataSource";
import { edgeFetch } from "./api";
import { prazoTeste } from "./lib";

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

/** Prazo da retenção pós-trial (SPEC 098 Fase 3, ADR 0043). */
const DIAS_RETENCAO = 90;

const NIVEL_LABEL: Record<string, string> = { bronze: "Bronze", prata: "Prata", ouro: "Ouro" };

function usoDe(usado: number, limite: number | null): string {
  return limite == null ? `${usado}` : `${usado} de ${limite}`;
}

function amanha(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function dataExclusao(leituraDesde: string): string {
  const d = new Date(leituraDesde);
  d.setDate(d.getDate() + DIAS_RETENCAO);
  return formatDate(d.toISOString().slice(0, 10));
}

/**
 * Testes (SPEC 098/104, redesenho SPEC 117). Dois momentos da mesma jornada:
 * a empresa em teste (3 dias pelo cadastro do site) e a que venceu sem
 * assinar e ficou só leitura até a exclusão automática. Leitura cross-tenant
 * via RPCs com bypass is_ultra_admin().
 */
export default function Testes() {
  usePageTitle("Testes · Ultra admin");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [nivelAlvo, setNivelAlvo] = useState<TrialRow | null>(null);
  const [novoNivel, setNovoNivel] = useState("__derivar__");
  const [motivoNivel, setMotivoNivel] = useState("");
  const [estenderAlvo, setEstenderAlvo] = useState<TrialRow | null>(null);
  const [novaData, setNovaData] = useState("");
  const [motivoEstender, setMotivoEstender] = useState("");
  const [preservarAlvo, setPreservarAlvo] = useState<{ empresaId: string; nome: string; preservar: boolean } | null>(
    null
  );
  const [motivoPreservar, setMotivoPreservar] = useState("");
  const [excluirAlvo, setExcluirAlvo] = useState<RetencaoRow | null>(null);
  const [motivoExcluir, setMotivoExcluir] = useState("");
  const [confirmaExcluir, setConfirmaExcluir] = useState("");

  const trialsQ = useQuery({
    queryKey: ["ultra-admin", "trials"],
    staleTime: 30_000,
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
        usuarios: r.usuarios,
        maxUsuarios: r.max_usuarios,
        tokensGastos: r.tokens_gastos,
        tokensTotal: r.tokens_total,
      }));
    },
  });

  const retencaoQ = useQuery({
    queryKey: ["ultra-admin", "retencao"],
    staleTime: 30_000,
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
  });

  const recarregar = () => qc.invalidateQueries({ queryKey: ["ultra-admin"] });
  const falhou = (titulo: string) => (error: unknown) =>
    toast.error(titulo, { description: getSafeErrorMessage(error) });

  const nivelM = useMutation({
    mutationFn: async (input: { empresaId: string; nivel: string | null; motivo: string | null }) => {
      // p_nivel/p_motivo aceitam NULL (limpa o override); o tipo gerado não marca isso.
      const { error } = await supabase.rpc("ultra_admin_definir_nivel_override", {
        p_empresa_id: input.empresaId,
        p_nivel: input.nivel,
        p_motivo: input.motivo,
      } as { p_empresa_id: string; p_nivel: string; p_motivo: string });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nível atualizado");
      void recarregar();
      setNivelAlvo(null);
    },
    onError: falhou("Não foi possível mudar o nível"),
  });

  const estenderM = useMutation({
    mutationFn: async (input: { empresaId: string; ate: string; motivo: string }) => {
      const { error } = await supabase.rpc("ultra_admin_estender_trial", {
        p_empresa_id: input.empresaId,
        p_novo_trial_ends_at: input.ate,
        p_motivo: input.motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Teste estendido");
      void recarregar();
      setEstenderAlvo(null);
    },
    onError: falhou("Não foi possível estender o teste"),
  });

  const preservarM = useMutation({
    mutationFn: async (input: { empresaId: string; preservar: boolean; motivo: string }) => {
      const { error } = await supabase.rpc("ultra_admin_marcar_preservar_dados", {
        p_empresa_id: input.empresaId,
        p_preservar: input.preservar,
        p_motivo: input.motivo,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.preservar ? "Dados preservados: a exclusão automática fica parada" : "Preservação removida");
      void recarregar();
      setPreservarAlvo(null);
    },
    onError: falhou("Não foi possível mudar a preservação"),
  });

  const excluirM = useMutation({
    mutationFn: (input: { empresaId: string; nome: string; motivo: string }) =>
      edgeFetch("ultra-admin-empresas", {
        method: "DELETE",
        body: { empresa_id: input.empresaId, confirm_name: input.nome, motivo: input.motivo },
      }),
    onSuccess: () => {
      toast.success("Empresa excluída");
      void recarregar();
      setExcluirAlvo(null);
    },
    onError: falhou("Não foi possível excluir a empresa"),
  });

  const trials = useMemo(() => trialsQ.data ?? [], [trialsQ.data]);
  const retencao = useMemo(() => retencaoQ.data ?? [], [retencaoQ.data]);

  const abrirNivel = (r: TrialRow) => {
    setNivelAlvo(r);
    setNovoNivel(r.nivelOverride ?? "__derivar__");
    setMotivoNivel(r.nivelOverrideMotivo ?? "");
  };
  const abrirEstender = (r: TrialRow) => {
    setEstenderAlvo(r);
    setNovaData(amanha());
    setMotivoEstender("");
  };
  const abrirPreservar = (empresaId: string, nome: string, preservado: boolean) => {
    setPreservarAlvo({ empresaId, nome, preservar: !preservado });
    setMotivoPreservar("");
  };
  const abrirExcluir = (r: RetencaoRow) => {
    setExcluirAlvo(r);
    setMotivoExcluir("");
    setConfirmaExcluir("");
  };

  const parar = (e: React.SyntheticEvent) => e.stopPropagation();

  const colunasTeste: ColumnDef<TrialRow>[] = [
    {
      key: "empresa",
      header: "Empresa",
      getSortValue: (r) => r.empresaNome,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">{r.empresaNome}</span>
          {r.razaoSocialDivergente && (
            <span title={`Nome diferente da Receita: ${r.razaoSocial}`}>
              <AlertTriangle className="h-3.5 w-3.5 text-warning-strong" aria-label="Nome diferente da Receita" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: "vence",
      header: "Prazo",
      getSortValue: (r) => r.trialEndsAt ?? "",
      cell: (r) => (
        <span
          className={r.diasRestantes <= 1 ? "font-medium text-danger-strong" : "text-ink-soft"}
          title={r.trialEstendidoMotivo ? `Estendido: ${r.trialEstendidoMotivo}` : undefined}
        >
          {prazoTeste(r.trialEndsAt) ?? "-"}
        </span>
      ),
    },
    {
      key: "nivel",
      header: "Nível",
      getSortValue: (r) => r.nivel,
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={r.nivel === "ouro" ? "brand" : "neutral"}>{NIVEL_LABEL[r.nivel] ?? r.nivel}</Badge>
          {r.nivelOverride && (
            <span title={`Ajustado por você: ${r.nivelOverrideMotivo ?? ""}`}>
              <ShieldCheck className="h-3.5 w-3.5 text-ink-muted" aria-label="Nível ajustado manualmente" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: "uso",
      header: "Projetos · usuários",
      cell: (r) => (
        <span className="tabular-nums text-ink-soft">
          {usoDe(r.projetosAtivos, r.maxProjetos)} · {usoDe(r.usuarios, r.maxUsuarios)}
        </span>
      ),
    },
    {
      key: "ia",
      header: "IA (tokens)",
      getSortValue: (r) => r.tokensGastos,
      cell: (r) => (
        <span className="tabular-nums text-ink-soft">
          {formatNumberCompact(r.tokensGastos)}
          {r.tokensTotal != null ? ` de ${formatNumberCompact(r.tokensTotal)}` : ""}
        </span>
      ),
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      align: "end",
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-full p-0"
              aria-label={`Ações de ${r.empresaNome}`}
              onClick={parar}
            >
              <MoreHorizontal size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={parar}>
            <DropdownMenuItem onClick={() => abrirEstender(r)}>Estender o teste</DropdownMenuItem>
            <DropdownMenuItem onClick={() => abrirNivel(r)}>Mudar o nível</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => abrirPreservar(r.empresaId, r.empresaNome, r.preservarDados)}>
              {r.preservarDados ? "Remover preservação de dados" : "Preservar dados"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const colunasRetencao: ColumnDef<RetencaoRow>[] = [
    {
      key: "empresa",
      header: "Empresa",
      getSortValue: (r) => r.empresaNome,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">{r.empresaNome}</span>
          {r.preservarDados && (
            <span title="Dados preservados: não será excluída">
              <Lock className="h-3.5 w-3.5 text-ink-muted" aria-label="Dados preservados" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: "venceu",
      header: "Venceu",
      getSortValue: (r) => r.diasEmLeitura,
      cell: (r) => (
        <span className="text-ink-soft">
          há {r.diasEmLeitura} {r.diasEmLeitura === 1 ? "dia" : "dias"}
        </span>
      ),
    },
    {
      key: "exclusao",
      header: "Exclusão automática",
      getSortValue: (r) => r.diasEmLeitura,
      cell: (r) => {
        if (r.preservarDados) return <span className="text-ink-muted">Parada (dados preservados)</span>;
        const faltam = Math.max(0, DIAS_RETENCAO - r.diasEmLeitura);
        return (
          <div className="min-w-0">
            <span className={faltam <= 5 ? "font-medium text-danger-strong" : "text-ink"}>
              {faltam === 0 ? "hoje" : `em ${faltam} ${faltam === 1 ? "dia" : "dias"}`}
            </span>
            <span className="text-xs text-ink-muted"> · {dataExclusao(r.leituraDesde)}</span>
          </div>
        );
      },
    },
    {
      key: "avisos",
      header: "Avisos por e-mail",
      cell: (r) => (
        <span className="text-ink-soft">
          {r.aviso85dEnviado ? "Último aviso enviado" : r.aviso60dEnviado ? "1º aviso enviado" : "Nenhum ainda"}
        </span>
      ),
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      align: "end",
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-full p-0"
              aria-label={`Ações de ${r.empresaNome}`}
              onClick={parar}
            >
              <MoreHorizontal size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={parar}>
            <DropdownMenuItem onClick={() => abrirPreservar(r.empresaId, r.empresaNome, r.preservarDados)}>
              {r.preservarDados ? "Remover preservação de dados" : "Preservar dados"}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={r.preservarDados}
              className="text-destructive focus:text-destructive"
              onClick={() => abrirExcluir(r)}
            >
              Excluir agora
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <PilarPage title="Testes">
      <p className="-mt-2 max-w-3xl text-sm text-ink-soft">
        Quem se cadastra pelo site testa por 3 dias. Sem assinatura no fim, a conta fica só leitura e é excluída{" "}
        {DIAS_RETENCAO} dias depois, com aviso por e-mail antes.
      </p>

      <Card className="border border-black/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Em teste agora <span className="font-normal text-ink-muted">({trials.length})</span>
          </CardTitle>
          <p className="text-xs text-ink-muted">
            Nível define os limites do teste: Bronze (e-mail confirmado), Prata (CNPJ ou CPF válido), Ouro (forma de
            pagamento cadastrada ou liberado por você).
          </p>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={colunasTeste}
            data={toDataSourceResult<TrialRow>({ data: trials, isLoading: trialsQ.isLoading, error: trialsQ.error })}
            rowKey={(r) => r.empresaId}
            onRowClick={(r) => navigate(`/ultra-admin/empresas/${r.empresaId}`)}
            defaultSortKey="vence"
            minWidth="760px"
            errorTitle="Não foi possível carregar os testes"
            emptyState={<EmptyState icon={FlaskConical} title="Nenhuma empresa em teste agora" />}
          />
        </CardContent>
      </Card>

      <Card className="border border-black/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Teste vencido, só leitura <span className="font-normal text-ink-muted">({retencao.length})</span>
          </CardTitle>
          <p className="text-xs text-ink-muted">
            Abre e exporta, mas não edita. Assinar devolve tudo na hora. Avisos por e-mail nos dias 60 e 85.
          </p>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={colunasRetencao}
            data={toDataSourceResult<RetencaoRow>({
              data: retencao,
              isLoading: retencaoQ.isLoading,
              error: retencaoQ.error,
            })}
            rowKey={(r) => r.empresaId}
            onRowClick={(r) => navigate(`/ultra-admin/empresas/${r.empresaId}`)}
            defaultSortKey="exclusao"
            defaultSortDir="desc"
            minWidth="760px"
            errorTitle="Não foi possível carregar as empresas vencidas"
            emptyState={<EmptyState icon={Lock} title="Nenhuma empresa em só leitura" />}
          />
        </CardContent>
      </Card>

      <FormDialog
        open={!!nivelAlvo}
        onOpenChange={(o) => !o && setNivelAlvo(null)}
        title={`Mudar o nível de ${nivelAlvo?.empresaNome ?? ""}`}
        description="Fica registrado com motivo, quem fez e quando."
        size="sm"
        submitLabel="Salvar"
        isPending={nivelM.isPending}
        submitDisabled={novoNivel !== "__derivar__" && !motivoNivel.trim()}
        onSubmit={() =>
          nivelAlvo &&
          nivelM.mutate({
            empresaId: nivelAlvo.empresaId,
            nivel: novoNivel === "__derivar__" ? null : novoNivel,
            motivo: novoNivel === "__derivar__" ? null : motivoNivel.trim(),
          })
        }
      >
        <div className="space-y-1.5">
          <Label>Nível</Label>
          <Select value={novoNivel} onValueChange={setNovoNivel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__derivar__">Automático (pelo cadastro)</SelectItem>
              <SelectItem value="bronze">Bronze</SelectItem>
              <SelectItem value="prata">Prata</SelectItem>
              <SelectItem value="ouro">Ouro (limites do plano)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {novoNivel !== "__derivar__" && (
          <div className="space-y-1.5">
            <Label htmlFor="nivel-motivo">Motivo</Label>
            <Textarea
              id="nivel-motivo"
              value={motivoNivel}
              onChange={(e) => setMotivoNivel(e.target.value)}
              placeholder="Ex.: design partner, liberar antes do CNPJ"
              rows={2}
            />
          </div>
        )}
      </FormDialog>

      <FormDialog
        open={!!estenderAlvo}
        onOpenChange={(o) => !o && setEstenderAlvo(null)}
        title={`Estender o teste de ${estenderAlvo?.empresaNome ?? ""}`}
        size="sm"
        submitLabel="Estender"
        isPending={estenderM.isPending}
        submitDisabled={!novaData || !motivoEstender.trim()}
        onSubmit={() =>
          estenderAlvo &&
          estenderM.mutate({
            empresaId: estenderAlvo.empresaId,
            ate: `${novaData}T23:59:59-03:00`,
            motivo: motivoEstender.trim(),
          })
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="estender-data">Novo vencimento</Label>
          <DatePicker id="estender-data" value={novaData} onChange={setNovaData} minDate={amanha()} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="estender-motivo">Motivo</Label>
          <Textarea
            id="estender-motivo"
            value={motivoEstender}
            onChange={(e) => setMotivoEstender(e.target.value)}
            placeholder="Ex.: negociação em andamento"
            rows={2}
          />
        </div>
      </FormDialog>

      <FormDialog
        open={!!preservarAlvo}
        onOpenChange={(o) => !o && setPreservarAlvo(null)}
        title={
          preservarAlvo?.preservar
            ? `Preservar os dados de ${preservarAlvo?.nome ?? ""}?`
            : `Remover a preservação de ${preservarAlvo?.nome ?? ""}?`
        }
        description={
          preservarAlvo?.preservar
            ? "A exclusão automática fica parada enquanto estiver marcado."
            : "A contagem de 90 dias volta a correr normalmente."
        }
        size="sm"
        submitLabel={preservarAlvo?.preservar ? "Preservar" : "Remover"}
        isPending={preservarM.isPending}
        submitDisabled={!motivoPreservar.trim()}
        onSubmit={() =>
          preservarAlvo &&
          preservarM.mutate({
            empresaId: preservarAlvo.empresaId,
            preservar: preservarAlvo.preservar,
            motivo: motivoPreservar.trim(),
          })
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="preservar-motivo">Motivo</Label>
          <Textarea
            id="preservar-motivo"
            value={motivoPreservar}
            onChange={(e) => setMotivoPreservar(e.target.value)}
            placeholder="Ex.: negociação avançada"
            rows={2}
            autoFocus
          />
        </div>
      </FormDialog>

      <FormDialog
        open={!!excluirAlvo}
        onOpenChange={(o) => !o && setExcluirAlvo(null)}
        title={`Excluir ${excluirAlvo?.empresaNome ?? ""} agora?`}
        description="Não dá pra desfazer. Logins e dados de operação são apagados; lançamentos financeiros ficam anonimizados pelo prazo fiscal de 5 anos."
        size="sm"
        submitLabel="Excluir empresa"
        submitVariant="destructive"
        isPending={excluirM.isPending}
        submitDisabled={!motivoExcluir.trim() || confirmaExcluir.trim() !== excluirAlvo?.empresaNome}
        onSubmit={() =>
          excluirAlvo &&
          excluirM.mutate({
            empresaId: excluirAlvo.empresaId,
            nome: confirmaExcluir.trim(),
            motivo: motivoExcluir.trim(),
          })
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="excluir-motivo">Motivo</Label>
          <Textarea
            id="excluir-motivo"
            value={motivoExcluir}
            onChange={(e) => setMotivoExcluir(e.target.value)}
            placeholder="Ex.: conta de teste"
            rows={2}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="excluir-confirmacao">
            Digite <span className="font-semibold text-ink">{excluirAlvo?.empresaNome}</span> para confirmar
          </Label>
          <Input
            id="excluir-confirmacao"
            value={confirmaExcluir}
            onChange={(e) => setConfirmaExcluir(e.target.value)}
            placeholder={excluirAlvo?.empresaNome}
            autoComplete="off"
          />
        </div>
      </FormDialog>
    </PilarPage>
  );
}
