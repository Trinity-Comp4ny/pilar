import { useEffect, useMemo, useState } from "react";
import { Eye, Lock, Mic, Pencil, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AvatarStack } from "@/components/AvatarStack";
import { BusyMark } from "@/components/motion/BusyMark";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { chipsDoExtraido, formatarDuracao, mensagemDoErro, rotuloDoDia, type TomChip } from "@/lib/registrosObra";
import { cn } from "@/lib/utils";
import {
  BUCKET_AUDIO_REGISTRO,
  BUCKET_FOTO_REGISTRO,
  assinarArquivos,
  useAtualizarRegistro,
  useExcluirRegistro,
  useObraRegistros,
  useReprocessarRegistro,
  type ObraRegistro,
} from "@/pages/obras/hooks/useObraRegistros";

const TOM_CHIP: Record<TomChip, string> = {
  neutro: "bg-muted text-ink-soft",
  positivo: "bg-positive/10 text-positive-strong",
  atencao: "bg-warning-soft text-warning-strong",
};

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/**
 * Timeline de registros da obra (SPEC 135, fase A): o que a equipe gravou, fotografou ou
 * escreveu pelo Pilar Campo, por dia, já organizado pela IA. O gestor ouve o áudio original,
 * corrige o texto, libera para o cliente ou apaga. O resumo do dia e o fechamento do RDO
 * são a fase B.
 */
export function ObraRegistrosTimeline({ obraId, canEdit }: { obraId: string; canEdit: boolean }) {
  const { data: registros = [], isLoading, error } = useObraRegistros(obraId);

  const dias = useMemo(() => {
    const grupos: Array<{ data: string; registros: ObraRegistro[] }> = [];
    for (const r of registros) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo?.data === r.data_registro) ultimo.registros.push(r);
      else grupos.push({ data: r.data_registro, registros: [r] });
    }
    return grupos;
  }, [registros]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    );
  }
  if (error) {
    return (
      <EmptyState
        title="Não deu para carregar os registros"
        description="Atualize a página. Se continuar, avise o suporte."
      />
    );
  }
  if (registros.length === 0) {
    return (
      <EmptyState
        icon={Mic}
        iconTone="brand"
        title="Nenhum registro ainda"
        description="Quem está na obra grava, fotografa ou escreve pelo Pilar Campo, e aparece aqui já organizado."
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {dias.map((d) => (
        <section key={d.data} className="space-y-3" aria-label={rotuloDoDia(d.data)}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {rotuloDoDia(d.data)} · {d.registros.length} {d.registros.length === 1 ? "registro" : "registros"}
          </h3>
          {d.registros.map((r) => (
            <CartaoDoRegistro key={r.id} registro={r} obraId={obraId} canEdit={canEdit} />
          ))}
        </section>
      ))}
    </div>
  );
}

