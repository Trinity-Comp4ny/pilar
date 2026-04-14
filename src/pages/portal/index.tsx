import { useState, useEffect } from "react";
import { useParams, NavLink } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, FolderKanban, Clock, FileCheck, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PortalData {
  projeto_id: string;
  cliente_id: string;
  empresa_id: string;
  projeto_nome: string;
  projeto_status: string;
  projeto_codigo: string;
  cliente_nome: string;
  empresa_nome: string;
}

interface PortalDisciplina {
  disciplina?: string;
  status?: string;
}

type PortalEntregaRow = Record<string, unknown>;

function errorMessageFromUnknown(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Token inválido";
}

export default function PortalLayout() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const verify = async () => {
      try {
        const { data: result, error: err } = await supabase.rpc("verify_portal_token", { p_token: token });
        if (err) throw err;
        setData(result as PortalData);
      } catch (e: unknown) {
        setError(errorMessageFromUnknown(e));
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Building2 className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">Acesso negado</h2>
            <p className="text-sm text-muted-foreground">{error || "Link inválido ou expirado. Solicite um novo link ao escritório."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const navItems = [
    { to: `/portal/${token}`, label: "Visão Geral", icon: FolderKanban, end: true },
    { to: `/portal/${token}/timeline`, label: "Etapas", icon: Clock, end: false },
    { to: `/portal/${token}/financeiro`, label: "Financeiro", icon: DollarSign, end: false },
    { to: `/portal/${token}/entregas`, label: "Entregas", icon: FileCheck, end: false },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{data.empresa_nome}</p>
            <h1 className="text-lg font-semibold">{data.projeto_codigo} — {data.projeto_nome}</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{data.cliente_nome}</p>
            <Badge variant="secondary" className="text-xs mt-1">{data.projeto_status}</Badge>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="bg-white border-b">
        <div className="max-w-4xl mx-auto flex gap-1 px-6">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-6">
        <PortalDashboard data={data} token={token!} />
      </main>
    </div>
  );
}

function PortalDashboard({ data, token: _token }: { data: PortalData; token: string }) {
  const [disciplinas, setDisciplinas] = useState<PortalDisciplina[]>([]);
  const [entregas, setEntregas] = useState<PortalEntregaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Busca disciplinas do projeto
      const { data: proj } = await supabase
        .from("projetos")
        .select("disciplinas, data_inicio, data_previsao, valor_contrato")
        .eq("id", data.projeto_id)
        .single();

      if (proj) {
        const raw = Array.isArray(proj.disciplinas) ? proj.disciplinas : [];
        setDisciplinas(raw as PortalDisciplina[]);
      }

      // Busca entregas pendentes
      const { data: entregasData } = await supabase
        .from("portal_entregas")
        .select("*")
        .eq("projeto_id", data.projeto_id)
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(5);

      if (entregasData) setEntregas(entregasData as PortalEntregaRow[]);
      setLoading(false);
    };
    fetchData();
  }, [data.projeto_id]);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const total = disciplinas.length;
  const concluidas = disciplinas.filter((d) => d.status === "Concluído").length;
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Progresso */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold mb-3">Progresso do Projeto</h3>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div className="bg-primary h-3 rounded-full transition-all" style={{ width: `${progresso}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{progresso}% concluído — {concluidas} de {total} disciplinas</p>
        </CardContent>
      </Card>

      {/* Disciplinas */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold mb-3">Etapas</h3>
          <div className="space-y-2">
            {disciplinas.map((d, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm">{d.disciplina}</span>
                <Badge variant={d.status === "Concluído" ? "default" : "secondary"} className="text-xs">
                  {d.status || "Não iniciado"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Entregas pendentes */}
      {entregas.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold mb-3">Entregas Pendentes</h3>
            <div className="space-y-2">
              {entregas.map((e) => (
                <div key={String(e.id ?? "")} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{String(e.titulo ?? "")}</p>
                    {e.descricao != null && String(e.descricao) !== "" && (
                      <p className="text-xs text-muted-foreground">{String(e.descricao)}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">{String(e.tipo ?? "")}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
