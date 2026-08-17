import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataFrescorProps {
  /** `dataUpdatedAt` do React Query (epoch ms da última resposta bem-sucedida). */
  updatedAt?: number;
  /** `isFetching` do React Query: revalidando em segundo plano. */
  isFetching?: boolean;
  /** Se passado, o selo vira botão que dispara `refetch`. */
  onRefresh?: () => void;
  className?: string;
}

/**
 * Selo de frescura para telas de dinheiro: "Atualizado há X" + estado "Atualizando".
 * Reduz a ansiedade do "será que esse número está certo?" mostrando que o dado é vivo.
 * O número já é revalidado em segundo plano pelo React Query; aqui só se expõe isso.
 */
export function DataFrescor({ updatedAt, isFetching, onRefresh, className }: DataFrescorProps) {
  // Re-renderiza a cada 30s para o "há X min" avançar sem depender de novo fetch.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!updatedAt && !isFetching) return null;

  const label = isFetching
    ? "Atualizando…"
    : updatedAt
      ? `Atualizado ${formatDistanceToNow(updatedAt, { addSuffix: true, locale: ptBR })}`
      : "";

  const content = (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}
      role="status"
      aria-live="polite"
    >
      <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} aria-hidden="true" />
      {label}
    </span>
  );

  if (!onRefresh) return content;

  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={isFetching}
      className="transition-opacity hover:opacity-70 disabled:cursor-default disabled:opacity-100"
      title="Atualizar agora"
      aria-label="Atualizar dados agora"
    >
      {content}
    </button>
  );
}
