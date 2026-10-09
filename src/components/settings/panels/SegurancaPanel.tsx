import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { MfaSetup } from "@/components/MfaSetup";
import { PasswordChangeCard } from "@/components/profile/PasswordChangeCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { translateAuthError } from "@/lib/authErrors";

// Encerra as outras sessões e mantém esta. O Supabase revoga os refresh tokens
// na hora; o access token que já está em outro aparelho vale até expirar (1h).
function OutrosDispositivosCard() {
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOutOthers = async () => {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      toast.success("Outros dispositivos desconectados");
    } catch (err) {
      toast.error("Não foi possível desconectar", { description: translateAuthError(err) });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogOut className="h-5 w-5" />
          Outros dispositivos
        </CardTitle>
        <CardDescription>
          Encerra o acesso em todos os navegadores e celulares, menos neste. O acesso termina em até 1 hora.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={handleSignOutOthers} disabled={signingOut}>
          {signingOut ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
          Sair dos outros dispositivos
        </Button>
      </CardContent>
    </Card>
  );
}

// Aba Segurança do modal: autenticação em dois fatores (TOTP), troca de senha e
// encerramento das outras sessões.
export function SegurancaPanel() {
  const { user } = useAuth();
  const email = user?.email ?? "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Autenticação em dois fatores
          </CardTitle>
          <CardDescription>Opcional. Pede um código do app autenticador a cada login, além da senha.</CardDescription>
        </CardHeader>
        <CardContent>
          <MfaSetup />
        </CardContent>
      </Card>

      <PasswordChangeCard currentEmail={email} />

      <OutrosDispositivosCard />
    </div>
  );
}
