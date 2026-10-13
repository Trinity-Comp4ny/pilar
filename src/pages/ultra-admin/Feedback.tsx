import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bug, Image as ImageIcon, Lightbulb, MessageSquare } from "lucide-react";
import { PilarPage } from "@/components/PilarPage";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDateTime } from "@/lib/format";
import { statusLabel } from "@/lib/status";
import { toDataSourceResult } from "@/types/dataSource";
import {
  useEmpresas,
  useFeedback,
  useMudarStatusFeedback,
  useUsuariosPlataforma,
  type FeedbackItem,
  type FeedbackStatus,
} from "./hooks";
import { quandoRelativo } from "./lib";
import { FiltroChips } from "./components/FiltroChips";

const STATUS: FeedbackStatus[] = ["novo", "em_analise", "planejado", "resolvido", "descartado"];
const ABERTOS: FeedbackStatus[] = ["novo", "em_analise", "planejado"];

type FiltroStatus = "abertos" | "todos" | FeedbackStatus;
type FiltroTipo = "todos" | "bug" | "sugestao";

/** Signed URL curta: o print pode ter dado de cliente, nada de link permanente. */
const PRINT_URL_TTL_S = 600;

type Linha = FeedbackItem & { autor: string | null; empresaNome: string | null };

export default function Feedback() {
  usePageTitle("Feedback · Ultra admin");
  const query = useFeedback();
  const usuariosQ = useUsuariosPlataforma();
  const empresasQ = useEmpresas();
  const mudarStatus = useMudarStatusFeedback();
  const [status, setStatus] = useState<FiltroStatus>("abertos");
  const [tipo, setTipo] = useState<FiltroTipo>("todos");
  const [busca, setBusca] = useState("");
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const linhas = useMemo<Linha[]>(() => {
    const autores = new Map((usuariosQ.data ?? []).map((u) => [u.id, u.nome ?? u.email]));
    const empresas = new Map((empresasQ.data ?? []).map((e) => [e.id, e.nome]));
    return (query.data ?? []).map((f) => ({
      ...f,
      autor: autores.get(f.createdBy) ?? null,
      empresaNome: f.empresaId ? (empresas.get(f.empresaId) ?? null) : null,
    }));
  }, [query.data, usuariosQ.data, empresasQ.data]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((f) => {
      if (status === "abertos" ? !ABERTOS.includes(f.status) : status !== "todos" && f.status !== status) return false;
      if (tipo !== "todos" && f.tipo !== tipo) return false;
      if (!q) return true;
      return [f.titulo ?? "", f.descricao, f.autor ?? "", f.empresaNome ?? ""].some((t) => t.toLowerCase().includes(q));
    });
  }, [linhas, status, tipo, busca]);

  const conta = (s: FeedbackStatus) => linhas.filter((f) => f.status === s).length;
  const aberto = linhas.find((f) => f.id === abertoId) ?? null;

  const colunas: ColumnDef<Linha>[] = [
    {
      key: "feedback",
      header: "Feedback",
      cell: (f) => (
        <div className="flex min-w-0 max-w-xl gap-2.5">
          {f.tipo === "bug" ? (
            <Bug size={15} strokeWidth={1.5} className="mt-0.5 shrink-0 text-danger-strong" aria-label="Problema" />
          ) : (
            <Lightbulb size={15} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-soft" aria-label="Sugestão" />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{f.titulo ?? "Problema relatado"}</p>
            <p className="line-clamp-1 text-xs text-ink-muted">{f.descricao}</p>
          </div>
          {f.printPath && <ImageIcon size={14} className="mt-0.5 shrink-0 text-ink-muted" aria-label="Tem print" />}
        </div>
      ),
    },
    {
      key: "autor",
      header: "De",
      getSortValue: (f) => f.empresaNome ?? "",
      cell: (f) => (
        <div className="min-w-0">
          <p className="truncate text-ink-soft">{f.autor ?? "-"}</p>
          {f.empresaNome && <p className="truncate text-xs text-ink-muted">{f.empresaNome}</p>}
        </div>
      ),
    },
    {
      key: "quando",
      header: "Enviado",
      getSortValue: (f) => f.createdAt,
      cell: (f) => <span className="text-ink-soft">{quandoRelativo(f.createdAt)}</span>,
    },
    {
      key: "status",
      header: "Status",
      getSortValue: (f) => STATUS.indexOf(f.status),
      cell: (f) => <StatusBadge domain="feedback" status={f.status} />,
    },
  ];

  return (
    <PilarPage title="Feedback" search={{ value: busca, onChange: setBusca, placeholder: "Buscar no feedback" }}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FiltroChips<FiltroStatus>
          ariaLabel="Filtrar por status"
          value={status}
          onChange={setStatus}
          opcoes={[
            { value: "abertos", label: "Em aberto", count: linhas.filter((f) => ABERTOS.includes(f.status)).length },
            ...STATUS.map((s) => ({ value: s, label: statusLabel("feedback", s), count: conta(s) })),
            { value: "todos", label: "Todos", count: linhas.length },
          ]}
        />
        <FiltroChips<FiltroTipo>
          ariaLabel="Filtrar por tipo"
          value={tipo}
          onChange={setTipo}
          opcoes={[
            { value: "todos", label: "Tudo" },
            { value: "bug", label: "Problemas" },
            { value: "sugestao", label: "Sugestões" },
          ]}
        />
      </div>

      <DataTable
        columns={colunas}
        data={toDataSourceResult<Linha>({ data: visiveis, isLoading: query.isLoading, error: query.error })}
        rowKey={(f) => f.id}
        onRowClick={(f) => setAbertoId(f.id)}
        defaultSortKey="quando"
        defaultSortDir="desc"
        minWidth="720px"
        errorTitle="Não foi possível carregar o feedback"
        emptyState={
          <EmptyState
            icon={MessageSquare}
            title={status === "abertos" ? "Nenhum feedback em aberto" : "Nada com esses filtros"}
            description="Chega aqui, no sino e por e-mail quando alguém usa o botão Feedback no menu do usuário."
          />
        }
      />

      <Sheet open={!!aberto} onOpenChange={(o) => !o && setAbertoId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {aberto && (
            <DetalheFeedback item={aberto} onStatus={(s) => mudarStatus.mutate({ id: aberto.id, status: s })} />
          )}
        </SheetContent>
      </Sheet>
    </PilarPage>
  );
}

function DetalheFeedback({ item, onStatus }: { item: Linha; onStatus: (s: FeedbackStatus) => void }) {
  const [printUrl, setPrintUrl] = useState<string | null>(null);
  const [printErro, setPrintErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    setPrintUrl(null);
    setPrintErro(false);
    if (!item.printPath) return;
    supabase.storage
      .from("feedback-prints")
      .createSignedUrl(item.printPath, PRINT_URL_TTL_S)
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error || !data) setPrintErro(true);
        else setPrintUrl(data.signedUrl);
      });
    return () => {
      vivo = false;
    };
  }, [item.printPath]);

  return (
    <div className="space-y-5">
      <SheetHeader className="space-y-1 text-left">
        <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
          {item.tipo === "bug" ? <Bug size={13} /> : <Lightbulb size={13} />}
          {item.tipo === "bug" ? "Problema" : "Sugestão"} · {formatDateTime(item.createdAt)}
        </p>
        <SheetTitle className="text-lg">{item.titulo ?? "Problema relatado"}</SheetTitle>
        <SheetDescription>
          {item.autor ?? "Autor desconhecido"}
          {item.empresaId && item.empresaNome && (
            <>
              {" · "}
              <Link to={`/ultra-admin/empresas/${item.empresaId}`} className="font-medium text-ink hover:underline">
                {item.empresaNome}
              </Link>
            </>
          )}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-ink-muted">Status</p>
        <Select value={item.status} onValueChange={(v) => onStatus(v as FeedbackStatus)}>
          <SelectTrigger className="w-48" aria-label="Status do feedback">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel("feedback", s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{item.descricao}</p>

      {item.printPath && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-ink-muted">Print</p>
          {printErro ? (
            <p className="text-sm text-ink-muted">Não deu pra abrir o print. Feche e abra de novo.</p>
          ) : printUrl ? (
            <a href={printUrl} target="_blank" rel="noreferrer">
              <img
                src={printUrl}
                alt={`Print enviado por ${item.autor ?? "usuário"}`}
                className="w-full rounded-lg border border-black/10 object-contain"
              />
            </a>
          ) : (
            <Skeleton className="h-48 w-full" />
          )}
        </div>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg bg-muted/60 p-4 text-sm">
        <dt className="text-ink-muted">Tela</dt>
        <dd className="break-all font-mono text-xs text-ink">{item.rota ?? "-"}</dd>
        <dt className="text-ink-muted">Navegador</dt>
        <dd className="text-ink">{item.navegador ?? "-"}</dd>
        <dt className="text-ink-muted">Janela</dt>
        <dd className="text-ink">{item.janela ?? "-"}</dd>
        {item.sentryEventId && (
          <>
            <dt className="text-ink-muted">Sentry</dt>
            <dd className="break-all font-mono text-xs text-ink">{item.sentryEventId}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
