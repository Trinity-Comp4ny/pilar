import { useState } from "react";
import { formatCurrency as fmtMoeda } from "@/lib/format";
import { useParams, useOutletContext, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, FileSignature, CheckCircle2 } from "lucide-react";
import { ClienteShell } from "./ClienteShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useClienteProjetoData } from "./useClienteProjetoData";
import { FinanceiroContent } from "@/pages/portal/PortalFinanceiro";
import { EntregasContent } from "@/pages/portal/PortalEntregas";
import { TimelineContent, type TimelineDisciplina } from "@/pages/portal/PortalTimeline";
import { PendenciasCard } from "@/pages/portal/PendenciasCard";
import type { ClienteAccount } from "@/hooks/useClienteAuth";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getPortalToken } from "@/hooks/useClienteAuth";
import type { ClienteProjetoData } from "./useClienteProjetoData";

function formatDate(d: string | null | undefined): string {
  if (!d) return "A definir";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

function AprovarPropostaCard({ projeto, refresh }: { projeto: ClienteProjetoData; refresh: () => void }) {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  const formatCurrency = (v: number | null) => (v == null ? "R$ 0,00" : fmtMoeda(v));

  const escopo = (projeto.disciplinas ?? []).map((d) => d.disciplina).filter((nome): nome is string => !!nome);
  const parcelas = projeto.receitas ?? [];

  const handleAprovar = async () => {
    const token = getPortalToken();
    if (!token) {
      toast({ title: "Sessão inválida", description: "Faça login novamente.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("portal-aprovar-proposta", {
        body: { projeto_id: projeto.projeto_id, token },
      });

      if (error) throw error;

      toast({
        title: "Proposta aprovada!",
        description: "Seu projeto foi confirmado. Em breve entraremos em contato.",
      });
      refresh();
    } catch {
      toast({
        title: "Erro ao aprovar proposta",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-brand/40 bg-brand/5">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
            <FileSignature className="h-5 w-5 text-ink" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Proposta aguardando aprovação</p>
            <p className="text-xs text-ink/60">Revise os detalhes e confirme para iniciar o projeto.</p>
          </div>
        </div>

        {/* Resumo do que está sendo contratado: escopo, prazo e pagamento,
            para o cliente não confirmar um contrato vendo só nome + valor. */}
        <div className="rounded-lg bg-white border divide-y">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Projeto</p>
              <p className="text-sm font-semibold">{projeto.projeto_nome}</p>
            </div>
            {projeto.valor_contrato != null && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Valor total</p>
                <p className="text-sm font-bold">{formatCurrency(projeto.valor_contrato)}</p>
              </div>
            )}
          </div>

          {escopo.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1.5">Escopo do projeto</p>
              <ul className="flex flex-wrap gap-1.5">
                {escopo.map((nome, i) => (
                  <li key={i} className="text-xs rounded-full bg-muted px-2.5 py-1 text-ink/80">
                    {nome}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 px-4 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Início</p>
              <p className="text-sm font-medium">{formatDate(projeto.data_inicio)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Previsão de conclusão</p>
              <p className="text-sm font-medium">{formatDate(projeto.data_previsao)}</p>
            </div>
          </div>

          {parcelas.length > 0 && (
            <div className="px-4 py-3">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Condições de pagamento</p>
                <p className="text-xs text-muted-foreground">
                  {parcelas.length === 1 ? "1 parcela" : `${parcelas.length} parcelas`}
                </p>
              </div>
              <ul className="space-y-1">
                {parcelas.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-ink/70">
                      {r.descricao || "Parcela"} · vence {formatDate(r.data_vencimento)}
                    </span>
                    <span className="font-medium">{formatCurrency(r.valor)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Button variant="brand" className="w-full gap-2" onClick={() => setConfirmOpen(true)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {loading ? "Aprovando…" : "Aprovar proposta"}
          </Button>
          <p className="text-center text-xs text-ink/60">Precisa de ajustes? Fale com o escritório antes de aprovar.</p>
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleAprovar}
        variant="default"
        title="Aprovar esta proposta?"
        itemName={projeto.projeto_nome}
        description={
          projeto.valor_contrato != null
            ? `Ao confirmar, o projeto será iniciado com o valor de ${formatCurrency(
                projeto.valor_contrato
              )}. Esta ação confirma o contrato: se precisar de alterações, fale com o escritório antes.`
            : "Ao confirmar, o projeto será iniciado conforme a proposta enviada. Esta ação confirma o contrato: se precisar de alterações, fale com o escritório antes."
        }
        confirmText="Confirmar aprovação"
        cancelText="Voltar"
      />
    </Card>
  );
}

function ProjetoOverview({ projeto, refresh }: { projeto: ClienteProjetoData; refresh: () => void }) {
  const mostrarAprovar = projeto.projeto_status === "Proposta";

  return (
    <div className="space-y-6">
      {mostrarAprovar ? (
        <AprovarPropostaCard projeto={projeto} refresh={refresh} />
      ) : (
        <PendenciasCard
          baseUrl={`/cliente/projeto/${projeto.projeto_id}`}
          receitas={projeto.receitas ?? []}
          portalEntregasPendentes={projeto.portal_entregas_pendentes ?? 0}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Início do Projeto</p>
            <p className="text-sm font-semibold mt-1">{formatDate(projeto.data_inicio)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Previsão de Conclusão</p>
            <p className="text-sm font-semibold mt-1">{formatDate(projeto.data_previsao)}</p>
          </CardContent>
        </Card>
      </div>

      <TimelineContent disciplinas={(projeto.disciplinas as TimelineDisciplina[]) ?? []} />
    </div>
  );
}

export default function ClienteProjetoDetail() {
  const { id } = useParams<{ id: string }>();
  usePageTitle("Portal | Projeto");
  const account = useOutletContext<ClienteAccount>();
  const { data, loading, error, refresh } = useClienteProjetoData(id);
  const location = useLocation();

  if (loading) {
    return (
      <ClienteShell account={account} projetoId={id}>
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </ClienteShell>
    );
  }

  if (error || !data) {
    return (
      <ClienteShell account={account}>
        <div className="flex justify-center py-12">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <Building2 className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold mb-2">Projeto não encontrado</h2>
              <p className="text-sm text-muted-foreground">
                {error || "Não foi possível carregar os dados do projeto."}
              </p>
            </CardContent>
          </Card>
        </div>
      </ClienteShell>
    );
  }

  // Determina qual aba mostrar com base na URL
  const basePath = `/cliente/projeto/${id}`;
  const subPath = location.pathname.replace(basePath, "");

  let content: React.ReactNode;
  if (subPath === "/financeiro") {
    content = <FinanceiroContent receitas={data.receitas ?? []} />;
  } else if (subPath === "/entregas") {
    content = <EntregasContent projetoId={data.projeto_id} />;
  } else {
    content = <ProjetoOverview projeto={data} refresh={refresh} />;
  }

  return (
    <ClienteShell
      account={account}
      projetoId={data.projeto_id}
      projetoNome={data.projeto_nome}
      projetoCodigo={data.projeto_codigo}
    >
      {content}
    </ClienteShell>
  );
}
