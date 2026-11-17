# Leads: atividades, propostas em PDF e serviços terceirizados

Comparação com `staging` em `3287b94e575acbdace44c0ea5e7ad6fa484fcc3b`.
Cada imagem reúne a tela anterior (esquerda) e a implementação (direita), em viewports de 1440 × 1000 e 390 × 844. Capturadas com Chromium/Playwright sobre os componentes reais, no checkout da base e no checkout da alteração, respectivamente. Somente autenticação, consultas e dados foram substituídos por fixtures locais e fictícias. Não são capturas de produção e não validam serviços remotos.

| Tela                    | Desktop                           | Celular                          |
| ----------------------- | --------------------------------- | -------------------------------- |
| Detalhe do lead         | [Comparação](lead-1440.jpg)       | [Comparação](lead-390.jpg)       |
| Editor de fluxo         | [Comparação](fluxo-1440.jpg)      | [Comparação](fluxo-390.jpg)      |
| Pipeline de disciplinas | [Comparação](pipeline-1440.jpg)   | [Comparação](pipeline-390.jpg)   |
| Detalhe da disciplina   | [Comparação](disciplina-1440.jpg) | [Comparação](disciplina-390.jpg) |

## Escopo e operação

- Atividades em registros separados, com autor, data/hora da ocorrência e texto. As notas do cadastro são preservadas. Registrar uma reunião aqui não cria evento na agenda.
- PDFs privados de até 15 MB, anexados a propostas vinculadas ao lead, com histórico imutável de revisões, valor, validade, condições e motivo. Envio externo é registrado manualmente, separado do upload. Não envia email, não publica automaticamente no portal e não substitui o fluxo DOCX existente.
- Disciplinas internas ou terceirizadas, com nome do prestador e acompanhamento interno opcional. A indicação é preservada entre modelos, criação e edição de projetos. Etapas paralelas continuam paralelas; uma terceirizada pendente em coluna anterior impede iniciar/concluir as posteriores, inclusive no banco. Concluir o serviço libera o avanço manual, sem iniciar outras disciplinas automaticamente.
- Migração adiciona duas tabelas com RLS, bucket privado, políticas e triggers, além de dois campos de disciplina. Não migra nem altera as notas antigas. Não foi aplicada em ambiente remoto.

## Validação

- 596 testes relacionados em 46 arquivos, incluindo concorrência de envio do formulário, rascunho após erro, upload e limpeza de órfãos, histórico de atividade e dependências externas.
- TypeScript e build de produção aprovados; ESLint dos arquivos alterados sem erros (há avisos preexistentes de dependências de hooks).
- Migração aplicada em PostgreSQL isolado com esquema mínimo de apoio: 19 verificações de autorização, isolamento, integridade e bloqueio de etapas aprovadas. Não equivale à execução da suíte completa do Supabase.
- Adicionada suíte pgTAP para executar com o banco de testes completo do repositório. A suíte pgTAP completa não foi executada localmente (ambiente sem Docker).
- Guard de segurança da migração aprovado. Antes da publicação, aplicar a migração pelo fluxo normal de staging e validar upload/download com usuários reais de teste, permissões e faturamento do ambiente.
