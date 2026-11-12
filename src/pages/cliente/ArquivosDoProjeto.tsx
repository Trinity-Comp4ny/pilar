import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Download, ExternalLink, File, Folder, FolderOpen, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { toDataSourceResult } from "@/types/dataSource";
import { formatBytes, formatDateTime } from "@/lib/format";
import { getSafeErrorMessage } from "@/lib/safeError";
import { baixarArquivoPortal, ehPastaPortal, listarArquivosPortal, type ArquivoPortal } from "./portalArquivos";

/**
 * Arquivos que o escritório deixou na pasta do cliente no Google Drive (SPEC 163) e os
 * links do projeto marcados para o cliente (SPEC 164). Sem nenhum dos dois, o bloco não
 * aparece.
 */
export function ArquivosDoProjeto({ projetoId }: { projetoId: string }) {
  const [pastaId, setPastaId] = useState<string | undefined>(undefined);
  const consulta = useQuery({
    queryKey: ["portal-arquivos", projetoId, pastaId ?? "raiz"],
    queryFn: () => listarArquivosPortal(projetoId, pastaId),
    staleTime: 30 * 1000,
    retry: false,
  });

  const links = pastaId ? [] : (consulta.data?.links ?? []);
  const temPasta = !!consulta.data?.pasta;
  // Na raiz: só mostra o card quando há pasta ou link. Dentro de uma subpasta, sempre.
  if (!pastaId && (consulta.isLoading || consulta.isError || (!temPasta && links.length === 0))) return null;

  const caminho = consulta.data?.caminho ?? [];
  const baixar = (a: ArquivoPortal) =>
    baixarArquivoPortal(projetoId, a).catch((e) =>
      toast.error("Não foi possível baixar", { description: getSafeErrorMessage(e, a.name) })
    );

  const colunas: ColumnDef<ArquivoPortal>[] = [
    {
      key: "nome",
      header: "Nome",
      mobile: "title",
      getSortValue: (a) => `${ehPastaPortal(a) ? 0 : 1}${a.name.toLowerCase()}`,
      cell: (a) => (
        <span className="flex min-w-0 items-center gap-2">
          {ehPastaPortal(a) ? (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <File className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{a.name}</span>
        </span>
      ),
    },
    {
      key: "tamanho",
      header: "Tamanho",
      align: "end",
      mobile: "trailing",
      getSortValue: (a) => Number(a.size ?? 0),
      cell: (a) => <span className="text-muted-foreground">{ehPastaPortal(a) ? "-" : formatBytes(a.size)}</span>,
    },
    {
      key: "modificado",
      header: "Atualizado",
      mobile: "subtitle",
      getSortValue: (a) => a.modifiedTime ?? "",
      cell: (a) => <span className="text-muted-foreground">{formatDateTime(a.modifiedTime)}</span>,
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      align: "end",
      cell: (a) =>
        ehPastaPortal(a) ? null : (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Baixar ${a.name}`}
            onClick={(e) => {
              e.stopPropagation();
              void baixar(a);
            }}
          >
            <Download className="h-4 w-4" />
          </Button>
        ),
    },
  ];

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-ink">Arquivos do projeto</p>
        </div>

        {links.length > 0 && (
          <ul className="space-y-1" aria-label="Links do projeto">
            {links.map((l, i) => (
              <li key={`${l.url}-${i}`}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-muted/50"
                >
                  <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{l.rotulo || l.url}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
        )}

        {(pastaId || temPasta) && caminho.length > 1 && (
          <nav aria-label="Caminho da pasta" className="flex flex-wrap items-center gap-1 text-sm">
            {caminho.map((p, idx) => (
              <span key={p.id} className="flex items-center gap-1">
                {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                {idx === caminho.length - 1 ? (
                  <span className="font-medium text-ink">{p.nome}</span>
                ) : (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-ink hover:underline"
                    onClick={() => setPastaId(idx === 0 ? undefined : p.id)}
                  >
                    {p.nome}
                  </button>
                )}
              </span>
            ))}
          </nav>
        )}

        {(pastaId || temPasta) && (
          <DataTable
            columns={colunas}
            data={toDataSourceResult<ArquivoPortal>({
              data: consulta.data?.itens,
              isLoading: consulta.isLoading,
              error: consulta.error,
            })}
            rowKey={(a) => a.id}
            onRowClick={(a) => (ehPastaPortal(a) ? setPastaId(a.id) : void baixar(a))}
            rowLabel={(a) => (ehPastaPortal(a) ? `Abrir a pasta ${a.name}` : `Baixar ${a.name}`)}
            defaultSortKey="nome"
            emptyMessage="O escritório ainda não compartilhou arquivos aqui."
            errorTitle="Não foi possível abrir os arquivos"
          />
        )}
      </CardContent>
    </Card>
  );
}
