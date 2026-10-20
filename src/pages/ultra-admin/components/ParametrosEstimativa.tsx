import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/motion/PageLoader";
import { Button } from "@/components/ui/button";
import { descreverAdicional } from "@/lib/estimativaObra";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import type { Parametros } from "@/schemas/estimativaObra";
import { useParametrosEstimativa, validarParametros } from "../estimativaAdmin";
import { useAcaoEmpresa } from "../hooks";

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 text-sm last:border-b-0">
      <dt className="text-ink-soft">{rotulo}</dt>
      <dd className="text-right font-medium tabular-nums text-ink">{valor}</dd>
    </div>
  );
}

function Bloco({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-base font-semibold text-ink">{titulo}</h2>
      {nota && <p className="mb-1 text-xs text-ink-soft">{nota}</p>}
      <dl>{children}</dl>
    </section>
  );
}

function QuadroParametros({ p }: { p: Parametros }) {
  const somaEtapas = p.etapas.reduce((a, e) => a + e.percentual, 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Bloco titulo="Percentual por etapa" nota="Quanto da base do CUB cada etapa leva. A soma fecha 100%.">
        {p.etapas.map((e) => (
          <Linha key={e.id} rotulo={e.nome} valor={formatPercent(e.percentual, 0)} />
        ))}
        <Linha rotulo="Soma" valor={formatPercent(somaEtapas, 0)} />
      </Bloco>

      <div className="space-y-4">
        <Bloco
          titulo="Adicionais de referência"
          nota="O CUB não inclui estes itens. Cada empresa pode ajustar os seus."
        >
          {Object.values(p.adicionais).map((a) => (
            <Linha key={a.rotulo} rotulo={a.rotulo} valor={descreverAdicional(a)} />
          ))}
        </Bloco>

        <Bloco titulo="Produtividade e prazo" nota="Horas de mão de obra por m² e o que o prazo assume.">
          <Linha rotulo="Padrão baixo" valor={`${formatNumber(p.produtividade_h_m2.baixo)} h/m²`} />
          <Linha rotulo="Padrão normal" valor={`${formatNumber(p.produtividade_h_m2.normal)} h/m²`} />
          <Linha rotulo="Padrão alto" valor={`${formatNumber(p.produtividade_h_m2.alto)} h/m²`} />
          <Linha rotulo="Galpão industrial" valor={`${formatNumber(p.produtividade_h_m2.industrial)} h/m²`} />
          <Linha rotulo="Horas por pessoa por mês" valor={formatNumber(p.horas_mes_por_pessoa)} />
          <Linha rotulo="Equipe padrão" valor={`${formatNumber(p.equipe_padrao)} pessoas`} />
        </Bloco>

        <Bloco titulo="Faixa e administração">
          <Linha rotulo="Taxa de administração padrão" valor={formatPercent(p.adm_padrao, 0)} />
          <Linha rotulo="Faixa padrão" valor={`±${formatPercent(p.faixa_padrao, 0)}`} />
          <Linha
            rotulo="Faixa a mais com CUB de mês antigo"
            valor={`+${formatNumber(p.faixa_extra_mes_antigo)} pontos`}
          />
          <Linha rotulo="Faixa a mais com UF vizinha" valor={`+${formatNumber(p.faixa_extra_uf_vizinha)} pontos`} />
        </Bloco>
      </div>
    </div>
  );
}

/**
 * Parâmetros do motor e o gate de validação (SPEC 136, ADR 0063). Só leitura: enquanto os valores forem
 * placeholder do protótipo, toda estimativa mostra o aviso e PDF e anexo ficam desligados. Editar os
 * valores pela tela é o BEZ-21.
 */
export function ParametrosEstimativa() {
  const query = useParametrosEstimativa();
  const [confirmar, setConfirmar] = useState<"validar" | "desfazer" | null>(null);

  const alterar = useAcaoEmpresa({
    run: (validar: boolean) => validarParametros(validar),
    sucesso: (validar) =>
      validar
        ? "Parâmetros validados. PDF e anexo à proposta liberados."
        : "Validação desfeita. PDF e anexo voltam a ficar bloqueados.",
    erro: "Não foi possível alterar a validação",
    contexto: "ultra-admin:estimativa-parametros",
  });

  if (query.isLoading) return <PageLoader label="Carregando os parâmetros" />;
  if (query.error || !query.data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Não foi possível carregar os parâmetros"
        description={query.error instanceof Error ? query.error.message : "Tente de novo em instantes."}
        action={{ label: "Tentar de novo", onClick: () => void query.refetch() }}
      />
    );
  }

  const { parametros, validadoEm } = query.data;
  const validado = validadoEm !== null;

  return (
    <div className="space-y-4">
      {validado ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success-soft-border bg-success-soft px-3 py-3 text-sm text-success-strong"
          role="status"
        >
          <span className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>Parâmetros validados</strong> em {formatDateTime(validadoEm)}. PDF e anexo à proposta estão
              liberados. Mudar qualquer valor desfaz a validação.
            </span>
          </span>
          <Button variant="outline" size="sm" onClick={() => setConfirmar("desfazer")}>
            Desfazer a validação
          </Button>
        </div>
      ) : (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-mid bg-warning-soft px-3 py-3 text-sm text-warning-strong"
          role="status"
        >
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>Parâmetros em validação.</strong> Estes valores vieram do protótipo e não foram conferidos com
              obras reais. Enquanto estiver assim, toda estimativa mostra o aviso e o PDF e o anexo à proposta ficam
              desligados.
            </span>
          </span>
          <Button variant="brand" size="sm" onClick={() => setConfirmar("validar")}>
            Marcar como validados
          </Button>
        </div>
      )}

      <QuadroParametros p={parametros} />

      <ConfirmDialog
        open={confirmar !== null}
        onOpenChange={(aberto) => !aberto && setConfirmar(null)}
        loading={alterar.isPending}
        title={confirmar === "desfazer" ? "Desfazer a validação?" : "Marcar os parâmetros como validados?"}
        description={
          confirmar === "desfazer"
            ? "O aviso volta para toda estimativa e o PDF e o anexo à proposta ficam bloqueados de novo."
            : "Confirme que você conferiu o percentual por etapa, os adicionais e a produtividade com obras reais. Depois disto, o aviso some e o PDF e o anexo à proposta ficam liberados para as empresas com a feature ligada."
        }
        confirmText={confirmar === "desfazer" ? "Desfazer a validação" : "Validar parâmetros"}
        onConfirm={() => alterar.mutate(confirmar === "validar", { onSettled: () => setConfirmar(null) })}
      />
    </div>
  );
}
