# Inventário de funcionalidades da landing

A referência é o código do produto. A disponibilidade de cada fluxo depende da versão publicada, das permissões e das flags da conta. Os caminhos nesta lista apontam para a landing, salvo quando indicados como evidência de código.

| Subárea | O que demonstrar | Evidência no repositório | Destino |
|---|---|---|---|
| Operação do escritório | Início, tarefas, agenda e notificações | src/App.tsx, src/pages/inicio, src/pages/meu-trabalho | Gestão |
| CRM | Funil, cadastro e detalhe de cliente, atividades do lead | src/pages/leads/components/LeadAtividadesPanel.tsx, src/pages/clientes | Gestão e /funcionalidades/crm |
| Propostas | Escopo por disciplina, documento, link compartilhado e aceite quando disponível | src/pages/propostas, src/App.tsx, src/pages/cliente/ClienteProjetoDetail.tsx | /funcionalidades/propostas. Validar regras de conversão, versões e assinatura |
| Financeiro | Visão geral, lançamentos, carteira, faturas, importação por planilha, folha e relatórios | src/pages/Financeiro.tsx, src/pages/financeiro | /funcionalidades/financeiro |
| Equipe | Cadastro, metas, horas e comprovantes de folha | src/pages/pessoas, src/pages/metas, src/pages/Timesheet.tsx, src/pages/financeiro/tabs/FolhaPagamento.tsx | Gestão |
| Carteira | Lista, quadro, calendário, mapa e cronograma | src/App.tsx, src/pages/projetos/components | Projetos e /funcionalidades/cronograma |
| Disciplinas | Responsáveis, etapas, revisões e dependências | src/pages/projetos/components/DisciplinasTab.tsx e src/pages/projetos/hooks | /funcionalidades/disciplinas |
| Detalhe de projeto | Escopo, histórico, revisões, arquivos, tarefas, pagamentos e rentabilidade | src/pages/projetos/components/ProjetoDetailTabs.tsx e src/pages/projetos/hooks/useRentabilidade.ts | Projetos e /funcionalidades/escopo-e-aditivos |
| RDO | Registro diário, fotos, efetivo, medições e relatório | src/pages/obras/components/ObraDiarioTab.tsx e RelatorioDiarioDialog.tsx | /funcionalidades/diario-de-obra |
| Suprimentos | Fornecedores, cotação, link do fornecedor e estoque | src/pages/fornecedores, src/pages/cotar, src/pages/obras/components/ObraCotacoesTab.tsx e ObraEstoqueTab.tsx | Obra e /funcionalidades/cotacoes |
| Execução | Cronograma, importação, tarefas, relatórios e histórico de obra | src/pages/obras/components e src/pages/obras/lib/importarCronograma.ts | Obra |
| Conta de obra | Aportes, despesas, comprovantes, saldo e importação de extrato OFX | src/pages/obras/components/ObraContaTab.tsx e src/pages/obras/lib/importarOfx.ts | /funcionalidades/prestacao-de-contas |
| Estimativa e clima | Custos, preços, cenários, cronograma e consulta de clima | src/App.tsx e src/pages/obras/estimativa | Validar flags estimativa_obra e obras_clima antes de divulgar |
| Campo | Acesso por obra, registro do dia, gravação, arquivos, fila e sincronização | src/pages/campo, src/pages/obras/components/ObraAcessosTab.tsx | /campo. Gravar captura offline e recepção no escritório |
| Portal de projeto | Disciplinas, entregas, arquivos, parcelas e aprovação elegível | src/pages/cliente/ClienteProjetoDetail.tsx, ArquivosDoProjeto.tsx | /portal. Validar convite e fluxo de aprovação em produção |
| Portal de obra | Visão geral, cronograma, diário, fotos e conta de obra | src/pages/cliente/ClienteObraDetail.tsx e src/pages/portal/PortalContaObra.tsx | /portal |
| IA | Chat, pendências, componentes de revisão de lançamento, lead, projeto, aditivo, cobrança, prazo e orçamento | src/pages/chat | /funcionalidades/agentes. Conferir o que cada plano habilita antes de abrir novas páginas |
| Conta e configuração | Usuários, empresa, cobrança, MFA e suporte | src/App.tsx | Planos, Segurança e Ajuda |

## Captação e publicação

- Usar uma empresa fictícia em uma conta de demonstração e um projeto exemplo para propostas, disciplinas, parcelas e portal. A interface ilustrada no site identifica os dados de exemplo.
- Priorizar gravações curtas para Portal, Campo offline e confirmação dos Agentes. Capturar sem nomes, anexos ou documentos de clientes. Anotar nos prints as ações que o público deve observar.
- As novas páginas comerciais ficam em /funcionalidades para conviver com os redirects de links antigos do app em /gestao, /projetos e /agentes.
- Após publicar, verificar HTML e canonicals no domínio público, rodar inspeção no Search Console e comparar impressões sem marca e cliques por página em janelas de 28 dias. Cruzar cliques de demonstração com reuniões confirmadas no CRM.


### Expansão do catálogo e mídia

- Gestão ganha equipe e horas, importação financeira e carteira e cartões. Projetos ganha rentabilidade. Obra ganha cronograma, estoque e estimativas. Horas e estimativas dependem da habilitação da conta.
- O Portal ganha páginas de projetos, obras e financeiro. As capturas dessas páginas são comparativos do app com dados de teste, descritos em docs/design/antes-depois. A captura de estimativas foi feita com dados de teste e mostra a aba de custos.
- Os demais prints e os oito clipes vêm da interface da Pilar gravada com a empresa fictícia Atrium Engenharia, descrita em docs/marketing/video/README.md. Os vídeos são carregados sob demanda.
- Faltam gravações da navegação do cliente no Portal, da fila offline e sincronização do Campo, e da confirmação de uma ação por um agente. O trecho de Agentes publicado aqui mostra a aba de pendências.
