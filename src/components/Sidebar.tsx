import { LayoutDashboard, FolderKanban, CheckSquare, Users, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const Sidebar = ({ activeSection, onSectionChange }: SidebarProps) => {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "projects", label: "Projetos", icon: FolderKanban },
    { id: "tasks", label: "Tarefas", icon: CheckSquare },
    { id: "team", label: "Equipe", icon: Users },
    { id: "settings", label: "Configurações", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-2xl font-display font-bold text-gradient-primary">
          TaskFlow
        </h1>
        <p className="text-xs text-sidebar-foreground/60 mt-1">Sistema de Gestão</p>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                    "hover:bg-sidebar-accent group",
                    isActive && "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow"
                  )}
                >
                  <Icon className={cn(
                    "w-5 h-5 transition-transform duration-200",
                    isActive ? "scale-110" : "group-hover:scale-110"
                  )} />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-sidebar-border">
        <div className="bg-sidebar-accent rounded-lg p-4">
          <p className="text-xs text-sidebar-foreground/60 mb-2">Versão Beta</p>
          <p className="text-sm font-medium text-sidebar-foreground">v1.0.0</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
