import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Key, Copy, RefreshCw, CheckCircle2, Trash2, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAsaasConfig, type AsaasAmbiente } from "@/hooks/useAsaas";
import { env } from "@/lib/env";

const SUPABASE_URL = env.VITE_SUPABASE_URL;

export function AsaasConfigForm() {
  const {
    carregarConfig,
    salvarConfig,
    regenerarToken,
    removerConfig,
    testarConexao,
    isSaving,
    isLoading,
    isRegenerando,
    isRemovendo,
    isTestando,
  } = useAsaasConfig();
  const [apiKey, setApiKey] = useState("");
  const [ambiente, setAmbiente] = useState<AsaasAmbiente>("sandbox");
  const [jaConfigurado, setJaConfigurado] = useState(false);
  const [webhookToken, setWebhookToken] = useState("");
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

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

  const handleCopiar = async (valor: string) => {
    await navigator.clipboard.writeText(valor);
    toast.success("Copiado");
  };

  const handleRegenerarToken = async () => {
    const novoToken = await regenerarToken();
    if (novoToken) setWebhookToken(novoToken);
  };

  const handleRemover = async () => {
    const ok = await removerConfig();
    if (ok) {
      setJaConfigurado(false);
      setWebhookToken("");
      setApiKey("");
      setAmbiente("sandbox");
    }
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
        <Label htmlFor="asaas-ambiente" className="text-xs">
          Ambiente
        </Label>
        <Select value={ambiente} onValueChange={(v) => setAmbiente(v as AsaasAmbiente)}>
          <SelectTrigger id="asaas-ambiente" aria-label="Ambiente">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
            <SelectItem value="producao">Produção</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="asaas-apikey" className="text-xs">
          API Key
        </Label>
        {jaConfigurado && !apiKey && (
          <div className="flex items-center gap-2 rounded-md border border-positive/20 bg-positive/10 px-3 py-2 text-xs text-positive-strong">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Configurada. Digite uma nova chave abaixo apenas para substituí-la.
          </div>
        )}
        <div className="relative">
          <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="asaas-apikey"
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

      <Button onClick={handleSalvar} disabled={isSaving || (!jaConfigurado && !apiKey.trim())} variant="brand">
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
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => testarConexao()} disabled={isTestando}>
            {isTestando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
            Testar conexão
          </Button>
          <Button
            type="button"
            variant="outline"
            className="text-danger-mid hover:text-danger-strong"
            onClick={() => setConfirmRemoveOpen(true)}
            disabled={isRemovendo}
          >
            {isRemovendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Remover integração
          </Button>
        </div>
      )}

      {jaConfigurado && (
        <div className="space-y-4 border-t pt-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Configuração de Webhook</p>

          <div className="space-y-2">
            <Label className="text-xs">URL do Webhook</Label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="text-xs text-muted-foreground bg-muted font-mono" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleCopiar(webhookUrl)}
                title="Copiar URL"
                aria-label="Copiar"
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
                className="text-xs text-muted-foreground bg-muted font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleCopiar(webhookToken)}
                title="Copiar token"
                aria-label="Copiar"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setConfirmRegenOpen(true)}
                disabled={isRegenerando}
                title="Regenerar token"
                aria-label="Regenerar token do webhook"
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

      <ConfirmDialog
        open={confirmRegenOpen}
        onOpenChange={setConfirmRegenOpen}
        onConfirm={handleRegenerarToken}
        title="Regenerar token do webhook"
        description="O token atual será invalidado imediatamente. O webhook já configurado no Asaas vai parar de funcionar até você atualizar o novo token lá. Deseja continuar?"
        variant="destructive"
        confirmText="Regenerar"
      />

      <ConfirmDialog
        open={confirmRemoveOpen}
        onOpenChange={setConfirmRemoveOpen}
        onConfirm={handleRemover}
        title="Remover integração Asaas"
        description="A chave e a configuração de webhook serão apagadas. Novas cobranças pelo Asaas deixarão de funcionar até reconfigurar. Deseja continuar?"
        variant="destructive"
        confirmText="Remover"
      />
    </div>
  );
}
