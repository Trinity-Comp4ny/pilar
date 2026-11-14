# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versão segue [SemVer](https://semver.org/lang/pt-BR/).

Regras deste repo:

- **Deploy ≠ release.** Vários deploys por dia não viram entrada aqui. Uma entrada é só quando há algo que o cliente precisa saber.
- **`[Não lançado]`** = está em `staging`, ainda não promovido para produção (`main`). Ao promover, renomeia-se a seção para a versão e a data.
- Todo PR de feature ou fix visível ao usuário acrescenta uma linha em `[Não lançado]`, na categoria certa (Adicionado / Alterado / Corrigido / Removido).
- A versão de runtime em produção é o commit SHA exposto em `/health` (`RELEASE_SHA`); esta é a versão amigável, voltada a suporte e ao cliente.
- **O cliente vê as novidades dentro do app (SPEC 152).** Commit que muda o que o usuário vê ou faz leva as linhas `Novidade: <frase para o cliente>` e `Impacto: fluxo | melhoria | correcao` (opcional `Modulo: <feature>`). No deploy em produção elas viram rascunho em `/ultra-admin/releases`; publicado, aparece em Novidades. Este arquivo segue como histórico técnico.

## [Não lançado]

### Adicionado

- Prévia de recursos: ligue um recurso novo antes de todo mundo em Configurações → Conta, com feedback e volta à versão atual. No Ultra admin, prazo de 7 dias em cada problema relatado. (SPEC 160)

- Alerta de acesso à conta por navegador novo, no sino e por e-mail, e lista dos navegadores que entraram em Configurações → Segurança. (SPEC 159)

- Comunicados da plataforma: o time do Pilar avisa os escritórios dentro do app, em faixa ou modal, por escritório, plano ou papel. Criados em `/ultra-admin/comunicados`. (SPEC 157)

- Pesquisa de satisfação (NPS) no Início, no máximo a cada 90 dias, e pergunta rápida "Foi fácil?" depois de lançar, criar proposta ou lead. Respostas em `/ultra-admin/satisfacao`; detrator avisa o ultra admin na hora. (SPEC 156)

- Agente da ajuda no canto da tela ("Como faço?"): responde com o passo a passo e leva até a tela; o que não tem artigo segue para os agentes ou para o suporte. Perguntas sem resposta aparecem em `/ultra-admin/ajuda`. (SPEC 155)

- Central de ajuda (`/ajuda`) com passo a passo das tarefas mais comuns, botão "?" no topo das telas que têm artigo e artigos na busca ⌘K. (SPEC 154)

- Faixa de aviso no topo do app quando há instabilidade declarada ou manutenção programada, com o que é afetado e o link para a status page. Manutenções cadastradas em `/ultra-admin/incidentes`. (SPEC 153)

- Novidades dentro do app: página Novidades, modal "O que mudou" quando o caminho de uma tarefa muda, aviso de versão nova com a contagem do que veio, e aviso no sino para quem pediu a mudança. Releases revisadas e publicadas em `/ultra-admin/releases`. (SPEC 152)

- Onboarding guiado: checklist de primeiros passos por pilar (Gestão/Projetos/Obras) e tour com coach marks nas ações principais. (#202)
- Command palette (⌘K / Ctrl+K) para navegar e criar registros rápido. (#194)
- Selo de frescura do dado ("Atualizado há X", clicável para revalidar) nas telas de dinheiro: Início, Visão Geral, Lançamentos e Rentabilidade. (#204)
- Central de notificações in-app, com sino no rodapé da barra lateral e preferências por usuário.
- Carteira: visão única que reúne contas e faturas de cartão.

### Alterado

- Design system: cores migradas para tokens semânticos, Badge com variantes de status e Button com a cor da marca por padrão. (#196)
- Formulários: campos de dinheiro, número e porcentagem passam a usar primitivos dedicados (MoneyInput / NumberInput / PercentInput), com máscara e teclado corretos. (#195, #197–#201)
- Microcopy de botões padronizada em sentence case.

### Corrigido

- Nova receita e Nova despesa na busca ⌘K abriam abas do Financeiro que não existem mais; agora abrem Lançamentos.

- Toasts que não apareciam: os avisos disparados pelo sistema antigo de toast (não montado) foram migrados para o sistema ativo. (#194)
- Mensagens de erro que vazavam texto técnico cru agora são sanitizadas e trazem o próximo passo, em Projetos, Clientes e Financeiro. (#204)
- Campos de data (sem hora) deixam de sofrer deslocamento por fuso horário. (#195)

## [1.0.0]

- Baseline: plataforma em uso pelos design partners (Dashboard, Projetos, Propostas, Leads, Clientes, Financeiro, Pessoas, Mapa, Relatórios, Portal do Cliente).
