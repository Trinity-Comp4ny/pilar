import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { TrocarSenhaForm } from "./TrocarSenhaForm";
import { usePageTitle } from "@/hooks/usePageTitle";

interface ForcarTrocaSenhaProps {
  // Chamado após a troca: revalida a sessão e libera a navegação.
  onSuccess: () => void;
}

// Tela cheia mostrada logo após o login quando a conta usa senha temporária
// (convite/reset). Bloqueia o portal até o cliente definir a própria senha.
export default function ForcarTrocaSenha({ onSuccess }: ForcarTrocaSenhaProps) {
  usePageTitle("Portal | Trocar senha");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
              <ShieldCheck className="h-6 w-6 text-brand" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-slate-900">Defina sua senha</h1>
              <p className="text-sm text-muted-foreground">
                Sua senha foi gerada pelo escritório. Crie uma senha própria para continuar.
              </p>
            </div>
          </div>

          <TrocarSenhaForm forced onSuccess={onSuccess} />
        </CardContent>
      </Card>
    </div>
  );
}
