import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bell, CheckCheck, Archive, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  useNotificacoes,
  useNotificacoesNaoLidas,
  useNotificacoesRealtime,
  useMarcarLida,
  useMarcarTodasLidas,
  useArquivar,
  useArquivarTodas,
  type Notificacao,
  type AbaNotificacao,
} from "@/hooks/useNotificacoes";
import { iconeCategoria, toneSeveridade, resolveLink, formatTimeAgo } from "@/lib/notificacoes";
import { setFaviconBadge } from "@/lib/favicon";
import { PreferenciasDialog } from "@/pages/notificacoes/PreferenciasDialog";

/**
 * Sino de notificações no rodapé da sidebar (spec 029). Popover com duas abas:
 * Inbox (não arquivadas) e Arquivadas. Leitura e arquivamento por usuário (RLS).
 * Atualiza em tempo real. Preferências por categoria abrem pela engrenagem.
 */
export function NotificationInbox() {
  const [open, setOpen] = useState(false);
  const [aba, setAba] = useState<AbaNotificacao>("inbox");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // "Gerenciar notificações por e-mail" no rodapé do e-mail (SPEC 096) chega com
  // ?abrir=preferencias-notificacao: abre direto as preferências.
  const [prefsOpen, setPrefsOpen] = useState(() => searchParams.get("abrir") === "preferencias-notificacao");

  // Limpa o parâmetro para o refresh não reabrir o diálogo.
  useEffect(() => {
    if (!searchParams.has("abrir")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("abrir");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const { data: itens = [] } = useNotificacoes(aba, 50);
  const { data: naoLidas = 0 } = useNotificacoesNaoLidas();
  const marcarLida = useMarcarLida();
  const marcarTodas = useMarcarTodasLidas();
  const arquivar = useArquivar();
  const arquivarTodas = useArquivarTodas();

  useNotificacoesRealtime();

  // Espelha o não-lido no favicon (bolinha vermelha estilo GitHub).
  useEffect(() => {
    void setFaviconBadge(naoLidas > 0);
  }, [naoLidas]);

  const abrir = (n: Notificacao) => {
    if (!n.lido_em) marcarLida.mutate(n.id);
    const link = resolveLink(n);
    if (link) {
      setOpen(false);
      navigate(link);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 shrink-0 rounded-full hover:bg-brand/30"
            aria-label={naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : "Notificações"}
          >
            <Bell className="h-[18px] w-[18px] text-black/70" strokeWidth={1.5} />
            {naoLidas > 0 && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-chart-danger ring-2 ring-white" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="end"
          sideOffset={12}
          collisionPadding={12}
          className="w-[380px] max-w-[calc(100vw-2rem)] p-0"
        >
          {/* Abas + preferências */}
          <div className="flex items-center justify-between gap-2 border-b p-2">
            <div className="flex gap-1 rounded-lg bg-muted/60 p-0.5">
              <AbaBtn ativo={aba === "inbox"} onClick={() => setAba("inbox")}>
                Inbox{naoLidas > 0 ? ` ${naoLidas}` : ""}
              </AbaBtn>
              <AbaBtn ativo={aba === "archive"} onClick={() => setAba("archive")}>
                Arquivadas
              </AbaBtn>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              aria-label="Preferências de notificação"
              onClick={() => {
                setOpen(false);
                setPrefsOpen(true);
              }}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Lista */}
          <div className="max-h-[420px] overflow-y-auto">
            {itens.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                {aba === "inbox" ? "Tudo em dia. Nada por aqui." : "Nada arquivado."}
              </div>
            ) : (
              itens.map((n) => {
                const Icon = iconeCategoria(n.categoria);
                const link = resolveLink(n);
                return (
                  <div
                    key={n.id}
                    role={link ? "button" : undefined}
                    className={cn(
                      "group flex items-start gap-3 border-b px-3 py-3 transition-colors last:border-0",
                      link && "cursor-pointer hover:bg-muted/50",
                      !n.lido_em && "bg-info-soft/40"
                    )}
                    onClick={() => abrir(n)}
                  >
                    <div className={cn("mt-0.5 rounded-full p-1.5", toneSeveridade(n.severidade))}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm", !n.lido_em ? "font-semibold text-ink" : "text-foreground")}>
                        {n.titulo}
                      </p>
                      {n.mensagem && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.mensagem}</p>}
                      <p className="mt-1 text-[11px] text-muted-foreground">{formatTimeAgo(n.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!n.lido_em && <span className="h-2 w-2 shrink-0 rounded-full bg-chart-danger" />}
                      {aba === "inbox" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label="Arquivar"
                          onClick={(e) => {
                            e.stopPropagation();
                            arquivar.mutate(n.id);
                          }}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Ações (só no inbox e com itens) */}
          {aba === "inbox" && itens.length > 0 && (
            <div className="flex items-center justify-between border-t px-2 py-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                disabled={naoLidas === 0}
                onClick={() => marcarTodas.mutate()}
              >
                <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                Marcar todas como lidas
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => arquivarTodas.mutate()}
              >
                <Archive className="mr-1.5 h-3.5 w-3.5" />
                Arquivar todas
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <PreferenciasDialog open={prefsOpen} onOpenChange={setPrefsOpen} />
    </>
  );
}

function AbaBtn({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1 text-xs font-medium transition-colors",
        ativo ? "bg-white text-ink shadow-sm" : "text-muted-foreground hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
