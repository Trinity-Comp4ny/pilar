import { NavLink } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, FolderKanban, Clock, DollarSign, FileCheck, Loader2 } from "lucide-react";
import { usePortalData, type PortalData } from "./usePortalData";

const navItems = [
  { path: "", label: "Visão Geral", icon: FolderKanban, end: true },
  { path: "/timeline", label: "Etapas", icon: Clock, end: false },
  { path: "/financeiro", label: "Financeiro", icon: DollarSign, end: false },
  { path: "/entregas", label: "Entregas", icon: FileCheck, end: false },
];

export function PortalShell({ children }: { children: (data: PortalData, token: string) => React.ReactNode }) {
  const { data, error, loading, token } = usePortalData();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Building2 className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">Acesso negado</h2>
            <p className="text-sm text-muted-foreground">{error || "Link inválido ou expirado."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{data.empresa_nome}</p>
            <h1 className="text-lg font-semibold">
              {data.projeto_codigo} — {data.projeto_nome}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{data.cliente_nome}</p>
            <Badge variant="secondary" className="text-xs mt-1">
              {data.projeto_status}
            </Badge>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-4xl mx-auto flex gap-1 px-6">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={`/portal/${token}${item.path}`}
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

      <main className="max-w-4xl mx-auto px-6 py-6">{children(data, token)}</main>
    </div>
  );
}
