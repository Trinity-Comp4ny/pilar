import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettingsModal } from "@/contexts/SettingsModalContext";
import { env } from "@/lib/env";
import { versaoAtual } from "@/lib/versaoApp";

const LINK_CLASS = "text-sm font-medium text-ink underline-offset-4 hover:underline";

// Rodapé da aba Conta: a versão em uso (o suporte pergunta "qual versão aparece aí?")
// e os caminhos de ajuda. Link interno fecha o modal, senão a página abre por trás dele.
export function SobrePilar() {
  const { closeSettings } = useSettingsModal();
  const statusUrl = env.VITE_STATUS_URL;

  return (
    <Card className="border border-border-subtle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Info size={16} className="text-ink" /> Sobre a Pilar
        </CardTitle>
        <CardDescription data-testid="versao-app" className="font-mono text-xs">
          {versaoAtual()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <nav aria-label="Ajuda e novidades" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/novidades" onClick={closeSettings} className={LINK_CLASS}>
            Novidades
          </Link>
          <Link to="/ajuda" onClick={closeSettings} className={LINK_CLASS}>
            Central de ajuda
          </Link>
          {statusUrl ? (
            <a href={statusUrl} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
              Status do sistema
            </a>
          ) : (
            <Link to="/status" onClick={closeSettings} className={LINK_CLASS}>
              Status do sistema
            </Link>
          )}
        </nav>
      </CardContent>
    </Card>
  );
}
