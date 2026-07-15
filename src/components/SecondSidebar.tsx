import { useState } from "react";
import { PanelLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SecondSidebarTab = {
  id: string;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
  badge?: string | number;
};

type Props = {
  tabs: SecondSidebarTab[];
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
};

const STORAGE_KEY = "pilar:second-sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeCollapsed(v: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch {
    // localStorage indisponível (modo privado ou quota excedida)
  }
}

export function SecondSidebar({ tabs, value, onValueChange, className }: Props) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = () =>
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(next);
      return next;
    });

  return (
    <>
      {/* Mobile: horizontal pill bar */}
      <nav
        aria-label="Seções"
        className="md:hidden flex w-full overflow-x-auto gap-1.5 px-3 py-2 border-b border-black/5 bg-white flex-shrink-0"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = value === tab.id;
          if (tab.disabled) {
            return (
              <span
                key={tab.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap opacity-40 flex-shrink-0"
              >
                {Icon && <Icon size={14} strokeWidth={1.5} />}
                <span>{tab.label}</span>
              </span>
            );
          }
          return (
            <button
              key={tab.id}
              onClick={() => onValueChange(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors flex-shrink-0",
                isActive ? "bg-brand text-black/80 font-medium" : "text-black/60 hover:bg-brand/20"
              )}
            >
              {Icon && <Icon size={14} strokeWidth={1.5} />}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="text-[9px] bg-black/10 px-1 py-0.5 rounded-full leading-none">{tab.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Desktop: vertical sidebar */}
      <div
        className={cn(
          "hidden md:flex h-full border-r border-black/5 bg-white flex-col flex-shrink-0 transition-[width] duration-300 ease-in-out",
          collapsed ? "w-16" : "w-60",
          className
        )}
      >
        <div
          className={cn(
            "flex h-16 border-b border-black/5 flex-shrink-0 items-center",
            collapsed ? "justify-center" : "justify-between px-4"
          )}
        >
          {!collapsed && <span className="text-xs font-medium tracking-[0.08em] uppercase text-black/40">Menu</span>}
          <button
            onClick={toggle}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className="h-8 w-8 rounded-full flex items-center justify-center text-black/70 hover:text-brand hover:bg-brand/5 transition-colors"
          >
            <PanelLeft size={18} strokeWidth={1.5} />
          </button>
        </div>

        <nav aria-label="Seções" className="flex-1 p-3 space-y-1 overflow-y-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = value === tab.id;

            if (tab.disabled) {
              return (
                <div
                  key={tab.id}
                  title={collapsed ? `${tab.label} — Em breve` : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-full text-sm opacity-40 cursor-not-allowed",
                    collapsed && "justify-center"
                  )}
                >
                  {Icon && <Icon size={18} strokeWidth={1.5} className="w-[18px] h-[18px] flex-shrink-0" />}
                  {!collapsed && (
                    <>
                      <span className="tracking-tight truncate flex-1">{tab.label}</span>
                      <span className="text-[9px] font-medium uppercase tracking-wide bg-black/10 text-black/50 px-1.5 py-0.5 rounded-full shrink-0">
                        Em breve
                      </span>
                    </>
                  )}
                </div>
              );
            }

            return (
              <button
                key={tab.id}
                onClick={() => onValueChange(tab.id)}
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? tab.label : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-full text-sm transition-all duration-200 text-left",
                  collapsed && "justify-center",
                  isActive ? "bg-brand text-black/80 font-medium" : "text-black/70 hover:bg-brand/30"
                )}
              >
                {Icon && <Icon size={18} strokeWidth={1.5} className="w-[18px] h-[18px] flex-shrink-0" />}
                {!collapsed && (
                  <>
                    <span className="tracking-tight flex-1">{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span className="ml-auto text-[10px] bg-black/10 px-1.5 py-0.5 rounded-full leading-none">
                        {tab.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
