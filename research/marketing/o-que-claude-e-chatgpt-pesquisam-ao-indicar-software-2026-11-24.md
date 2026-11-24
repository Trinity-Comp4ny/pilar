# O que Claude e ChatGPT pesquisam ao indicar software para escritório de engenharia

Coleta de 2026-11-24, uma pergunta, uma conversa por IA, conta logada, busca na web ligada.
Amostra pequena: serve para direção de conteúdo, não para ranking. Repetir a cada poucas semanas com perguntas diferentes.

**Pergunta usada:** "Qual o melhor software de gestão financeira e de projetos para um escritório de engenharia multidisciplinar pequeno no Brasil? Quero controlar rentabilidade por projeto, medições e fluxo de caixa."

## Método (Claude)

Guia "O que o Claude pesquisa" (não oficial, usa endpoint interno do claude.ai): conversa nova, depois `GET /api/organizations/<org>/chat_conversations/<id>?tree=True&rendering_mode=messages&render_all_tools=true` e leitura dos blocos `tool_use` com `name: WebSearch`. No Claude, a ferramenta se chama `WebSearch`, não `web_search`; o campo é `input.query`. Pode quebrar sem aviso.

## Termos que o Claude pesquisou (7 buscas)

1. software gestão escritório de engenharia projetos rentabilidade por projeto medições fluxo de caixa
2. ERP para empresas de projetos de engenharia e arquitetura Brasil comparativo 2026
3. Omie vs Conta Azul vs Bling gestão financeira empresa de serviços projetos preço 2026
4. software gestão de projetos de engenharia consultiva horas apontamento custo por projeto Brasil
5. Omie módulo projetos rentabilidade por projeto lançamentos financeiros
6. sistema gestão escritório arquitetura engenharia projetos Brasil controle de horas medição contratos ArchOffice
7. Conta Azul centro de custo projetos relatório DRE por projeto

Padrões: sempre "Brasil", "2026", "comparativo", "preço"; ancora em generalistas (Omie, Conta Azul, Bling) e não em nichados; "engenharia consultiva", "apontamento de horas", "centro de custo", "DRE por projeto" são o vocabulário de busca. Domínios mais lidos: getharvest.com, contaazul.com, omie.com.br, clickup.com, flowlu.com, b2bstack.com.br, sienge.com.br. O Pilar não apareceu nas fontes.

## ChatGPT

Interface não expõe as buscas sem token de sessão (não extraído). O que dá para ver é o resultado:

- Recomendou FlowUp, Fontti Business, Vobi, **Pilar**, Mais Gestão, Mais Controle, OrigamiFlow. Disse que agendaria demo de FlowUp, Fontti e Pilar.
- Sobre o Pilar: "especializada em engenharia multidisciplinar", cita disciplinas, dependências, propostas, portal do cliente, agentes de IA com aprovação, usuários ilimitados, R$ 299/mês (Essencial, 10 projetos ativos), vindos da página de preços.
- **Lacunas que ele apontou:** (1) um artigo oficial de novembro de 2026 diz que a rentabilidade completa depende de consolidação dos dados; (2) não confirmou fluxo de medição contratual. Na tabela: rentabilidade "Parcial", medições "A confirmar".
- Disse também que nenhuma solução demonstra publicamente rentabilidade por disciplina + medições + aditivos + fluxo de caixa juntos.

## O que fazer com isso

- Publicar página/post que afirme com clareza (sem hype) o que o Pilar já faz de rentabilidade e de medição/aditivos, usando as palavras acima: "rentabilidade por projeto", "rentabilidade por disciplina", "apontamento de horas", "boletim de medição", "engenharia consultiva". Conferir primeiro o que é verdade no produto (CLAUDE.md: Timesheet e Rentabilidade são dormentes).
- Rever o artigo de novembro que ressalva a rentabilidade: a IA o leu e repete a ressalva.
- Entrar nas fontes que as IAs leem (comparativos tipo b2bstack, páginas "vs Omie / Conta Azul") e ter página de comparação própria.
