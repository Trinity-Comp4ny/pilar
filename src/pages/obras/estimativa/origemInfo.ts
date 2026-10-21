import type { BadgeProps } from "@/components/ui/badge";
import type { OrigemLinha } from "@/schemas/estimativaObra";

export type TipoDeOrigem = OrigemLinha["tipo"] | "cub";

export const ORIGEM_INFO: Record<TipoDeOrigem, { rotulo: string; variante: BadgeProps["variant"] }> = {
  cub: { rotulo: "CUB", variante: "info" },
  sinapi: { rotulo: "SINAPI", variante: "success" },
  empresa: { rotulo: "Sua empresa", variante: "highlight" },
  usuario: { rotulo: "Você informou", variante: "neutral" },
  referencia_pilar: { rotulo: "Provisória", variante: "warning" },
  a_definir: { rotulo: "A definir", variante: "outline" },
};
