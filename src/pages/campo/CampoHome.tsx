import { useNavigate, useOutletContext } from "react-router-dom";
import { ClipboardList, HardHat, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { campoLogout, type CampoAccount } from "./useCampoAuth";

export default function CampoHome() {
  usePageTitle("Pilar Campo");
  const navigate = useNavigate();
  const { account } = useOutletContext<{ account: CampoAccount }>();

  const sair = () => {
    campoLogout();
    navigate("/campo/login", { replace: true });
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="flex items-center justify-between border-b border-black/5 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-ink">
            <HardHat className="h-4 w-4" />
          </div>
          <span className="font-semibold text-ink">Pilar Campo</span>
        </div>
        <Button variant="ghost" size="sm" onClick={sair} className="text-muted-foreground">
          <LogOut className="mr-1.5 h-4 w-4" />
          Sair
        </Button>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-5 py-8">
        <div>
          <p className="text-sm text-muted-foreground">Olá,</p>
          <h1 className="text-2xl font-semibold text-ink">{account.nome}</h1>
        </div>

        <button
          type="button"
          disabled
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-black/10 bg-muted/30 px-4 py-5 text-left"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-ink">Registrar o dia</p>
            <p className="text-sm text-muted-foreground">Em breve: diário, foto e medição pelo celular.</p>
          </div>
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Seu acesso é só desta obra. O que você registrar aqui aparece para o escritório.
        </p>
      </main>
    </div>
  );
}
