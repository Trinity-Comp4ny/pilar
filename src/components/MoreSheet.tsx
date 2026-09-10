import { Eye, EyeOff, LogOut, MessageSquare, Settings, ShieldCheck, Zap, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AvatarStack } from "@/components/AvatarStack";
import { NotificationInbox } from "@/components/NotificationInbox";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useSettingsModal } from "@/contexts/SettingsModalContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useValoresOcultos } from "@/contexts/ValoresOcultosContext";
import { cn } from "@/lib/utils";

interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MoreSheetRow({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors hover:bg-muted",
        destructive ? "text-destructive" : "text-ink"
      )}
    >
      <Icon size={18} className="shrink-0" />
      <span className="flex-1 tracking-tight">{label}</span>
    </button>
  );
}

/**
 * "Menu" da bottom bar mobile (spec 097 / ADR 0040): o que hoje é o dropdown do
 * avatar na sidebar desktop (`AppSidebar.tsx`), num bottom sheet. Nunca uma tela
 * de módulo — cada pilar (Gestão/Projetos/Obra) já tem slot próprio na barra.
 *
 * `NotificationInbox` é self-contained (ícone + popover próprio), então fica no
 * cabeçalho do sheet em vez de virar uma linha de lista — passa `side="bottom"`
 * porque o default (`"right"`) é pensado pro sino da sidebar desktop, que tem
 * espaço sobrando à direita; aqui o sino já nasce colado na borda direita de
 * uma tela de largura total, então abrir "pra direita" cortava o popover.
 * `ImpersonationPicker` fica de fora por ora: depende de `DropdownMenuSub`
 * (contexto Radix do dropdown desktop) e é ferramenta interna de suporte
 * (só ultra_admin, uso raro) — não crítica pro fluxo mobile do dia a dia.
 */
export function MoreSheet({ open, onOpenChange }: MoreSheetProps) {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { openSettings } = useSettingsModal();
  const { isAdmin, isUltraAdmin } = usePermissions();
  const { ocultos: valoresOcultos, toggle: toggleValoresOcultos } = useValoresOcultos();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const userName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || user?.email || "Usuário"
    : (user?.user_metadata as { nome?: string } | null | undefined)?.nome || user?.email || "Usuário";
  const userEmail = user?.email ?? null;

  const closeAnd = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>

          {/* SheetContent sempre injeta um botão "X" em absolute right-4 top-4
              (src/components/ui/sheet.tsx) — sem este espaço reservado, o sino
              de notificações ficava embaixo dele. pr-11 abre lugar pro X;
              o cabeçalho por si só já cai abaixo dele por causa do próprio
              padding do botão de conta. */}
          <div className="flex items-center gap-2 pr-11">
            <button
              type="button"
              onClick={closeAnd(() => openSettings("conta"))}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-muted"
            >
              <AvatarStack pessoas={[{ nome: userName, avatarUrl: profile?.avatar_url }]} size="xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight text-ink">{userName}</p>
                {userEmail && <p className="truncate text-xs leading-tight text-muted-foreground">{userEmail}</p>}
              </div>
              <Settings size={16} className="shrink-0 text-muted-foreground" />
            </button>
            <NotificationInbox side="bottom" align="end" />
          </div>

          <div className="my-1 border-t" />

          <MoreSheetRow icon={MessageSquare} label="Feedback" onClick={closeAnd(() => setFeedbackOpen(true))} />
          <MoreSheetRow
            icon={valoresOcultos ? Eye : EyeOff}
            label={valoresOcultos ? "Mostrar valores financeiros" : "Ocultar valores financeiros"}
            onClick={toggleValoresOcultos}
          />
          {isAdmin && !isUltraAdmin && (
            <MoreSheetRow icon={ShieldCheck} label="Portal Admin" onClick={closeAnd(() => navigate("/admin"))} />
          )}
          {isUltraAdmin && (
            <MoreSheetRow icon={Zap} label="Portal Ultra" onClick={closeAnd(() => navigate("/ultra-admin"))} />
          )}

          <div className="my-1 border-t" />

          <MoreSheetRow
            icon={LogOut}
            label="Sair"
            destructive
            onClick={closeAnd(() => {
              void signOut().then(() => navigate("/login"));
            })}
          />
        </SheetContent>
      </Sheet>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
