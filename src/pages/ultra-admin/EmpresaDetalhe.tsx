import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Archive, Building2, MoreHorizontal, Pencil, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/motion/PageLoader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDate } from "@/lib/format";
import { PLAN_LABEL, edgeFetch, type EmpresaDetalhe as Empresa } from "./api";
import { Card, CardContent } from "@/components/ui/card";
import { Fato } from "./components/Fato";
import { EmpresaVisaoTab } from "./components/EmpresaVisaoTab";
import { EmpresaUsuariosTab } from "./components/EmpresaUsuariosTab";
import { EmpresaAtividadeTab } from "./components/EmpresaAtividadeTab";
import { atualizarEmpresa, useAcaoEmpresa, useEmpresa } from "./hooks";
import { prazoTeste, quandoRelativo, situacaoEmpresa, type Situacao } from "./lib";
import {
  ArquivarDialog,
  ComecarCobrarDialog,
  EditarEmpresaDialog,
  ExcluirDialog,
  SuspenderDialog,
  TornarConvidadaDialog,
} from "./components/EmpresaDialogs";

type Aba = "visao" | "usuarios" | "atividade";
type DialogAberto = "editar" | "suspender" | "arquivar" | "excluir" | "convidada" | "cobrar" | null;

/** Uma frase sobre a cobrança, no tom da situação. */
function resumoCobranca(situacao: Situacao, empresa: Empresa): string {
  switch (situacao) {
    case "pagante":
      return "Assinatura ativa no Asaas.";
    case "convidada":
      return "Usa o Pilar sem pagar.";
    case "em_teste": {
      const prazo = prazoTeste(empresa.cobranca.trialEndsAt);
      if (prazo?.startsWith("venceu")) return `Teste ${prazo}: vira só leitura na próxima verificação diária.`;
      return `Teste ${prazo}. Sem assinatura no fim, fica só leitura.`;
    }
    case "teste_vencido":
      return "Teste vencido: só leitura até assinar. Exclusão automática 90 dias depois do vencimento.";
    case "em_atraso":
      return "Pagamento em atraso no Asaas.";
    case "assinatura_cancelada":
      return "Assinatura cancelada. A conta está bloqueada.";
    case "suspensa":
      return "Suspensa por aqui: ninguém da empresa entra até reativar.";
    case "arquivada":
      return "Arquivada: ninguém entra. Reative ou exclua de vez.";
    default:
      return "Sem assinatura registrada.";
  }
}

