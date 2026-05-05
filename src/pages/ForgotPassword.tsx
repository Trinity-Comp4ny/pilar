import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { translateAuthError } from "@/lib/authErrors";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
});

export default function ForgotPassword() {
  usePageTitle("Recuperar senha");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const validate = (value: string) => {
    const result = schema.safeParse({ email: value });
    setEmailError(result.success ? null : (result.error.issues[0]?.message ?? "Email inválido"));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched(true);

    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Email inválido";
      setEmailError(msg);
      toast.error("Email inválido", { description: msg });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error("Erro ao enviar", { description: translateAuthError(error) });
      setIsLoading(false);
      return;
    }

    setSent(true);
    setIsLoading(false);
  };

  return (
    <div className="landing-grain min-h-screen w-full flex overflow-hidden bg-paper">
      {/* Lado Esquerdo - Formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-paper relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-brand/6 rounded-full blur-[100px] animate-aurora" />
        </div>

        <Link
          to="/login"
          className="absolute top-8 left-8 lg:left-12 flex items-center gap-2 text-ink-soft hover:text-brand transition-colors font-medium text-sm group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar
        </Link>

        <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="text-center space-y-2">
            <div className="flex justify-center items-center gap-2 mb-6">
              <img
                src="/pilar-logo.svg"
                alt="Pilar"
                className="h-10 w-auto hover:rotate-12 transition-transform duration-300"
              />
              <span className="text-2xl font-medium tracking-tight text-ink">
                Pilar<sup className="text-[10px] font-normal text-slate-400 ml-0.5 relative -top-2.5">®</sup>
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">Recuperar senha</h1>
            <p className="text-sm text-ink-soft">Informe seu email e enviaremos um link para redefinir sua senha.</p>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center animate-in fade-in duration-500">
              <CheckCircle2 className="w-12 h-12 text-brand" />
              <p className="text-base font-medium text-ink">Email enviado!</p>
              <p className="text-sm text-ink-soft">
                Verifique sua caixa de entrada em <strong>{email}</strong> e clique no link para redefinir sua senha.
              </p>
              <Link
                to="/login"
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-sm font-medium text-ink hover:opacity-90 transition-opacity"
              >
                Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-ink-soft font-medium">
                  Email <span className="text-red-500">*</span>
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-brand transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@empresa.com"
                    className="pl-10 h-11 bg-paper-alt border-paper-border focus:border-brand focus:ring-brand/20 transition-all"
                    value={email}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEmail(v);
                      if (touched) validate(v);
                    }}
                    onBlur={() => {
                      setTouched(true);
                      validate(email);
                    }}
                    aria-invalid={!!emailError}
                    aria-describedby="email-hint"
                    required
                    autoFocus
                  />
                </div>
                {touched && emailError ? (
                  <p id="email-hint" className="text-xs text-red-500" role="alert">
                    {emailError}
                  </p>
                ) : (
                  <p id="email-hint" className="text-xs text-ink-soft">
                    Use o email cadastrado da sua conta.
                  </p>
                )}
              </div>

              <Button
                className="w-full h-11 bg-brand hover:bg-brand/90 text-ink font-medium shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all active:scale-[0.98] text-sm"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  "Enviar link de recuperação"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Lado Direito - Visual (igual ao Login) */}
      <div className="hidden lg:flex w-1/2 relative bg-black items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <video
            src="/video-login.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover opacity-70 scale-105 animate-pulse-slow grayscale"
            style={{ animationDuration: "20s" }}
          />
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
        </div>

        <div className="relative z-10 flex flex-col justify-between h-full w-full p-16 text-white">
          <div className="animate-in fade-in slide-in-from-top-8 duration-700 flex justify-end">
            <div className="flex items-center gap-3 opacity-80">
              <img
                src="/pilar-logo.svg"
                alt="Pilar"
                className="h-8 w-8 brightness-0 invert hover:rotate-12 transition-transform duration-300"
              />
              <span className="text-xl font-medium tracking-tight">
                Pilar<sup className="text-[9px] font-normal text-white/50 ml-0.5 relative -top-2">®</sup>
              </span>
            </div>
          </div>

          <div className="space-y-8 max-w-lg ml-auto text-right animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
            <div className="flex justify-end">
              <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                Impulsionado por Trinity Company
              </span>
            </div>

            <blockquote className="text-3xl font-light leading-snug">
              "A gestão eficiente é o alicerce onde grandes empresas constroem seu futuro."
            </blockquote>

            <div className="flex flex-col items-end gap-3 pt-4 border-t border-white/20">
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <span>Controle Financeiro Integrado</span>
                <CheckCircle2 className="w-5 h-5 text-brand" />
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <span>Gestão de Projetos e Obras</span>
                <CheckCircle2 className="w-5 h-5 text-brand" />
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <span>CRM e Relacionamento</span>
                <CheckCircle2 className="w-5 h-5 text-brand" />
              </div>
            </div>
          </div>

          <div className="text-xs text-white/40 text-right animate-in fade-in duration-1000 delay-300">
            © {new Date().getFullYear()} Pilar. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </div>
  );
}
