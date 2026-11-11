import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { PilarPage } from "@/components/PilarPage";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/motion/PageLoader";
import { NovidadeLista } from "@/components/novidades/NovidadeLista";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMarcarNovidadesVistas, useNovidades } from "@/hooks/useNovidades";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDateTime } from "@/lib/format";

// Novidades do produto (SPEC 152): o que mudou no Pilar, da release mais nova à mais velha.
// Abrir a página conta como ter visto: o ponto do menu e o modal "O que mudou" somem.
export default function Novidades() {
  usePageTitle("Novidades");
  const { releases, isLoading, error } = useNovidades();
  const marcar = useMarcarNovidadesVistas();
  const marcou = useRef(false);

  const temNova = releases.some((r) => r.nova);
  useEffect(() => {
    if (!temNova || marcou.current) return;
    marcou.current = true;
    marcar.mutate();
  }, [temNova, marcar]);

  return (
    <PilarPage title="Novidades">
      <p className="text-sm text-ink-muted">
        O que mudou no Pilar. Mudanças no caminho de uma tarefa aparecem primeiro.
      </p>

      {isLoading ? (
        <PageLoader label="Buscando novidades" />
      ) : error ? (
        <EmptyState
          title="Não foi possível carregar as novidades"
          description="Recarregue a página para tentar de novo."
        />
      ) : releases.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nenhuma novidade por enquanto"
          description="Quando sair uma melhoria no Pilar, ela aparece aqui."
        />
      ) : (
        <div className="space-y-4">
          {releases.map((r) => (
            <Card key={r.id}>
              <CardHeader className="space-y-1 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-ink">{r.titulo}</h2>
                  {r.versao && <span className="text-sm text-ink-muted">{r.versao}</span>}
                  {r.nova && <Badge variant="info">Nova</Badge>}
                </div>
                <p className="text-xs text-ink-muted">{`Publicada em ${formatDateTime(r.publicada_em)}`}</p>
              </CardHeader>
              <CardContent>
                <NovidadeLista itens={r.itens} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PilarPage>
  );
}