function CartaoDoRegistro({
  registro: r,
  obraId,
  canEdit,
}: {
  registro: ObraRegistro;
  obraId: string;
  canEdit: boolean;
}) {
  const atualizar = useAtualizarRegistro(obraId);
  const excluir = useExcluirRegistro(obraId);
  const reprocessar = useReprocessarRegistro(obraId);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [fotoUrls, setFotoUrls] = useState<string[]>([]);

  const organizando = r.status === "enviado" || r.status === "organizando";
  const textoAtual = r.texto_organizado ?? r.texto_bruto;
  const chips = chipsDoExtraido(r.extraido);

  // As fotos aparecem junto do card; só o áudio espera o clique em "Ouvir".
  const chaveFotos = r.fotos.join("|");
  useEffect(() => {
    let vivo = true;
    if (r.fotos.length === 0) {
      setFotoUrls([]);
      return;
    }
    assinarArquivos(BUCKET_FOTO_REGISTRO, r.fotos)
      .then((urls) => vivo && setFotoUrls(urls))
      .catch(() => vivo && setFotoUrls([]));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveFotos]);

  const ouvir = async () => {
    if (!r.audio_path) return;
    try {
      const [url] = await assinarArquivos(BUCKET_AUDIO_REGISTRO, [r.audio_path]);
      setAudioUrl(url ?? null);
    } catch {
      toast.error("Não deu para abrir o áudio", { description: "Tente de novo em instantes." });
    }
  };

  const salvarTexto = async () => {
    const t = texto.trim();
    try {
      await atualizar.mutateAsync({ id: r.id, texto_organizado: t.length > 0 ? t : null });
      setEditando(false);
      toast.success("Texto corrigido");
    } catch {
      toast.error("Não deu para salvar o texto", { description: "Tente de novo." });
    }
  };

  const alternarCliente = () =>
    atualizar.mutate(
      { id: r.id, visivel_cliente: !r.visivel_cliente },
      { onError: () => toast.error("Não deu para mudar a visibilidade", { description: "Tente de novo." }) }
    );

  const apagar = async () => {
    try {
      await excluir.mutateAsync(r);
      toast.success("Registro apagado");
    } catch {
      toast.error("Não deu para apagar o registro", { description: "Tente de novo." });
    }
    setConfirmaExcluir(false);
  };

  return (
    <article className="space-y-3 rounded-2xl border border-black/5 bg-white p-4" data-estado={r.status}>
      <header className="flex items-center gap-2.5">
        <AvatarStack pessoas={[{ nome: r.autor_nome }]} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{r.autor_nome}</p>
          <p className="text-xs text-muted-foreground">
            {hora(r.criado_em)}
            {r.audio_duracao_s !== null && ` · áudio de ${formatarDuracao(r.audio_duracao_s)}`}
            {r.fotos.length > 0 && ` · ${r.fotos.length} ${r.fotos.length === 1 ? "foto" : "fotos"}`}
          </p>
        </div>
        {organizando && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-semibold text-ink">
            <BusyMark className="h-3 w-3" />
            Organizando
          </span>
        )}
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
            r.visivel_cliente ? "bg-positive/10 text-positive-strong" : "bg-muted text-ink-soft"
          )}
        >
          {r.visivel_cliente ? (
            <Eye className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Lock className="h-3 w-3" aria-hidden="true" />
          )}
          {r.visivel_cliente ? "Cliente vê" : "Interno"}
        </span>
      </header>

      {textoAtual ? (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{textoAtual}</p>
      ) : organizando ? (
        <div className="space-y-2" aria-hidden="true">
          <span className="block h-3 w-11/12 rounded-full bg-muted" />
          <span className="block h-3 w-2/3 rounded-full bg-muted" />
        </div>
      ) : null}

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <li key={c.id} className={cn("rounded-lg px-2.5 py-1 text-[13px] font-medium", TOM_CHIP[c.tom])}>
              {c.texto}
            </li>
          ))}
        </ul>
      )}

      {fotoUrls.length > 0 && (
        <ul className="grid max-w-md grid-cols-3 gap-2">
          {fotoUrls.map((u, i) => (
            <li key={u}>
              <a href={u} target="_blank" rel="noreferrer">
                <img
                  src={u}
                  alt={`Foto ${i + 1} de ${r.autor_nome}`}
                  className="h-24 w-full rounded-xl object-cover"
                  loading="lazy"
                />
              </a>
            </li>
          ))}
        </ul>
      )}

      {r.audio_path && (audioUrl ? <audio controls autoPlay src={audioUrl} className="w-full" /> : null)}

      {r.status === "falhou" && (
        <p className="text-sm text-muted-foreground">
          {mensagemDoErro(r.erro)}
          {r.erro === "sem_tokens" ? " Depois de renovar os créditos, toque em tentar de novo." : ""}
        </p>
      )}

      <footer className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-black/5 pt-2">
        {r.audio_path && !audioUrl && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2.5 text-[13px]" onClick={() => void ouvir()}>
            <Mic className="h-4 w-4" aria-hidden="true" />
            Ouvir áudio
          </Button>
        )}
        {r.status === "falhou" && canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 px-2.5 text-[13px]"
            loading={reprocessar.isPending}
            onClick={() => reprocessar.mutate(r.id)}
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Tentar de novo
          </Button>
        )}
        {canEdit && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 px-2.5 text-[13px]"
              onClick={alternarCliente}
              disabled={atualizar.isPending}
            >
              {r.visivel_cliente ? (
                <Lock className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
              {r.visivel_cliente ? "Esconder do cliente" : "Mostrar ao cliente"}
            </Button>
            {!organizando && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 px-2.5 text-[13px]"
                onClick={() => {
                  setTexto(textoAtual ?? "");
                  setEditando(true);
                }}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Corrigir texto
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-9 gap-1.5 px-2.5 text-[13px] text-danger-mid"
              onClick={() => setConfirmaExcluir(true)}
              aria-label="Apagar registro"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </>
        )}
      </footer>

      <FormDialog
        open={editando}
        onOpenChange={setEditando}
        size="sm"
        title="Corrigir o texto"
        description="O áudio original continua guardado. Só o texto muda."
        isPending={atualizar.isPending}
        onSubmit={() => void salvarTexto()}
      >
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={6}
          maxLength={20000}
          aria-label="Texto do registro"
          autoFocus
        />
      </FormDialog>

      <ConfirmDialog
        open={confirmaExcluir}
        onOpenChange={setConfirmaExcluir}
        onConfirm={() => void apagar()}
        title="Apagar este registro?"
        description="O texto, as fotos e o áudio guardado são apagados. Não dá para desfazer."
        confirmText="Apagar"
        variant="destructive"
        loading={excluir.isPending}
      />
    </article>
  );
}
