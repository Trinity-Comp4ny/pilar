import { Link, useSearchParams } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { ROLE_LABEL, reasonFor, type Feature } from "@/lib/permissions";

const KNOWN_FEATURES: Feature[] = [
  "dashboard",
  "relatorios",
  "leads",
  "propostas",
  "clientes",
  "projetos",
  "planejamento",
  "timesheet",
  "mapa",
  "financeiro",
  "pessoas",
  "metas",
  "portal_cliente",
  "capacidade",
  "templates",
  "ai_hub",
  "admin_portal",
  "billing",
];

const FEATURE_LABEL: Record<Feature, string> = {
  dashboard: "Dashboard",
  relatorios: "Relatórios",
  leads: "Leads",
  propostas: "Propostas",
  clientes: "Clientes",
  projetos: "Projetos",
  planejamento: "Planejamento",
  timesheet: "Timesheet",
  mapa: "Mapa",
  financeiro: "Financeiro",
  pessoas: "Equipe",
  metas: "Metas",
  portal_cliente: "Portal do Cliente",
  capacidade: "Capacidade",
  templates: "Templates",
  ai_hub: "IA",
  admin_portal: "Admin Portal",
  billing: "Assinatura",
};

function isKnownFeature(value: string | null): value is Feature {
  return !!value && (KNOWN_FEATURES as string[]).includes(value);
}

export default function SemAcesso() {
  const [params] = useSearchParams();
  const { profile } = useAuth();
  const { role } = usePermissions();

  const recursoParam = params.get("recurso");
  const recurso = isKnownFeature(recursoParam) ? recursoParam : null;
  const recursoLabel = recurso ? FEATURE_LABEL[recurso] : "esta página";
  const motivo = recurso ? reasonFor(recurso, "view") : "Seu perfil não tem acesso";
  const roleLabel = role ? ROLE_LABEL[role] : "sem perfil";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-full bg-accent-orange/10 flex items-center justify-center">
          <ShieldOff className="w-7 h-7 text-accent-orange" strokeWidth={1.5} />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-medium tracking-tight">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para acessar <span className="font-medium text-foreground">{recursoLabel}</span>.
          </p>
        </div>

        <div className="rounded-lg border border-black/5 bg-muted/30 p-4 text-left text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Seu perfil</span>
            <span className="font-medium">{roleLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Necessário</span>
            <span className="font-medium">{motivo.replace("Requer permissão: ", "")}</span>
          </div>
          {profile?.empresas?.nome && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Empresa</span>
              <span className="font-medium">{profile.empresas.nome}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button asChild>
            <Link to="/dashboard">Voltar ao dashboard</Link>
          </Button>
          <p className="text-xs text-muted-foreground">Precisa desse acesso? Fale com um admin da sua empresa.</p>
        </div>
      </div>
    </div>
  );
}
