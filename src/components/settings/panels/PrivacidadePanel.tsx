import { useEffect, useState } from "react";
import { Cookie, Download, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/safeError";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { requestCookieConsentReview, getCookieConsent, CONSENT_CHANGED_EVENT } from "@/lib/cookieConsent";

// Ações de autoatendimento LGPD (exportar/excluir dados), que exigem sessão
// autenticada. O texto legal completo mora em pilarsoft.com.br/privacidade
// (marketing, sem login) — ver ADR 0025.
export function PrivacidadePanel() {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [exportSubmitting, setExportSubmitting] = useState(false);
  const [exportRequested, setExportRequested] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(() => getCookieConsent()?.analytics ?? false);

  useEffect(() => {
    const onConsentChanged = () => setAnalyticsConsent(getCookieConsent()?.analytics ?? false);
    window.addEventListener(CONSENT_CHANGED_EVENT, onConsentChanged);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onConsentChanged);
  }, []);

  const handleRequestExport = async () => {
    if (!user) return;
    setExportSubmitting(true);
    try {
      const { data, error } = await (
        supabase.rpc as unknown as (
          fn: string,
          args?: Record<string, unknown>
        ) => Promise<{ data: { error?: string } | null; error: { message: string } | null }>
      )("request_data_export");
      if (error) throw error;
      if (data?.error === "already_pending") {
        toast.info("Já existe uma solicitação de exportação em andamento.");
        return;
      }
      setExportRequested(true);
      toast.success("Solicitação registrada. Enviaremos seus dados por email em até 15 dias.");
    } catch (err) {
      toast.error("Não foi possível registrar a solicitação", {
        description: getSafeErrorMessage(err, "Tente de novo em instantes."),
      });
    } finally {
      setExportSubmitting(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (!user) return;
    setSubmitting(true);
    const { error } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ error: { message: string } | null }>
    )("request_data_deletion", {
      p_motivo: motivo.trim() || null,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Não foi possível registrar a solicitação", {
        description: getSafeErrorMessage(error, "Tente de novo em instantes."),
      });
      return;
    }

    toast.success("Solicitação registrada. Nossa equipe entrará em contato em até 15 dias.");
    setMotivo("");
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Seus dados
          </CardTitle>
          <CardDescription>
            Trate seus dados pessoais conforme a LGPD.{" "}
            <a
              href="https://pilarsoft.com.br/privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Ver política de privacidade completa
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Download className="w-5 h-5 text-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">Exportar meus dados</p>
              <p className="text-sm text-muted-foreground">
                Enviaremos uma cópia de todos os seus dados pessoais por email em até 15 dias (LGPD Art. 18, V).
              </p>
              {exportRequested ? (
                <p className="text-sm text-positive-strong font-medium">
                  Solicitação registrada, aguarde contato em até 15 dias úteis.
                </p>
              ) : (
                <Button variant="outline" size="sm" onClick={handleRequestExport} disabled={exportSubmitting}>
                  <Download className="w-4 h-4 mr-2" />
                  {exportSubmitting ? "Enviando..." : "Solicitar exportação de dados"}
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 pt-4 border-t">
            <Trash2 className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">Excluir meus dados</p>
              <p className="text-sm text-muted-foreground">
                Processamos em até 15 dias, respeitando obrigações legais de retenção (ex.: dados fiscais por 5 anos).
              </p>
              <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Solicitar exclusão de dados
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar solicitação de exclusão</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta solicitação será revisada pela nossa equipe. Dados sujeitos à retenção legal (fiscal,
                      auditoria) podem ser mantidos pelo prazo exigido pela LGPD. Você receberá uma confirmação por
                      email.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-2">
                    <label htmlFor="motivo" className="text-sm font-medium">
                      Motivo (opcional)
                    </label>
                    <Textarea
                      id="motivo"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Conte-nos o motivo para nos ajudar a melhorar..."
                      rows={3}
                      maxLength={500}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        handleRequestDeletion();
                      }}
                      disabled={submitting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {submitting ? "Enviando..." : "Confirmar solicitação"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cookie className="h-4 w-4" />
            Cookies
          </CardTitle>
          <CardDescription>
            Cookies de análise hoje:{" "}
            <strong className="text-foreground">{analyticsConsent ? "aceitos" : "recusados"}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={requestCookieConsentReview}>
            Alterar preferências de cookies
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
