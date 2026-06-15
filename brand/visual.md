# Identidade Visual

> **A verdade técnica das cores/tokens vive em `src/styles/tokens.css`** — este arquivo
> descreve a intenção e o uso, NÃO duplica valores. Mudou cor? Muda no tokens.css.
> Ref: [BRAND.md](./BRAND.md) · Última atualização: `2026-06-10` · `v0`

## Princípio

Estética **Paper + Ink**: quase-branco de fundo, tinta escura no texto, verde da marca como acento pontual. Calma, técnica, premium — não "startup colorida". A cor conta história: financeiro usa verde/vermelho semânticos, status têm cor própria.

## Cor

Fonte: `src/styles/tokens.css` (arquitetura `PRIMITIVES → SEMANTIC`). Resumo de uso:

| Papel | Token semântico | Notas |
|---|---|---|
| Marca / acento | `--brand-accent` (verde "Alto Grain", `#A4EC86`) | Pontual — CTA sutil, sinal "ao vivo", destaque. **Não** é cor de fundo de página. |
| Fundo app | `--surface-app` / `--surface-card` / `--surface-sidebar` | Escala Paper |
| Texto | `--text-ink` (títulos) / `--text-ink-soft` (corpo) / `--text-muted` | Escala Ink |
| Positivo / negativo | `--positive` (verde) / `--negative` (vermelho) | Financeiro — receita vs despesa |
| Charts | `--chart-*` | Paleta dedicada, não reusar status |
| Status projeto | `--status-*` | planning/progress/review/done/paused/cancelled |
| Pipeline leads | `--pipeline-*` | etapas do funil |

**Regras de cor:**
- Componentes consomem **semantic**, nunca primitive (`--c-*`) direto.
- Verde da marca é tempero, não base. Página inteira verde = errado.
- Verde/vermelho financeiro ≠ verde da marca. Significados diferentes.

## Tipografia

`[A DEFINIR — confirmar no código/Figma]`. Documentar: família display (hero usa `font-light`, tracking negativo, clamp 48–96px), família corpo, escala, pesos. Hero atual: peso fino + itálico de destaque (`.hero-italic-highlight`).

## Logo

`[A DEFINIR]` — anexar SVGs e regras:
- Versões: principal, monocromática, símbolo isolado, sobre fundo escuro.
- Área de respiro, tamanho mínimo, usos proibidos (distorcer, recolorir, sombra).
- Uso do `®`: "Pilar®" em contexto institucional/landing.

## Espaçamento, raio, sombra

Tokens em `tokens.css`: `--shadow-card`, `--shadow-elegant`, `--shadow-popover`. Raio via shadcn (`--radius`). Gradientes: `--gradient-primary`, `--gradient-subtle`, `--gradient-brand`.

## Componentes

Base **shadcn/ui + Tailwind**. Padrão de página: header via prop `header={}` do `PageLayout` (ver `CLAUDE.md`). Referências vivas: `src/pages/Projetos.tsx`, `src/pages/Relatorios.tsx`, `src/pages/landing/`.

## Iconografia

`lucide-react` (já em uso). Traço fino, consistente com a estética leve. Não misturar bibliotecas de ícone.

## Pendências visuais ⚠️

- [ ] Especificar tipografia (famílias + escala + pesos)
- [ ] Anexar logo + regras de uso
- [ ] Confirmar se `#A4EC86` ("Alto Grain") é a cor de marca definitiva ou herança de protótipo
- [ ] Definir tratamento de imagem/foto (se houver) e ilustração
