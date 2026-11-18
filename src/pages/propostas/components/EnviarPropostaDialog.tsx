import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Send } from "lucide-react";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BusyMark } from "@/components/motion/BusyMark";
import { PageLoader } from "@/components/motion/PageLoader";
import { supabase } from "@/integrations/supabase/client";
import { mensagemDaFunction } from "@/lib/edgeError";
import { reportInvokeError } from "@/lib/monitoring";
import { analytics } from "@/lib/analytics";
import { gerarPropostaPdf, nomeArquivoProposta } from "../lib/propostaPdf";

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

interface EnviarPropostaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposta: {
    id: string;
    titulo: string;
    tipo?: string | null;
    area_m2?: number | null;
    localizacao?: string | null;
    valor_proposto?: number | null;
    prazo_estimado_dias?: number | null;
    validade?: string | null;
    observacao?: string | null;
    lead_id?: string | null;
    cliente_id?: string | null;
  };
  disciplinas?: { disciplina: string; valor_venda?: number }[];
  onSent?: () => void;
}

// Logo da empresa como data URL para o jsPDF. Falha (CORS, 404) devolve undefined e o
// PDF sai só com o nome da empresa.
async function carregarLogo(url?: string | null): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    if (!/^image\/(png|jpe?g)$/.test(blob.type)) return undefined;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

/**
 * Proposta em um passo: o PDF padrão já sai preenchido com os dados do sistema.
 * O usuário confere, baixa ou envia por e-mail. Sem template e sem variável.
 */
export function EnviarPropostaDialog({ open, onOpenChange, proposta, disciplinas = [], onSent }: EnviarPropostaDialogProps) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [email, setEmail] = useState("");
  const [assunto, setAssunto] = useState(`Proposta — ${proposta.titulo}`);
  const [mensagem, setMensagem] = useState("");

  const { data: contato } = useQuery({
    queryKey: ["proposta-destinatario", proposta.lead_id, proposta.cliente_id],
    enabled: open && (!!proposta.lead_id || !!proposta.cliente_id),
    queryFn: async () => {
      const tabela = proposta.cliente_id ? "clientes" : "leads";
      const id = (proposta.cliente_id ?? proposta.lead_id) as string;
      const { data } = await supabase.from(tabela).select("nome, email, contato").eq("id", id).single();
      return data;
    },
  });

  const { data: empresa } = useQuery({
    queryKey: ["empresa-marca-proposta"],
    enabled: open,
    queryFn: async () => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) return null;
      const { data } = await supabase.from("empresas").select("nome, logo_url").eq("id", empresaId).single();
      return data;
    },
  });

  const itens = useMemo(
    () => disciplinas.map((d) => ({ descricao: d.disciplina, valor: d.valor_venda ?? 0 })),
    [disciplinas]
  );

  // E-mail do destinatário vem do cadastro; o usuário só edita se faltar.
  useEffect(() => {
    if (contato?.email) setEmail((atual) => atual || contato.email || "");
  }, [contato]);

  useEffect(() => {
    if (!open || empresa === undefined) return;
    let cancelado = false;
    let url: string | null = null;
    setGerando(true);
    (async () => {
      try {
        const logo = await carregarLogo(empresa?.logo_url);
        const pdf = await gerarPropostaPdf({
          titulo: proposta.titulo,
          tipo: proposta.tipo,
          empresaNome: empresa?.nome,
          empresaLogo: logo,
          cliente: contato,
          localizacao: proposta.localizacao,
          areaM2: proposta.area_m2,
          valor: proposta.valor_proposto,
          prazoDias: proposta.prazo_estimado_dias,
          validade: proposta.validade,
          observacao: proposta.observacao,
          itens,
        });
        if (cancelado) return;
        url = URL.createObjectURL(pdf);
        setBlob(pdf);
        setPreviewUrl(url);
      } catch (err) {
        reportInvokeError(err, "gerar-proposta-pdf");
        toast.error("Não foi possível gerar o PDF");
      } finally {
        if (!cancelado) setGerando(false);
      }
    })();
    return () => {
      cancelado = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, empresa, contato, proposta, itens]);

  const emailInvalido = email.trim().length > 0 && !isValidEmail(email);

  const baixar = () => {
    if (blob) saveAs(blob, nomeArquivoProposta(proposta.titulo));
  };

  const enviar = async () => {
    if (!blob) return;
    if (!isValidEmail(email)) {
      toast.error("Informe um e-mail válido");
      return;
    }
    setEnviando(true);
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binario = "";
      for (let i = 0; i < bytes.byteLength; i++) binario += String.fromCharCode(bytes[i]);
      const { error } = await supabase.functions.invoke("send-proposta-email", {
        body: {
          email: email.trim(),
          subject: assunto.trim() || `Proposta — ${proposta.titulo}`,
          mensagem: mensagem.trim() || undefined,
          attachment_base64: btoa(binario),
          filename: nomeArquivoProposta(proposta.titulo),
          proposta_id: proposta.id,
          nome_cliente: contato?.nome || undefined,
          doc_mode: "proposta",
        },
      });
      if (error) throw new Error(await mensagemDaFunction(error, error.message));
      toast.success("Proposta enviada", { description: `E-mail enviado para ${email.trim()}` });
      analytics.track("proposta_enviada", { documento: "proposta", formato: "pdf" });
      onSent?.();
      onOpenChange(false);
    } catch (err) {
      reportInvokeError(err, "send-proposta-email");
      toast.error("Erro ao enviar e-mail", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar proposta</DialogTitle>
          <DialogDescription>
            O PDF sai pronto com os dados do cliente, o escopo e o valor. Confira e envie.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
          <div className="min-h-72 rounded-lg border bg-muted/30 overflow-hidden">
            {gerando || !previewUrl ? (
              <PageLoader />
            ) : (
              <iframe title="Prévia da proposta" src={previewUrl} className="h-[26rem] w-full" />
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="enviar-email">E-mail do cliente *</Label>
              <Input
                id="enviar-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@email.com"
                aria-invalid={emailInvalido}
              />
              {emailInvalido && <p className="text-xs text-negative-strong">Digite um e-mail válido.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="enviar-assunto">Assunto</Label>
              <Input id="enviar-assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enviar-mensagem">Mensagem (opcional)</Label>
              <Textarea
                id="enviar-mensagem"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={4}
                placeholder="Uma mensagem para acompanhar o PDF"
              />
            </div>
            <p className="text-2xs text-muted-foreground">
              Depois do envio, a proposta passa para <strong>Enviada</strong>.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={baixar} disabled={!blob}>
            <Download className="h-4 w-4" /> Baixar PDF
          </Button>
          <Button
            variant="brand"
            className="gap-1.5"
            onClick={enviar}
            disabled={!blob || !email.trim() || emailInvalido || enviando}
          >
            {enviando ? (
              <>
                <BusyMark className="h-4 w-4" /> Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Enviar por e-mail
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
