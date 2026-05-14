import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Zap } from "lucide-react";
import { AsaasConfigForm } from "@/components/asaas/AsaasConfigForm";

export function IntegracoesTab() {
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-black/5 bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-brand/10 flex items-center justify-center">
                <Zap size={18} className="text-brand" />
              </div>
              <div>
                <CardTitle className="text-base font-medium tracking-tight">Asaas</CardTitle>
                <CardDescription className="text-xs">
                  Gateway de pagamento brasileiro — PIX e boleto
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary">Gateway de pagamento</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2.5 text-xs text-yellow-800">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Suas credenciais são armazenadas com criptografia e <strong>nunca</strong> expostas ao cliente final.
              Apenas administradores e usuários com acesso financeiro podem visualizar esta tela.
            </span>
          </div>
          <AsaasConfigForm />
        </CardContent>
      </Card>
    </div>
  );
}
