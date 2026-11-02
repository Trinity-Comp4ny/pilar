import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type Pendencia, useCobranca, useDecidirCobranca, useEnviarCobranca } from "./hooks/useAgentePendencias";
import { ETAPAS_COBRANCA, num, plural, somarDias, txt } from "./lib/pendencias";

interface CobrancaDrawerProps {
  pendencia: Pendencia | null;
  onOpenChange: (open: boolean) => void;
  /** Quem vê o financeiro mas não edita só lê o rascunho. */
  canEdit: boolean;
}

/**
 * Painel de revisão de uma cobrança preparada pelo agente (SPEC 148): a escada da parcela, o e-mail
 * pronto e as quatro saídas (aprovar e enviar, editar, recusar, já cobrei por fora). Nada sai sem o clique.
 */
export function CobrancaDrawer({ pendencia, onOpenChange, canEdit }: CobrancaDrawerProps) {
  const cobrancaId = pendencia ? txt(pendencia.dados.cobranca_id) : null;
  const cobranca = useCobranca(cobrancaId);
  const enviar = useEnviarCobranca();
  const decidir = useDecidirCobranca();

  const [editando, setEditando] = useState(false);
  const [abertura, setAbertura] = useState("");

  useEffect(() => {
    if (cobranca.data) setAbertura(cobranca.data.abertura);
    setEditando(false);
  }, [cobranca.data]);

  if (!pendencia) return null;

  const d = pendencia.dados;
  const etapaAtual = num(d.etapa) ?? 1;
  const vencimento = txt(d.vencimento);
  const dias = num(d.dias) ?? 0;
  const parcela = num(d.parcela_total) ? `Parcela ${num(d.parcela_numero)} de ${num(d.parcela_total)}` : null;
  const projeto = txt(d.projeto_nome);
  const titulo = parcela
    ? `Cobrança: ${parcela}${projeto ? `, ${projeto}` : ""}`
    : pendencia.titulo.replace(/^Cobrança pronta/, "Cobrança");
  const rascunho = cobranca.data;
  const ocupado = enviar.isPending || decidir.isPending;
  const proxima = ETAPAS_COBRANCA.find((e) => e.etapa === etapaAtual + 1);

  const fechar = () => onOpenChange(false);

  const handleEnviar = async () => {
    if (!rascunho) return;
    const editado = abertura.trim() !== rascunho.abertura.trim() ? abertura.trim() : undefined;
    try {
      const r = await enviar.mutateAsync({ cobrancaId: rascunho.id, abertura: editado });
      toast.success(`E-mail enviado para ${r.email}`, {
        description:
          vencimento && proxima
            ? `Registrado no histórico. Próxima etapa em ${formatDateShort(somarDias(vencimento, proxima.offset))}.`
            : "Registrado no histórico.",
      });
      fechar();
    } catch (e) {
      toast.error("Não foi possível enviar a cobrança", {
        description: e instanceof Error ? e.message : "Tente de novo em instantes.",
      });
    }
  };

  const handleDecidir = async (status: "recusada" | "externa") => {
    if (!rascunho) return;
    try {
      await decidir.mutateAsync({ cobrancaId: rascunho.id, status });
      toast.success(
        status === "recusada"
          ? "Etapa recusada. O agente não propõe essa etapa de novo."
          : "Registrado como cobrado por fora. Próxima cobrança só depois de 5 dias."
      );
      fechar();
    } catch {
      toast.error("Não foi possível registrar a decisão", { description: "Atualize a lista e tente de novo." });
    }
  };

  return (
    <Sheet open={!!pendencia} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border p-4 pr-12">
          <SheetTitle>{titulo}</SheetTitle>
          <SheetDescription>
            {txt(d.cliente_nome) ?? "Cliente"}
            {num(d.valor) !== null && ` · ${formatCurrency(num(d.valor) ?? 0)}`}
            {vencimento && ` · vence em ${formatDate(vencimento)}`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <details className="rounded-lg border border-border bg-muted/40">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
              Por que apareceu?
            </summary>
            <ul className="list-disc space-y-1 px-3 pb-3 pl-7 text-sm text-ink-soft">
              {vencimento && dias > 0 && (
                <li>
                  Parcela pendente, vencida em {formatDate(vencimento)} ({plural(dias, "dia", "dias")} de atraso).
                </li>
              )}
              {vencimento && dias <= 0 && <li>Parcela pendente, vence em {formatDate(vencimento)}.</li>}
              {txt(rascunho?.fatos.contatos_anteriores) && (
                <li>Já cobrada em {txt(rascunho?.fatos.contatos_anteriores)}, sem pagamento registrado.</li>
              )}
              {num(rascunho?.fatos.media_atraso_historico) !== null && (
                <li>
                  As últimas parcelas desse cliente foram pagas em média {num(rascunho?.fatos.media_atraso_historico)}{" "}
                  dia(s) após o vencimento.
                </li>
              )}
              <li>
                Regra: a etapa {etapaAtual} acontece {ETAPAS_COBRANCA[etapaAtual - 1]?.quando}.
              </li>
            </ul>
          </details>

          <section aria-labelledby="escada-cobranca" className="space-y-2">
            <h4 id="escada-cobranca" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Escada de cobrança
            </h4>
            <ol className="space-y-1.5">
              {ETAPAS_COBRANCA.map((e) => {
                const feita = e.etapa < etapaAtual;
                const agora = e.etapa === etapaAtual;
                return (
                  <li key={e.etapa} className="flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        feita && "border-transparent bg-success-soft text-success-strong",
                        agora && "border-foreground bg-brand",
                        !feita && !agora && "border-border"
                      )}
                    >
                      {feita && <Check className="h-3 w-3" />}
                    </span>
                    <span className={cn("flex-1", agora ? "font-semibold text-foreground" : "text-ink-soft")}>
                      {e.nome}, {e.quando}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {agora
                        ? "agora, aguardando você"
                        : vencimento
                          ? formatDateShort(somarDias(vencimento, e.offset))
                          : ""}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section aria-labelledby="email-preparado" className="space-y-2">
            <h4 id="email-preparado" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              E-mail preparado
            </h4>
            {cobranca.isLoading && <Skeleton className="h-40 w-full" />}
            {cobranca.isError && (
              <p className="rounded-lg border border-danger-mid-border bg-danger-soft p-3 text-sm text-danger-strong">
                Não foi possível carregar o rascunho. Feche e abra de novo; se persistir, atualize a página.
              </p>
            )}
            {rascunho && (
              <div className="overflow-hidden rounded-lg border border-border">
                <dl className="grid grid-cols-[4rem_1fr] gap-x-2 gap-y-1 border-b border-border bg-muted/40 p-3 text-sm">
                  <dt className="text-muted-foreground">Para</dt>
                  <dd className="break-all text-foreground">{rascunho.destinatario_email}</dd>
                  <dt className="text-muted-foreground">Assunto</dt>
                  <dd className="text-foreground">{rascunho.assunto}</dd>
                </dl>
                <div className="space-y-3 p-3">
                  <div className="space-y-1">
                    <label htmlFor="cobranca-abertura" className="text-xs text-muted-foreground">
                      Abertura preparada pelo agente, no tom da etapa. Edite à vontade.
                    </label>
                    <Textarea
                      id="cobranca-abertura"
                      value={abertura}
                      onChange={(e) => setAbertura(e.target.value)}
                      readOnly={!editando}
                      rows={7}
                      maxLength={1500}
                    />
                  </div>
                  <div className="rounded-lg border border-border p-3 text-sm">
                    <dl className="space-y-1">
                      {projeto && <Linha rotulo="Projeto" valor={projeto} />}
                      {parcela && <Linha rotulo="Parcela" valor={parcela} />}
                      {num(d.valor) !== null && <Linha rotulo="Valor" valor={formatCurrency(num(d.valor) ?? 0)} />}
                      {vencimento && <Linha rotulo="Vencimento" valor={formatDate(vencimento)} />}
                    </dl>
                    <p className="mt-2 text-xs text-muted-foreground">
                      O e-mail inclui a chave PIX do escritório quando ela está cadastrada. Esses dados vêm do sistema e
                      não são editáveis.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <SheetFooter className="flex-col gap-2 border-t border-border bg-surface-app p-4 sm:flex-col sm:space-x-0">
          <p className="text-xs text-muted-foreground">
            {canEdit
              ? "Nenhum e-mail sai sem o seu clique."
              : "Seu perfil só visualiza o financeiro, então não envia cobrança."}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!canEdit || !rascunho || ocupado}
              onClick={() => handleDecidir("recusada")}
            >
              Recusar
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canEdit || !rascunho || ocupado}
              onClick={() => setEditando((v) => !v)}
            >
              {editando ? "Concluir edição" : "Editar"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canEdit || !rascunho || ocupado}
              onClick={() => handleDecidir("externa")}
            >
              Já cobrei por fora
            </Button>
            <Button
              variant="brand"
              size="sm"
              disabled={!canEdit || !rascunho || abertura.trim().length < 20 || ocupado}
              loading={enviar.isPending}
              onClick={handleEnviar}
            >
              Aprovar e enviar
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="font-medium text-foreground">{valor}</dd>
    </div>
  );
}
