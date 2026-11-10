import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpen, ChevronRight } from "lucide-react";
import { PilarPage } from "@/components/PilarPage";
import { EmptyState } from "@/components/EmptyState";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ARTIGOS, GRUPOS_AJUDA, type ArtigoAjuda } from "@/content/ajuda/indice";
import { artigosDaRota, buscarArtigos } from "@/lib/ajudaBusca";
import { usePageTitle } from "@/hooks/usePageTitle";

function ListaArtigos({ artigos }: { artigos: ArtigoAjuda[] }) {
  return (
    <ul className="divide-y divide-black/5">
      {artigos.map((a) => (
        <li key={a.slug}>
          <Link
            to={`/ajuda/${a.slug}`}
            className="flex items-center justify-between gap-3 py-3 text-left transition-colors hover:text-ink-soft"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{a.titulo}</span>
              <span className="block text-xs text-ink-muted">{a.resumo}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-ink-muted" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Central de ajuda (SPEC 154): artigos por tarefa, com busca. `?tela=/rota` lista os da tela que
// mandou para cá (botão "?" do cabeçalho quando a tela tem mais de um artigo).
export default function Ajuda() {
  usePageTitle("Central de ajuda");
  const [params] = useSearchParams();
  const tela = params.get("tela");
  const [busca, setBusca] = useState("");
  const [feedbackAberto, setFeedbackAberto] = useState(false);

  const resultados = useMemo(() => buscarArtigos(busca), [busca]);
  const daTela = useMemo(() => (tela ? artigosDaRota(tela) : []), [tela]);

  return (
    <PilarPage title="Central de ajuda" search={{ value: busca, onChange: setBusca, placeholder: "Buscar na ajuda" }}>
      {busca.trim() ? (
        resultados.length > 0 ? (
          <Card>
            <CardContent className="py-1">
              <ListaArtigos artigos={resultados} />
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="Nenhum artigo com esse termo"
            description="Tente outra palavra ou conte para a gente o que você procurava."
            action={{ label: "Enviar feedback", onClick: () => setFeedbackAberto(true), variant: "outline" }}
          />
        )
      ) : (
        <div className="space-y-4">
          {daTela.length > 0 && (
            <Card>
              <CardContent className="space-y-1 pt-4">
                <h2 className="text-sm font-semibold text-ink">Desta tela</h2>
                <ListaArtigos artigos={daTela} />
              </CardContent>
            </Card>
          )}
          {GRUPOS_AJUDA.map((g) => {
            const artigos = ARTIGOS.filter((a) => a.grupo === g.id);
            if (artigos.length === 0) return null;
            return (
              <Card key={g.id}>
                <CardContent className="space-y-1 pt-4">
                  <h2 className="text-sm font-semibold text-ink">{g.label}</h2>
                  <ListaArtigos artigos={artigos} />
                </CardContent>
              </Card>
            );
          })}
          <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
            <span>Não achou o que procurava?</span>
            <Button variant="outline" size="sm" onClick={() => setFeedbackAberto(true)}>
              Enviar feedback
            </Button>
          </div>
        </div>
      )}
      <FeedbackDialog open={feedbackAberto} onOpenChange={setFeedbackAberto} />
    </PilarPage>
  );
}
