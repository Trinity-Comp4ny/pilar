import { useNavigate } from "react-router-dom";
import { MfaChallenge } from "@/components/MfaChallenge";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Logo } from "@/components/Logo";
import { AuthPromessa } from "@/components/AuthPromessa";

export default function MfaChallengePage() {
  usePageTitle("Verificação de dois fatores");
  const navigate = useNavigate();
  const { signOut, refreshMfaLevel } = useAuth();

  const handleVerified = async () => {
    await refreshMfaLevel();
    sessionStorage.setItem("pilar_post_login", "1");
    navigate("/inicio", { replace: true });
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="landing-grain min-h-dvh w-full flex overflow-hidden bg-paper">
      {/* Lado Esquerdo - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-paper relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-brand/6 rounded-full blur-[100px] animate-aurora" />
        </div>

        <button
          onClick={handleLogout}
          className="absolute top-8 left-8 lg:left-12 flex items-center gap-2 text-ink-soft hover:text-brand transition-colors font-medium text-sm group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Sair
        </button>

        <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="flex justify-center">
            <Logo size="lg" className="text-ink" />
          </div>

          <MfaChallenge onVerified={handleVerified} />
        </div>
      </div>

      {/* Lado Direito - Visual */}
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
          <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-black/10" />
        </div>

        <div className="relative z-10 flex flex-col justify-between h-full w-full p-16 text-white">
          <div className="animate-in fade-in slide-in-from-top-8 duration-700 flex justify-end">
            <div className="opacity-80">
              <Logo tone="inverted" size="sm" />
            </div>
          </div>

          <AuthPromessa />

          <div className="text-xs text-white/40 text-right animate-in fade-in duration-1000 delay-300">
            © {new Date().getFullYear()} Pilar. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </div>
  );
}
