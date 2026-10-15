import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, SlidersHorizontal, Sparkles } from "lucide-react";
import { analytics } from "@/lib/analytics";
import { usePermissions } from "@/hooks/usePermissions";
import { usePainelGestao } from "@/pages/inicio/hooks/usePainelGestao";
import { usePainelLayout } from "@/pages/inicio/hooks/usePainelLayout";
import { useResumoSemanal } from "@/pages/inicio/hooks/useResumoSemanal";
import { useTemaInicio } from "@/pages/inicio/hooks/useTemaInicio";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { DataFrescor } from "@/components/DataFrescor";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PainelGrid } from "./painel/PainelGrid";
import { HeroInicio } from "./hero/HeroInicio";
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
 *
 * O cabeçalho (SPEC 121) abre a tela com a saudação e o resumo da semana escrito por IA:
 * da empresa inteira para quem vê dinheiro, só do que é seu para os demais.
 */

export default function Inicio() {
  usePageTitle("Início");
  const navigate = useNavigate();
  const { can } = usePermissions();

  const { profile } = useAuth();
  const painel = usePainelGestao();
  const resumo = useResumoSemanal(true);
  const cabecalho = useTemaInicio();
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

  const renderHero = (acoes: React.ReactNode) => (
    <HeroInicio
      nome={profile?.first_name?.trim() || null}
      tema={cabecalho.tema}
      mostrarResumo={cabecalho.mostrarResumo}
      editando={editando}
      acoes={acoes}
      onTema={cabecalho.setTema}
      onMostrarResumo={cabecalho.setMostrarResumo}
      resumo={{
        estado: resumo.estado,
        resumo: resumo.resumo,
        erro: resumo.erro,
        onTentarDeNovo: resumo.tentarDeNovo,
      }}
    />
  );

  return (
    <PageLayout
      // O cabeçalho da tela já abre com a saudação: o respiro do topo cai de 40 para 20 px.
      className="pt-5 md:pt-5 xl:pt-5 2xl:pt-5"
      containerClassName="space-y-0"
      header={
        <PageHeader title="Início">
          <DataFrescor
            updatedAt={painel.dataUpdatedAt}
            isFetching={painel.isFetching}
            onRefresh={() => void painel.refetch()}
          />
          {/* Gatilho discreto: texto e ícone, sem caixa. Em edição, os botões vão no cabeçalho da tela. */}
          {!editando && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-full px-3 text-muted-foreground hover:text-ink"
              onClick={() => setEditando(true)}
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              Personalizar
            </Button>
          )}
        </PageHeader>
      }
    >
      <div className="flex flex-col gap-5">
        {painel.isLoading ? (
          <>
            {renderHero(null)}
            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-12">
              {["inteira", "meia", "meia"].map((tamanho, i) => (
                <div key={i} className={tamanho === "inteira" ? "lg:col-span-12" : "lg:col-span-6"}>
                  <Skeleton className="h-[132px] w-full rounded-3xl" />
                </div>
              ))}
            </div>
          </>
        ) : painel.isError ? (
          <>
            {renderHero(null)}
            <div className="rounded-3xl border border-danger-soft-border bg-danger-soft px-4 py-3 text-sm text-danger-strong">
              Não foi possível carregar o painel.{" "}
              <button type="button" onClick={() => void painel.refetch()} className="underline">
                Tentar de novo
              </button>
            </div>
          </>
        ) : painel.data ? (
          <PainelGrid
            key={editando ? "edicao" : "leitura"}
            data={painel.data}
            layout={layout}
            editando={editando}
            salvando={salvando}
            onEditar={setEditando}
            onSalvar={salvar}
            onRestaurar={restaurarPadrao}
            hero={renderHero}
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
              className="flex items-center gap-3 rounded-full border border-border/60 bg-white py-2 pl-3 pr-2 shadow-card focus-within:ring-2 focus-within:ring-brand/60"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-ink">
                <Sparkles size={18} />
              </span>
              <input
                value={pergunta}
                onChange={(event) => setPergunta(event.target.value)}
                placeholder="Pergunte aos agentes"
                className="flex-1 bg-transparent py-1.5 text-base text-ink outline-hidden placeholder:text-ink-muted"
                aria-label="Perguntar aos agentes"
              />
              <button
                type="submit"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-ink transition-opacity hover:opacity-90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/60"
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
