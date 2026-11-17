import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSettingsModal } from "@/contexts/SettingsModalContext";
import { supabase } from "@/integrations/supabase/client";
import { edgeFunctionErrorDetail } from "@/lib/edgeFunctionError";
import { monitoring } from "@/lib/monitoring";

interface ExportacaoPronta {
  url: string;
  arquivo: string;
}

// SPEC 098: quem não pode regularizar a assinatura (não é admin) não vê o atalho
// pra tela de pagamento nem o export, que ele não tem acesso mesmo. Só orienta a
// falar com quem administra a empresa.
//
// O admin leva os dados mesmo sem pagar (LGPD art. 18, portabilidade): a edge
// exportar-dados-empresa exige admin, login recente e tem limite por hora.
export function SubscriptionSuspendedScreen({ isAdmin }: { isAdmin: boolean }) {
  const { openSettings } = useSettingsModal();
  const [exportando, setExportando] = useState(false);
  const [precisaReentrar, setPrecisaReentrar] = useState(false);

  async function exportarDados() {
    setExportando(true);
    setPrecisaReentrar(false);
    try {
      const { data, error } = await supabase.functions.invoke<ExportacaoPronta>("exportar-dados-empresa", {
        body: {},
      });
      if (error) {
        const { message, codigo } = await edgeFunctionErrorDetail(
          error,
          "Não foi possível gerar a exportação. Tente de novo em instantes."
        );
        if (codigo === "reautenticar") {
          setPrecisaReentrar(true);
          return;
        }
        toast.error(message);
        return;
      }
      if (!data?.url) {
        toast.error("Não foi possível gerar a exportação. Tente de novo em instantes.");
        return;
      }
      // O link assinado já vem com o cabeçalho de download: a página não navega.
      window.location.assign(data.url);
      toast.success("Exportação pronta. O download começou.");
    } catch (error) {
      monitoring.captureException(error, { context: "exportar-dados-empresa" });
      toast.error("Não foi possível gerar a exportação. Tente de novo em instantes.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-muted p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-warning-soft">
            <AlertTriangle className="h-10 w-10 text-warning-mid" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-ink">Acesso suspenso</h1>
          <p className="text-ink-muted text-sm leading-relaxed">
            {isAdmin
              ? "Sua assinatura está suspensa ou cancelada. Seus dados continuam guardados. Regularize o pagamento para retomar o acesso, ou exporte uma cópia deles."
              : "A assinatura da sua empresa está suspensa ou cancelada. Fale com o administrador da sua empresa para regularizar o pagamento."}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {isAdmin && (
            <>
              <Button variant="brand" onClick={() => openSettings("pagamento")}>
                Ver assinatura
              </Button>
              <Button variant="outline" onClick={() => void exportarDados()} loading={exportando}>
                {!exportando && <Download className="h-4 w-4" />}
                Exportar meus dados
              </Button>
              {precisaReentrar && (
                <p role="alert" className="text-sm text-ink-muted">
                  Por segurança, a exportação pede um login recente. Saia da conta, entre de novo e tente outra vez.
                </p>
              )}
            </>
          )}
          <Button variant="ghost" asChild className="text-ink-muted">
            <Link to="/" onClick={() => supabase.auth.signOut()}>
              Sair da conta
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
