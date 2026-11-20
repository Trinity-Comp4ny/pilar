import { useMemo, useState } from "react";
import { PilarPage } from "@/components/PilarPage";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/motion/PageLoader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  CATEGORIAS,
  ORIGENS_CONTATO,
  agruparTemas,
  filtrar,
  percentualRedeProxima,
  proporcaoPorOrigem,
} from "./cerebroLib";
import { useInsightsDoCerebro, useReunioes } from "./reunioesApi";

const TODOS = "todos";

/** O que se repete nas reuniões (SPEC 169): frequência por tema. Nesta fase nada é "recomendação". */
export default function Cerebro() {
  usePageTitle("Cérebro · Ultra admin");
  const insights = useInsightsDoCerebro();
  const reunioes = useReunioes();
  const [categoria, setCategoria] = useState(TODOS);
  const [modulo, setModulo] = useState(TODOS);
  const [escritorio, setEscritorio] = useState(TODOS);

  const todas = useMemo(() => insights.data ?? [], [insights.data]);
  const modulos = useMemo(() => [...new Set(todas.map((l) => l.modulo_pilar).filter(Boolean))] as string[], [todas]);
  const escritorios = useMemo(
    () => [...new Set(todas.map((l) => l.reuniao?.origem_nome).filter(Boolean))] as string[],
    [todas]
  );
  const temas = useMemo(
    () =>
      agruparTemas(
        filtrar(todas, {
          categoria: categoria === TODOS ? null : categoria,
          modulo: modulo === TODOS ? null : modulo,
          escritorio: escritorio === TODOS ? null : escritorio,
        })
      ),
    [todas, categoria, modulo, escritorio]
  );
  const origens = useMemo(() => proporcaoPorOrigem(reunioes.data ?? []), [reunioes.data]);
  const redeProxima = percentualRedeProxima(reunioes.data ?? []);

  return (
    <PilarPage title="Cérebro de reuniões">
      <p className="text-sm text-ink-muted">
        Temas que aparecem nas reuniões, contados por reunião e por escritório distinto. Um tema que só apareceu em um
        escritório é hipótese, não recomendação.
      </p>

      {origens.length > 0 ? (
        <p className="text-sm text-ink-muted" role="note">
          {redeProxima}% das reuniões vieram de parente, amigo ou indicação:{" "}
          {origens.map((o) => `${ORIGENS_CONTATO[o.origem] ?? "Sem origem"} ${o.percentual}%`).join(", ")}. Leia os
          temas com esse viés em mente.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Filtro rotulo="Categoria" valor={categoria} onChange={setCategoria} opcoes={Object.entries(CATEGORIAS)} />
        <Filtro rotulo="Módulo" valor={modulo} onChange={setModulo} opcoes={modulos.map((m) => [m, m])} />
        <Filtro
          rotulo="Escritório"
          valor={escritorio}
          onChange={setEscritorio}
          opcoes={escritorios.map((e) => [e, e])}
        />
      </div>

      {insights.isLoading ? (
        <PageLoader label="Somando os achados" />
      ) : insights.error ? (
        <EmptyState title="Não foi possível carregar o cérebro" description="Recarregue a página." />
      ) : temas.length === 0 ? (
        <EmptyState title="Nenhum tema ainda" description="Analise uma reunião em Reuniões para começar." />
      ) : (
        <div className="space-y-3">
          {temas.map((t) => (
            <Card key={t.chave}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{CATEGORIAS[t.categoria] ?? t.categoria}</Badge>
                    <span className="font-medium">{t.modulo ?? "Sem módulo"}</span>
                  </div>
                  <span className="text-sm text-ink-muted">
                    {t.reunioes} {t.reunioes === 1 ? "reunião" : "reuniões"}, {t.escritorios}{" "}
                    {t.escritorios === 1 ? "escritório" : "escritórios"}
                    {t.escritorios < 2 ? " (hipótese)" : ""}
                  </span>
                </div>
                {t.exemplos.map((e) => (
                  <blockquote key={e.id} className="border-l-2 pl-3 text-sm text-ink-muted">
                    {e.citacao}
                  </blockquote>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PilarPage>
  );
}

function Filtro({
  rotulo,
  valor,
  onChange,
  opcoes,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: Array<[string, string]>;
}) {
  return (
    <Select value={valor} onValueChange={onChange}>
      <SelectTrigger className="w-52" aria-label={rotulo}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>{`${rotulo}: todos`}</SelectItem>
        {opcoes.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
