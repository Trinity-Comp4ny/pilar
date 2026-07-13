import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Send,
  ShieldOff,
  Trash2,
  User,
  Landmark,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Banknote,
  Package,
} from "lucide-react";
import { formatDocument } from "@/lib/maskUtils";
import { useClienteDetalhe } from "@/hooks/useClienteDetalhe";
import { usePermissions } from "@/hooks/usePermissions";
import { useRequireAal2 } from "@/hooks/useRequireAal2";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useClientes } from "@/hooks/useClientes";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ClienteMessageDialog } from "@/pages/clientes/ClienteMessageDialog";
import { FinanceiroContent } from "@/pages/portal/PortalFinanceiro";
import type { ClienteReceita } from "@/pages/cliente/useClienteProjetoData";
import { EntregasContent } from "@/pages/portal/PortalEntregas";
import { PROJECT_STATUS_CONFIG } from "@/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Cliente } from "@/hooks/useClientes";
import type { ProjetoResumo } from "@/hooks/useClienteDetalhe";

const formatCurrency = (v: number | null) =>
  v != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

const formatDate = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

const TIPO_NF_LABELS: Record<string, string> = {
  servico: "Serviço",
  produto: "Produto",
  misto: "Misto",
};

// ─── Admin Financeiro Wrapper ────────────────────────────────────────────────

function AdminFinanceiroContent({ projetoId }: { projetoId: string }) {
  const [receitas, setReceitas] = useState<ClienteReceita[]>([]);

  useEffect(() => {
    supabase
      .from("receitas")
      .select("id, descricao, valor, data_vencimento, data_recebimento, status")
      .eq("projeto_id", projetoId)
      .is("deleted_at", null)
      .order("data_vencimento", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          toast.error("Erro ao carregar receitas");
          return;
        }
        setReceitas((data ?? []) as ClienteReceita[]);
      });
  }, [projetoId]);

  return <FinanceiroContent receitas={receitas} />;
}

// ─── Projeto Card ────────────────────────────────────────────────────────────

