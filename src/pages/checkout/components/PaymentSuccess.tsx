import { CheckCircle2, Mail } from "lucide-react";

interface PaymentSuccessProps {
  email: string;
  planNome: string;
  inviteDispatched: boolean;
}

export function PaymentSuccess({ email, planNome, inviteDispatched }: PaymentSuccessProps) {
  return (
    <div className="text-center space-y-6 py-8">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand/10 text-positive-strong">
        <CheckCircle2 className="w-8 h-8" />
      </div>

      <div>
        <h2 className="text-3xl font-medium text-ink">Pagamento confirmado</h2>
        <p className="text-ink-muted mt-2">Plano {planNome} ativo. Bem-vindo ao Pilar.</p>
      </div>

      <div className="bg-muted border border-border rounded-xl p-6 text-left space-y-3">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium text-ink">
              {inviteDispatched ? "Email enviado" : "Enviando email..."}
            </p>
            <p className="text-xs text-ink-muted">
              Verifique <span className="font-medium text-ink-soft">{email}</span> pra definir sua senha e entrar no
              Pilar.
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-ink-disabled">Não chegou em 5 minutos? Confira spam ou entre em contato com o suporte.</p>
    </div>
  );
}
