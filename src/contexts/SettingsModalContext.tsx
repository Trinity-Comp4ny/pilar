import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// Modal de configurações da conta (substitui as antigas rotas /profile, /company e
// /billing — spec do modal único). O estado vive aqui, não na URL: qualquer ponto da
// área autenticada abre a aba certa com openSettings(secao), inclusive as telas de
// bloqueio (trial expirado, assinatura suspensa) que rodam fora do Layout.
export type SettingsSection = "conta" | "seguranca" | "empresa" | "uso" | "pagamento" | "privacidade";

interface SettingsModalValue {
  isOpen: boolean;
  section: SettingsSection;
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
}

const SettingsModalContext = createContext<SettingsModalValue | null>(null);

export function useSettingsModal(): SettingsModalValue {
  const ctx = useContext(SettingsModalContext);
  if (!ctx) {
    throw new Error("useSettingsModal must be used within a SettingsModalProvider");
  }
  return ctx;
}

export function SettingsModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>("conta");

  const openSettings = useCallback((next: SettingsSection = "conta") => {
    setSection(next);
    setIsOpen(true);
  }, []);

  const closeSettings = useCallback(() => setIsOpen(false), []);

  return (
    <SettingsModalContext.Provider value={{ isOpen, section, openSettings, closeSettings }}>
      {children}
    </SettingsModalContext.Provider>
  );
}
