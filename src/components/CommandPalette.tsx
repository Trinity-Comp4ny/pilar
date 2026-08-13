import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Building2,
  Calendar,
  FileText,
  Home,
  LogOut,
  MapPin,
  Plus,
  Settings,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useAuth } from "@/contexts/AuthContext";
import { useSettingsModal } from "@/contexts/SettingsModalContext";
import { type PaletteCreateEvent } from "@/hooks/useCommandPalette";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type NavCmd = { label: string; path: string; icon: typeof Home; keywords?: string };
type CreateCmd = {
  label: string;
  event: PaletteCreateEvent;
  path: string;
  icon: typeof Plus;
  keywords?: string;
};

const NAV_COMMANDS: NavCmd[] = [
  { label: "Início", path: "/inicio", icon: Home, keywords: "dashboard home painel visao geral" },
  { label: "Projetos", path: "/projetos", icon: Calendar, keywords: "obras escopos" },
  { label: "Financeiro", path: "/gestao/financeiro", icon: Wallet, keywords: "contas faturas despesas receitas" },
  { label: "Leads", path: "/gestao/leads", icon: UserPlus, keywords: "comercial prospects" },
  { label: "Clientes", path: "/gestao/clientes", icon: Building2, keywords: "contatos empresas" },
  { label: "Equipe", path: "/gestao/equipe", icon: Users, keywords: "pessoas time membros" },
  { label: "Propostas", path: "/gestao/propostas", icon: FileText, keywords: "documentos contratos" },
  { label: "Mapa", path: "/projetos/mapa", icon: MapPin, keywords: "obras geolocalizacao projetos" },
  { label: "Relatórios", path: "/gestao/financeiro?tab=relatorios", icon: BarChart, keywords: "metricas analise" },
];

const CREATE_COMMANDS: CreateCmd[] = [
  {
    label: "Nova receita",
    event: "palette:create-receita",
    path: "/gestao/financeiro?tab=receitas&new=1",
    icon: TrendingUp,
    keywords: "criar adicionar entrada lancamento",
  },
  {
    label: "Nova despesa",
    event: "palette:create-despesa",
    path: "/gestao/financeiro?tab=despesas&new=1",
    icon: TrendingDown,
    keywords: "criar adicionar pagamento lancamento",
  },
  {
    label: "Novo projeto",
    event: "palette:create-projeto",
    path: "/projetos?new=1",
    icon: Calendar,
    keywords: "criar adicionar obra",
  },
  {
    label: "Novo lead",
    event: "palette:create-lead",
    path: "/gestao/leads?new=1",
    icon: UserPlus,
    keywords: "criar adicionar prospect",
  },
  {
    label: "Novo cliente",
    event: "palette:create-cliente",
    path: "/gestao/clientes?new=1",
    icon: Building2,
    keywords: "criar adicionar contato",
  },
  {
    label: "Novo membro de equipe",
    event: "palette:create-pessoa",
    path: "/gestao/equipe?new=1",
    icon: Users,
    keywords: "criar adicionar pessoa colaborador",
  },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { openSettings } = useSettingsModal();

  const close = () => onOpenChange(false);

  const runNavigate = (path: string) => {
    close();
    navigate(path);
  };

  const runSettings = () => {
    close();
    openSettings("conta");
  };

  const runCreate = (cmd: CreateCmd) => {
    close();
    navigate(cmd.path);
    // Em um próximo passo, as páginas podem ouvir esse evento para abrir o dialog automaticamente.
    window.dispatchEvent(new CustomEvent(cmd.event));
  };

  const runLogout = async () => {
    close();
    await signOut();
    navigate("/login");
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Digite um comando ou busque..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        <CommandGroup heading="Navegação">
          {NAV_COMMANDS.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <CommandItem
                key={cmd.path}
                value={`nav ${cmd.label} ${cmd.keywords ?? ""}`}
                onSelect={() => runNavigate(cmd.path)}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>Ir para {cmd.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Criar">
          {CREATE_COMMANDS.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <CommandItem
                key={cmd.event}
                value={`criar ${cmd.label} ${cmd.keywords ?? ""}`}
                onSelect={() => runCreate(cmd)}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{cmd.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ações">
          <CommandItem value="acoes configuracoes perfil ajustes preferencias" onSelect={runSettings}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Configurações</span>
          </CommandItem>
          <CommandItem value="acoes sair logout signout" onSelect={runLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sair</span>
            <CommandShortcut>Logout</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
