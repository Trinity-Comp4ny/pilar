import { PropostaLinkVersao } from "@/components/propostas/PropostaLinkVersao";
import { useRef, useState } from "react";
import { Download, FilePlus2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { type Lead } from "@/hooks/useLeads";
import { useCreateProposta, usePropostas } from "@/hooks/usePropostas";
import { usePropostaVersoes } from "@/hooks/usePropostaVersoes";
import { propostaPdfSchema, validarPropostaPdf } from "@/lib/propostaPdfArquivo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { FormDialog } from "@/components/FormDialog";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { parseCurrencyString } from "@/lib/currencyUtils";
import { toast } from "sonner";

export function LeadPropostasPanel({ lead, canEdit }: { lead: Lead; canEdit: boolean }) {
  const { can } = usePermissions();
  const podeVer = can("propostas", "view") && can("financeiro", "view");
  const podeEditar = canEdit && can("propostas", "edit") && podeVer;
  const { data: todas = [] } = usePropostas();
  const propostas = todas.filter((p) => p.lead_id === lead.id);
  const criar = useCreateProposta();
  const versoes = usePropostaVersoes(
    lead.id,
    propostas.map((p) => p.id),
    podeVer
  );
  const [aberto, setAberto] = useState(false);
  const [propostaId, setPropostaId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [valor, setValor] = useState("");
  const [validade, setValidade] = useState("");
  const [condicoes, setCondicoes] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const envioEmCurso = useRef(false);
  if (!podeVer) return null;

  const abrir = (id: string | null) => {
    const proposta = propostas.find((p) => p.id === id);
    setPropostaId(id);
    setTitulo(proposta?.titulo ?? `Proposta — ${lead.nome}`);
    setValor(proposta?.valor_proposto != null ? formatCurrency(proposta.valor_proposto) : "");
    setValidade(proposta?.validade ?? "");
    setArquivo(null);
    setCondicoes("");
    setMotivo("");
    setErro("");
    setAberto(true);
  };
  const salvar = async () => {
    if (envioEmCurso.current) return;
    envioEmCurso.current = true;
    setErro("");
    try {
      setSalvando(true);
      const erroArquivo = await validarPropostaPdf(arquivo);
      if (erroArquivo) {
        setErro(erroArquivo);
        return;
      }
      if (!valor.trim()) {
        setErro("Informe o valor da proposta.");
        return;
      }
      const validado = propostaPdfSchema.safeParse({ titulo, valor: parseCurrencyString(valor), condicoes, motivo });
      if (!validado.success) {
        setErro(validado.error.issues[0].message);
        return;
      }
      let id = propostaId;
      if (!id) {
        const nova = await criar.mutateAsync({
          titulo: validado.data.titulo,
          lead_id: lead.id,
          valor_proposto: validado.data.valor,
          validade: validade || undefined,
        });
        id = nova.id;
        setPropostaId(id); // Retry reaproveita a proposta, mesmo se o upload falhar.
      }
      await versoes.adicionar.mutateAsync({
        propostaId: id,
        arquivo: arquivo!,
        valor: validado.data.valor,
        validade: validade || null,
        condicoes,
        motivo,
      });
      setAberto(false);
      toast.success("PDF da proposta salvo");
    } catch {
      setErro(
        "Não foi possível salvar o PDF. Confira o arquivo e tente novamente; a proposta cadastrada será reaproveitada."
      );
    } finally {
      envioEmCurso.current = false;
      setSalvando(false);
    }
  };
  return (
    <section aria-label="PDFs das propostas" className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Propostas em PDF</h3>
        {podeEditar && (
          <Button size="sm" variant="outline" onClick={() => abrir(null)}>
            <FilePlus2 className="mr-1.5 h-4 w-4" />
            Adicionar proposta em PDF
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Guarde o PDF que você já utiliza e preserve cada revisão. Salvar não envia ao cliente nem publica no portal.
      </p>
      {versoes.isError && (
        <div role="alert" className="text-sm">
          Não foi possível carregar os PDFs.
          <Button variant="ghost" onClick={() => void versoes.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {propostas.length === 0 && (
        <p className="py-3 text-center text-xs text-muted-foreground">Nenhuma proposta em PDF ainda.</p>
      )}
      {propostas.map((p) => {
        const historico = (versoes.data ?? []).filter((v) => v.proposta_id === p.id);
        return (
          <div key={p.id} className="space-y-2 border-t pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{p.titulo}</span>
              {podeEditar && !["aceita", "recusada"].includes(p.status) && (
                <Button size="sm" variant="ghost" onClick={() => abrir(p.id)}>
                  {historico.length ? "Adicionar revisão" : "Anexar PDF"}
                </Button>
              )}
            </div>
            {versoes.isLoading && (
              <p role="status" className="text-xs text-muted-foreground">
                Carregando revisões…
              </p>
            )}
            {!versoes.isLoading && historico.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem PDF anexado.</p>
            )}
            {historico.map((v, i) => (
              <article key={v.id} className="space-y-1.5 rounded-md border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Versão {v.numero}</Badge>
                  {i === 0 && <span className="text-xs text-muted-foreground">Mais recente</span>}
                  <span className="text-sm font-medium">{formatCurrency(v.valor_proposto)}</span>
                </div>
                <p className="break-all text-xs">{v.nome_arquivo}</p>
                <p className="text-xs text-muted-foreground">
                  Adicionada em {formatDateTime(v.created_at)}
                  {v.validade ? ` · Validade ${formatDate(v.validade)}` : ""}
                </p>
                {v.condicoes_pagamento && <p className="whitespace-pre-wrap text-xs">{v.condicoes_pagamento}</p>}
                {v.motivo_revisao && (
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">Revisão: {v.motivo_revisao}</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => void versoes.baixar(v.arquivo_path, v.nome_arquivo)}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Baixar PDF
                  </Button>
                  {v.enviado_em ? (
                    <span className="text-xs text-muted-foreground">
                      Envio registrado em {formatDateTime(v.enviado_em)}
                    </span>
                  ) : (
                    podeEditar && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={versoes.registrarEnvio.isPending}
                        onClick={() => versoes.registrarEnvio.mutate(v.id)}
                      >
                        Registrar envio externo
                      </Button>
                    )
                  )}
                </div>
                <PropostaLinkVersao
                  versao={v}
                  podePublicar={podeEditar && i === 0 && ["rascunho", "enviada"].includes(p.status)}
                  podeRevogar={podeEditar}
                />
              </article>
            ))}
          </div>
        );
      })}
      <FormDialog
        open={aberto}
        onOpenChange={(open) => {
          if (!salvando) setAberto(open);
        }}
        title={propostaId ? "Anexar PDF à proposta" : "Adicionar proposta em PDF"}
        description="O documento será guardado no histórico desta negociação. Não será enviado ao cliente."
        size="lg"
        onSubmit={() => void salvar()}
        isPending={salvando}
        submitLabel="Salvar PDF"
      >
        <div className="space-y-4">
          {!propostaId && (
            <div className="space-y-1.5">
              <Label htmlFor="pdf-titulo">Título</Label>
              <Input id="pdf-titulo" value={titulo} maxLength={200} onChange={(e) => setTitulo(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pdf-arquivo">Arquivo PDF (até 15 MB)</Label>
            <Input
              id="pdf-arquivo"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pdf-valor">Valor</Label>
              <MoneyInput id="pdf-valor" value={valor} onChange={setValor} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdf-validade">Validade</Label>
              <DatePicker id="pdf-validade" value={validade} onChange={setValidade} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdf-condicoes">Condições de pagamento</Label>
            <Textarea
              id="pdf-condicoes"
              value={condicoes}
              maxLength={10000}
              onChange={(e) => setCondicoes(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdf-motivo">Motivo da revisão</Label>
            <Input id="pdf-motivo" value={motivo} maxLength={2000} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          {erro && (
            <p role="alert" className="text-sm text-danger-strong">
              {erro}
            </p>
          )}
        </div>
      </FormDialog>
    </section>
  );
}
