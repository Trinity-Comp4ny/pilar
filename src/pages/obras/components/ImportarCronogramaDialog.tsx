import { useRef, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { useImportarCronograma } from "@/pages/obras/hooks/useImportarCronograma";
import {
  lerCsv,
  MODELO_CRONOGRAMA_CSV,
  planejarImportacao,
  type Celula,
  type PlanoImportacao,
} from "@/pages/obras/lib/importarCronograma";

const LIMITE_BYTES = 5 * 1024 * 1024;

async function lerPlanilha(arquivo: File): Promise<Celula[][]> {
  // CSV não passa pelo leitor de Excel: ele lê 01/03/2026 como 3 de janeiro.
  if (/\.csv$/i.test(arquivo.name)) return lerCsv(await arquivo.text());
  const XLSX = await import("xlsx");
  const buffer = await arquivo.arrayBuffer();
  const livro = XLSX.read(buffer, { type: "array", cellDates: true });
  const aba = livro.Sheets[livro.SheetNames[0]];
  if (!aba) return [];
  return XLSX.utils.sheet_to_json<Celula[]>(aba, { header: 1, raw: true, defval: "" });
}

function baixarModelo() {
  // BOM para o Excel abrir o UTF-8 com acento.
  const blob = new Blob(["﻿" + MODELO_CRONOGRAMA_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-cronograma-obra.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/** Importa o cronograma (fase, etapa, serviço, tarefa) de uma planilha Excel ou CSV. */
export function ImportarCronogramaDialog({
  open,
  onOpenChange,
  obraId,
  projetoId,
  fasesExistentes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  projetoId: string | null;
  fasesExistentes: number;
}) {
  const importar = useImportarCronograma(obraId, projetoId, fasesExistentes);
  const entrada = useRef<HTMLInputElement>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [plano, setPlano] = useState<PlanoImportacao | null>(null);
  const [lendo, setLendo] = useState(false);

  const fechar = (v: boolean) => {
    if (!v) {
      setNomeArquivo(null);
      setPlano(null);
    }
    onOpenChange(v);
  };

  const escolher = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    if (arquivo.size > LIMITE_BYTES) {
      toast.error("Arquivo grande demais", { description: "O limite é 5 MB." });
      return;
    }
    setLendo(true);
    setNomeArquivo(arquivo.name);
    try {
      setPlano(planejarImportacao(await lerPlanilha(arquivo)));
    } catch {
      setPlano({ itens: [], tarefas: [], avisos: [], erro: "Não deu para ler esse arquivo. Use .xlsx, .xls ou .csv." });
    } finally {
      setLendo(false);
    }
  };

  const confirmar = async () => {
    if (!plano || plano.erro) return;
    try {
      const r = await importar.mutateAsync(plano);
      toast.success("Cronograma importado", { description: `${r.nos} itens e ${r.tarefas} tarefas.` });
      fechar(false);
    } catch (e) {
      toast.error("Não foi possível importar", { description: e instanceof Error ? e.message : "Tente de novo." });
    }
  };

  const conta = (n: ItemNivel) => plano?.itens.filter((i) => i.nivel === n).length ?? 0;
  type ItemNivel = "fase" | "etapa" | "servico";

  return (
    <FormDialog
      open={open}
      onOpenChange={fechar}
      title="Importar cronograma"
      description="Suba uma planilha com as colunas Fase, Etapa, Serviço, Tarefa, Início e Fim. Célula vazia herda a de cima."
      size="md"
      submitLabel="Importar"
      onSubmit={() => void confirmar()}
      isPending={importar.isPending}
      submitDisabled={!plano || !!plano.erro}
    >
      <div className="space-y-4">
        <input
          ref={entrada}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          aria-label="Planilha do cronograma"
          onChange={(e) => {
            void escolher(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => entrada.current?.click()} loading={lendo}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {nomeArquivo ?? "Escolher planilha"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={baixarModelo}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Baixar modelo
          </Button>
        </div>

        {plano?.erro && (
          <div role="alert" className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger-strong">
            {plano.erro}
          </div>
        )}

        {plano && !plano.erro && (
          <div className="space-y-3">
            <p className="text-sm text-ink">
              Vai entrar: {conta("fase")} {conta("fase") === 1 ? "fase" : "fases"}, {conta("etapa")}{" "}
              {conta("etapa") === 1 ? "etapa" : "etapas"}, {conta("servico")}{" "}
              {conta("servico") === 1 ? "serviço" : "serviços"} e {plano.tarefas.length}{" "}
              {plano.tarefas.length === 1 ? "tarefa" : "tarefas"}.
            </p>
            <p className="text-xs text-muted-foreground">
              O que entra vem depois do que a obra já tem. Nada existente é alterado.
            </p>
            {plano.avisos.length > 0 && (
              <div className="rounded-xl bg-warning-soft px-3 py-2.5 text-xs text-warning-strong">
                <p className="mb-1 font-medium">
                  {plano.avisos.length} {plano.avisos.length === 1 ? "aviso" : "avisos"}
                </p>
                <ul className="max-h-28 space-y-0.5 overflow-y-auto">
                  {plano.avisos.slice(0, 20).map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                  {plano.avisos.length > 20 && <li>E mais {plano.avisos.length - 20}.</li>}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </FormDialog>
  );
}
