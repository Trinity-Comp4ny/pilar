# Responsável terceirizado e atividades do lead com menções

Base: staging em `4ea5231f12947eddaf34bffd8fdbc0883c9289a6` (inclui a PR #910).

Capturas feitas com Chromium/Playwright nos componentes reais da base e da implementação, em worktrees separadas, com fixtures fictícias e autenticação/API substituídas apenas no harness. Viewports: 1440 × 1000 e 390 × 844. Cada imagem reúne ANTES (esquerda) e DEPOIS (direita).

| Tela | Desktop | Celular |
| --- | --- | --- |
| Atividades do lead | [Comparação](lead-1440.jpg) | [Comparação](lead-390.jpg) |
| Editor de fluxo | [Comparação](fluxo-1440.jpg) | [Comparação](fluxo-390.jpg) |
| Detalhe da disciplina | [Comparação](disciplina-1440.jpg) | [Comparação](disciplina-390.jpg) |

O campo de responsável oferece “Serviço terceirizado” junto das pessoas. Não há campos adicionais de execução ou prestador. A atribuição e o tipo de execução são salvos juntos; os dados de execução existentes continuam disponíveis internamente e as dependências externas permanecem bloqueantes.

O lead usa o mesmo compositor de comentários das disciplinas, com menções por nome e @todos/@all. A data passa a ser automática no banco. A migração guarda os ids mencionados, cria o aviso no sino após a inserção, usa o envio de e-mail já existente e remove o aviso se a atividade for excluída. O link abre o lead e destaca a atividade. A rotina filtra destinatários ativos da mesma empresa, exclui o autor e respeita as preferências de notificações.

A migração deve seguir o deploy normal de staging após o merge. Nenhuma migração foi aplicada em ambiente remoto durante a implementação.
