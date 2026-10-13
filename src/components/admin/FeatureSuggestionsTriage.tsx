import { useState } from "react";
import { Bug, Image as ImageIcon, Lightbulb, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safeError";

export type FeatureSuggestionStatus = "novo" | "em_analise" | "planejado" | "descartado";
type FeedbackTipo = "bug" | "sugestao";

export type ManagedFeatureSuggestion = {
  id: string;
  tipo: FeedbackTipo;
  titulo: string | null;
  descricao: string;
  createdAt: string;
  authorEmail: string | null;
  empresaNome: string | null;
  rota: string | null;
  navegador: string | null;
  printPath: string | null;
  sentryEventId: string | null;
  statusInterno: FeatureSuggestionStatus;
};

const STATUS_OPTIONS: { value: FeatureSuggestionStatus; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "em_analise", label: "Em análise" },
  { value: "planejado", label: "Planejado" },
  { value: "descartado", label: "Descartado" },
];

type FiltroTipo = "todos" | FeedbackTipo;

const FILTROS: { value: FiltroTipo; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "bug", label: "Problemas" },
  { value: "sugestao", label: "Sugestões" },
];

export type FeatureSuggestionsTriageProps = {
  suggestions: ManagedFeatureSuggestion[];
  onChangeStatus: (id: string, status: FeatureSuggestionStatus) => void;
};

/** Signed URL curta: o print pode ter dado de cliente, então nada de link permanente. */
const PRINT_URL_TTL_S = 600;

export function FeatureSuggestionsTriage({ suggestions, onChangeStatus }: FeatureSuggestionsTriageProps) {
  const [filtro, setFiltro] = useState<FiltroTipo>("todos");
  const [print, setPrint] = useState<{ url: string; item: ManagedFeatureSuggestion } | null>(null);
  const visiveis = filtro === "todos" ? suggestions : suggestions.filter((s) => s.tipo === filtro);

  const abrirPrint = async (item: ManagedFeatureSuggestion) => {
    if (!item.printPath) return;
    const { data, error } = await supabase.storage
      .from("feedback-prints")
      .createSignedUrl(item.printPath, PRINT_URL_TTL_S);
    if (error || !data) {
      toast.error("Não deu pra abrir o print", { description: getSafeErrorMessage(error) });
      return;
    }
    setPrint({ url: data.signedUrl, item });
  };

  return (
    <Card className="border border-black/5">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare size={20} strokeWidth={1.5} />
            Feedback dos usuários
          </CardTitle>
          <CardDescription>
            Problemas e sugestões enviados pelo modal de feedback do app. Triagem interna, sem visibilidade pro usuário.
          </CardDescription>
        </div>
        <Select value={filtro} onValueChange={(v) => setFiltro(v as FiltroTipo)}>
          <SelectTrigger className="h-8 w-36" aria-label="Filtrar por tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTROS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Feedback</TableHead>
              <TableHead>Autor</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead className="w-48">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-black/50">
                  Nenhum feedback enviado ainda. Ele chega aqui e no sino assim que alguém usar o botão Feedback do menu
                  do usuário.
                </TableCell>
              </TableRow>
            ) : (
              visiveis.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="max-w-md align-top">
                    <p className="flex items-center gap-1.5 font-medium">
                      {s.tipo === "bug" ? (
                        <Bug size={14} strokeWidth={1.5} aria-label="Problema" className="shrink-0" />
                      ) : (
                        <Lightbulb size={14} strokeWidth={1.5} aria-label="Sugestão" className="shrink-0" />
                      )}
                      <span className="line-clamp-1">{s.titulo ?? "Problema relatado"}</span>
                    </p>
                    <p className="line-clamp-3 whitespace-pre-line text-xs text-black/60">{s.descricao}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-black/50">
                      {s.rota && (
                        <span className="font-mono" title={s.navegador ?? undefined}>
                          {s.rota}
                        </span>
                      )}
                      {s.sentryEventId && <span title={s.sentryEventId}>Sentry {s.sentryEventId.slice(0, 8)}</span>}
                      {s.printPath && (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto gap-1 p-0 text-xs"
                          onClick={() => abrirPrint(s)}
                        >
                          <ImageIcon size={12} strokeWidth={1.5} />
                          Ver print
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-black/70">
                    <p>{s.authorEmail ?? "-"}</p>
                    {s.empresaNome && <p className="text-xs text-black/50">{s.empresaNome}</p>}
                  </TableCell>
                  <TableCell className="align-top text-black/70">{formatDateTime(s.createdAt)}</TableCell>
                  <TableCell className="align-top">
                    <Select
                      value={s.statusInterno}
                      onValueChange={(value) => onChangeStatus(s.id, value as FeatureSuggestionStatus)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={print !== null} onOpenChange={(next) => !next && setPrint(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{print?.item.titulo ?? "Problema relatado"}</DialogTitle>
            <DialogDescription>
              {[print?.item.empresaNome, print?.item.authorEmail, print?.item.rota].filter(Boolean).join(" · ")}
            </DialogDescription>
          </DialogHeader>
          {print && (
            <img
              src={print.url}
              alt={`Print enviado por ${print.item.authorEmail ?? "usuário"}`}
              className="max-h-[75vh] w-full rounded border border-black/10 object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
