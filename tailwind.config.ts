import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        "accent-orange": "hsl(var(--accent-orange))",

        // Pilar design tokens — ver src/styles/tokens.css
        // Formato hsl(... / <alpha-value>) habilita opacity modifier (ex: bg-paper/90)
        paper: {
          DEFAULT: "hsl(var(--surface-landing) / <alpha-value>)",
          alt: "hsl(var(--surface-landing-alt) / <alpha-value>)",
          border: "hsl(var(--border-landing) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "hsl(var(--text-ink) / <alpha-value>)",
          soft: "hsl(var(--text-ink-soft) / <alpha-value>)",
          muted: "hsl(var(--text-muted) / <alpha-value>)",
          disabled: "hsl(var(--text-disabled) / <alpha-value>)",
          "on-brand": "hsl(var(--text-on-brand) / <alpha-value>)",
        },
        brand: {
          DEFAULT: "hsl(var(--brand-accent) / <alpha-value>)",
        },
        positive: "hsl(var(--positive) / <alpha-value>)",
        negative: "hsl(var(--negative) / <alpha-value>)",
        chart: {
          success: "hsl(var(--chart-success) / <alpha-value>)",
          "success-alt": "hsl(var(--chart-success-alt) / <alpha-value>)",
          danger: "hsl(var(--chart-danger) / <alpha-value>)",
          warning: "hsl(var(--chart-warning) / <alpha-value>)",
          "warning-alt": "hsl(var(--chart-warning-alt) / <alpha-value>)",
          info: "hsl(var(--chart-info) / <alpha-value>)",
          "info-alt": "hsl(var(--chart-info-alt) / <alpha-value>)",
          neutral: "hsl(var(--chart-neutral) / <alpha-value>)",
          grid: "hsl(var(--chart-grid) / <alpha-value>)",
        },
        status: {
          planning: "hsl(var(--status-planning) / <alpha-value>)",
          progress: "hsl(var(--status-progress) / <alpha-value>)",
          review: "hsl(var(--status-review) / <alpha-value>)",
          done: "hsl(var(--status-done) / <alpha-value>)",
          paused: "hsl(var(--status-paused) / <alpha-value>)",
          cancelled: "hsl(var(--status-cancelled) / <alpha-value>)",
          unknown: "hsl(var(--status-unknown) / <alpha-value>)",
        },
        // Tinted surfaces / strong texts (ver src/styles/tokens.css)
        success: {
          soft: "hsl(var(--surface-success-soft) / <alpha-value>)",
          "soft-border": "hsl(var(--border-success-soft) / <alpha-value>)",
          strong: "hsl(var(--text-success-strong) / <alpha-value>)",
          mid: "hsl(var(--text-success-mid) / <alpha-value>)",
          DEFAULT: "hsl(var(--text-success-soft) / <alpha-value>)",
        },
        danger: {
          soft: "hsl(var(--surface-danger-soft) / <alpha-value>)",
          "soft-border": "hsl(var(--border-danger-soft) / <alpha-value>)",
          "mid-border": "hsl(var(--border-danger-mid) / <alpha-value>)",
          strong: "hsl(var(--text-danger-strong) / <alpha-value>)",
          mid: "hsl(var(--text-danger-mid) / <alpha-value>)",
          DEFAULT: "hsl(var(--text-danger-soft) / <alpha-value>)",
        },
        info: {
          soft: "hsl(var(--surface-info-soft) / <alpha-value>)",
          "soft-border": "hsl(var(--border-info-soft) / <alpha-value>)",
          "mid-border": "hsl(var(--border-info-mid) / <alpha-value>)",
          strong: "hsl(var(--text-info-strong) / <alpha-value>)",
          mid: "hsl(var(--text-info-mid) / <alpha-value>)",
          DEFAULT: "hsl(var(--text-info-soft) / <alpha-value>)",
        },
        warning: {
          soft: "hsl(var(--surface-warning-soft) / <alpha-value>)",
          "soft-border": "hsl(var(--border-warning-soft) / <alpha-value>)",
          "mid-border": "hsl(var(--border-warning-mid) / <alpha-value>)",
          strong: "hsl(var(--text-warning-strong) / <alpha-value>)",
          mid: "hsl(var(--text-warning-mid) / <alpha-value>)",
          DEFAULT: "hsl(var(--text-warning-soft) / <alpha-value>)",
        },
        attention: {
          soft: "hsl(var(--surface-attention-soft) / <alpha-value>)",
          "soft-border": "hsl(var(--border-attention-soft) / <alpha-value>)",
          "mid-border": "hsl(var(--border-attention-mid) / <alpha-value>)",
          strong: "hsl(var(--text-attention-strong) / <alpha-value>)",
          mid: "hsl(var(--text-attention-mid) / <alpha-value>)",
          DEFAULT: "hsl(var(--text-attention-soft) / <alpha-value>)",
        },
        highlight: {
          soft: "hsl(var(--surface-highlight-soft) / <alpha-value>)",
          "soft-border": "hsl(var(--border-highlight-soft) / <alpha-value>)",
          "mid-border": "hsl(var(--border-highlight-mid) / <alpha-value>)",
          strong: "hsl(var(--text-highlight-strong) / <alpha-value>)",
          mid: "hsl(var(--text-highlight-mid) / <alpha-value>)",
          DEFAULT: "hsl(var(--text-highlight-soft) / <alpha-value>)",
        },
        pipeline: {
          novo: "hsl(var(--pipeline-novo) / <alpha-value>)",
          contato: "hsl(var(--pipeline-contato) / <alpha-value>)",
          proposta: "hsl(var(--pipeline-proposta) / <alpha-value>)",
          negociacao: "hsl(var(--pipeline-negociacao) / <alpha-value>)",
          perdido: "hsl(var(--pipeline-perdido) / <alpha-value>)",
        },
      },
      fontFamily: {
        montserrat: ["Montserrat", "sans-serif"],
      },
      // Escala tipográfica FLUIDA (clamp via tokens em tokens.css).
      // Só landing + títulos de módulo — NÃO usar em tabelas de dados.
      // font-size + line-height acoplados (o util Heading consome estes).
      // ATENÇÃO: nomes registrados no extendTailwindMerge do cn (src/lib/utils.ts),
      // senão o tailwind-merge descarta o tamanho quando há override de cor.
      fontSize: {
        display: ["var(--text-display)", { lineHeight: "var(--text-display-lh)" }],
        h1: ["var(--text-h1)", { lineHeight: "var(--text-h1-lh)" }],
        h2: ["var(--text-h2)", { lineHeight: "var(--text-h2-lh)" }],
        h3: ["var(--text-h3)", { lineHeight: "var(--text-h3-lh)" }],
        h4: ["var(--text-h4)", { lineHeight: "var(--text-h4-lh)" }],
        lead: ["var(--text-lead)", { lineHeight: "var(--text-lead-lh)" }],
      },
      // Ritmo vertical de seção fluido → py-section / py-section-sm / py-section-lg
      spacing: {
        section: "var(--space-section)",
        "section-sm": "var(--space-section-sm)",
        "section-lg": "var(--space-section-lg)",
      },
      // Larguras de conteúdo nomeadas → max-w-content / max-w-wide
      maxWidth: {
        content: "var(--container-content)",
        wide: "var(--container-wide)",
      },
      // Motion coeso (tokens em tokens.css) → ease-out-expo/quint, duration-fast/base/slow
      transitionTimingFunction: {
        "out-expo": "var(--ease-out-expo)",
        "out-quint": "var(--ease-out-quint)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-subtle": "var(--gradient-subtle)",
        "gradient-brand": "var(--gradient-brand)",
      },
      boxShadow: {
        elegant: "var(--shadow-elegant)",
        card: "var(--shadow-card)",
        popover: "var(--shadow-popover)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" },
        },
        aurora: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(5%, -6%) scale(1.06)" },
          "66%": { transform: "translate(-4%, 5%) scale(0.97)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.65s ease-out both",
        float: "float 7s ease-in-out infinite",
        "float-slow": "float 10s ease-in-out infinite",
        aurora: "aurora 14s ease-in-out infinite",
        "aurora-alt": "aurora 18s ease-in-out infinite reverse",
      },
    },
    fontFamily: {
      sans: ["Inter", "sans-serif"],
      heading: ["Inter", "sans-serif"],
      montserrat: ["Montserrat", "sans-serif"],
    },
    boxShadow: {
      elegant: "var(--shadow-elegant)",
      card: "var(--shadow-card)",
      popover: "var(--shadow-popover)",
      soft: "0 20px 25px -5px rgba(0, 0, 0, 0.05)",
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
