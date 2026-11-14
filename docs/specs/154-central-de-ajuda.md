# SPEC: Central de ajuda e ajuda contextual

**Data:** 2026-11-10
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** plataforma (ajuda)
**Relacionada:** [SPEC 152](152-o-que-mudou-e-voce-pediu-entregamos.md) (novidades), [SPEC 147](147-chat-do-agente-com-ferramentas-e-proatividade.md) (chat do agente), pesquisa [profissionalizacao-saas-referencias](../../research/themes/profissionalizacao-saas-referencias.md)

## Problema

Não existe ajuda dentro do Pilar. Quem não acha onde fazer algo pergunta no WhatsApp, e cada
pergunta repetida é tempo do sócio. O agente no canto da tela (próxima spec) também precisa de
uma fonte confiável para responder "como faço X" sem inventar caminho.

## Objetivo

Para as tarefas mais comuns dos módulos ativos, o usuário acha em segundos o passo a passo, a
partir da tela onde está, da busca ⌘K ou da central, e vai direto para a tela certa.

**Fora de escopo:**

- Agente no canto da tela respondendo pela central (SPEC própria, usa estes artigos).
- Vídeo, GIF e prints nos artigos (fase 2; print envelhece rápido com o design mudando).
- Central pública fora do login (fase 2: o mesmo conteúdo pode ir para a LP).
- "Este artigo ajudou?" com nota.

## Requisitos

1. Artigos em markdown versionados no repo (`src/content/ajuda/<slug>.md`), um por tarefa, com
   índice tipado (`src/content/ajuda/indice.ts`): título, resumo, grupo, rotas e palavras-chave.
   O texto muda no mesmo PR que muda a tela.
2. `/ajuda` lista os artigos por grupo, com busca sem acento; `/ajuda/:slug` mostra o artigo e o
   botão "Ir para a tela".
3. O cabeçalho de toda página (`PageHeader`) mostra um "?" quando a tela tem artigo: um artigo
   abre direto; mais de um abre a lista "Desta tela".
4. A busca ⌘K mostra o grupo "Ajuda" com até 4 artigos que respondem ao que foi digitado.
5. "Central de ajuda" no menu do usuário e no menu do celular.
6. Busca sem resultado e fim de artigo oferecem "Enviar feedback": a pergunta sem resposta vira
   pauta de artigo novo.

Requisitos não-funcionais:

- **Bundle:** o índice é leve e vai no bundle de entrada; o texto de cada artigo é baixado só
  quando ele abre.
- **Confiabilidade:** um teste reprova o PR se o índice e os arquivos divergem, se um artigo
  cita rota que não existe no App, ou se o texto usa palavra banida da marca.
- **Segurança:** markdown renderizado sem HTML cru (react-markdown escapa por padrão).

## Critérios de aceite

- [ ] Dado que estou em `/leads`, então vejo o "?" no cabeçalho e ele abre o artigo de leads.
- [ ] Dada uma tela sem artigo, então não aparece "?".
- [ ] Dado que digito "fatura" no ⌘K, então aparece o artigo de faturas no grupo Ajuda.
- [ ] Dado que busco "orcamento" sem acento na central, então acho o artigo de proposta.
- [ ] Dado um artigo com link para rota inexistente, então o teste `scripts/ajuda-artigos.test.ts`
      reprova.

## Dados e contratos

Sem banco. `ArtigoAjuda { slug, titulo, resumo, grupo, rotas[], palavras[] }` em
`src/content/ajuda/indice.ts`; busca e casamento por rota em `src/lib/ajudaBusca.ts`.

## Plano de implementação

1. Índice, busca e carregamento sob demanda + teste de consistência.
2. Páginas `/ajuda` e `/ajuda/:slug`, "?" no `PageHeader`, grupo Ajuda no ⌘K, entradas de menu.
3. Primeiros artigos das tarefas mais comuns, escritos a partir do código (rótulos e caminhos
   reais), na voz da marca.

## Decisões e riscos

- **Markdown no repo em vez de CMS:** o texto anda junto com a tela, revisado no mesmo PR, e o
  teste pega caminho quebrado. Migrar para banco só se alguém fora do time precisar editar.
- **Risco: artigo desatualizado.** Mitigação: o teste de rotas, e a regra de que PR que muda o
  caminho de uma tarefa atualiza o artigo (o trailer `Impacto: fluxo` da SPEC 152 é o lembrete).