function ProjetoCard({ projeto }: { projeto: ProjetoResumo }) {
  const config = PROJECT_STATUS_CONFIG[projeto.status as keyof typeof PROJECT_STATUS_CONFIG];
  const progress =
    projeto.total_disciplinas > 0 ? Math.round((projeto.disciplinas_concluidas / projeto.total_disciplinas) * 100) : 0;

  return (
    <Link to={`/projetos/${projeto.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer group">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {projeto.codigo_projeto && (
                <p className="text-[10px] font-mono text-muted-foreground">{projeto.codigo_projeto}</p>
              )}
              <p className="text-sm font-medium truncate group-hover:text-brand transition-colors">{projeto.nome}</p>
            </div>
            {config && <Badge className={cn("text-[10px] shrink-0", config.color)}>{config.label}</Badge>}
          </div>

          {projeto.total_disciplinas > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Progresso</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{projeto.valor_contrato ? formatCurrency(projeto.valor_contrato) : "Sem valor"}</span>
            <span>
              {projeto.data_previsao
                ? `Previsão: ${formatDate(projeto.data_previsao)}`
                : formatDate(projeto.data_inicio)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ─── Projeto Accordion ───────────────────────────────────────────────────────

function ProjetoAccordion({ projeto, children }: { projeto: ProjetoResumo; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const config = PROJECT_STATUS_CONFIG[projeto.status as keyof typeof PROJECT_STATUS_CONFIG];

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            {projeto.codigo_projeto && (
              <span className="text-[10px] font-mono text-muted-foreground mr-2">{projeto.codigo_projeto}</span>
            )}
            <span className="text-sm font-medium">{projeto.nome}</span>
          </div>
        </div>
        {config && <Badge className={cn("text-[10px] shrink-0", config.color)}>{config.label}</Badge>}
      </button>
      {open && <div className="px-4 pb-4 pt-2 border-t">{children}</div>}
    </div>
  );
}

// ─── Visão Geral ─────────────────────────────────────────────────────────────

function VisaoGeralTab({ cliente, isAdmin }: { cliente: Cliente; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const requireAal2 = useRequireAal2();
  const [confirmPortalOpen, setConfirmPortalOpen] = useState(false);
  const [portalCredentials, setPortalCredentials] = useState<{ email: string } | null>(null);
  const [resetCredentials, setResetCredentials] = useState<{ email: string } | null>(null);

  const { portalStatus, isLoadingPortal } = useClienteDetalhe(cliente.id);

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("invite-cliente-portal", {
        body: { cliente_id: cliente.id, email: cliente.email },
      });
      if (error) {
        const body = error.context ? await error.context.json?.().catch(() => null) : null;
        throw new Error(body?.error || error.message);
      }
      if (data?.error) throw new Error(data.error);
      return { email: data.email as string };
    },
    onSuccess: (data) => {
      setPortalCredentials(data);
      queryClient.invalidateQueries({ queryKey: ["portal-status", cliente.id] });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao criar acesso"),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("reset-cliente-portal-password", {
        body: {
          cliente_id: cliente.id,
          nome_cliente: `${cliente.nome}${cliente.sobrenome ? " " + cliente.sobrenome : ""}`,
        },
      });
      if (error) {
        const body = error.context ? await error.context.json?.().catch(() => null) : null;
        throw new Error(body?.error || error.message);
      }
      if (data?.error) throw new Error(data.error);
      return { email: data.email as string };
    },
    onSuccess: (data) => setResetCredentials(data),
    onError: (err: Error) => toast.error(err.message || "Erro ao redefinir senha"),
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("cliente_portal_accounts")
        .update({ ativo: false })
        .eq("cliente_id", cliente.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acesso ao portal revogado");
      setPortalCredentials(null);
      setResetCredentials(null);
      queryClient.invalidateQueries({ queryKey: ["portal-status", cliente.id] });
    },
    onError: () => toast.error("Erro ao revogar acesso"),
  });

  const handleInvite = async () => {
    if (!(await requireAal2())) return;
    inviteMutation.mutate();
  };

  const handleReset = async () => {
    if (!(await requireAal2())) return;
    resetMutation.mutate();
  };

  const handleRevoke = async () => {
    if (!(await requireAal2())) return;
    revokeMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Dados */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">CPF / CNPJ</p>
              <p className="text-sm font-medium">{formatDocument(cliente.cpf_cnpj)}</p>
            </div>
            {cliente.origem && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Origem</p>
                <p className="text-sm font-medium">{cliente.origem}</p>
              </div>
            )}
            {cliente.tipo_nf && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Tipo NF</p>
                <p className="text-sm font-medium capitalize">{TIPO_NF_LABELS[cliente.tipo_nf.toLowerCase()] ?? cliente.tipo_nf}</p>
              </div>
            )}
          </div>

          <div className="pt-2 border-t space-y-2">
            <p className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
              <User className="h-3.5 w-3.5" /> Contato
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {cliente.email || <span className="text-muted-foreground italic">Não informado</span>}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {cliente.contato || <span className="text-muted-foreground italic">Não informado</span>}
              </div>
              {cliente.endereco && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {cliente.endereco}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contas bancárias */}
      {cliente.contas_bancarias && cliente.contas_bancarias.length > 0 && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <p className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
              <Landmark className="h-3.5 w-3.5" /> Contas Bancárias
            </p>
            <div className="space-y-2">
              {cliente.contas_bancarias.map((conta, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 border rounded-lg px-3 py-2 text-sm",
                    conta.is_primary && "border-brand/40 bg-brand/5"
                  )}
                >
                  <Landmark
                    className={cn("h-4 w-4 shrink-0", conta.is_primary ? "text-brand" : "text-muted-foreground")}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{conta.banco}</span>
                      {conta.is_primary && (
                        <span className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded">Principal</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Ag. {conta.agencia} · Cc. {conta.conta} · <span className="capitalize">{conta.tipo}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Portal do Cliente */}
      {isAdmin && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <p className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
              <Globe className="h-3.5 w-3.5" /> Portal do Cliente
            </p>

            {isLoadingPortal && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Verificando...
              </div>
            )}

            {!isLoadingPortal && (portalStatus?.exists || !!portalCredentials) && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-positive/10 border border-positive/20 rounded-lg px-3 py-2 text-sm text-positive">
                  <Globe className="h-4 w-4" />
                  <span className="flex-1">Cliente possui acesso ao portal</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReset}
                    disabled={resetMutation.isPending || revokeMutation.isPending}
                    className="flex-1"
                  >
                    {resetMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {resetMutation.isPending ? "Redefinindo..." : "Redefinir senha"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRevoke}
                    disabled={revokeMutation.isPending || resetMutation.isPending}
                    className="border-red-200 text-red-700 hover:bg-red-50"
                  >
                    {revokeMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <ShieldOff className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {revokeMutation.isPending ? "Revogando..." : "Revogar"}
                  </Button>
                </div>
                {resetCredentials && (
                  <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-sm text-amber-800">
                    Senha redefinida! Credenciais enviadas para <strong>{resetCredentials.email}</strong>.
                  </div>
                )}
              </div>
            )}

            {!isLoadingPortal && portalCredentials && (
              <div className="border border-positive/20 bg-positive/10 rounded-lg p-3 text-sm text-positive">
                Acesso criado! Credenciais enviadas para <strong>{portalCredentials.email}</strong>.
              </div>
            )}

            {!isLoadingPortal && !portalStatus?.exists && !portalCredentials && (
              <div className="space-y-2">
                {cliente.email ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Criar acesso para <span className="font-medium text-foreground">{cliente.email}</span>
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setConfirmPortalOpen(true)}
                      disabled={inviteMutation.isPending}
                      className="bg-brand hover:bg-brand/90 text-ink"
                    >
                      {inviteMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Globe className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {inviteMutation.isPending ? "Criando..." : "Criar acesso ao portal"}
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Cadastre um email para criar acesso ao portal.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmPortalOpen} onOpenChange={setConfirmPortalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Criar acesso ao portal?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Será criado acesso para{" "}
                  <span className="font-medium text-foreground">
                    {cliente.nome}
                    {cliente.sobrenome ? ` ${cliente.sobrenome}` : ""}
                  </span>
                  .
                </p>
                <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-blue-800">
                  <Send className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <p>
                    As credenciais serão enviadas para <strong>{cliente.email}</strong>.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmPortalOpen(false);
                handleInvite();
              }}
              className="bg-brand hover:bg-brand/90 text-ink"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Criar e enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function ClienteDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, can } = usePermissions();
  const canEdit = can("clientes", "edit");

  const { cliente, projetos, isLoadingCliente, isLoadingProjetos } = useClienteDetalhe(id!);

  const clienteNomeCompleto = cliente
    ? `${cliente.nome}${cliente.sobrenome ? " " + cliente.sobrenome : ""}`
    : "Cliente";
  usePageTitle(clienteNomeCompleto);

  const { deleteCliente } = useClientes();

  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageText, setMessageText] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleSendMessage = async () => {
    if (!cliente || !messageText || !messageSubject) return;
    try {
      const { error } = await supabase.functions.invoke("send-manual-client-email", {
        body: { email: cliente.email, subject: messageSubject, message: messageText },
      });
      if (error) throw error;
      toast.success(`Mensagem enviada para ${clienteNomeCompleto}`);
    } catch {
      toast.error("Erro ao enviar mensagem");
    }
    setIsMessageOpen(false);
    setMessageSubject("");
    setMessageText("");
  };

  const handleDelete = async () => {
    if (!cliente) return;
    try {
      await deleteCliente(cliente.id);
      navigate("/clientes");
    } catch {
      // error handled by hook
    }
  };

  if (isLoadingCliente) {
    return (
      <PageLayout header={<PageHeader title="Carregando..." />}>
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PageLayout>
    );
  }

  if (!cliente) {
    return (
      <PageLayout header={<PageHeader title="Cliente não encontrado" />}>
        <div className="p-6 text-muted-foreground text-sm">
          Cliente não encontrado.{" "}
          <button onClick={() => navigate("/clientes")} className="underline">
            Voltar para clientes
          </button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      header={
        <PageHeader title={clienteNomeCompleto} description={formatDocument(cliente.cpf_cnpj)}>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/clientes")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Voltar
            </Button>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setIsMessageOpen(true)}>
                <Mail className="h-4 w-4 mr-1.5" />
                Mensagem
              </Button>
            )}
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate(`/clientes?edit=${cliente.id}`)}>
                  <Pencil className="h-4 w-4 mr-1.5" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Excluir
                </Button>
              </>
            )}
          </div>
        </PageHeader>
      }
    >
      <Tabs defaultValue="visao-geral" className="space-y-4">
        <TabsList>
          <TabsTrigger value="visao-geral" className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="projetos" className="flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            Projetos
            {!isLoadingProjetos && projetos.length > 0 && (
              <span className="text-[10px] bg-muted rounded-full px-1.5">{projetos.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="entregas" className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Entregas
          </TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="visao-geral">
          <VisaoGeralTab cliente={cliente} isAdmin={isAdmin} />
        </TabsContent>

        {/* Projetos */}
        <TabsContent value="projetos">
          {isLoadingProjetos ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          ) : projetos.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum projeto vinculado a este cliente.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projetos.map((p) => (
                <ProjetoCard key={p.id} projeto={p} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Financeiro */}
        <TabsContent value="financeiro">
          {isLoadingProjetos ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : projetos.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Banknote className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum projeto para exibir financeiro.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {projetos.map((p) => (
                <ProjetoAccordion key={p.id} projeto={p}>
                  <AdminFinanceiroContent projetoId={p.id} />
                </ProjetoAccordion>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Entregas */}
        <TabsContent value="entregas">
          {isLoadingProjetos ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : projetos.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum projeto para exibir entregas.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {projetos.map((p) => (
                <ProjetoAccordion key={p.id} projeto={p}>
                  <EntregasContent projetoId={p.id} readOnly />
                </ProjetoAccordion>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ClienteMessageDialog
        open={isMessageOpen}
        cliente={cliente}
        subject={messageSubject}
        message={messageText}
        onSubjectChange={setMessageSubject}
        onMessageChange={setMessageText}
        onCancel={() => {
          setIsMessageOpen(false);
          setMessageSubject("");
          setMessageText("");
        }}
        onSend={handleSendMessage}
        onOpenChange={setIsMessageOpen}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={handleDelete}
        title="Excluir Cliente"
        description="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </PageLayout>
  );
}