export default function EmpresaDetalhe() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const pedida = params.get("tab");
  const aba: Aba = pedida === "usuarios" || pedida === "atividade" ? pedida : "visao";
  const [dialog, setDialog] = useState<DialogAberto>(null);
  const query = useEmpresa(id);
  const empresa = query.data;
  usePageTitle(empresa ? `${empresa.nome} · Ultra admin` : "Empresa · Ultra admin");

  const fechar = () => setDialog(null);
  const ok = { onSuccess: fechar };

  const editar = useAcaoEmpresa({
    run: (patch: Record<string, unknown>) => atualizarEmpresa(id, patch),
    sucesso: "Empresa atualizada",
    erro: "Não foi possível salvar",
    contexto: "ultra-admin-empresas:update",
  });
  const mudarStatus = useAcaoEmpresa({
    run: (input: { status: "active" | "suspended" | "cancelled"; confirmName?: string }) =>
      atualizarEmpresa(id, { status: input.status, confirm_name: input.confirmName }),
    sucesso: (i) =>
      i.status === "active" ? "Empresa reativada" : i.status === "suspended" ? "Empresa suspensa" : "Empresa arquivada",
    erro: "Não foi possível mudar o status",
    contexto: "ultra-admin-empresas:status",
  });
  const convidada = useAcaoEmpresa({
    run: (confirmName: string) => atualizarEmpresa(id, { marcar_convidada: { confirm_name: confirmName } }),
    sucesso: "Empresa convidada: acesso liberado sem cobrança",
    erro: "Não foi possível tornar convidada",
    contexto: "ultra-admin-empresas:marcar-convidada",
  });
  const cobrar = useAcaoEmpresa({
    run: (i: { confirmName: string; diasPrazo: number }) =>
      atualizarEmpresa(id, { converter_pagante: { dias_prazo: i.diasPrazo, confirm_name: i.confirmName } }),
    sucesso: (i) => `Cobrança iniciada: ${i.diasPrazo} dias para assinar`,
    erro: "Não foi possível começar a cobrar",
    contexto: "ultra-admin-empresas:converter-pagante",
  });
  const excluir = useAcaoEmpresa({
    run: (i: { confirmName: string; motivo: string }) =>
      edgeFetch("ultra-admin-empresas", {
        method: "DELETE",
        body: { empresa_id: id, confirm_name: i.confirmName, motivo: i.motivo },
      }),
    sucesso: "Empresa excluída",
    erro: "Não foi possível excluir a empresa",
    contexto: "ultra-admin-empresas:delete",
  });

  if (query.isLoading) return <PageLoader size="page" />;

  if (!empresa) {
    return (
      <PageLayout
        header={<PageHeader title="Empresa" breadcrumbs={[{ label: "Empresas", to: "/ultra-admin/empresas" }]} />}
      >
        <EmptyState
          icon={Building2}
          title="Empresa não encontrada"
          description="Ela pode ter sido excluída. Volte pra lista e confira."
          action={{ label: "Ver empresas", onClick: () => navigate("/ultra-admin/empresas"), variant: "outline" }}
        />
      </PageLayout>
    );
  }

  const situacao = situacaoEmpresa(empresa.status, empresa.cobranca);
  const convitesPendentes = empresa.usuarios.filter((u) => u.isPending).length;
  const naoPaga = !empresa.cobranca.isPaying && !empresa.cobranca.convidada;

  return (
    <PageLayout
      header={
        <PageHeader title={empresa.nome} breadcrumbs={[{ label: "Empresas", to: "/ultra-admin/empresas" }]}>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => setDialog("editar")}>
            <Pencil size={14} />
            Editar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full px-2" aria-label="Mais ações">
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              {empresa.cobranca.convidada && (
                <DropdownMenuItem onClick={() => setDialog("cobrar")}>Começar a cobrar</DropdownMenuItem>
              )}
              {naoPaga && <DropdownMenuItem onClick={() => setDialog("convidada")}>Tornar convidada</DropdownMenuItem>}
              {(empresa.cobranca.convidada || naoPaga) && <DropdownMenuSeparator />}
              {empresa.status === "active" ? (
                <DropdownMenuItem onClick={() => setDialog("suspender")} className="gap-2">
                  <PauseCircle size={14} /> Suspender acesso
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => mudarStatus.mutate({ status: "active" })} className="gap-2">
                  <PlayCircle size={14} /> Reativar
                </DropdownMenuItem>
              )}
              {empresa.status !== "cancelled" ? (
                <DropdownMenuItem onClick={() => setDialog("arquivar")} className="gap-2">
                  <Archive size={14} /> Arquivar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => setDialog("excluir")}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 size={14} /> Excluir de vez
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </PageHeader>
      }
    >
      <Card className="border border-black/5">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusBadge domain="empresa_situacao" status={situacao} />
            <p className="text-sm text-ink-soft">{resumoCobranca(situacao, empresa)}</p>
            {situacao === "convidada" && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setDialog("cobrar")}>
                Começar a cobrar
              </Button>
            )}
            {(situacao === "em_teste" || situacao === "teste_vencido") && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setDialog("convidada")}>
                Tornar convidada
              </Button>
            )}
            {situacao === "arquivada" && (
              <>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => mudarStatus.mutate({ status: "active" })}
                >
                  Reativar
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-destructive"
                  onClick={() => setDialog("excluir")}
                >
                  Excluir de vez
                </Button>
              </>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
            <Fato label="Plano">{PLAN_LABEL[empresa.plano]}</Fato>
            <Fato label="Usuários">
              {empresa.usersCount}
              {convitesPendentes > 0 && (
                <span className="font-normal text-ink-muted"> + {convitesPendentes} convidados</span>
              )}
            </Fato>
            <Fato label="Projetos ativos">{empresa.projetosAtivos ?? "-"}</Fato>
            <Fato label="Último acesso">{quandoRelativo(empresa.ultimoAcesso) ?? "Ninguém entrou"}</Fato>
            <Fato label="Criada em">{empresa.createdAt ? formatDate(empresa.createdAt.slice(0, 10)) : "-"}</Fato>
            <Fato label="CNPJ">{empresa.cnpj ?? "Não informado"}</Fato>
          </dl>
        </CardContent>
      </Card>

      <Tabs value={aba} onValueChange={(v) => setParams(v === "visao" ? {} : { tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários ({empresa.usersCount})</TabsTrigger>
          <TabsTrigger value="atividade">Atividade</TabsTrigger>
        </TabsList>
        <TabsContent value="visao" className="mt-4">
          <EmpresaVisaoTab
            empresa={empresa}
            onVerAtividade={() => setParams({ tab: "atividade" }, { replace: true })}
          />
        </TabsContent>
        <TabsContent value="usuarios" className="mt-4">
          <EmpresaUsuariosTab empresa={empresa} />
        </TabsContent>
        <TabsContent value="atividade" className="mt-4">
          <EmpresaAtividadeTab empresaId={empresa.id} />
        </TabsContent>
      </Tabs>

      <EditarEmpresaDialog
        open={dialog === "editar"}
        onOpenChange={(o) => !o && fechar()}
        isPending={editar.isPending}
        empresa={empresa}
        onConfirm={(patch) => editar.mutate(patch, ok)}
      />
      <SuspenderDialog
        open={dialog === "suspender"}
        onOpenChange={(o) => !o && fechar()}
        isPending={mudarStatus.isPending}
        empresaNome={empresa.nome}
        onConfirm={(confirmName) => mudarStatus.mutate({ status: "suspended", confirmName }, ok)}
      />
      <ArquivarDialog
        open={dialog === "arquivar"}
        onOpenChange={(o) => !o && fechar()}
        isPending={mudarStatus.isPending}
        empresaNome={empresa.nome}
        onConfirm={(confirmName) => mudarStatus.mutate({ status: "cancelled", confirmName }, ok)}
      />
      <ExcluirDialog
        open={dialog === "excluir"}
        onOpenChange={(o) => !o && fechar()}
        isPending={excluir.isPending}
        empresaNome={empresa.nome}
        onConfirm={(input) =>
          excluir.mutate(input, {
            onSuccess: () => {
              fechar();
              navigate("/ultra-admin/empresas", { replace: true });
            },
          })
        }
      />
      <TornarConvidadaDialog
        open={dialog === "convidada"}
        onOpenChange={(o) => !o && fechar()}
        isPending={convidada.isPending}
        empresaNome={empresa.nome}
        onConfirm={(confirmName) => convidada.mutate(confirmName, ok)}
      />
      <ComecarCobrarDialog
        open={dialog === "cobrar"}
        onOpenChange={(o) => !o && fechar()}
        isPending={cobrar.isPending}
        empresaNome={empresa.nome}
        onConfirm={(input) => cobrar.mutate(input, ok)}
      />
    </PageLayout>
  );
}
