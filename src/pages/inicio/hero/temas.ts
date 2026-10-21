/**
 * Temas do cabeçalho do Início (SPEC 121). Três, todos só com token semântico:
 *
 * - `verde`: lavagem clara da marca, texto tinta. É o padrão, para a tela abrir com cor
 *   definida sem pintar a página inteira de verde (brand/visual.md: verde é tempero).
 * - `grafite`: tinta escura com texto claro.
 * - `papel`: cartão branco com as curvas da marca ao fundo.
 *
 * O tom de cada destaque (positivo, atenção, neutro) vive no chip de ícone redondo, não no
 * fundo do cartão, então o mesmo código serve aos três temas.
 */

export const TEMAS = ["verde", "grafite", "papel"] as const;
export type TemaInicio = (typeof TEMAS)[number];

export const TEMA_PADRAO: TemaInicio = "verde";

export const ROTULO_TEMA: Record<TemaInicio, string> = {
  verde: "Verde",
  grafite: "Grafite",
  papel: "Papel",
};

export type VisualTema = {
  raiz: string;
  /** Texto de apoio (parágrafo, legendas). */
  suave: string;
  /** Superfície dos chips de destaque e do bloco de foco. */
  chip: string;
  /** Linha divisória interna. */
  divisor: string;
  onda: string;
  circulo: string;
  /** Amostra do tema no seletor. */
  amostra: string;
};

export const VISUAL_TEMA: Record<TemaInicio, VisualTema> = {
  verde: {
    raiz: "border-brand/50 bg-brand-soft text-ink",
    suave: "text-ink-soft",
    chip: "border-white/70 bg-white/70 text-ink",
    divisor: "border-ink/10",
    onda: "fill-brand/40",
    circulo: "fill-brand/30",
    amostra: "bg-brand-soft border-brand/60",
  },
  grafite: {
    raiz: "border-ink-soft bg-gradient-primary text-white",
    suave: "text-white/80",
    chip: "border-white/10 bg-white/10 text-white",
    divisor: "border-white/15",
    onda: "fill-brand/15",
    circulo: "fill-brand/10",
    amostra: "bg-gradient-primary border-ink-soft",
  },
  papel: {
    raiz: "border-border bg-white text-ink",
    suave: "text-ink-soft",
    chip: "border-border bg-muted text-ink",
    divisor: "border-border",
    onda: "fill-brand/25",
    circulo: "fill-brand/15",
    amostra: "bg-white border-border",
  },
};

export function ehTema(valor: unknown): valor is TemaInicio {
  return typeof valor === "string" && (TEMAS as readonly string[]).includes(valor);
}
