import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { analytics } from "@/lib/analytics";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { usePainelGestao } from "@/hooks/usePainelGestao";
import { usePainelLayout } from "@/hooks/usePainelLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { DataFrescor } from "@/components/DataFrescor";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PainelGrid } from "./painel/PainelGrid";
import { LAYOUT_PADRAO } from "./painel/catalogo";

/**
 * /inicio: painel do escritório, montado pelo usuário (SPEC 092, ADR 0037 e 0038).
 *
 * A tela nasce enxuta, com os números que o design partner pediu (total de
 * projetos, concluídos, atrasados), e cresce só onde a pessoa escolhe. Quem
 * decide o conteúdo é o layout salvo em `profiles.painel_layout`; quem decide o
 * que existe no catálogo é a permissão de quem abre.
 *
 * Widget financeiro existe no catálogo, mas nunca no padrão: dinheiro no
 * /inicio é opt-in de quem já pode ver dinheiro em qualquer outra tela.
 */

function saudacao(nome: string | null): string {
  const h = new Date().getHours();
  const periodo = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return nome ? `${periodo}, ${nome}` : periodo;
}

export default function Inicio() {
  usePageTitle("Início");
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { can } = usePermissions();

  const painel = usePainelGestao();
  const { layout, salvar, restaurarPadrao, salvando } = usePainelLayout(LAYOUT_PADRAO);
  const [editando, setEditando] = useState(false);
  const [pergunta, setPergunta] = useState("");

  const podeAgentes = can("ai_chat");

  const perguntar = () => {
    const prompt = pergunta.trim();
    // Instrumenta a porta de entrada do agente (não envia o texto: PII).
    analytics.track("inicio_agentes_abrir", { origem: "barra_inicio", com_texto: prompt.length > 0 });
    navigate("/agentes", prompt ? { state: { prompt } } : undefined);
  };

  return (
    <PageLayout
      header={
        <PageHeader title="Início">
          <span className="mr-auto hidden text-sm text-ink sm:inline">
            {saudacao(profile?.first_name ?? null)}
          </span>
          <DataFrescor
            updatedAt={painel.dataUpdatedAt}
            isFetching={painel.isFetching}
            onRefresh={() => void painel.refetch()}
          />
          {!editando && painel.data && (
            <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
              Personalizar
            </Button>
          )}
        </PageHeader>
      }
    >
      <div className="flex flex-col gap-4">

        {painel.isLoading ? (
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-12">
            {["inteira", "meia", "meia"].map((tamanho, i) => (
              <div
                key={i}
                className={tamanho === "inteira" ? "lg:col-span-12" : "lg:col-span-6"}
              >
                <Skeleton className="h-[132px] w-full rounded-2xl" />
              </div>
            ))}
          </div>
        ) : painel.isError ? (
          <div className="rounded-2xl border border-danger-soft-border bg-danger-soft px-4 py-3 text-sm text-danger-strong">
            Não foi possível carregar o painel.{" "}
            <button type="button" onClick={() => void painel.refetch()} className="underline">
              Tentar de novo
            </button>
          </div>
        ) : painel.data ? (
          <PainelGrid
            data={painel.data}
            layout={layout}
            editando={editando}
            salvando={salvando}
            onEditar={setEditando}
            onSalvar={salvar}
            onRestaurar={restaurarPadrao}
          />
        ) : null}

        {/* Porta dos agentes: fica fora do painel porque não é indicador, é ação. */}
        {podeAgentes && !editando && (
          <section aria-label="Assistente">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                perguntar();
              }}
              className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white py-2.5 pl-4 pr-2 shadow-sm focus-within:ring-2 focus-within:ring-brand/60"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-ink">
                <Sparkles size={18} />
              </span>
              <input
                value={pergunta}
                onChange={(event) => setPergunta(event.target.value)}
                placeholder="Pergunte aos agentes"
                className="flex-1 bg-transparent py-1.5 text-base text-ink outline-none placeholder:text-ink-muted"
                aria-label="Perguntar aos agentes"
              />
              <button
                type="submit"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                aria-label="Abrir conversa com os agentes"
              >
                <ArrowRight size={18} />
              </button>
            </form>
          </section>
        )}
      </div>
    </PageLayout>
  );
}
