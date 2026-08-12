import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Zap, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AutomacoesTab() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-black/5 bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-medium tracking-tight">Integrações ativas</CardTitle>
          <CardDescription>Conexões com serviços externos já disponíveis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <IntegrationRow
            icon={CreditCard}
            name="Asaas"
            description="Cobrança via boleto, PIX e cartão para receitas"
            status="configurado"
            onOpen={() => navigate("/gestao/financeiro?tab=faturas")}
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-black/5 bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-medium tracking-tight flex items-center gap-2">
            Futuras integrações
            <Badge variant="secondary">Em breve</Badge>
          </CardTitle>
          <CardDescription>Automações planejadas no roadmap</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: "ContaAzul", description: "Sincronização contábil e emissão de NF-e" },
            { name: "Omie", description: "Integração completa com ERP" },
            { name: "WhatsApp Business", description: "Notificação de cobranças e status" },
            { name: "Webhooks customizados", description: "Exportar eventos para sistemas internos" },
          ].map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between rounded-lg border border-black/5 bg-gray-50/50 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-black/5 flex items-center justify-center">
                  <Zap size={16} className="text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                </div>
              </div>
              <Badge variant="outline" className="text-muted-foreground">
                planejado
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function IntegrationRow({
  icon: Icon,
  name,
  description,
  status,
  onOpen,
}: {
  icon: typeof CreditCard;
  name: string;
  description: string;
  status: "configurado" | "não configurado";
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-black/5 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-brand/10 flex items-center justify-center">
          <Icon size={16} className="text-ink" />
        </div>
        <div>
          <div className="text-sm font-medium flex items-center gap-2">
            {name}
            <Badge
              className={
                status === "configurado"
                  ? "bg-emerald-600/15 text-emerald-700 border-transparent hover:bg-emerald-600/15"
                  : "bg-black/5 text-black/50 border-transparent hover:bg-black/5"
              }
            >
              {status}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onOpen} className="gap-1">
        Abrir
        <ArrowUpRight size={14} />
      </Button>
    </div>
  );
}
