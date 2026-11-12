import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { useAlternarPrevia, usePrevias } from "@/hooks/usePrevias";

/**
 * Prévia de recursos (SPEC 160) em Configurações → Conta: ligar um recurso antes de todo mundo,
 * mandar feedback e voltar à versão atual quando quiser. Sem recurso em prévia, não aparece.
 */
export function PreviasRecursos() {
  const { recursos, ligadas } = usePrevias();
  const alternar = useAlternarPrevia();
  const [feedbackDe, setFeedbackDe] = useState<string | null>(null);
  if (recursos.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          Prévia de recursos
        </CardTitle>
        <CardDescription>
          Teste antes o que ainda está saindo do forno. Vale só para você, e dá para voltar à versão atual quando
          quiser.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-black/5">
          {recursos.map((r) => {
            const ligado = ligadas.has(r.chave);
            return (
              <li key={r.chave} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-ink">{r.nome}</p>
                  <p className="text-sm text-ink-muted">{r.descricao}</p>
                  {ligado && (
                    <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setFeedbackDe(r.nome)}>
                      Contar o que achou
                    </Button>
                  )}
                </div>
                <Switch
                  checked={ligado}
                  aria-label={ligado ? `Voltar à versão atual de ${r.nome}` : `Ligar a prévia de ${r.nome}`}
                  disabled={alternar.isPending}
                  onCheckedChange={(v) =>
                    alternar.mutate(
                      { chave: r.chave, ligar: v },
                      {
                        onSuccess: () => toast.success(v ? `${r.nome} ligado para você` : "Voltou à versão atual"),
                        onError: () => toast.error("Não foi possível mudar a prévia"),
                      }
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      </CardContent>
      <FeedbackDialog
        open={!!feedbackDe}
        onOpenChange={(o) => !o && setFeedbackDe(null)}
        mensagemInicial={feedbackDe ? `Prévia de ${feedbackDe}: ` : undefined}
      />
    </Card>
  );
}
