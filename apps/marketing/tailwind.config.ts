import type { Config } from "tailwindcss";
// Reaproveita o tema (cores/tokens/keyframes) do app raiz — fonte única de
// verdade (ADR 0008 + 0021). Aqui só entram o `content` deste workspace e o
// que é exclusivo da landing: a família Geist e os tons de cartão/moldura.
import rootConfig from "../../tailwind.config";

export default {
  ...rootConfig,
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    ...rootConfig.theme,
    extend: {
      ...rootConfig.theme?.extend,
      fontFamily: {
        sans: ["Geist", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        ...(rootConfig.theme?.extend as Record<string, unknown>)?.colors as Record<string, unknown>,
        // Superfície da moldura e dos cartões claros sobre o fundo cinza.
        frame: "hsl(var(--surface-landing-white) / <alpha-value>)",
        // Cartões do bento: cheio no verde da marca, e a lavagem clara dele.
        "card-brand": "hsl(var(--brand-accent) / <alpha-value>)",
        "card-brand-soft": "hsl(var(--brand-accent-soft) / <alpha-value>)",
      },
    },
  },
} satisfies Config;
