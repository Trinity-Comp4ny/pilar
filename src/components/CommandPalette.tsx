import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Building2,
  Calendar,
  Clock,
  FileText,
  Home,
  LogOut,
  MapPin,
  Plus,
  Settings,
  Star,
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
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useBuscaGlobal, type BuscaResultado, type BuscaTipo } from "@/hooks/useBuscaGlobal";
import { useRecentItems, type RecentItem } from "@/hooks/useRecentItems";

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

const TIPO_LABEL: Record<BuscaTipo, string> = {
  cliente: "cliente",
  projeto: "projeto",
  fornecedor: "fornecedor",
  lead: "lead",
  proposta: "proposta",
  pessoa: "pessoa",
};

const TIPO_ICON: Record<string, typeof Home> = {
  cliente: Building2,
  projeto: Calendar,
  fornecedor: Building2,
  lead: UserPlus,
  proposta: FileText,
  pessoa: Users,
  pagina: FileText,
};

const combina = (query: string, ...campos: (string | undefined)[]) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return campos.filter(Boolean).join(" ").toLowerCase().includes(q);
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { openSettings } = useSettingsModal();

  const [query, setQuery] = useState("");
  const termo = useDebouncedValue(query, 250);
  const { grupos, isFetching, enabled } = useBuscaGlobal(termo);
  const { record, recentes, favoritos, toggleFavorito, isFavorito } = useRecentItems();

  const buscando = enabled;
  const semResultados = enabled && !isFetching && grupos.length === 0;
  const favs = favoritos();
  const recs = recentes();

  const navFiltrado = NAV_COMMANDS.filter((cmd) => combina(query, cmd.label, cmd.keywords));
  const createFiltrado = CREATE_COMMANDS.filter((cmd) => combina(query, cmd.label, cmd.keywords));

  const close = () => {
    onOpenChange(false);
    setQuery("");
  };

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

  const abrirResultado = (r: BuscaResultado) => {
    record({ tipo: r.tipo, id: r.id, label: r.label, rota: r.rota });
    close();
    navigate(r.rota);
  };

  const abrirItem = (item: RecentItem) => {
    record({ tipo: item.tipo, id: item.id, label: item.label, rota: item.rota });
    close();
    navigate(item.rota);
  };

  const StarButton = ({ item }: { item: Omit<RecentItem, "ts"> }) => {
    const ativo = isFavorito(item);
    return (
      <button
        type="button"
        aria-label={ativo ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        className="ml-auto rounded p-1 text-muted-foreground hover:text-foreground"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorito(item);
        }}
      >
        <Star className={ativo ? "h-4 w-4 fill-current text-brand" : "h-4 w-4"} />
      </button>
    );
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Digite um comando ou busque..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {!buscando && favs.length === 0 && recs.length === 0 && navFiltrado.length === 0 && createFiltrado.length === 0 ? (
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        ) : null}

        {buscando ? (
          <CommandGroup heading="Resultados">
            {isFetching ? (
              <CommandItem value="__buscando" disabled className="text-muted-foreground">
                Buscando...
              </CommandItem>
            ) : null}
            {semResultados ? (
              <CommandItem value="__sem-resultados" disabled className="text-muted-foreground">
                Nenhum registro encontrado
              </CommandItem>
            ) : null}
            {grupos.flatMap((grupo) =>
              grupo.itens.map((r) => {
                const Icon = r.icon;
                return (
                  <CommandItem
                    key={`${r.tipo}-${r.id}`}
                    value={`resultado-${r.tipo}-${r.id}`}
                    onSelect={() => abrirResultado(r)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span className="truncate">{r.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{TIPO_LABEL[r.tipo]}</span>
                    <StarButton item={{ tipo: r.tipo, id: r.id, label: r.label, rota: r.rota }} />
                  </CommandItem>
                );
              })
            )}
          </CommandGroup>
        ) : null}

        {!buscando && favs.length > 0 ? (
          <CommandGroup heading="Favoritos">
            {favs.map((item) => {
              const Icon = TIPO_ICON[item.tipo] ?? FileText;
              return (
                <CommandItem
                  key={`fav-${item.tipo}-${item.id}`}
                  value={`fav-${item.tipo}-${item.id}`}
                  onSelect={() => abrirItem(item)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                  <StarButton item={{ tipo: item.tipo, id: item.id, label: item.label, rota: item.rota }} />
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}

        {!buscando && recs.length > 0 ? (
          <CommandGroup heading="Recentes">
            {recs.map((item) => {
              const Icon = TIPO_ICON[item.tipo] ?? Clock;
              return (
                <CommandItem
                  key={`rec-${item.tipo}-${item.id}`}
                  value={`rec-${item.tipo}-${item.id}`}
                  onSelect={() => abrirItem(item)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                  <StarButton item={{ tipo: item.tipo, id: item.id, label: item.label, rota: item.rota }} />
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}

        {navFiltrado.length > 0 ? (
          <>
            {buscando || favs.length > 0 || recs.length > 0 ? <CommandSeparator /> : null}
            <CommandGroup heading="Navegação">
              {navFiltrado.map((cmd) => {
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
          </>
        ) : null}

        {createFiltrado.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Criar">
              {createFiltrado.map((cmd) => {
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
          </>
        ) : null}

        {!buscando ? (
          <>
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
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
