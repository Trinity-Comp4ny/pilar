import { useNavigate, NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  ArrowLeft,
  FolderKanban,
  DollarSign,
  FileCheck,
  LayoutDashboard,
  ChevronDown,
  KeyRound,
  Building2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { portalLogout, type ClienteAccount } from "@/hooks/useClienteAuth";
import { supabase } from "@/integrations/supabase/client";
import { TrocarSenhaForm } from "./TrocarSenhaForm";

interface ClienteShellProps {
  account: ClienteAccount;
  children: React.ReactNode;
  projetoId?: string;
  projetoNome?: string;
  projetoCodigo?: string | null;
  /** Sub-header de obra (sem abas): mostra "voltar" + nome da obra. */
  obraNome?: string;
}

const projetoNavItems = [
  { path: "", label: "Visão Geral", icon: FolderKanban, end: true },
  { path: "/financeiro", label: "Financeiro", icon: DollarSign, end: false },
  { path: "/entregas", label: "Entregas", icon: FileCheck, end: false },
];

export function ClienteShell({
  account,
  children,
  projetoId,
  projetoNome,
  projetoCodigo,
  obraNome,
}: ClienteShellProps) {
  const navigate = useNavigate();
  const [isAdminSession, setIsAdminSession] = useState(false);
  const [senhaDialogOpen, setSenhaDialogOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsAdminSession(!!data.session);
    });
  }, []);

  const handleLogout = async () => {
    await portalLogout();
    navigate("/cliente/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/pilar-logo.svg" alt="Pilar" className="h-8 w-8" />
            <div>
              <span className="text-lg font-semibold tracking-tight text-slate-900">
                Pilar<sup className="text-[9px] font-normal text-slate-400 ml-0.5 relative -top-2">®</sup>
              </span>
              <span className="text-xs text-muted-foreground ml-2">Portal do Cliente</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isAdminSession && (
              <Button variant="outline" size="sm" onClick={() => navigate("/gestao/clientes")} className="text-xs">
                <LayoutDashboard className="h-3.5 w-3.5 mr-1" />
                Voltar ao painel
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground gap-1.5 h-11 sm:h-9"
                >
                  <span className="truncate max-w-[8rem] sm:max-w-[14rem]">
                    <span className="sm:hidden">{account.nome.split(" ")[0]}</span>
                    <span className="hidden sm:inline">{account.nome}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setSenhaDialogOpen(true)}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Trocar senha
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Sub-header do projeto (quando dentro de um projeto) */}
      {projetoId && (
        <>
          <div className="bg-white border-b px-6 py-3">
            <div className="max-w-7xl mx-auto flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/cliente/dashboard")}
                className="text-muted-foreground hover:text-foreground -ml-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Projetos
              </Button>
              <div className="h-4 w-px bg-border shrink-0" />
              <div className="min-w-0 flex items-baseline gap-2">
                {projetoCodigo && <span className="text-xs text-muted-foreground shrink-0">{projetoCodigo}</span>}
                <span className="text-sm font-medium truncate">{projetoNome}</span>
              </div>
            </div>
          </div>

          {/* Nav do projeto */}
          <nav className="bg-white border-b">
            <div className="max-w-7xl mx-auto flex gap-1 px-6 overflow-x-auto">
              {projetoNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={`/cliente/projeto/${projetoId}${item.path}`}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors ${
                      isActive
                        ? "border-brand text-slate-900 font-semibold"
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

      {/* Sub-header da obra (página dedicada, sem abas) */}
      {obraNome && !projetoId && (
        <div className="bg-white border-b px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/cliente/dashboard")}
              className="text-muted-foreground hover:text-foreground -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Início
            </Button>
            <div className="h-4 w-px bg-border shrink-0" />
            <div className="min-w-0 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{obraNome}</span>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <p className="text-xs text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} Pilar. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      <Dialog open={senhaDialogOpen} onOpenChange={setSenhaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trocar senha</DialogTitle>
            <DialogDescription>Defina uma nova senha de acesso ao portal.</DialogDescription>
          </DialogHeader>
          <TrocarSenhaForm onSuccess={() => setSenhaDialogOpen(false)} onCancel={() => setSenhaDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
