import { useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { PilarPage } from "@/components/PilarPage";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/motion/PageLoader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { usePageTitle } from "@/hooks/usePageTitle";
import { CATEGORIAS, ORIGENS_CONTATO, TIPOS_REUNIAO } from "./cerebroLib";
import { useCorrigirTipo, useRemoverInsight, useReuniao } from "./reunioesApi";

const ROTULO_REDACAO: Record<string, string> = {
  email: "e-mail",
  telefone: "telefone",
  cpf: "CPF",
  cnpj: "CNPJ",
  url_token: "link com token",
  senha: "senha",
  valor: "valor em reais",
};

/** Uma reunião analisada (SPEC 169): tipo, trechos, achados com citação e compromissos. */
export default function ReuniaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  usePageTitle("Reunião · Ultra admin");
  const query = useReuniao(id);
  const corrigir = useCorrigirTipo(id ?? "");
  const remover = useRemoverInsight(id ?? "");
  const [removendo, setRemovendo] = useState<string | null>(null);

  if (query.isLoading) return <PageLoader label="Abrindo a reunião" />;
  if (query.error || !query.data) {
    return (
      <PilarPage title="Reunião">
        <EmptyState title="Não foi possível abrir a reunião" description="Volte à lista e tente de novo." />
      </PilarPage>
    );
  }

  const { reuniao, insights, segmentos, compromissos } = query.data;
  const tipoAtual = reuniao.tipo_corrigido ?? reuniao.tipo;
  const visiveis = insights.filter((i) => !i.removido);
  const abertos = compromissos.filter((c) => c.status === "aberto");
  const redacoes = Object.entries(reuniao.redacoes ?? {});
  const ruidoAlto = segmentos.some((s) => (s.proporcao_ruido ?? 0) >= 0.5);

  return (
    <PilarPage title={reuniao.titulo} breadcrumbs={[{ label: "Reuniões", to: "/ultra-admin/reunioes" }]}>
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
        <span>{formatDate(reuniao.ocorreu_em.slice(0, 10))}</span>
        {reuniao.origem_nome ? <span>{reuniao.origem_nome}</span> : null}
        {reuniao.origem_contato ? <Badge variant="neutral">{ORIGENS_CONTATO[reuniao.origem_contato]}</Badge> : null}
        {reuniao.tipo_confianca !== null && !reuniao.tipo_corrigido ? (
          <span>Confiança no tipo: {Math.round(reuniao.tipo_confianca * 100)}%</span>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Tipo da reunião</span>
        <Select
          value={tipoAtual}
          onValueChange={(v) => corrigir.mutate(v, { onError: (e: Error) => toast.error(e.message) })}
        >
          <SelectTrigger className="w-56" aria-label="Corrigir o tipo da reunião">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TIPOS_REUNIAO).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {redacoes.length > 0 ? (
        <p className="text-sm text-ink-muted">
          Dado removido antes de gravar: {redacoes.map(([k, n]) => `${n} ${ROTULO_REDACAO[k] ?? k}`).join(", ")}.
        </p>
      ) : null}
      {ruidoAlto ? (
        <p className="text-sm text-status-warning">
          Parte desta reunião é conversa fora do assunto. Os achados dessas partes valem menos.
        </p>
      ) : null}

      {segmentos.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Trechos</h2>
          <ul className="space-y-1 text-sm">
            {segmentos.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <Badge variant="outline">{TIPOS_REUNIAO[s.tipo] ?? s.tipo}</Badge>
                <span className="text-ink-muted">
                  linhas {s.inicio} a {s.fim}
                  {s.proporcao_ruido !== null ? `, ${Math.round(s.proporcao_ruido * 100)}% de ruído` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Achados ({visiveis.length})</h2>
        {visiveis.length === 0 ? (
          <EmptyState compact title="Nenhum achado com citação nesta reunião" />
        ) : (
          visiveis.map((i) => (
            <Card key={i.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="info">{CATEGORIAS[i.categoria] ?? i.categoria}</Badge>
                    {i.modulo_pilar ? <Badge variant="outline">{i.modulo_pilar}</Badge> : null}
                    {i.texto_duvidoso ? <Badge variant="warning">Texto duvidoso</Badge> : null}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setRemovendo(i.id)}>
                    Remover
                  </Button>
                </div>
                <p className="text-sm font-medium">{i.texto}</p>
                <blockquote className="border-l-2 pl-3 text-sm text-ink-muted">{i.citacao}</blockquote>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Compromissos em aberto ({abertos.length})</h2>
        {abertos.length === 0 ? (
          <EmptyState compact title="Nenhum compromisso em aberto" />
        ) : (
          <ul className="space-y-1 text-sm">
            {abertos.map((c) => (
              <li key={c.id}>
                {c.prometido_por === "pilar" ? "Pilar" : "Cliente"}: {c.descricao}
                {c.prazo ? ` (até ${formatDate(c.prazo)})` : ""}
              </li>
            ))}
          </ul>
        )}
        {reuniao.proximo_passo ? (
          <p className="text-sm">
            Próximo passo: {reuniao.proximo_passo}
            {reuniao.proximo_passo_em ? ` (${formatDate(reuniao.proximo_passo_em)})` : ""}
          </p>
        ) : null}
      </section>

      <ConfirmDialog
        open={!!removendo}
        onOpenChange={(o) => !o && setRemovendo(null)}
        title="Remover este achado?"
        description="Ele deixa de contar no cérebro. A reunião continua salva."
        confirmText="Remover"
        variant="destructive"
        onConfirm={() => {
          if (removendo) remover.mutate(removendo, { onError: (e: Error) => toast.error(e.message) });
          setRemovendo(null);
        }}
      />
    </PilarPage>
  );
}
