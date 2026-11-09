# Cor

> A verdade técnica vive em `src/styles/tokens.css`. Este arquivo explica a intenção, dá os
> valores em hex e os contrastes medidos. Mudou cor? Muda no `tokens.css` e atualiza aqui.
> Uso em tela e componente: `docs/design/PILAR_DESIGN_SYSTEM.md` (seção 3).
> Logotipo e fundos: [logo.md](./logo.md).

## 1. Ideia

**Paper + Ink, com verde só de tempero.** Fundo quase branco, texto em tinta escura, e um
verde claro que aparece em poucos lugares e sempre significa "ação" ou "marca". O resto da
cor (verde, vermelho, azul, âmbar) é semântica: conta o estado de um dado, nunca decora.

- **Paper domina.** É o fundo de quase toda tela.
- **Ink é o texto e o traço.** Título, corpo, ícone e logotipo.
- **O verde da marca é tempero.** Botão primário, destaque, sinal de "ao vivo". Em bloco grande
  cansa; use a versão lavada (`brand-accent-soft`) para superfície grande. Uma tela inteira verde
  está errada.
- **Cor semântica só informa.** Verde e vermelho do financeiro não são o verde da marca.

## 2. Paleta da marca

| Papel | Token | Hex | Uso |
|---|---|---|---|
| Paper 0 | `--c-paper-0` | #FFFFFF | Cartão, modal, superfície elevada |
| Paper 50 | `--c-paper-50` | #FCFCFC | Fundo do app |
| Paper 100 | `--c-paper-100` | #F7F7F7 | Fundo da landing, sidebar |
| Paper 200 | `--c-paper-200` | #EDEDED | Hover, superfície muted, chip |
| Paper 300 | `--c-paper-300` | #D9D9D9 | Borda leve |
| **Ink 900** | `--c-ink-900` | **#1A1A1A** | Título, texto primário, ícone, logotipo |
| Ink 800 | `--c-ink-800` | #3D3D3D | Corpo, texto secundário |
| Gray 600 | `--c-gray-600` | #5F6572 | Rótulo, placeholder, texto de apoio |
| Gray 400 | `--c-gray-400` | #9EA3AE | Desabilitado (nunca para texto que precisa ser lido) |
| Gray 300 | `--c-gray-300` | #D1D5DB | Borda de ênfase |
| Gray 200 | `--c-gray-200` | #E5E7EB | Borda padrão, separador |
| **Verde da marca** | `--c-brand-500` | **#A4EC86** | Botão primário, destaque, fundo de ícone |
| Verde lavado | `--brand-accent-soft` | #E2F6DA | Superfície grande: cartão do bento, faixa |
| Verde forte | `--c-modulo-gestao-strong` | #366B1F | Texto e traço verde sobre fundo claro |

**Sobre o hex do verde.** O hex oficial é **#A4EC86** (favicon, manifesto, e-mail, logotipo). O token
em HSL (`102 73% 73%`) arredonda para #A6EC88, uma diferença que o olho não vê. Em arquivo de
marca (logo, ícone, impressão, deck) use o hex.

### Módulos

Cada módulo da landing tem um par: **fill** (fundo de pílula, cartão, ícone) e **strong** (texto
e traço sobre claro, fecha 4,5 : 1).

| Módulo | Fill | Strong |
|---|---|---|
| Gestão | #A4EC86 (a marca) | #366B1F |
| Projetos | #D0E3F6 | #295485 |
| Obra | #F7DDBF | #874E1C |

## 3. Contraste medido

Contraste WCAG 2.1 calculado sobre os hex acima. Meta de texto: **4,5 : 1** (AA). Texto grande
(≥ 24 px, ou ≥ 19 px em semibold): 3 : 1.

| Texto | Fundo | Razão | Passa |
|---|---|---|---|
| Ink 900 | Paper 0 | 17,4 : 1 | AAA |
| Ink 900 | Paper 200 | 14,9 : 1 | AAA |
| Ink 800 | Paper 0 | 10,9 : 1 | AAA |
| Gray 600 | Paper 0 | 5,9 : 1 | AA |
| Gray 600 | Paper 200 | 5,0 : 1 | AA |
| Gray 500 | Paper 200 | 4,1 : 1 | **reprova** (por isso o texto de apoio é Gray 600) |
| Gray 400 | Paper 0 | 2,5 : 1 | **reprova** (só desabilitado) |
| Ink 900 | Verde da marca | 12,4 : 1 | AAA |
| Branco | Ink 900 | 17,4 : 1 | AAA |
| Verde da marca | Ink 900 | 12,4 : 1 | AAA |
| **Verde da marca** | **Paper 0** | **1,4 : 1** | **reprova** |
| Verde forte | Paper 0 | 6,4 : 1 | AA |

**Regra do verde.** Verde da marca é **fundo** (com texto Ink por cima) ou **acento sobre Ink**.
Nunca é cor de texto, de ícone ou de traço sobre fundo claro. Para texto verde sobre claro,
use o verde forte.

