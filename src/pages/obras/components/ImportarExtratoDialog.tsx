import { useMemo, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency, formatDate } from "@/lib/format";
import { useSaveAporte, useSaveDespesa, type ObraLancamentoRow } from "@/pages/obras/hooks/useObraConta";
import { planejarOfx, type PlanoOfx } from "@/pages/obras/lib/importarOfx";

const LIMITE_BYTES = 5 * 1024 * 1024;

/** Importa o extrato do banco (.ofx): crédito vira aporte, débito vira despesa. */
export function ImportarExtratoDialog({
  open,
  onOpenChange,
  obraId,
  lancamentos,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  lancamentos: ObraLancamentoRow[];
}) {
  const aporte = useSaveAporte(obraId);
  const despesa = useSaveDespesa(obraId);
  const entrada = useRef<HTMLInputElement>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [plano, setPlano] = useState<PlanoOfx | null>(null);
  const [fora, setFora] = useState<Set<string>>(new Set());
  const [gravando, setGravando] = useState(false);

  const fechar = (v: boolean) => {
    if (!v) {
      setNomeArquivo(null);
      setPlano(null);
      setFora(new Set());
    }
    onOpenChange(v);
  };

  const escolher = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    if (arquivo.size > LIMITE_BYTES) {
      toast.error("Arquivo grande demais", { description: "O limite é 5 MB." });
      return;
    }
    setNomeArquivo(arquivo.name);
    const p = planejarOfx(
      await arquivo.text(),
      lancamentos.map((l) => ({ tipo: l.tipo, data: l.data, valor: l.valor }))
    );
    setPlano(p);
    // Duplicadas começam desmarcadas.
    setFora(new Set(p.linhas.filter((l) => l.duplicada).map((l) => l.fitid)));
  };

  const marcadas = useMemo(() => (plano?.linhas ?? []).filter((l) => !fora.has(l.fitid)), [plano, fora]);

  const alternar = (fitid: string) =>
    setFora((atual) => {
      const novo = new Set(atual);
      if (novo.has(fitid)) novo.delete(fitid);
      else novo.add(fitid);
      return novo;
    });

  const confirmar = async () => {
    if (marcadas.length === 0) return;
    setGravando(true);
    let feitas = 0;
    try {
      // Um por vez: a despesa passa pelo RPC que cria a taxa de administração.
      for (const l of marcadas) {
        if (l.tipo === "aporte") {
          await aporte.mutateAsync({ data: l.data, descricao: l.descricao, valor: l.valorAbs });
        } else {
          await despesa.mutateAsync({ data: l.data, descricao: l.descricao, valor: l.valorAbs });
        }
        feitas += 1;
      }
      toast.success("Extrato importado", { description: `${feitas} lançamentos na conta.` });
      fechar(false);
    } catch (e) {
      toast.error("A importação parou no meio", {
        description: `${feitas} de ${marcadas.length} entraram. ${e instanceof Error ? e.message : "Tente de novo."}`,
      });
    } finally {
      setGravando(false);
    }
  };

  const totalAportes = marcadas.filter((l) => l.tipo === "aporte").reduce((a, l) => a + l.valorAbs, 0);
  const totalDespesas = marcadas.filter((l) => l.tipo === "despesa").reduce((a, l) => a + l.valorAbs, 0);

  return (
    <FormDialog
      open={open}
      onOpenChange={fechar}
      title="Importar extrato"
      description="Suba o arquivo .ofx do banco. Entrada vira aporte, saída vira despesa. Você confere antes de gravar."
      size="lg"
      submitLabel={marcadas.length > 0 ? `Importar ${marcadas.length}` : "Importar"}
      onSubmit={() => void confirmar()}
      isPending={gravando}
      submitDisabled={!plano || !!plano.erro || marcadas.length === 0}
    >
      <div className="space-y-4">
        <input
          ref={entrada}
          type="file"
          accept=".ofx,.OFX"
          className="sr-only"
          aria-label="Extrato OFX"
          onChange={(e) => {
            void escolher(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" onClick={() => entrada.current?.click()}>
          <FileUp className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {nomeArquivo ?? "Escolher extrato"}
        </Button>

        {plano?.erro && (
          <div role="alert" className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger-strong">
            {plano.erro}
          </div>
        )}

        {plano && !plano.erro && (
          <div className="space-y-3">
            <p className="text-sm text-ink">
              {marcadas.length} de {plano.linhas.length} movimentações vão entrar: {formatCurrency(totalAportes)} em
              aportes e {formatCurrency(totalDespesas)} em despesas.
            </p>
            {plano.linhas.some((l) => l.duplicada) && (
              <p className="text-xs text-muted-foreground">
                As que já estão na conta (mesma data, tipo e valor) vêm desmarcadas.
              </p>
            )}
            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {plano.linhas.map((l) => (
                <li key={l.fitid} className="flex items-center gap-3 px-3 py-2">
                  <Checkbox
                    checked={!fora.has(l.fitid)}
                    onCheckedChange={() => alternar(l.fitid)}
                    aria-label={`Importar ${l.descricao}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{l.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(l.data)} · {l.tipo === "aporte" ? "Aporte" : "Despesa"}
                      {l.duplicada ? " · já está na conta" : ""}
                    </p>
                  </div>
                  <span className={l.tipo === "aporte" ? "text-sm text-success-strong" : "text-sm text-ink"}>
                    {l.tipo === "aporte" ? "+" : "-"}
                    {formatCurrency(l.valorAbs)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </FormDialog>
  );
}
