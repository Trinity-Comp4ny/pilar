import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PilarPage } from "@/components/PilarPage";
import { FormDialog } from "@/components/FormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/motion/PageLoader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AVISOS_PLATAFORMA_KEY } from "@/hooks/useAvisosPlataforma";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDateTime } from "@/lib/format";
import { getSafeErrorMessage } from "@/lib/safeError";
import { useEmpresas } from "./hooks";
import { localParaIso } from "./components/manutencaoForm";
import { erroDoComunicado, publicoDoComunicado, situacaoComunicado, type FormComunicado } from "./comunicadosLib";

const KEY = ["ultra-admin-comunicados"] as const;
const TODOS = "todos";
const VAZIO: FormComunicado = {
  titulo: "",
  mensagem: "",
  formato: "faixa",
  linkUrl: "",
  linkRotulo: "",
  empresaId: null,
  planoSlug: null,
  soAdmins: false,
  inicio: "",
  fim: "",
};

// Comunicados da plataforma (SPEC 157): avisar os escritórios dentro do app, em faixa ou modal,
// para todos ou um público. Encerrar tira de todos na hora.
export default function Comunicados() {
  usePageTitle("Comunicados · Ultra admin");
  const qc = useQueryClient();
  const empresas = useEmpresas();
  const [form, setForm] = useState<FormComunicado | null>(null);
  const [encerrarAlvo, setEncerrarAlvo] = useState<{ id: string; titulo: string } | null>(null);

  const planos = useQuery({
    queryKey: ["ultra-admin-planos-slug"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pilar_subscription_plans").select("slug, nome").order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plataforma_comunicados")
        .select("id, titulo, mensagem, formato, link_url, empresa_id, plano_slug, so_admins, inicio, fim, encerrado_em")
        .order("inicio", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: KEY });
    void qc.invalidateQueries({ queryKey: AVISOS_PLATAFORMA_KEY });
  };

  const criar = useMutation({
    mutationFn: async (f: FormComunicado) => {
      const { error } = await supabase.from("plataforma_comunicados").insert({
        titulo: f.titulo.trim(),
        mensagem: f.mensagem.trim(),
        formato: f.formato,
        link_url: f.linkUrl.trim() || null,
        link_rotulo: f.linkRotulo.trim() || null,
        empresa_id: f.empresaId,
        plano_slug: f.planoSlug,
        so_admins: f.soAdmins,
        inicio: localParaIso(f.inicio) ?? new Date().toISOString(),
        fim: localParaIso(f.fim),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comunicado publicado");
      setForm(null);
      recarregar();
    },
    onError: (err) => toast.error("Não foi possível publicar", { description: getSafeErrorMessage(err) }),
  });

  const encerrar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("plataforma_comunicados")
        .update({ encerrado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comunicado encerrado");
      setEncerrarAlvo(null);
      recarregar();
    },
    onError: (err) => toast.error("Não foi possível encerrar", { description: getSafeErrorMessage(err) }),
  });

  const nomeEmpresa = (id: string | null) =>
    id ? (empresas.data?.find((e) => e.id === id)?.nome ?? "um escritório") : null;
  const agora = query.dataUpdatedAt;
  const erro = form ? erroDoComunicado(form) : null;

  return (
    <PilarPage
      title="Comunicados"
      primaryAction={{ label: "Novo comunicado", icon: Plus, onClick: () => setForm(VAZIO) }}
    >
      <p className="text-sm text-ink-muted">
        Aviso para os escritórios dentro do app. Faixa fica no topo do conteúdo até a pessoa dispensar; modal abre uma
        vez. Use para o que muda a vida do cliente: preço, prazo, mudança de regra.
      </p>

      {query.isLoading ? (
        <PageLoader label="Buscando comunicados" />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhum comunicado ainda"
          description="Crie o primeiro em Novo comunicado."
        />
      ) : (
        <div className="space-y-3">
          {(query.data ?? []).map((c) => {
            const situacao = situacaoComunicado(c, agora);
            return (
              <Card key={c.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                      {c.titulo}
                      <Badge
                        variant={situacao === "ativo" ? "success" : situacao === "programado" ? "info" : "outline"}
                      >
                        {situacao === "ativo" ? "No ar" : situacao === "programado" ? "Programado" : "Encerrado"}
                      </Badge>
                      <Badge variant="outline">{c.formato === "modal" ? "Modal" : "Faixa"}</Badge>
                    </p>
                    <p className="text-sm text-ink">{c.mensagem}</p>
                    <p className="text-xs text-ink-muted">
                      {`${publicoDoComunicado(c, nomeEmpresa(c.empresa_id))} · desde ${formatDateTime(c.inicio)}`}
                      {c.fim ? ` até ${formatDateTime(c.fim)}` : ""}
                    </p>
                  </div>
                  {situacao !== "encerrado" && (
                    <Button variant="outline" size="sm" onClick={() => setEncerrarAlvo({ id: c.id, titulo: c.titulo })}>
                      Encerrar
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <FormDialog
        open={!!form}
        onOpenChange={(o) => !o && setForm(null)}
        title="Novo comunicado"
        description="Aparece para o público escolhido a partir do início."
        size="lg"
        submitLabel="Publicar"
        isPending={criar.isPending}
        submitDisabled={!!erro}
        onSubmit={() => form && !erro && criar.mutate(form)}
      >
        {form && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="com-titulo">Título</Label>
              <Input
                id="com-titulo"
                value={form.titulo}
                maxLength={120}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ex.: Novo preço do pacote de tokens a partir de dezembro"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="com-mensagem">Mensagem</Label>
              <Textarea
                id="com-mensagem"
                value={form.mensagem}
                maxLength={600}
                rows={3}
                onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Formato</Label>
                <Select
                  value={form.formato}
                  onValueChange={(v) => setForm({ ...form, formato: v as "faixa" | "modal" })}
                >
                  <SelectTrigger aria-label="Formato">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faixa">Faixa no topo</SelectItem>
                    <SelectItem value="modal">Modal (abre uma vez)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Escritório</Label>
                <Select
                  value={form.empresaId ?? TODOS}
                  onValueChange={(v) => setForm({ ...form, empresaId: v === TODOS ? null : v })}
                >
                  <SelectTrigger aria-label="Escritório">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todos</SelectItem>
                    {(empresas.data ?? []).map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select
                  value={form.planoSlug ?? TODOS}
                  onValueChange={(v) => setForm({ ...form, planoSlug: v === TODOS ? null : v })}
                >
                  <SelectTrigger aria-label="Plano">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todos</SelectItem>
                    {(planos.data ?? []).map((p) => (
                      <SelectItem key={p.slug} value={p.slug}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <Checkbox checked={form.soAdmins} onCheckedChange={(v) => setForm({ ...form, soAdmins: v === true })} />
              Só administradores dos escritórios
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="com-link">Link (opcional)</Label>
                <Input
                  id="com-link"
                  value={form.linkUrl}
                  onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                  placeholder="/gestao/financeiro ou https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="com-link-rotulo">Texto do link</Label>
                <Input
                  id="com-link-rotulo"
                  value={form.linkRotulo}
                  maxLength={40}
                  onChange={(e) => setForm({ ...form, linkRotulo: e.target.value })}
                  placeholder="Saiba mais"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="com-inicio">Início (vazio = agora)</Label>
                <Input
                  id="com-inicio"
                  type="datetime-local"
                  value={form.inicio}
                  onChange={(e) => setForm({ ...form, inicio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="com-fim">Fim (opcional)</Label>
                <Input
                  id="com-fim"
                  type="datetime-local"
                  value={form.fim}
                  onChange={(e) => setForm({ ...form, fim: e.target.value })}
                />
              </div>
            </div>
            {erro && form.titulo && form.mensagem && <p className="text-sm text-danger-strong">{erro}</p>}
          </div>
        )}
      </FormDialog>

      <ConfirmDialog
        open={!!encerrarAlvo}
        onOpenChange={(o) => !o && setEncerrarAlvo(null)}
        title="Encerrar comunicado"
        itemName={encerrarAlvo?.titulo}
        description="Sai do app de todos os escritórios na hora."
        confirmText="Encerrar"
        loading={encerrar.isPending}
        onConfirm={() => encerrarAlvo && encerrar.mutate(encerrarAlvo.id)}
      />
    </PilarPage>
  );
}
