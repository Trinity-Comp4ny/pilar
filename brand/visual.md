# Identidade visual

> Resumo e índice. A verdade técnica das cores vive em `src/styles/tokens.css`; cada tema tem o
> seu arquivo. Ref: [BRAND.md](./BRAND.md) · Última atualização: `2026-10-27` · `v1`

## Em uma página

**Paper + Ink, com verde de tempero.** Papel quase branco, tinta escura, linha fina, número em
primeiro plano. O verde da marca (#A4EC86) marca a próxima ação, nunca cobre uma página.
Técnico e calmo, nunca "startup colorida".

| Tema                | Resumo                                                                                                                | Arquivo                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Logotipo            | Coluna de seis linhas + "Pilar" em Geist Medium. Lockup horizontal é o padrão. Respiro de 2X, símbolo mínimo de 16 px | [logo.md](./logo.md)                         |
| Tipografia          | Geist na marca, Inter no produto. Corpo do app 14 px, piso 12 px, títulos em peso 500 com tracking -0,035 em          | [typography.md](./typography.md)             |
| Cor                 | Paper, Ink e verde da marca; cor semântica só para estado e dinheiro; verde nunca é texto sobre claro                 | [color.md](./color.md)                       |
| Linguagem de design | Pílula para ação, 12 px para contêiner, três sombras leves, ícone lucide, a marca é o movimento                       | [design-language.md](./design-language.md)   |
| Imagem e ilustração | Tela real, croqui no traço do símbolo, padrão colunata, foto documental, um verde por peça                            | [imagery.md](./imagery.md)                   |
| Movimento           | Calmo, ease-out, o símbolo se desenha e respira; vídeo com legenda queimada                                           | [motion.md](./motion.md)                     |
| Instagram           | Perfil @pilarsoft.app, 10 templates em 1080 px, grade do feed, checklist                                              | [social-instagram.md](./social-instagram.md) |
| Uso e cobranding    | Escrita do nome, uso por terceiros, logo de cliente                                                                   | [usage.md](./usage.md)                       |
| Brand book visual   | Tudo acima em uma página, com os diagramas                                                                            | [guidelines.html](./guidelines.html)         |
| Componentes e telas | Contrato de UI do produto                                                                                             | `docs/design/PILAR_DESIGN_SYSTEM.md`         |

## Arquivos de marca

`brand/assets/logo/` (SVG e PNG do logotipo, ícone e favicon, mais os diagramas) e
`brand/assets/*.svg` (escala tipográfica, forma e elevação). Tudo é gerado por
`scripts/brand/build.py`; não edite os SVG à mão.

## Pendências visuais

- [x] Tipografia: famílias, escala, pesos e piso definidos.
- [x] Logo e regras de uso anexados.
- [x] Verde #A4EC86 confirmado como cor da marca (favicon, manifesto, e-mail e logotipo já o usam).
- [x] Tratamento de imagem e ilustração: [design-language.md](./design-language.md), seção 7.
- [ ] Converter o código às medidas oficiais: ver "Divergências" em [logo.md](./logo.md) e a dívida
      de tamanho de fonte em [typography.md](./typography.md).
