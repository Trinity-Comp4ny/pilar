import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PilarPage } from "@/components/PilarPage";
import { FormDialog } from "@/components/FormDialog";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/motion/PageLoader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PREVIAS_KEY } from "@/hooks/usePrevias";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getSafeErrorMessage } from "@/lib/safeError";

const KEY = ["ultra-admin-previas"] as const;
const CHAVE = /^[a-z][a-z0-9_-]{1,39}$/;

// Prévia de recursos (SPEC 160): cadastrar o recurso em prévia, ligar e desligar o catálogo e ver
// quantas pessoas ligaram. O código do recurso usa usePrevia("<chave>").
export default function Previas() {
  usePageTitle("Prévias · Ultra admin");
  const qc = useQueryClient();
  const [form, setForm] = useState<{ chave: string; nome: string; descricao: string } | null>(null);

  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const [recursos, ligadas] = await Promise.all([
        supabase
          .from("recursos_previa")
          .select("chave, nome, descricao, ativo, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("usuario_previas").select("chave"),
      ]);
      if (recursos.error) throw recursos.error;
      if (ligadas.error) throw ligadas.error;
      const contagem = new Map<string, number>();
      for (const l of ligadas.data ?? []) contagem.set(l.chave, (contagem.get(l.chave) ?? 0) + 1);
      return (recursos.data ?? []).map((r) => ({ ...r, pessoas: contagem.get(r.chave) ?? 0 }));
    },
  });

  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: KEY });
    void qc.invalidateQueries({ queryKey: PREVIAS_KEY });
  };

  const criar = useMutation({
    mutationFn: async (f: { chave: string; nome: string; descricao: string }) => {
      const { error } = await supabase
        .from("recursos_previa")
        .insert({ chave: f.chave.trim(), nome: f.nome.trim(), descricao: f.descricao.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prévia cadastrada");
      setForm(null);
      recarregar();
    },
    onError: (err) => toast.error("Não foi possível cadastrar", { description: getSafeErrorMessage(err) }),
  });

  const ativar = useMutation({
    mutationFn: async ({ chave, ativo }: { chave: string; ativo: boolean }) => {
      const { error } = await supabase.from("recursos_previa").update({ ativo }).eq("chave", chave);
      if (error) throw error;
    },
    onSettled: recarregar,
    onError: (err) => toast.error("Não foi possível mudar", { description: getSafeErrorMessage(err) }),
  });

  const chaveValida = !!form && CHAVE.test(form.chave.trim());
  const pronto = !!form && chaveValida && !!form.nome.trim() && !!form.descricao.trim();

  return (
    <PilarPage
      title="Prévia de recursos"
      primaryAction={{
        label: "Nova prévia",
        icon: Plus,
        onClick: () => setForm({ chave: "", nome: "", descricao: "" }),
      }}
    >
      <p className="text-sm text-ink-muted">
        Recurso em prévia aparece em Configurações → Conta para quem quiser testar antes. No código, mostre a novidade
        só quando <code>usePrevia(&quot;chave&quot;)</code> for verdadeiro. Desligar tira do catálogo e de todo mundo.
      </p>
      {query.isLoading ? (
        <PageLoader label="Buscando prévias" />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Nenhum recurso em prévia"
          description="Cadastre o primeiro em Nova prévia."
        />
      ) : (
        <div className="space-y-3">
          {(query.data ?? []).map((r) => (
            <Card key={r.chave}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-ink">
                    {r.nome} <code className="text-xs text-ink-muted">{r.chave}</code>
                  </p>
                  <p className="text-sm text-ink-muted">{r.descricao}</p>
                  <p className="text-xs text-ink-muted">
                    {r.pessoas === 1 ? "1 pessoa ligou" : `${r.pessoas} pessoas ligaram`}
                  </p>
                </div>
                <Switch
                  checked={r.ativo}
                  aria-label={r.ativo ? `Tirar ${r.nome} do catálogo` : `Pôr ${r.nome} no catálogo`}
                  onCheckedChange={(v) => ativar.mutate({ chave: r.chave, ativo: v })}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <FormDialog
        open={!!form}
        onOpenChange={(o) => !o && setForm(null)}
        title="Nova prévia"
        submitLabel="Cadastrar"
        isPending={criar.isPending}
        submitDisabled={!pronto}
        onSubmit={() => form && pronto && criar.mutate(form)}
      >
        {form && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="previa-chave">Chave (usada no código)</Label>
              <Input
                id="previa-chave"
                value={form.chave}
                onChange={(e) => setForm({ ...form, chave: e.target.value })}
                placeholder="ex.: gantt-novo"
                autoFocus
              />
              {form.chave && !chaveValida && (
                <p className="text-xs text-danger-strong">Minúsculas, números, - ou _, começando por letra.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="previa-nome">Nome</Label>
              <Input
                id="previa-nome"
                value={form.nome}
                maxLength={80}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="previa-descricao">O que muda para quem ligar</Label>
              <Textarea
                id="previa-descricao"
                value={form.descricao}
                maxLength={400}
                rows={3}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>
          </div>
        )}
      </FormDialog>
    </PilarPage>
  );
}
