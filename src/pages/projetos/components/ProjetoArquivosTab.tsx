import { RowActions } from "@/components/data/RowActions";
import { useRef, useState, type DragEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Download,
  ExternalLink,
  File,
  Folder,
  FolderOpen,
  FolderPlus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { FormDialog } from "@/components/FormDialog";
import { BusyMark } from "@/components/motion/BusyMark";
import { PageLoader } from "@/components/motion/PageLoader";
import { useAcaoPendente } from "@/hooks/useAcaoPendente";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { toDataSourceResult } from "@/types/dataSource";
import { usePermissions } from "@/hooks/usePermissions";
import { useConteudoDaPasta, usePastaDoProjeto, useStatusDrive } from "@/hooks/useGoogleDrive";
import {
  baixarArquivo,
  conectarGoogleDrive,
  criarPasta,
  ehPasta,
  enviarArquivo,
  ErroDrive,
  moverParaLixeira,
  type ItemDrive,
  type PastaDrive,
} from "@/lib/googleDrive";
import { formatBytes, formatDateTime } from "@/lib/format";
import { getSafeErrorMessage } from "@/lib/safeError";
import { LinksDoProjeto } from "./LinksDoProjeto";

interface ProjetoArquivosTabProps {
  projetoId: string;
  canEdit: boolean;
}

/** preparando: pedindo o link de envio ao Drive; enviando: bytes subindo; finalizando: 100% enviado, esperando o Drive confirmar. */
type FaseEnvio = "preparando" | "enviando" | "finalizando";

interface Envio {
  id: string;
  nome: string;
  progresso: number;
  fase: FaseEnvio;
}

const faseDoProgresso = (p: number): FaseEnvio => (p >= 1 ? "finalizando" : p > 0 ? "enviando" : "preparando");

const textoDaFase = (e: Envio) =>
  e.fase === "preparando"
    ? "Preparando…"
    : e.fase === "finalizando"
      ? "Finalizando no Drive…"
      : `${Math.round(e.progresso * 100)}%`;

const linkDaPasta = (id: string) => `https://drive.google.com/drive/folders/${id}`;

/**
 * Aba Arquivos do projeto: a pasta no Google Drive do escritório (SPEC 163) e os links do
 * projeto, que vão ao portal quando marcados (SPEC 164). Sem Drive, ficam os links e o
 * convite fixo para conectar.
 */
export function ProjetoArquivosTab({ projetoId, canEdit }: ProjetoArquivosTabProps) {
  return (
    <div className="space-y-4">
      <ArquivosDoDrive projetoId={projetoId} canEdit={canEdit} />
      <LinksDoProjeto projetoId={projetoId} canEdit={canEdit} />
    </div>
  );
}

/** Convite fixo para conectar o Drive enquanto o escritório não conectou. */
function ConectarDrive({ isAdmin }: { isAdmin: boolean }) {
  const [conectando, setConectando] = useState(false);
  const conectar = async () => {
    setConectando(true);
    try {
      await conectarGoogleDrive();
    } catch (e) {
      setConectando(false);
      toast.error("Não foi possível conectar", { description: getSafeErrorMessage(e, "Tente de novo.") });
    }
  };
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
        <FolderOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-semibold text-ink">Conecte o Google Drive</p>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Cada projeto ganha uma pasta no Drive do escritório, uma por disciplina e uma que o cliente vê no portal. A equipe envia e baixa daqui. Enquanto isso, use os links abaixo."
              : "Os arquivos do projeto aparecem aqui quando o admin do escritório conectar o Google Drive. Enquanto isso, use os links abaixo."}
          </p>
        </div>
        {isAdmin && (
          <Button variant="brand" onClick={conectar} loading={conectando} className="shrink-0">
            Conectar Google Drive
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ArquivosDoDrive({ projetoId, canEdit }: ProjetoArquivosTabProps) {
  const { isAdmin } = usePermissions();
  const status = useStatusDrive();
  const conectado = !!status.data?.conectado;
  const pasta = usePastaDoProjeto(projetoId, conectado);

  if (status.isLoading) return <PageLoader />;

  if (!conectado) return <ConectarDrive isAdmin={isAdmin} />;

  if (pasta.isLoading) return <PageLoader label="Abrindo a pasta do projeto" />;

  if (pasta.error) {
    const reconectar = pasta.error instanceof ErroDrive && pasta.error.codigo === "reconectar";
    return (
      <Card>
        <EmptyState
          icon={FolderOpen}
          title={reconectar ? "A conexão com o Google Drive expirou" : "Não foi possível abrir a pasta"}
          description={
            reconectar
              ? isAdmin
                ? "Conecte de novo para a equipe voltar a ver os arquivos."
                : "Peça ao admin do escritório para conectar o Google Drive de novo."
              : getSafeErrorMessage(pasta.error, "Tente de novo em instantes.")
          }
          action={
            reconectar && isAdmin
              ? { label: "Conectar de novo", variant: "brand", onClick: () => void conectarGoogleDrive() }
              : { label: "Tentar de novo", variant: "outline", onClick: () => void pasta.refetch() }
          }
        />
      </Card>
    );
  }

  const raiz = pasta.data?.raiz;
  if (!raiz) {
    return (
      <Card>
        <EmptyState
          icon={FolderOpen}
          title="A pasta deste projeto ainda não existe"
          description="Ela é criada quando alguém que edita o projeto abre esta aba."
        />
      </Card>
    );
  }

  return <NavegadorDePastas raiz={raiz} pastas={pasta.data?.pastas ?? []} canEdit={canEdit} />;
}

function NavegadorDePastas({ raiz, pastas, canEdit }: { raiz: PastaDrive; pastas: PastaDrive[]; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [caminho, setCaminho] = useState<{ id: string; nome: string }[]>([{ id: raiz.pasta_id, nome: raiz.nome }]);
  const atual = caminho[caminho.length - 1];
  const conteudo = useConteudoDaPasta(atual.id);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [novaPastaAberta, setNovaPastaAberta] = useState(false);
  const [nomeNovaPasta, setNomeNovaPasta] = useState("");
  const [criando, setCriando] = useState(false);
  const [excluir, setExcluir] = useState<ItemDrive | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const { executar, pendente } = useAcaoPendente();
  const inputRef = useRef<HTMLInputElement>(null);

  const pastaDeDisciplina = new Set(pastas.filter((p) => p.projeto_disciplina_id).map((p) => p.pasta_id));
  const pastaDoCliente = pastas.find((p) => p.para_cliente)?.pasta_id;
  // Pastas fixas do projeto (disciplinas e Cliente) não vão para a lixeira.
  const pastaFixa = (id: string) => pastaDeDisciplina.has(id) || id === pastaDoCliente;
  const dentroDaPastaDoCliente = !!pastaDoCliente && caminho.some((p) => p.id === pastaDoCliente);
  // dragenter/dragleave disparam a cada elemento filho: o contador evita o aviso piscar.
  const profundidadeArraste = useRef(0);
  const recarregar = () => queryClient.invalidateQueries({ queryKey: ["google-drive-pasta", atual.id] });

  const abrir = (item: ItemDrive) => {
    if (ehPasta(item)) setCaminho((c) => [...c, { id: item.id, nome: item.name }]);
  };

  const enviar = async (arquivos: FileList | File[]) => {
    const lista = Array.from(arquivos);
    if (!lista.length) return;
    const destino = atual.id;
    let enviados = 0;
    await Promise.all(
      lista.map(async (arquivo) => {
        const id = `${arquivo.name}-${arquivo.size}-${Math.random()}`;
        setEnvios((e) => [...e, { id, nome: arquivo.name, progresso: 0, fase: "preparando" }]);
        try {
          await enviarArquivo(destino, arquivo, (p) =>
            setEnvios((e) => e.map((x) => (x.id === id ? { ...x, progresso: p, fase: faseDoProgresso(p) } : x)))
          );
          enviados++;
        } catch (e) {
          toast.error("Envio não concluído", { description: getSafeErrorMessage(e, arquivo.name) });
        } finally {
          setEnvios((e) => e.filter((x) => x.id !== id));
        }
      })
    );
    if (enviados) toast.success(enviados === 1 ? "Arquivo enviado" : `${enviados} arquivos enviados`);
    queryClient.invalidateQueries({ queryKey: ["google-drive-pasta", destino] });
  };

  const criar = async () => {
    const nome = nomeNovaPasta.trim();
    if (!nome) return;
    setCriando(true);
    try {
      await criarPasta(atual.id, nome);
      setNovaPastaAberta(false);
      setNomeNovaPasta("");
      recarregar();
    } catch (e) {
      toast.error("Não foi possível criar a pasta", { description: getSafeErrorMessage(e, "Tente de novo.") });
    } finally {
      setCriando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    setExcluindo(true);
    try {
      await moverParaLixeira(excluir.id);
      toast.success("Foi para a lixeira do Drive", { description: "Dá para restaurar pelo Google Drive por 30 dias." });
      setExcluir(null);
      recarregar();
    } catch (e) {
      toast.error("Não foi possível excluir", { description: getSafeErrorMessage(e, "Tente de novo.") });
    } finally {
      setExcluindo(false);
    }
  };

  const baixar = (item: ItemDrive) =>
    executar(item.id, () =>
      baixarArquivo(item).catch((e) =>
        toast.error("Não foi possível baixar", { description: getSafeErrorMessage(e, item.name) })
      )
    );

  const colunas: ColumnDef<ItemDrive>[] = [
    {
      key: "nome",
      header: "Nome",
      mobile: "title",
      getSortValue: (i) => `${ehPasta(i) ? 0 : 1}${i.name.toLowerCase()}`,
      cell: (i) => (
        <span className="flex min-w-0 items-center gap-2">
          {ehPasta(i) ? (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <File className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{i.name}</span>
          {pastaDeDisciplina.has(i.id) && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              disciplina
            </span>
          )}
          {i.id === pastaDoCliente && (
            <span className="shrink-0 rounded-full bg-brand/20 px-2 py-0.5 text-[11px] text-ink">
              aparece no portal do cliente
            </span>
          )}
        </span>
      ),
    },
    {
      key: "tamanho",
      header: "Tamanho",
      align: "end",
      mobile: "trailing",
      getSortValue: (i) => Number(i.size ?? 0),
      cell: (i) => <span className="text-muted-foreground">{ehPasta(i) ? "-" : formatBytes(i.size)}</span>,
    },
    {
      key: "modificado",
      header: "Modificado",
      mobile: "subtitle",
      getSortValue: (i) => i.modifiedTime ?? "",
      cell: (i) => <span className="text-muted-foreground">{formatDateTime(i.modifiedTime)}</span>,
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      align: "end",
      cell: (i) => (
        <RowActions
          label={i.name}
          actions={[
            { label: "Baixar", icon: Download, hidden: ehPasta(i), disabled: pendente(i.id), onClick: () => baixar(i) },
            {
              label: "Abrir no Drive",
              icon: ExternalLink,
              hidden: !i.webViewLink,
              onClick: () => window.open(i.webViewLink, "_blank", "noopener,noreferrer"),
            },
            {
              label: "Excluir",
              icon: Trash2,
              destructive: true,
              hidden: !canEdit || pastaFixa(i.id),
              onClick: () => setExcluir(i),
            },
          ]}
        />
      ),
    },
  ];

  const temArquivo = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  const aoSoltar = (e: DragEvent) => {
    e.preventDefault();
    profundidadeArraste.current = 0;
    setArrastando(false);
    if (canEdit && e.dataTransfer.files.length) void enviar(e.dataTransfer.files);
  };

  return (
    <Card
      onDragEnter={(e) => {
        if (!canEdit || !temArquivo(e)) return;
        e.preventDefault();
        profundidadeArraste.current += 1;
        setArrastando(true);
      }}
      onDragOver={(e) => {
        if (!canEdit || !temArquivo(e)) return;
        e.preventDefault();
      }}
      onDragLeave={() => {
        profundidadeArraste.current = Math.max(0, profundidadeArraste.current - 1);
        if (profundidadeArraste.current === 0) setArrastando(false);
      }}
      onDrop={aoSoltar}
      className="relative"
    >
      {arrastando && (
        <div
          role="status"
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[inherit] border-2 border-dashed border-brand bg-background/90"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand">
            <Upload className="h-5 w-5 text-ink" />
          </span>
          <p className="text-sm font-medium text-ink">Solte para enviar</p>
          <p className="text-xs text-muted-foreground">Os arquivos vão para a pasta {atual.nome}</p>
        </div>
      )}
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Caminho da pasta" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
            {caminho.map((p, idx) => (
              <span key={p.id} className="flex items-center gap-1">
                {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                {idx === caminho.length - 1 ? (
                  <span className="font-medium text-ink">{p.nome}</span>
                ) : (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-ink hover:underline"
                    onClick={() => setCaminho((c) => c.slice(0, idx + 1))}
                  >
                    {p.nome}
                  </button>
                )}
              </span>
            ))}
          </nav>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={linkDaPasta(atual.id)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Abrir no Drive
              </a>
            </Button>
            {canEdit && (
              <>
                <Button variant="outline" size="sm" onClick={() => setNovaPastaAberta(true)}>
                  <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
                  Nova pasta
                </Button>
                <Button variant="brand" size="sm" loading={envios.length > 0} onClick={() => inputRef.current?.click()}>
                  {envios.length === 0 && <Upload className="mr-1.5 h-3.5 w-3.5" />}
                  {envios.length > 0 ? "Enviando…" : "Enviar arquivos"}
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  hidden
                  data-testid="arquivos-input"
                  onChange={(e) => {
                    if (e.target.files) void enviar(e.target.files);
                    e.target.value = "";
                  }}
                />
              </>
            )}
          </div>
        </div>

        {dentroDaPastaDoCliente && (
          <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-ink">
            O cliente vê esta pasta no portal e pode baixar o que estiver aqui.
          </p>
        )}

        {envios.length > 0 && (
          <div role="status" className="space-y-3 rounded-lg border border-brand/40 bg-brand/10 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <BusyMark className="h-4 w-4" />
              {envios.length === 1
                ? "Enviando 1 arquivo para o Drive…"
                : `Enviando ${envios.length} arquivos para o Drive…`}
            </p>
            <ul className="space-y-2" aria-label="Envios em andamento">
              {envios.map((e) => (
                <li key={e.id} className="space-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="truncate">{e.nome}</span>
                    <span className="shrink-0 text-muted-foreground">{textoDaFase(e)}</span>
                  </div>
                  <Progress value={e.progresso * 100} className="h-2" indicatorClassName="bg-brand" />
                </li>
              ))}
            </ul>
          </div>
        )}

        <DataTable
          columns={colunas}
          data={toDataSourceResult<ItemDrive>({
            data: conteudo.data?.itens,
            isLoading: conteudo.isLoading,
            error: conteudo.error,
          })}
          rowKey={(i) => i.id}
          onRowClick={abrir}
          rowLabel={(i) => (ehPasta(i) ? `Abrir a pasta ${i.name}` : i.name)}
          defaultSortKey="nome"
          emptyMessage={canEdit ? "Pasta vazia. Arraste arquivos para cá ou use Enviar arquivos." : "Pasta vazia."}
          errorTitle="Não foi possível listar a pasta"
        />
      </CardContent>

      <FormDialog
        open={novaPastaAberta}
        onOpenChange={setNovaPastaAberta}
        title="Nova pasta"
        size="sm"
        onSubmit={criar}
        submitLabel="Criar pasta"
        isPending={criando}
        submitDisabled={!nomeNovaPasta.trim()}
      >
        <div className="space-y-2">
          <Label htmlFor="nova-pasta-nome">Nome</Label>
          <Input
            id="nova-pasta-nome"
            autoFocus
            value={nomeNovaPasta}
            onChange={(e) => setNomeNovaPasta(e.target.value)}
            placeholder="Ex.: Revisão 2"
          />
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!excluir}
        onOpenChange={(o) => !o && setExcluir(null)}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        variant="destructive"
        title="Mandar para a lixeira?"
        itemName={excluir?.name}
        description="Vai para a lixeira do Google Drive. Dá para restaurar por lá durante 30 dias."
        confirmText="Excluir"
      />
    </Card>
  );
}
