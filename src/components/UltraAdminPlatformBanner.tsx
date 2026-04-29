import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isUltraAdmin } from "@/lib/roles";
import { ULTRA_PLATFORM_MODE_KEY } from "./PrivateRoute";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldAlert } from "lucide-react";

export function UltraAdminPlatformBanner() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  if (!isUltraAdmin(profile?.role)) return null;
  if (sessionStorage.getItem(ULTRA_PLATFORM_MODE_KEY) !== "true") return null;

  function exitPlatformMode() {
    sessionStorage.removeItem(ULTRA_PLATFORM_MODE_KEY);
    navigate("/ultra-admin");
  }

  return (
    <div className="flex items-center justify-between gap-4 bg-amber-50 border-b border-amber-200 px-6 py-2 text-sm text-amber-800">
      <div className="flex items-center gap-2">
        <ShieldAlert size={14} className="shrink-0" />
        <span>Modo plataforma ativo — você está visualizando como ultra admin.</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-7 rounded-full border-amber-300 bg-white text-amber-800 hover:bg-amber-100 hover:text-amber-900"
        onClick={exitPlatformMode}
      >
        <ArrowLeft size={13} />
        Voltar ao Portal Ultra
      </Button>
    </div>
  );
}
