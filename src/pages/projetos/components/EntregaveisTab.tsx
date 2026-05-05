import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Loader2,
  Download,
  Upload,
  CheckCircle2,
  Clock,
  RotateCcw,
  Paperclip,
  FileText,
  Trash2,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface EntregaveisTabProps {
  projetoId: string;
  canEdit: boolean;
  disciplinas: { disciplina: string }[];
}

interface Entregavel {
  id: string;
  projeto_id: string;
  empresa_id: string;
  titulo: string;
  descricao: string | null;
  tipo: "documento" | "aprovacao" | "informacao" | null;
  status: "pendente" | "aprovado" | "revisao_solicitada";
  versao: number;
  disciplina: string | null;
  fase: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  arquivo_mime: string | null;
  arquivo_tamanho_bytes: number | null;
  drive_url: string | null;
  entregavel_pai_id: string | null;
  resposta_cliente: string | null;
  resposta_empresa: string | null;
  respondido_em: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<Entregavel["status"], { label: string; className: string; icon: typeof Clock }> = {
  pendente: {
    label: "Aguardando cliente",
    className: "bg-amber-50 text-amber-800 border-amber-200",
    icon: Clock,
  },
  aprovado: {
    label: "Aprovado",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: CheckCircle2,
  },
  revisao_solicitada: {
    label: "Revisão solicitada",
    className: "bg-orange-50 text-orange-800 border-orange-200",
    icon: RotateCcw,
  },
};

const TIPO_OPTIONS: { value: Entregavel["tipo"]; label: string }[] = [
  { value: "documento", label: "Documento" },
  { value: "aprovacao", label: "Aprovação" },
  { value: "informacao", label: "Informação" },
];

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const DRIVE_URL_REGEX = /^https:\/\/(drive|docs)\.google\.com\/.+/;

export function EntregaveisTab({ projetoId, canEdit, disciplinas }: EntregaveisTabProps) {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [parentForRevision, setParentForRevision] = useState<Entregavel | null>(null);

  const { data: entregaveis = [], isLoading } = useQuery({
    queryKey: ["entregaveis", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_entregas")
        .select("*")
        .eq("projeto_id", projetoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Entregavel[];
    },
  });

  const threads = useMemo(() => buildThreads(entregaveis), [entregaveis]);

  const openNew = () => {
    setParentForRevision(null);
    setIsFormOpen(true);
  };

  const openRevision = (parent: Entregavel) => {
    setParentForRevision(parent);
    setIsFormOpen(true);
  };

  const stats = useMemo(() => {
    const pendentes = entregaveis.filter((e) => e.status === "pendente").length;
    const aprovados = entregaveis.filter((e) => e.status === "aprovado").length;
    const revisoes = entregaveis.filter((e) => e.status === "revisao_solicitada").length;
    return { pendentes, aprovados, revisoes };
  }, [entregaveis]);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {stats.pendentes} pendente{stats.pendentes === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline" className="text-xs border-emerald-200 text-emerald-700">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {stats.aprovados} aprovado{stats.aprovados === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline" className="text-xs border-orange-200 text-orange-700">
              <RotateCcw className="h-3 w-3 mr-1" />
              {stats.revisoes} revisão{stats.revisoes === 1 ? "" : "s"} pendente
            </Badge>
          </div>
          {canEdit && (
            <Button size="sm" onClick={openNew}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo entregável
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : threads.length === 0 ? (
          <EmptyState canEdit={canEdit} onNew={openNew} />
        ) : (
          <div className="space-y-2">
            {threads.map((thread) => (
              <ThreadCard
                key={thread.root.id}
                thread={thread}
                canEdit={canEdit}
                expanded={expandedThread === thread.root.id}
                onToggle={() => setExpandedThread((prev) => (prev === thread.root.id ? null : thread.root.id))}
                onRequestRevision={openRevision}
              />
            ))}
          </div>
        )}
      </CardContent>

      {isFormOpen && (
        <EntregavelForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          projetoId={projetoId}
          disciplinas={disciplinas}
          parent={parentForRevision}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["entregaveis", projetoId] });
          }}
        />
      )}
    </Card>
  );
}

type Thread = { root: Entregavel; versoes: Entregavel[] };

