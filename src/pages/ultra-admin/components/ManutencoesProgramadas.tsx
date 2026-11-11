import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { FormDialog } from "@/components/FormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AVISOS_PLATAFORMA_KEY } from "@/hooks/useAvisosPlataforma";
import { janelaManutencao } from "@/lib/avisosPlataforma";
import { getSafeErrorMessage } from "@/lib/safeError";
import { erroDoForm, localParaIso, VAZIO, type FormManutencao as Form } from "./manutencaoForm";

const KEY = ["ultra-admin-manutencoes"] as const;

interface Manutencao {
  id: string;
  titulo: string;
  mensagem: string | null;
  inicio: string;
  fim: string;
}

/**
 * Manutenções programadas (SPEC 153): o app mostra a faixa 24 h antes e durante a janela.
 * Cancelar grava `cancelada_em` e tira a faixa de todos.
 */
export function ManutencoesProgramadas() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [cancelarAlvo, setCancelarAlvo] = useState<Manutencao | null>(null);

  const query = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Manutencao[]> => {
      const { data, error } = await supabase
        .from("status_manutencoes")
        .select("id, titulo, mensagem, inicio, fim")
        .is("cancelada_em", null)
        .gt("fim", new Date().toISOString())
        .order("inicio");
      if (error) throw error;
      return data ?? [];
    },
  });

  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: KEY });
    void qc.invalidateQueries({ queryKey: AVISOS_PLATAFORMA_KEY });
  };

  const criar = useMutation({
    mutationFn: async (f: Form) => {
      const { error } = await supabase.from("status_manutencoes").insert({
        titulo: f.titulo.trim(),
        mensagem: f.mensagem.trim() || null,
        inicio: localParaIso(f.inicio) as string,
        fim: localParaIso(f.fim) as string,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Manutenção programada", { description: "A faixa aparece no app 24 h antes do início." });
      setForm(null);
      recarregar();
    },
    onError: (err) => toast.error("Não foi possível salvar", { description: getSafeErrorMessage(err) }),
  });

  const cancelar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("status_manutencoes")
        .update({ cancelada_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Manutenção cancelada");
      setCancelarAlvo(null);
      recarregar();
    },
    onError: (err) => toast.error("Não foi possível cancelar", { description: getSafeErrorMessage(err) }),
  });

  const lista = query.data ?? [];
  // Hora da última busca: a lista é refeita junto, e a render fica pura.
  const agora = query.dataUpdatedAt;
  const erro = form ? erroDoForm(form, agora || undefined) : null;

  return (
    <section className="space-y-3" aria-labelledby="manutencoes-titulo">
      <div className="flex items-center justify-between gap-2">
        <h2 id="manutencoes-titulo" className="text-sm font-semibold text-ink">
          Manutenções programadas <span className="font-normal text-ink-muted">({lista.length})</span>
        </h2>
        <Button variant="outline" size="sm" onClick={() => setForm(VAZIO)}>
          <Plus size={14} aria-hidden /> Programar
        </Button>
      </div>

      {!query.isLoading && lista.length === 0 && <EmptyState compact title="Nenhuma manutenção programada." />}
      {lista.map((m) => {
        const emAndamento = new Date(m.inicio).getTime() <= agora;
        return (
          <Card key={m.id} className="border border-black/5">
            <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 space-y-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  <CalendarClock size={15} aria-hidden />
                  {m.titulo}
                  {emAndamento && <Badge variant="warning">Em andamento</Badge>}
                </p>
                <p className="text-xs text-ink-muted">
                  {`Previsto ${janelaManutencao(new Date(m.inicio), new Date(m.fim))} (horário de Brasília)`}
                </p>
                {m.mensagem && <p className="text-sm text-ink">{m.mensagem}</p>}
              </div>
              <Button variant="outline" size="sm" onClick={() => setCancelarAlvo(m)}>
                {emAndamento ? "Encerrar" : "Cancelar"}
              </Button>
            </CardContent>
          </Card>
        );
      })}

      <FormDialog
        open={!!form}
        onOpenChange={(o) => !o && setForm(null)}
        title="Programar manutenção"
        description="A faixa aparece para todos os escritórios 24 h antes e durante a janela."
        isPending={criar.isPending}
        submitLabel="Programar"
        submitDisabled={!!erro}
        onSubmit={() => form && !erro && criar.mutate(form)}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manut-titulo">Título</Label>
            <Input
              id="manut-titulo"
              value={form?.titulo ?? ""}
              maxLength={120}
              onChange={(e) => setForm((f) => f && { ...f, titulo: e.target.value })}
              placeholder="Ex.: Atualização do banco de dados"
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manut-inicio">Início</Label>
              <Input
                id="manut-inicio"
                type="datetime-local"
                value={form?.inicio ?? ""}
                onChange={(e) => setForm((f) => f && { ...f, inicio: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manut-fim">Fim</Label>
              <Input
                id="manut-fim"
                type="datetime-local"
                value={form?.fim ?? ""}
                onChange={(e) => setForm((f) => f && { ...f, fim: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manut-mensagem">Mensagem para o cliente (opcional)</Label>
            <Textarea
              id="manut-mensagem"
              value={form?.mensagem ?? ""}
              maxLength={500}
              rows={3}
              onChange={(e) => setForm((f) => f && { ...f, mensagem: e.target.value })}
              placeholder="Ex.: O Financeiro fica fora do ar por até 1 hora. O resto funciona normalmente."
            />
          </div>
          {erro && form?.inicio && form?.fim && <p className="text-sm text-danger-strong">{erro}</p>}
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!cancelarAlvo}
        onOpenChange={(o) => !o && setCancelarAlvo(null)}
        title="Cancelar manutenção"
        itemName={cancelarAlvo?.titulo}
        description="A faixa some do app para todos."
        confirmText="Cancelar manutenção"
        cancelText="Voltar"
        loading={cancelar.isPending}
        onConfirm={() => cancelarAlvo && cancelar.mutate(cancelarAlvo.id)}
      />
    </section>
  );
}