## 4. Cor semântica

### Financeiro

Receita é verde, despesa é vermelho, e só valores de dinheiro colorem. Número neutro fica Ink.

| Intenção | Fill (fundo, barra) | Texto (contraste sobre branco) |
|---|---|---|
| Positivo | `--positive` #21C45D | `--positive-strong` #157F3C (5,1 : 1) |
| Negativo | `--negative` #EF4343 | `--negative-strong` #BA1C1C (6,4 : 1) |

O fill **não** serve de texto sobre claro (verde 2,3 : 1, vermelho 3,8 : 1).

### Status (família soft e strong)

Cada intenção tem superfície suave, borda e texto forte. Texto forte sobre a superfície suave:

| Intenção | Superfície | Texto forte | Razão | Significa |
|---|---|---|---|---|
| Sucesso | #F2FDF5 | #166434 | 6,9 : 1 | Concluído, pago, ativo |
| Perigo | #FEE1E1 | #811D1D | 8,0 : 1 | Erro, atrasado, destrutivo |
| Info | #F0F6FF | #1E3FAE | 8,1 : 1 | Informativo, em andamento |
| Aviso | #FFFBEB | #91400D | 6,9 : 1 | Atenção moderada, pendente |
| Atenção | #FFF6EB | #9B3412 | 6,8 : 1 | Projeto ativo, ponto de atenção |
| Destaque | #FAF5FF | #6A21A6 | 8,2 : 1 | Lead, novidade |

Em componente use `StatusBadge` e o registry (`src/lib/status.ts`). A cor nunca vem de fora.

### Fill sólido

Para banner, alerta cheio e badge sólido. Cada fill tem um texto par:

| Intenção | Fill | Texto | Razão | Situação |
|---|---|---|---|---|
| Perigo | #DE2121 | Branco | 4,8 : 1 | AA |
| Aviso | #EBBD05 | Ink | 9,8 : 1 | AA |
| Info | #2463EB | Branco | 5,2 : 1 | AA |
| Sucesso | #16A249 | Branco | 3,3 : 1 | Só texto grande |
| Atenção | #F97415 | Branco | 2,8 : 1 | **Reprova** |

Sucesso e Atenção sólidos não fecham AA com texto branco: use Ink no Atenção (6,3 : 1) e
texto grande ou verde mais escuro no Sucesso. O comentário em `tokens.css` que afirma "contraste AA
garantido" para todos os pares está errado e vira card de acompanhamento.

### Gráficos e marcadores

Paleta própria, não reaproveite status: `--chart-*` (sucesso, perigo, aviso, info, neutro, grade),
`--status-*` (marcador de projeto: planejamento, andamento, revisão, concluído, pausado,
cancelado) e `--pipeline-*` (etapas do funil de leads). Regras:

- Cor nunca é a única pista: gráfico leva rótulo, forma ou valor junto.
- Máximo de 6 séries por gráfico. Mais que isso, agrupe.
- Grade em Gray 200, sempre atrás dos dados.

## 5. Superfícies e profundidade

A profundidade vem de **borda fina e três sombras leves**, não de cor.

| Nível | Superfície | Borda | Sombra |
|---|---|---|---|
| Fundo | Paper 50 | nenhuma | nenhuma |
| Cartão | Paper 0 | Gray 200 | `--shadow-card` |
| Elevado (menu, cartão em destaque) | Paper 0 | Gray 200 | `--shadow-elegant` |
| Sobreposição (popover, modal) | Paper 0 | Gray 200 | `--shadow-popover` |

As sombras usam Ink com 6% a 12% de opacidade, nunca preto puro.

## 6. Fundo escuro

O produto **não tem tema escuro**: `tokens.css` só ajusta dois tokens financeiros em `.dark`, e
não existe alternador de tema (e só um arquivo usa `dark:`). Para superfície escura dentro da marca (seção da landing, capa de
deck, e-mail escuro, ícone do app) vale esta receita:

| Elemento | Cor |
|---|---|
| Fundo | Ink 900 #1A1A1A |
| Texto | Paper 0 #FFFFFF (17,4 : 1); apoio em Gray 400 #9EA3AE (6,9 : 1) |
| Acento | Verde da marca #A4EC86 (12,4 : 1 sobre Ink) |
| Dinheiro positivo / negativo | `--c-green-400` / `--c-red-400` (já em `.dark`) |

## 7. Como aplicar no código

- Componente consome token **semântico** (`bg-surface-card`, `text-ink`, `bg-brand`), nunca a
  primitiva (`--c-*`) nem paleta crua do Tailwind (`bg-red-100`). O ESLint barra.
- Botão primário é `variant="brand"` (verde, texto Ink). Texto verde sobre claro não existe.
- Cor nova ou ajuste de contraste: edite `tokens.css`, rode o teste de acessibilidade (Axe) e
  atualize as tabelas deste arquivo.
- Fora do app (e-mail, deck, impressão) use o hex da tabela da seção 2.
