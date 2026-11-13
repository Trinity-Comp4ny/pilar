import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateShort } from "@/lib/format";
import { type Pendencia, type ResultadoAcao, useAplicarPlanoPrazo, usePlanoPrazo } from "./hooks/useAgentePendencias";
import { disciplinaAberta, textoComunicado } from "./lib/plano";
import { num, plural } from "./lib/pendencias";

interface PrazoDrawerProps {
  pendencia: Pendencia | null;
  onOpenChange: (open: boolean) => void;
  /** Quem não edita projetos só lê o plano. */
  canEdit: boolean;
}

const ROTULO_ACAO = {
  avisar: "Aviso à equipe",
  comunicado: "Comunicado ao cliente",
  aditivo: "Aditivo de prazo",
} as const;

/**
 * Plano de prazo em risco (SPEC 148): mostra as disciplinas ainda abertas e prepara três ações
 * opcionais (avisar a equipe, comunicar o cliente, abrir aditivo de prazo). A Pilar não prevê a nova
 * data: ela depende de horas lançadas, que ainda não existem. A data e os dias são do usuário.
 */
export function PrazoDrawer({ pendencia, onOpenChange, canEdit }: PrazoDrawerProps) {
  const projetoId = pendencia?.projeto_id ?? null;
  const plano = usePlanoPrazo(projetoId);
  const aplicar = useAplicarPlanoPrazo();

  const [avisar, setAvisar] = useState(true);
  const [comunicar, setComunicar] = useState(true);
  const [criarAditivo, setCriarAditivo] = useState(false);
  const [dias, setDias] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  // Ações que já deram certo nesta revisão: depois de uma falha parcial, tentar de novo não as repete.
  const [feitas, setFeitas] = useState<Partial<Record<ResultadoAcao["acao"], boolean>>>({});

  const dados = plano.data;
  const abertas = dados?.disciplinas.filter((d) => disciplinaAberta(d.status)) ?? [];
  const clienteEmail = dados?.cliente?.email?.trim() ?? "";
  const podeComunicar = !!dados?.cliente && clienteEmail.length > 0;

  useEffect(() => {
    if (!dados) return;
    const t = textoComunicado({
      cliente: dados.cliente?.nome ?? "cliente",
      projeto: dados.nome,
      entrega: dados.entrega ? formatDate(dados.entrega) : null,
      abertas: abertas.length,
    });
    setAssunto(t.assunto);
    setMensagem(t.mensagem);
    setComunicar(podeComunicar);
    // abertas.length só muda junto com `dados`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados]);

  if (!pendencia) return null;

  const fazerAvisar = avisar && !feitas.avisar;
  const fazerComunicado = comunicar && podeComunicar && !feitas.comunicado;
  const fazerAditivo = criarAditivo && !feitas.aditivo;
  const diasAditivo = Number.parseInt(dias, 10);
  const aditivoValido = Number.isInteger(diasAditivo) && diasAditivo >= 1 && diasAditivo <= 365;
  const algumaAcao = avisar || (comunicar && podeComunicar) || criarAditivo;
  const pronto =
    canEdit && algumaAcao && (!criarAditivo || aditivoValido) && (!comunicar || mensagem.trim().length > 0);
  const diasParaEntrega = num(pendencia.dados.dias_para_vencer);

  const handleAplicar = async () => {
    if (!projetoId || !dados || !pronto) return;
    try {
      const resultados = await aplicar.mutateAsync({
        projetoId,
        pendenciaId: pendencia.id,
        avisar: fazerAvisar,
        comunicado:
          fazerComunicado && dados.cliente
            ? { clienteId: dados.cliente.id, assunto: assunto.trim(), mensagem: mensagem.trim() }
            : null,
        aditivo: fazerAditivo
          ? {
              dias: diasAditivo,
              justificativa: `Disciplinas em andamento: ${abertas.map((d) => d.nome).join(", ") || "nenhuma"}.`,
            }
          : null,
      });
      setFeitas((atual) => ({
        ...atual,
        ...Object.fromEntries(resultados.filter((r) => r.ok).map((r) => [r.acao, true])),
      }));
      const aplicadas = resultados.filter((r) => r.ok);
      const falhas = resultados.filter((r) => !r.ok);
      if (falhas.length === 0) {
        toast.success(`${plural(aplicadas.length, "ação aplicada", "ações aplicadas")}`, {
          description: "A pendência volta a aparecer em 3 dias se o prazo continuar em risco.",
        });
        onOpenChange(false);
      } else {
        toast.error(`Não foi possível aplicar: ${falhas.map((f) => ROTULO_ACAO[f.acao]).join(", ")}`, {
          description: aplicadas.length
            ? `Já aplicado: ${aplicadas.map((f) => ROTULO_ACAO[f.acao]).join(", ")}. Tentar de novo reenvia só o que falhou.`
            : "Nada foi alterado. Tente de novo em instantes.",
        });
      }
    } catch {
      toast.error("Não foi possível aplicar o plano", { description: "Atualize a lista e tente de novo." });
    }
  };

  return (
    <Sheet open={!!pendencia} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border p-4 pr-12">
          <SheetTitle>Prazo em risco: {dados?.nome ?? "projeto"}</SheetTitle>
          <SheetDescription>
            {dados?.entrega
              ? `Entrega em ${formatDate(dados.entrega)}${diasParaEntrega !== null ? ` (${plural(diasParaEntrega, "dia", "dias")})` : ""}`
              : "Sem data de entrega"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {plano.isLoading && <Skeleton className="h-48 w-full" />}
          {plano.isError && (
            <p className="rounded-lg border border-danger-mid-border bg-danger-soft p-3 text-sm text-danger-strong">
              Não foi possível carregar o projeto. Feche e abra de novo; se persistir, atualize a página.
            </p>
          )}

          {dados && (
            <>
              <details className="rounded-lg border border-border bg-muted/40" open>
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
                  Por que apareceu?
                </summary>
                <ul className="list-disc space-y-1 px-3 pb-3 pl-7 text-sm text-ink-soft">
                  <li>
                    A entrega está a {diasParaEntrega !== null ? plural(diasParaEntrega, "dia", "dias") : "poucos dias"}{" "}
                    e
                    {abertas.length === 0
                      ? " todas as disciplinas estão concluídas ou pausadas."
                      : ` ${plural(abertas.length, "disciplina segue", "disciplinas seguem")} em aberto.`}
                  </li>
                  <li>
                    A Pilar não prevê a nova data: ela depende das horas lançadas por disciplina, que ainda não existem.
                    Você informa a data ou os dias de aditivo.
                  </li>
                </ul>
              </details>

              <section aria-labelledby="disciplinas-abertas" className="space-y-2">
                <h4
                  id="disciplinas-abertas"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Disciplinas em aberto
                </h4>
                {abertas.length === 0 ? (
                  <p className="text-sm text-ink-soft">Nenhuma. Se o trabalho acabou, conclua o projeto.</p>
                ) : (
                  <ul className="space-y-1">
                    {abertas.map((d) => (
                      <li key={d.nome} className="flex justify-between gap-3 text-sm">
                        <span className="text-foreground">{d.nome}</span>
                        <span className="text-muted-foreground">
                          {d.status ?? "sem status"}
                          {d.data_fim ? ` · prazo ${formatDateShort(d.data_fim)}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="plano-acoes" className="space-y-3">
                <h4 id="plano-acoes" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Plano preparado: marque o que quer aplicar
                </h4>

                <div className="space-y-1 rounded-lg border border-border p-3">
                  <label className="flex items-start gap-2 text-sm font-medium text-foreground">
                    <Checkbox
                      checked={avisar}
                      onCheckedChange={(v) => setAvisar(v === true)}
                      disabled={!canEdit || feitas.avisar}
                    />
                    Avisar os responsáveis{feitas.avisar && <Aplicado />}
                  </label>
                  <p className="pl-6 text-xs text-muted-foreground">
                    Notificação na Pilar com a entrega e a quantidade de disciplinas abertas. Sem responsável com conta,
                    vai para a gestão.
                  </p>
                </div>

                <div className="space-y-2 rounded-lg border border-border p-3">
                  <label className="flex items-start gap-2 text-sm font-medium text-foreground">
                    <Checkbox
                      checked={comunicar && podeComunicar}
                      onCheckedChange={(v) => setComunicar(v === true)}
                      disabled={!canEdit || !podeComunicar || feitas.comunicado}
                    />
                    Comunicar o cliente por e-mail{feitas.comunicado && <Aplicado />}
                  </label>
                  {!podeComunicar ? (
                    <p className="pl-6 text-xs text-muted-foreground">
                      O cliente do projeto está sem e-mail cadastrado. Cadastre o e-mail para comunicar daqui.
                    </p>
                  ) : (
                    comunicar && (
                      <div className="space-y-2 pl-6">
                        <p className="text-xs text-muted-foreground">
                          Para {dados.cliente?.nome} ({clienteEmail}). Revise o texto: ele não promete data.
                        </p>
                        <Input
                          aria-label="Assunto do comunicado"
                          value={assunto}
                          maxLength={200}
                          onChange={(e) => setAssunto(e.target.value)}
                          disabled={!canEdit}
                        />
                        <Textarea
                          aria-label="Mensagem do comunicado"
                          rows={7}
                          value={mensagem}
                          maxLength={2000}
                          onChange={(e) => setMensagem(e.target.value)}
                          disabled={!canEdit}
                        />
                      </div>
                    )
                  )}
                </div>

                <div className="space-y-2 rounded-lg border border-border p-3">
                  <label className="flex items-start gap-2 text-sm font-medium text-foreground">
                    <Checkbox
                      checked={criarAditivo}
                      onCheckedChange={(v) => setCriarAditivo(v === true)}
                      disabled={!canEdit || feitas.aditivo}
                    />
                    Criar rascunho de aditivo de prazo{feitas.aditivo && <Aplicado />}
                  </label>
                  <p className="pl-6 text-xs text-muted-foreground">
                    Cria o aditivo sem valor. Ao aprová-lo na aba Escopo, a data de entrega se move pelos dias
                    informados.
                  </p>
                  {criarAditivo && (
                    <div className="flex items-center gap-2 pl-6">
                      <label htmlFor="aditivo-dias" className="text-sm text-ink-soft">
                        Dias a mais
                      </label>
                      <Input
                        id="aditivo-dias"
                        inputMode="numeric"
                        className="w-24 text-right"
                        placeholder="0"
                        value={dias}
                        onChange={(e) => setDias(e.target.value.replace(/\D/g, "").slice(0, 3))}
                        disabled={!canEdit || feitas.aditivo}
                      />
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        <SheetFooter className="flex-col gap-2 border-t border-border bg-surface-app p-4 sm:flex-col sm:space-x-0">
          <p className="text-xs text-muted-foreground">
            {canEdit
              ? "Cada ação marcada é aplicada separadamente. Nada é enviado ao cliente sem o seu clique."
              : "Seu perfil só visualiza projetos, então não aplica o plano."}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button
              variant="brand"
              size="sm"
              disabled={!pronto || aplicar.isPending}
              loading={aplicar.isPending}
              onClick={handleAplicar}
            >
              Aplicar selecionadas
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Aplicado() {
  return <span className="ml-2 text-xs font-normal text-success-strong">já aplicado</span>;
}
