import { useNavigate, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Camera, ChevronRight, ClipboardList, CloudOff, HardHat, Loader2, LogOut, Plus, RefreshCw, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { climaLabel } from "@/lib/obras";
import { usePageTitle } from "@/hooks/usePageTitle";
import { campoLogout, getCampoToken, type CampoAccount } from "./useCampoAuth";
import { useCampoSync } from "./useCampoSync";

interface RdoDia {
  id: string;
  data: string;
  clima: string | null;
  efetivo: number | null;
  atividades: string | null;
  fotos?: number;
}

export default function CampoHome() {
  usePageTitle("Pilar Campo");
  const navigate = useNavigate();
  const { account } = useOutletContext<{ account: CampoAccount }>();
  const { pendentes, sincronizando, sincronizar } = useCampoSync();

  const { data: rdos = [], isLoading } = useQuery({
    queryKey: ["campo_rdos", account.account_id],
    queryFn: async (): Promise<RdoDia[]> => {
      const token = getCampoToken();
      if (!token) return [];
      const { data, error } = await supabase.rpc("campo_listar_rdos", { p_token: token, p_limite: 30 });
      if (error) throw error;
      const r = data as unknown as { ok: boolean; rdos?: RdoDia[] };
      return r?.ok ? (r.rdos ?? []) : [];
    },
    staleTime: 1000 * 30,
  });

  const sair = () => {
    campoLogout();
    navigate("/campo/login", { replace: true });
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="flex items-center justify-between border-b border-black/5 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-ink">
            <HardHat className="h-4 w-4" />
          </div>
          <span className="font-semibold text-ink">Pilar Campo</span>
        </div>
        <Button variant="ghost" size="sm" onClick={sair} className="text-muted-foreground">
          <LogOut className="mr-1.5 h-4 w-4" />
          Sair
        </Button>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-5 py-8">
        <div>
          <p className="text-sm text-muted-foreground">Olá,</p>
          <h1 className="text-2xl font-semibold text-ink">{account.nome}</h1>
        </div>

        {pendentes > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-warning-soft bg-warning-soft/40 px-4 py-3">
            <CloudOff className="h-5 w-5 shrink-0 text-warning-strong" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                {pendentes} {pendentes === 1 ? "dia aguardando" : "dias aguardando"} envio
              </p>
              <p className="text-xs text-muted-foreground">Salvo no aparelho. Envia sozinho com internet.</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={sincronizar}
              disabled={sincronizando}
              aria-label="Tentar enviar agora"
            >
              {sincronizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        )}

        <Button variant="brand" className="h-14 w-full justify-start text-base" onClick={() => navigate("/campo/dia")}>
          <Plus className="mr-2 h-5 w-5" />
          Registrar o dia
        </Button>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Últimos dias</p>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : rdos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center">
              <ClipboardList className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum dia registrado ainda.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {rdos.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{formatDate(r.data)}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {r.clima && <span>{climaLabel(r.clima)}</span>}
                      {r.efetivo != null && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {r.efetivo}
                        </span>
                      )}
                      {!!r.fotos && r.fotos > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          {r.fotos}
                        </span>
                      )}
                      {r.atividades && <span className="truncate">{r.atividades}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Seu acesso é só desta obra. O que você registrar aqui aparece para o escritório.
        </p>
      </main>
    </div>
  );
}
