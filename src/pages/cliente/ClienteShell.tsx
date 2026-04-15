import { useNavigate, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, ArrowLeft, FolderKanban, Clock, DollarSign, FileCheck } from "lucide-react";
import { clearPortalToken, type ClienteAccount } from "./useClienteAuth";

interface ClienteShellProps {
  account: ClienteAccount;
  children: React.ReactNode;
  projetoId?: string;
  projetoNome?: string;
  projetoCodigo?: string | null;
}

const projetoNavItems = [
  { path: "", label: "Visão Geral", icon: FolderKanban, end: true },
  { path: "/timeline", label: "Etapas", icon: Clock, end: false },
  { path: "/financeiro", label: "Financeiro", icon: DollarSign, end: false },
  { path: "/entregas", label: "Entregas", icon: FileCheck, end: false },
];

export function ClienteShell({ account, children, projetoId, projetoNome, projetoCodigo }: ClienteShellProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearPortalToken();
    navigate("/cliente/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/pilar-logo.svg" alt="Pilar" className="h-8 w-8" />
            <div>
              <span className="text-lg font-semibold tracking-tight text-slate-900">Pilar</span>
              <span className="text-xs text-muted-foreground ml-2">Portal do Cliente</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">{account.nome}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Sub-header do projeto (quando dentro de um projeto) */}
      {projetoId && (
        <>
          <div className="bg-white border-b px-6 py-3">
            <div className="max-w-5xl mx-auto flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/cliente/dashboard")}
                className="text-muted-foreground hover:text-foreground -ml-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Projetos
              </Button>
              <div className="h-4 w-px bg-border" />
              <div>
                {projetoCodigo && <span className="text-xs text-muted-foreground mr-2">{projetoCodigo}</span>}
                <span className="text-sm font-medium">{projetoNome}</span>
              </div>
            </div>
          </div>

          {/* Nav do projeto */}
          <nav className="bg-white border-b">
            <div className="max-w-5xl mx-auto flex gap-1 px-6">
              {projetoNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={`/cliente/projeto/${projetoId}${item.path}`}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors ${
                      isActive
                        ? "border-accent-orange text-accent-orange font-medium"
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
        </>
      )}

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-6">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-white mt-auto">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <p className="text-xs text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} Pilar. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
