import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw } from "lucide-react";
import { BusyMark } from "@/components/motion/BusyMark";
import { cn } from "@/lib/utils";

interface DataFrescorProps {
  /** `dataUpdatedAt` do React Query (epoch ms da última resposta bem-sucedida). */
  updatedAt?: number;
  /** `isFetching` do React Query: revalidando em segundo plano. */
  isFetching?: boolean;
  /** Se passado, o selo vira botão que dispara `refetch`. */
  onRefresh?: () => void;
  className?: string;
  /** Abaixo de `md` corta o texto e deixa só o ícone (o texto segue no DOM para leitor de tela). */
  compactOnMobile?: boolean;
}

/**
 * Selo de frescura para telas de dinheiro: "Atualizado há X" + estado "Atualizando".
 * Reduz a ansiedade do "será que esse número está certo?" mostrando que o dado é vivo.
 * O número já é revalidado em segundo plano pelo React Query; aqui só se expõe isso.
 */
export function DataFrescor({ updatedAt, isFetching, onRefresh, className, compactOnMobile }: DataFrescorProps) {
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
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        // Celular: só o ícone, maior e com área de toque de 32 px (pedido do Matheus, 12/11).
        compactOnMobile && "max-md:p-2 max-md:[&>svg]:h-4 max-md:[&>svg]:w-4",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {isFetching ? <BusyMark className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" aria-hidden="true" />}
      {/* Só o ícone no celular: cortar a largura deixava aparecer "At" ao lado dele. */}
      <span className={cn(compactOnMobile && "max-md:sr-only")}>{label}</span>
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
      // O nome acessível contém o texto visível (WCAG 2.5.3): quem usa comando de voz
      // fala o que vê ("Atualizado há 2 minutos") e o leitor de tela diz a ação.
      aria-label={`${label}. Atualizar dados agora`}
    >
      {content}
    </button>
  );
}
