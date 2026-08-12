import { Building2, CreditCard, Gauge, ShieldCheck, User } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useSettingsModal, type SettingsSection } from "@/contexts/SettingsModalContext";
import { ContaPanel } from "./panels/ContaPanel";
import { SegurancaPanel } from "./panels/SegurancaPanel";
import { EmpresaPanel } from "./panels/EmpresaPanel";
import { UsoPanel } from "./panels/UsoPanel";
import { PagamentoPanel } from "./panels/PagamentoPanel";

type SectionDef = {
  id: SettingsSection;
  label: string;
  icon: typeof User;
  Panel: React.ComponentType;
};

const SECTIONS: SectionDef[] = [
  { id: "conta", label: "Conta", icon: User, Panel: ContaPanel },
  { id: "seguranca", label: "Segurança", icon: ShieldCheck, Panel: SegurancaPanel },
  { id: "empresa", label: "Empresa", icon: Building2, Panel: EmpresaPanel },
  { id: "uso", label: "Uso", icon: Gauge, Panel: UsoPanel },
  { id: "pagamento", label: "Pagamento", icon: CreditCard, Panel: PagamentoPanel },
];

// Modal de configurações da conta: rail de seções à esquerda, painel ativo à direita.
// Montado uma vez perto da raiz autenticada; qualquer ponto abre a aba certa via
// useSettingsModal().openSettings(secao).
export function SettingsDialog() {
  const { isOpen, section, openSettings, closeSettings } = useSettingsModal();

  const active = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  const Panel = active.Panel;

  return (
    <Dialog open={isOpen} onOpenChange={(next) => !next && closeSettings()}>
      <DialogContent className="z-[60] flex max-w-[min(100vw-2rem,980px)] h-[min(88vh,700px)] gap-0 p-0 overflow-hidden">
        <div className="flex min-h-0 w-full flex-col sm:flex-row">
          {/* Rail de seções */}
          <nav
            aria-label="Seções de configurações"
            className="flex-shrink-0 border-b sm:border-b-0 sm:border-r border-black/5 bg-black/[0.015] sm:w-56 p-3"
          >
            <DialogTitle className="px-2 pt-1 pb-2 text-sm font-semibold text-ink">Configurações</DialogTitle>
            <div className="flex sm:flex-col gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SECTIONS.map(({ id, label, icon: Icon }) => {
                const isActive = id === active.id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => openSettings(id)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-full px-3 py-2 text-sm whitespace-nowrap transition-colors flex-shrink-0",
                      isActive ? "bg-brand text-black/80 font-medium" : "text-black/60 hover:bg-black/[0.04]"
                    )}
                  >
                    <Icon size={16} strokeWidth={1.7} className="flex-shrink-0" />
                    {label}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Painel ativo */}
          <div className="flex min-h-0 flex-1 flex-col">
            <header className="flex-shrink-0 border-b border-black/5 px-6 py-4 pr-12">
              <h2 className="text-lg font-semibold text-ink">{active.label}</h2>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{isOpen && <Panel />}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