function buildThreads(entregaveis: Entregavel[]): Thread[] {
  const byId = new Map<string, Entregavel>(entregaveis.map((e) => [e.id, e]));
  const threadsMap = new Map<string, Thread>();

  for (const e of entregaveis) {
    let rootId = e.id;
    let current: Entregavel | undefined = e;
    while (current?.entregavel_pai_id) {
      const parent = byId.get(current.entregavel_pai_id);
      if (!parent) break;
      rootId = parent.id;
      current = parent;
    }
    if (!threadsMap.has(rootId)) {
      threadsMap.set(rootId, { root: byId.get(rootId)!, versoes: [] });
    }
    threadsMap.get(rootId)!.versoes.push(e);
  }

  for (const thread of threadsMap.values()) {
    thread.versoes.sort((a, b) => a.versao - b.versao);
  }

  return Array.from(threadsMap.values()).sort(
    (a, b) => new Date(b.root.created_at).getTime() - new Date(a.root.created_at).getTime()
  );
}

function ThreadCard({
  thread,
  canEdit,
  expanded,
  onToggle,
  onRequestRevision,
}: {
  thread: Thread;
  canEdit: boolean;
  expanded: boolean;
  onToggle: () => void;
  onRequestRevision: (parent: Entregavel) => void;
}) {
  const current = thread.versoes[thread.versoes.length - 1];
  const config = STATUS_CONFIG[current.status];
  const StatusIcon = config.icon;
  const hasHistory = thread.versoes.length > 1;

  return (
    <div
      className={cn(
        "rounded-lg border transition-all bg-white",
        current.status === "revisao_solicitada" && "border-orange-200 bg-orange-50/30",
        current.status === "aprovado" && "border-emerald-200/50"
      )}
    >
      <div className="flex items-start gap-3 p-3 cursor-pointer hover:bg-black/[0.015]" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{current.titulo}</span>
            {current.disciplina && (
              <Badge variant="secondary" className="text-[10px]">
                {current.disciplina}
              </Badge>
            )}
            {current.versao > 1 && (
              <Badge variant="outline" className="text-[10px]">
                v{current.versao}
              </Badge>
            )}
          </div>
          {current.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{current.descricao}</p>}
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
            <span>{new Date(current.created_at).toLocaleDateString("pt-BR")}</span>
            {current.fase && <span>· {current.fase}</span>}
            {current.arquivo_nome && (
              <span className="flex items-center gap-1">
                · <Paperclip className="h-3 w-3" /> {current.arquivo_nome}
              </span>
            )}
            {current.drive_url && (
              <span className="flex items-center gap-1 text-blue-700">
                · <ExternalLink className="h-3 w-3" /> Google Drive
              </span>
            )}
            {hasHistory && <span>· {thread.versoes.length} versões</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge className={cn("text-[10px] border", config.className)}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/10 p-3 space-y-3">
          {thread.versoes.map((v) => (
            <VersionDetail key={v.id} entrega={v} isLatest={v.id === current.id} />
          ))}

          {canEdit && current.status === "revisao_solicitada" && (
            <div className="pt-2 border-t border-dashed">
              <Button size="sm" onClick={() => onRequestRevision(current)}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Enviar nova versão (v{current.versao + 1})
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VersionDetail({ entrega, isLatest }: { entrega: Entregavel; isLatest: boolean }) {
  const config = STATUS_CONFIG[entrega.status];

  return (
    <div className={cn("rounded-md p-3 bg-white border text-xs space-y-2", !isLatest && "opacity-70")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            v{entrega.versao}
          </Badge>
          <Badge className={cn("text-[10px] border", config.className)}>{config.label}</Badge>
          <span className="text-muted-foreground">{new Date(entrega.created_at).toLocaleString("pt-BR")}</span>
        </div>
        <div className="flex items-center gap-2">
          {entrega.drive_url && <DriveLinkButton url={entrega.drive_url} />}
          {entrega.arquivo_path && <DownloadButton path={entrega.arquivo_path} nome={entrega.arquivo_nome} />}
        </div>
      </div>

      {entrega.descricao && <p className="text-xs text-foreground">{entrega.descricao}</p>}

      {entrega.resposta_empresa && (
        <div className="rounded p-2 bg-blue-50 border border-blue-100 text-[11px] text-blue-900">
          <span className="font-medium">Nossa observação:</span> {entrega.resposta_empresa}
        </div>
      )}

      {entrega.resposta_cliente && (
        <div className="rounded p-2 bg-orange-50 border border-orange-100 text-[11px] text-orange-900">
          <span className="font-medium">Cliente solicitou:</span> {entrega.resposta_cliente}
          {entrega.respondido_em && (
            <span className="block mt-0.5 text-[10px] text-orange-700/70">
              {new Date(entrega.respondido_em).toLocaleString("pt-BR")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function DownloadButton({ path, nome }: { path: string; nome: string | null }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage.from("portal-entregas").createSignedUrl(path, 300);
      if (error) throw error;
      const url = data?.signedUrl;
      if (!url) throw new Error("URL não gerada");
      const link = document.createElement("a");
      link.href = url;
      link.download = nome || "entregavel";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error("Não foi possível baixar o arquivo");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleDownload} disabled={downloading}>
      {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
      <span className="ml-1 max-w-[120px] truncate">{nome || "Baixar"}</span>
    </Button>
  );
}

function DriveLinkButton({ url }: { url: string }) {
  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className="h-7 text-[11px] border-blue-200 text-blue-700 hover:bg-blue-50"
    >
      <a href={url} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="h-3 w-3" />
        <span className="ml-1">Google Drive</span>
      </a>
    </Button>
  );
}

function EmptyState({ canEdit, onNew }: { canEdit: boolean; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <FileText className="h-10 w-10 mb-3 opacity-30" />
      <p className="text-sm font-medium">Nenhum entregável enviado ainda</p>
      <p className="text-xs mt-1">
        Entregáveis aparecem no portal do cliente para aprovação ou solicitação de revisão.
      </p>
      {canEdit && (
        <Button size="sm" variant="outline" className="mt-4" onClick={onNew}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Enviar primeiro entregável
        </Button>
      )}
    </div>
  );
}

function EntregavelForm({
  open,
  onOpenChange,
  projetoId,
  disciplinas,
  parent,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId: string;
  disciplinas: { disciplina: string }[];
  parent: Entregavel | null;
  onSuccess: () => void;
}) {
  const [titulo, setTitulo] = useState(parent?.titulo ?? "");
  const [descricao, setDescricao] = useState("");
  const [disciplina, setDisciplina] = useState<string>(parent?.disciplina ?? "");
  const [fase, setFase] = useState(parent?.fase ?? "");
  const [tipo, setTipo] = useState<Entregavel["tipo"]>(parent?.tipo ?? "documento");
  const [respostaEmpresa, setRespostaEmpresa] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [driveUrl, setDriveUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const driveUrlTrim = driveUrl.trim();
  const driveUrlInvalid = driveUrlTrim.length > 0 && !DRIVE_URL_REGEX.test(driveUrlTrim);

  const disciplinasUnicas = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const d of disciplinas) {
      if (d.disciplina && !seen.has(d.disciplina)) {
        seen.add(d.disciplina);
        out.push(d.disciplina);
      }
    }
    return out;
  }, [disciplinas]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      toast.error("Arquivo muito grande", { description: "Limite de 50MB." });
      e.target.value = "";
      return;
    }
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!titulo.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    if (driveUrlInvalid) {
      toast.error("Link do Google Drive inválido", {
        description: "Use uma URL drive.google.com ou docs.google.com",
      });
      return;
    }
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão inválida");

      const { data: profile } = await supabase.from("profiles").select("empresa_id").eq("id", user.id).single();
      if (!profile?.empresa_id) throw new Error("Empresa não encontrada");

      const nextVersao = parent ? parent.versao + 1 : 1;

      const insertPayload = {
        empresa_id: profile.empresa_id,
        projeto_id: projetoId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        tipo,
        disciplina: disciplina || null,
        fase: fase.trim() || null,
        versao: nextVersao,
        entregavel_pai_id: parent?.id ?? null,
        resposta_empresa: parent && respostaEmpresa.trim() ? respostaEmpresa.trim() : null,
        respondido_empresa_em: parent && respostaEmpresa.trim() ? new Date().toISOString() : null,
        drive_url: driveUrlTrim || null,
        status: "pendente",
        created_by: user.id,
      };
      const { data: inserted, error: insertErr } = await supabase
        .from("portal_entregas")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(insertPayload as any)
        .select()
        .single();
      if (insertErr || !inserted) throw insertErr ?? new Error("Falha ao criar");

      if (file) {
        const cleanName = file.name.replace(/[^\w\-.]/g, "_");
        const path = `${profile.empresa_id}/${projetoId}/${inserted.id}/${cleanName}`;
        const { error: uploadErr } = await supabase.storage
          .from("portal-entregas")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (uploadErr) throw uploadErr;

        const { error: updateErr } = await supabase
          .from("portal_entregas")

          .update({
            arquivo_path: path,
            arquivo_nome: file.name,
            arquivo_mime: file.type || null,
            arquivo_tamanho_bytes: file.size,
          } as Record<string, unknown>)
          .eq("id", inserted.id);
        if (updateErr) throw updateErr;
      }

      toast.success(parent ? `Nova versão v${nextVersao} enviada` : "Entregável enviado");
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{parent ? `Nova versão — v${parent.versao + 1}` : "Novo entregável"}</DialogTitle>
          <DialogDescription>
            {parent
              ? "Envie uma versão revisada em resposta à solicitação do cliente."
              : "Será enviado para o portal do cliente para aprovação ou comentário."}
          </DialogDescription>
        </DialogHeader>

        {parent?.resposta_cliente && (
          <div className="rounded-md bg-orange-50 border border-orange-200 p-3 text-xs text-orange-900">
            <p className="font-medium mb-1">Cliente solicitou:</p>
            <p>{parent.resposta_cliente}</p>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Título *</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Projeto arquitetônico — anteprojeto"
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Disciplina</Label>
              <Select value={disciplina} onValueChange={setDisciplina}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {disciplinasUnicas.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Cadastre disciplinas no projeto primeiro.
                    </div>
                  ) : (
                    disciplinasUnicas.map((d) => (
                      <SelectItem key={d} value={d} className="text-xs">
                        {d}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fase</Label>
              <Input
                value={fase}
                onChange={(e) => setFase(e.target.value)}
                placeholder="Ex: Anteprojeto, Executivo"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo ?? "documento"} onValueChange={(v) => setTipo(v as Entregavel["tipo"])}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPO_OPTIONS.map((t) => (
                  <SelectItem key={t.value ?? ""} value={t.value ?? ""} className="text-xs">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="O que o cliente deve avaliar neste entregável?"
              rows={3}
              maxLength={1000}
            />
          </div>

          {parent && (
            <div className="space-y-1.5">
              <Label className="text-xs">Resposta à solicitação do cliente</Label>
              <Textarea
                value={respostaEmpresa}
                onChange={(e) => setRespostaEmpresa(e.target.value)}
                placeholder="Descreva o que mudou nesta versão"
                rows={2}
                maxLength={500}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Arquivo (opcional, máx 50MB)</Label>
            <FileUploadField file={file} onFileChange={handleFileChange} onClear={() => setFile(null)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <ExternalLink className="h-3 w-3" />
              Link Google Drive (opcional)
            </Label>
            <Input
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className={cn("h-9 text-xs", driveUrlInvalid && "border-destructive focus-visible:ring-destructive")}
            />
            {driveUrlInvalid ? (
              <p className="text-[10px] text-destructive">
                URL deve começar com https://drive.google.com ou https://docs.google.com
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Cole link de pasta ou arquivo. Lembre de compartilhar com o cliente no Drive.
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={submitting || !titulo.trim() || driveUrlInvalid}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Enviar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FileUploadField({
  file,
  onFileChange,
  onClear,
}: {
  file: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  if (file) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="truncate">{file.name}</span>
          <span className="text-muted-foreground flex-shrink-0">{formatFileSize(file.size)}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear} aria-label="Remover arquivo">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <label className="flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-black/10 bg-black/[0.015] px-3 py-4 cursor-pointer text-xs hover:border-brand/30 hover:bg-brand/5 transition-colors">
      <Upload className="h-4 w-4 text-muted-foreground" />
      <span className="text-muted-foreground">Clique para escolher arquivo</span>
      <input type="file" className="hidden" onChange={onFileChange} />
    </label>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
