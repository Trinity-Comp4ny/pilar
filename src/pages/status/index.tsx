import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDateTime } from "@/lib/format";

type ComponentStatusRow = {
  id: string;
  slug: string;
  nome_exibicao: string;
  status_efetivo: string;
};

type IncidentRow = {
  id: string;
  titulo: string;
  severidade: string;
  status: string;
  created_at: string;
  status_incident_components: { status_components: { nome_exibicao: string } | null }[];
  status_incident_updates: { id: string; mensagem: string; created_at: string }[];
};

// Rota pública, sem sessão: nunca usar PilarPage/PageLayout aqui (dependem de
// SidebarProvider, que só existe dentro do shell autenticado).
export default function StatusPage() {
  usePageTitle("Status");

  const componentsQuery = useQuery({
    queryKey: ["status-current"],
    queryFn: async () => {
      const { data, error } = await supabase.from("status_current").select("id, slug, nome_exibicao, status_efetivo");
      if (error) throw error;
      return (data ?? []) as ComponentStatusRow[];
    },
    refetchInterval: 30_000,
  });

  const incidentsQuery = useQuery({
    queryKey: ["status-incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("status_incidents")
        .select(
          "id, titulo, severidade, status, created_at, status_incident_components(status_components(nome_exibicao)), status_incident_updates(id, mensagem, created_at)"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as IncidentRow[];
    },
    refetchInterval: 30_000,
  });

  const hasError = componentsQuery.isError || incidentsQuery.isError;
  const isLoading = componentsQuery.isLoading || incidentsQuery.isLoading;
  const incidents = incidentsQuery.data ?? [];

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-8">
        <Logo />

        <div>
          <h1 className="text-xl font-semibold text-ink">Status da Pilar</h1>
          <p className="mt-1 text-sm text-black/60">Disponibilidade dos componentes da plataforma.</p>
        </div>

        {hasError ? (
          <p className="rounded-lg bg-danger-soft p-4 text-sm text-danger-strong">
            Não conseguimos carregar o status agora. Tente novamente em instantes.
          </p>
        ) : isLoading ? (
          <p className="text-sm text-black/50">Carregando...</p>
        ) : (
          <>
            <Card className="border border-black/5">
              <CardContent className="divide-y divide-black/5 p-0">
                {(componentsQuery.data ?? []).map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium">{c.nome_exibicao}</span>
                    <StatusBadge domain="status_componente" status={c.status_efetivo} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div>
              <h2 className="mb-3 text-sm font-medium text-black/70">Incidentes</h2>
              {incidents.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-positive/5 p-4 text-sm text-positive-strong">
                  <CheckCircle2 size={16} />
                  Nenhum incidente registrado.
                </div>
              ) : (
                <div className="space-y-3">
                  {incidents.map((incident) => (
                    <Card key={incident.id} className="border border-black/5">
                      <CardContent className="space-y-2 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{incident.titulo}</p>
                          <StatusBadge domain="status_incidente" status={incident.status} />
                        </div>
                        <p className="text-xs text-black/50">
                          {incident.status_incident_components
                            .map((c) => c.status_components?.nome_exibicao)
                            .filter(Boolean)
                            .join(", ")}{" "}
                          · {formatDateTime(incident.created_at)}
                        </p>
                        {incident.status_incident_updates.length > 0 && (
                          <ul className="space-y-1 border-l-2 border-black/10 pl-3">
                            {incident.status_incident_updates
                              .slice()
                              .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
                              .map((u) => (
                                <li key={u.id} className="text-xs text-black/70">
                                  <span className="text-black/40">{formatDateTime(u.created_at)}</span> · {u.mensagem}
                                </li>
                              ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
