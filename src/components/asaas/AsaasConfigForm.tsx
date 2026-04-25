import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Key, Copy, RefreshCw, CheckCircle2 } from "lucide-react";
import { useAsaasConfig, type AsaasAmbiente } from "@/hooks/useAsaas";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export function AsaasConfigForm() {
  const { carregarConfig, salvarConfig, regenerarToken, isSaving, isLoading, isRegenerando } = useAsaasConfig();
  const [apiKey, setApiKey] = useState("");
  const [ambiente, setAmbiente] = useState<AsaasAmbiente>("sandbox");
  const [jaConfigurado, setJaConfigurado] = useState(false);
  const [webhookToken, setWebhookToken] = useState("");

  const webhookUrl = `${SUPABASE_URL}/functions/v1/asaas-webhook`;

  useEffect(() => {
    carregarConfig().then((config) => {
      if (config) {
        setJaConfigurado(config.configurado);
        setAmbiente(config.ambiente);
        setWebhookToken(config.webhook_token);
      }
    });
  }, []);

  const handleSalvar = async () => {
    const result = await salvarConfig({ apiKey: apiKey.trim() || undefined, ambiente });
    if (result?.webhook_token) {
      setWebhookToken(result.webhook_token);
      setJaConfigurado(true);
      setApiKey("");
    }
  };

  const handleCopiar = (valor: string) => {
    navigator.clipboard.writeText(valor);
  };

  const handleRegenerarToken = async () => {
    const novoToken = await regenerarToken();
    if (novoToken) setWebhookToken(novoToken);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs">Ambiente</Label>
        <Select value={ambiente} onValueChange={(v) => setAmbiente(v as AsaasAmbiente)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
            <SelectItem value="producao">Produção</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">API Key</Label>
        {jaConfigurado && !apiKey && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Configurada. Digite uma nova chave abaixo apenas para substituí-la.
          </div>
        )}
        <div className="relative">
          <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={jaConfigurado ? "Nova chave (deixe em branco para manter)" : "$aact_..."}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Encontre em <span className="font-medium">Minha Conta → Integrações</span> no painel Asaas.
        </p>
      </div>

      <Button
        onClick={handleSalvar}
        disabled={isSaving || (!jaConfigurado && !apiKey.trim())}
        className="bg-accent-orange hover:bg-accent-orange/90 text-ink"
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Salvando...
          </>
        ) : (
          "Salvar configuração"
        )}
      </Button>

      {jaConfigurado && (
        <div className="space-y-4 border-t pt-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Configuração de Webhook</p>

          <div className="space-y-2">
            <Label className="text-xs">URL do Webhook</Label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="text-xs text-muted-foreground bg-gray-50 font-mono" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleCopiar(webhookUrl)}
                title="Copiar URL"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Token de Acesso do Webhook</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={webhookToken}
                type="password"
                className="text-xs text-muted-foreground bg-gray-50 font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleCopiar(webhookToken)}
                title="Copiar token"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleRegenerarToken}
                disabled={isRegenerando}
                title="Regenerar token"
              >
                <RefreshCw className={`h-4 w-4 ${isRegenerando ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure a URL e este token em{" "}
              <span className="font-medium">Configurações → Integrações → Webhooks</span> no painel Asaas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
