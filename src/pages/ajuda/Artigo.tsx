import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import { PilarPage } from "@/components/PilarPage";
import { EmptyState } from "@/components/EmptyState";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { PageLoader } from "@/components/motion/PageLoader";
import { ArtigoMarkdown } from "./ArtigoMarkdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { artigoPorSlug, carregarCorpo } from "@/lib/ajudaBusca";
import { usePageTitle } from "@/hooks/usePageTitle";

// Artigo da central de ajuda (SPEC 154). O texto vem do markdown em src/content/ajuda, baixado
// só aqui. "Ir para a tela" leva à rota principal do artigo.
export default function ArtigoAjuda() {
  const { slug } = useParams();
  const artigo = artigoPorSlug(slug);
  usePageTitle(artigo ? `${artigo.titulo} · Ajuda` : "Ajuda");
  const [feedbackAberto, setFeedbackAberto] = useState(false);

  const corpo = useQuery({
    queryKey: ["ajuda-artigo", slug],
    queryFn: () => carregarCorpo(slug ?? ""),
    enabled: !!artigo,
    staleTime: Infinity,
  });

  const breadcrumbs = [{ label: "Central de ajuda", to: "/ajuda" }];

  if (!artigo) {
    return (
      <PilarPage title="Artigo não encontrado" breadcrumbs={breadcrumbs}>
        <EmptyState
          icon={BookOpen}
          title="Esse artigo não existe mais"
          description="Volte para a central e busque pelo assunto."
        />
      </PilarPage>
    );
  }

  const rota = artigo.rotas[0];

  return (
    <PilarPage
      title={artigo.titulo}
      breadcrumbs={breadcrumbs}
      actions={
        rota ? (
          <Button variant="outline" size="sm" className="gap-1.5 rounded-full" asChild>
            <Link to={rota}>
              Ir para a tela
              <ArrowRight size={13} aria-hidden />
            </Link>
          </Button>
        ) : undefined
      }
    >
      <Card>
        <CardContent className="pt-5">
          {corpo.isLoading ? (
            <PageLoader label="Abrindo o artigo" />
          ) : corpo.data ? (
            <ArtigoMarkdown>{corpo.data}</ArtigoMarkdown>
          ) : (
            <EmptyState compact title="Não foi possível abrir o artigo. Recarregue a página." />
          )}
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
        <span>Ficou alguma dúvida?</span>
        <Button variant="outline" size="sm" onClick={() => setFeedbackAberto(true)}>
          Enviar feedback
        </Button>
      </div>
      <FeedbackDialog open={feedbackAberto} onOpenChange={setFeedbackAberto} />
    </PilarPage>
  );
}
