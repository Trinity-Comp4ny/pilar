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
  type FiltroNotificacao,
  type Notificacao,
  type AbaNotificacao,
} from "@/hooks/useNotificacoes";
import {
  CATEGORIAS,
  CATEGORIA_PORTAL,
  TIPOS_PORTAL,
  TIPO_PORTAL_LABEL,
  iconeCategoria,
  rotuloCategoria,
  toneSeveridade,
  resolveLink,
  formatTimeAgo,
  type CategoriaFiltro,
  type TipoPortal,
} from "@/lib/notificacoes";
import { usePermissions } from "@/hooks/usePermissions";
import { setFaviconBadge } from "@/lib/favicon";
import { PreferenciasDialog } from "@/pages/notificacoes/PreferenciasDialog";

interface NotificationInboxProps {
  /**
   * Lado de abertura do popover. Default (`"right"`) é o da sidebar desktop,
   * que tem espaço sobrando à direita do sino. Dentro do `MoreSheet` mobile
   * (spec 097), o sino fica perto do topo/borda direita de uma tela de largura
   * total, então `side="right"` não tinha pra onde abrir sem cortar — o
   * chamador passa `side="bottom"` nesse caso.
   */
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

/**
 * Sino de notificações no rodapé da sidebar (spec 029). Popover com duas abas:
 * Inbox (não arquivadas) e Arquivadas. Leitura e arquivamento por usuário (RLS).
 * Atualiza em tempo real. Preferências por categoria abrem pela engrenagem.
 */
export function NotificationInbox({ side = "right", align = "end" }: NotificationInboxProps = {}) {
  const [open, setOpen] = useState(false);
  const [aba, setAba] = useState<AbaNotificacao>("inbox");
  const [categoria, setCategoria] = useState<CategoriaFiltro | null>(null);
  const [tipo, setTipo] = useState<TipoPortal | null>(null);
  const { isUltraAdmin } = usePermissions();
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

  const filtro: FiltroNotificacao = { categoria, tipo };
  const { data: itens = [] } = useNotificacoes(aba, 50, filtro);
  const { data: contagem } = useNotificacoesNaoLidas();
  const naoLidas = contagem?.total ?? 0;
  const porCategoria = contagem?.porCategoria ?? {};
  const porTipoPortal = contagem?.porTipoPortal ?? {};
  // "Marcar todas" e "Arquivar todas" valem para o que o filtro mostra.
  const naoLidasNoFiltro = categoria ? (tipo ? (porTipoPortal[tipo] ?? 0) : (porCategoria[categoria] ?? 0)) : naoLidas;
  const escolherCategoria = (c: CategoriaFiltro | null) => {
    setCategoria(c);
    setTipo(null);
  };
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
          side={side}
          align={align}
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

          {/* Filtro por categoria: o limite de 50 vale por categoria, e a contagem de não lidas
              mostra onde há coisa nova mesmo com outra categoria enchendo a lista. */}
          <div className="flex flex-wrap gap-1.5 border-b px-2 py-2" role="group" aria-label="Filtrar por categoria">
            <ChipCategoria ativo={categoria === null} onClick={() => escolherCategoria(null)}>
              Todas
            </ChipCategoria>
            {categoriasDoSino(isUltraAdmin).map((c) => {
              const n = aba === "inbox" ? (porCategoria[c] ?? 0) : 0;
              return (
                <ChipCategoria
                  key={c}
                  ativo={categoria === c}
                  onClick={() => escolherCategoria(categoria === c ? null : c)}
                  label={n > 0 ? `${rotuloCategoria(c)}, ${n} não lidas` : undefined}
                >
                  {rotuloCategoria(c)}
                  {n > 0 && <span className="ml-1 tabular-nums font-semibold">{n}</span>}
                </ChipCategoria>
              );
            })}
          </div>

          {/* Avisos do portal: feedback e cadastros se misturam na mesma categoria, então ganham um segundo filtro. */}
          {isUltraAdmin && categoria === CATEGORIA_PORTAL && (
            <div
              className="flex flex-wrap gap-1.5 border-b px-2 py-2"
              role="group"
              aria-label="Filtrar por tipo de aviso"
            >
              <ChipCategoria ativo={tipo === null} onClick={() => setTipo(null)}>
                Todos
              </ChipCategoria>
              {TIPOS_PORTAL.map((t) => {
                const n = aba === "inbox" ? (porTipoPortal[t] ?? 0) : 0;
                return (
                  <ChipCategoria
                    key={t}
                    ativo={tipo === t}
                    onClick={() => setTipo(tipo === t ? null : t)}
                    label={n > 0 ? `${TIPO_PORTAL_LABEL[t]}, ${n} não lidas` : undefined}
                  >
                    {TIPO_PORTAL_LABEL[t]}
                    {n > 0 && <span className="ml-1 tabular-nums font-semibold">{n}</span>}
                  </ChipCategoria>
                );
              })}
            </div>
          )}

          {/* Lista */}
          <div className="max-h-[420px] overflow-y-auto">
            {itens.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                {categoria
                  ? aba === "inbox"
                    ? `Tudo em dia em ${rotuloCategoria(categoria).toLowerCase()}.`
                    : `Nada arquivado em ${rotuloCategoria(categoria).toLowerCase()}.`
                  : aba === "inbox"
                    ? "Tudo em dia. Nada por aqui."
                    : "Nada arquivado."}
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
                disabled={naoLidasNoFiltro === 0}
                onClick={() => marcarTodas.mutate(filtro)}
              >
                <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                Marcar todas como lidas
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => arquivarTodas.mutate(filtro)}
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

/** Chips de categoria do sino: "Portal" vem primeiro pro ultra admin, que é quem recebe esses avisos. */
function categoriasDoSino(isUltraAdmin: boolean): CategoriaFiltro[] {
  return isUltraAdmin ? [CATEGORIA_PORTAL, ...CATEGORIAS] : [...CATEGORIAS];
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

function ChipCategoria({
  ativo,
  onClick,
  label,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      aria-label={label}
      className={cn(
        "whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        ativo ? "border-ink bg-ink text-white" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
