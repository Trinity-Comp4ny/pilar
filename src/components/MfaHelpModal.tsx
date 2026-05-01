import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Smartphone, Lightbulb } from "lucide-react";

interface MfaHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  {
    title: "Instale um app autenticador",
    description: "No seu celular, baixe um dos apps abaixo.",
    apps: ["Google Authenticator", "Microsoft Authenticator", "Authy", "1Password"],
  },
  {
    title: "Escaneie o QR Code",
    description: "Abra o app e use a opção de escanear código. Aponte a câmera para o QR exibido aqui.",
  },
  {
    title: "Digite o código de 6 dígitos",
    description: "O app vai gerar um código que troca a cada 30 segundos. Copie o atual e cole abaixo.",
  },
  {
    title: "Pronto",
    description: "Daqui para frente, a cada novo login vamos pedir o código do app.",
  },
];

export function MfaHelpModal({ open, onOpenChange }: MfaHelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Como configurar o MFA</DialogTitle>
          <DialogDescription>Proteja sua conta em 4 passos rápidos.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-2">
          {STEPS.map((step, idx) => (
            <div key={idx} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand text-ink flex items-center justify-center font-semibold text-sm">
                {idx + 1}
              </div>
              <div className="flex-1">
                <h4 className="font-medium mb-1">{step.title}</h4>
                <p className="text-sm text-muted-foreground mb-2">{step.description}</p>
                {step.apps && (
                  <div className="flex flex-wrap gap-2">
                    {step.apps.map((app) => (
                      <span
                        key={app}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-xs font-medium text-slate-700"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        {app}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="flex gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="font-medium text-sm mb-1 text-amber-900">Troque de celular?</h5>
              <p className="text-xs text-amber-800">
                Antes de formatar ou trocar de aparelho, use a opção "Trocar autenticador" para re-configurar. Sem isso,
                só o suporte consegue liberar a conta.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
