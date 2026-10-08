import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { MfaSetup } from "@/components/MfaSetup";
import { PasswordChangeCard } from "@/components/profile/PasswordChangeCard";
import { useAuth } from "@/contexts/AuthContext";

// Aba Segurança do modal: autenticação em dois fatores (TOTP) e troca de senha.
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
    </div>
  );
}
