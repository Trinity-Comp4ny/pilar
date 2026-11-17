import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PilarPage } from "@/components/PilarPage";
import { EmptyState } from "@/components/EmptyState";
import { KPICard } from "@/components/KPICard";
import { PageLoader } from "@/components/motion/PageLoader";
import { EscolhaChips } from "@/components/forms/EscolhaChips";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { PORTES } from "@/lib/perfilEscritorio";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  comoResolvem,
  dorPorDisciplina,
  dorPorPorte,
  ferramentasEmUso,
  filtrar,
  lerLinhas,
  paraCsv,
  projetosAtivosPorFaixa,
  rankingDeDores,
  resumir,
  textosLivres,
  type Distribuicao,
  type GrupoDores,
  type LinhaDores,
} from "@/pages/ultra-admin/doresLib";

const TODOS = "todos";
const FILTROS = [
  { value: TODOS, label: "Todos os portes" },
  ...PORTES.map((p) => ({ value: p.value, label: p.label })),
];

function baixarCsv(csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dores-do-mercado-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Dores do mercado (SPEC 165, fase 4): o que os escritórios disseram no onboarding inteligente, somado.
 * Só o ultra-admin lê (RLS de `onboarding_respostas`). Ajuda a vender, priorizar produto e abrir a conversa
 * certa com cada escritório.
 */
export default function DoresMercado() {
  usePageTitle("Dores do mercado · Ultra admin");
  const [porte, setPorte] = useState<string>(TODOS);

  const query = useQuery({
    queryKey: ["ultra-admin-dores-mercado"],
    queryFn: async (): Promise<LinhaDores[]> => {
      const { data, error } = await supabase
        .from("onboarding_respostas")
        .select(
          "empresa_id, dores, dor_principal, texto_livre, contexto, etapa_atual, concluido_em, created_at, empresas(nome, porte, disciplinas)"
        )
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as LinhaDores[];
    },
  });

  const todas = useMemo(() => lerLinhas(query.data ?? []), [query.data]);
  const respostas = useMemo(() => filtrar(todas, { porte: porte === TODOS ? null : porte }), [todas, porte]);

  const resumo = useMemo(() => resumir(respostas), [respostas]);
  const ranking = useMemo(() => rankingDeDores(respostas), [respostas]);
  const resolvem = useMemo(() => comoResolvem(respostas), [respostas]);
  const ferramentas = useMemo(() => ferramentasEmUso(respostas), [respostas]);
  const projetos = useMemo(() => projetosAtivosPorFaixa(respostas), [respostas]);
  const porPorte = useMemo(() => dorPorPorte(todas), [todas]);
  const porDisciplina = useMemo(() => dorPorDisciplina(respostas), [respostas]);
  const textos = useMemo(() => textosLivres(respostas), [respostas]);
  const maior = ranking.itens[0]?.mencoes ?? 1;

  return (
    <PilarPage
      title="Dores do mercado"
      actions={
        <Button
          variant="outline"
          size="sm"
          disabled={respostas.length === 0}
          onClick={() => baixarCsv(paraCsv(respostas))}
        >
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      }
    >
      <p className="text-sm text-ink-muted">
        O que os donos responderam no onboarding: dores, como resolvem hoje e o que usam. Cada escritório conta uma vez.
      </p>

      {query.isLoading ? (
        <PageLoader label="Buscando respostas" />
      ) : query.error ? (
        <EmptyState title="Não foi possível carregar as respostas" description="Recarregue a página." />
      ) : todas.length === 0 ? (
        <EmptyState
          title="Ainda sem respostas"
          description="Quando um dono passar pelo onboarding inteligente, as dores aparecem aqui."
        />
      ) : (
        <>
          <EscolhaChips ariaLabel="Filtrar por porte" opcoes={FILTROS} value={porte} onChange={setPorte} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard label="Iniciaram" value={String(resumo.iniciaram)} />
            <KPICard label="Concluíram" value={String(resumo.concluiram)} />
            <KPICard label="Marcaram uma dor" value={String(resumo.comDor)} />
            <KPICard label="Escreveram texto" value={String(resumo.comTexto)} />
          </div>

          <Card>
            <CardContent className="space-y-3 pt-4">
              <h2 className="text-sm font-semibold text-ink">
                Dores mais citadas{" "}
                <span className="font-normal text-ink-muted">(base: {ranking.base} escritórios)</span>
              </h2>
              {ranking.itens.length === 0 ? (
                <EmptyState compact title="Nenhuma dor marcada neste recorte." />
              ) : (
                <ul className="space-y-2.5">
                  {ranking.itens.map((i) => (
                    <li key={i.dor} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-ink">{i.rotulo}</span>
                        <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                          {i.mencoes} ({i.pct}%) · principal em {i.principal}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-paper-border" aria-hidden>
                        <div className="h-2 rounded-full bg-brand" style={{ width: `${(i.mencoes / maior) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <GrupoDeDores titulo="A dor muda com o porte?" grupos={porPorte} aviso="Sempre soma todos os portes." />
            <GrupoDeDores titulo="E com a disciplina?" grupos={porDisciplina} />
          </div>

          <Card>
            <CardContent className="space-y-3 pt-4">
              <h2 className="text-sm font-semibold text-ink">Como resolvem hoje</h2>
              {resolvem.length === 0 ? (
                <EmptyState compact title="Sem respostas ainda." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {resolvem.map((g) => (
                    <div key={g.dor} className="space-y-1.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{g.rotulo}</p>
                      <p className="text-sm text-ink">{g.pergunta}</p>
                      <ul className="text-sm text-ink-soft">
                        {g.respostas.map((r) => (
                          <li key={r.valor} className="flex justify-between gap-3">
                            <span>{r.rotulo}</span>
                            <span className="tabular-nums">{r.total}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Contagem titulo="O que usam hoje" itens={ferramentas} />
            <Contagem titulo="Projetos ao mesmo tempo" itens={projetos} />
          </div>

          <Card>
            <CardContent className="space-y-3 pt-4">
              <h2 className="text-sm font-semibold text-ink">Com as palavras deles</h2>
              {textos.length === 0 ? (
                <EmptyState compact title="Nenhum texto livre neste recorte." />
              ) : (
                <ul className="divide-y divide-black/5">
                  {textos.map((t) => (
                    <li key={`${t.empresaId}-${t.criadoEm}`} className="space-y-0.5 py-2.5 text-sm">
                      <p className="whitespace-pre-line text-ink">{t.texto}</p>
                      <p className="text-xs text-ink-muted">
                        <Link to={`/ultra-admin/empresas/${t.empresaId}`} className="underline underline-offset-2">
                          {t.empresa}
                        </Link>
                        {t.principal ? ` · ${t.principal}` : ""} · {formatDate(t.criadoEm)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PilarPage>
  );
}

function GrupoDeDores({ titulo, grupos, aviso }: { titulo: string; grupos: GrupoDores[]; aviso?: string }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
        {grupos.length === 0 ? (
          <EmptyState compact title="Sem dados neste recorte." />
        ) : (
          <ul className="space-y-3">
            {grupos.map((g) => (
              <li key={g.value} className="text-sm">
                <p className="font-medium text-ink">
                  {g.rotulo} <span className="font-normal text-ink-muted">({g.escritorios})</span>
                </p>
                <ol className="list-decimal pl-5 text-ink-soft">
                  {g.ranking.map((r) => (
                    <li key={r.dor}>
                      {r.rotulo} <span className="tabular-nums text-ink-muted">· {r.mencoes}</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
        {aviso && <p className="text-xs text-ink-muted">{aviso}</p>}
      </CardContent>
    </Card>
  );
}

function Contagem({ titulo, itens }: { titulo: string; itens: Distribuicao[] }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
        {itens.length === 0 ? (
          <EmptyState compact title="Sem respostas ainda." />
        ) : (
          <ul className="divide-y divide-black/5 text-sm">
            {itens.map((i) => (
              <li key={i.value} className="flex items-center justify-between py-2">
                <span className="text-ink">{i.rotulo}</span>
                <span className="tabular-nums text-ink-muted">{i.total}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
