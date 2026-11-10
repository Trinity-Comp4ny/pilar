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

- Toasts que não apareciam: os avisos disparados pelo sistema antigo de toast (não montado) foram migrados para o sistema ativo. (#194)
- Mensagens de erro que vazavam texto técnico cru agora são sanitizadas e trazem o próximo passo, em Projetos, Clientes e Financeiro. (#204)
- Campos de data (sem hora) deixam de sofrer deslocamento por fuso horário. (#195)

## [1.0.0]

- Baseline: plataforma em uso pelos design partners (Dashboard, Projetos, Propostas, Leads, Clientes, Financeiro, Pessoas, Mapa, Relatórios, Portal do Cliente).
