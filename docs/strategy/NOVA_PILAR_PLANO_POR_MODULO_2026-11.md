# Nova Pilar — plano por módulo e critérios de aceite

Complementa [a memória estratégica](NOVA_DIRECAO_PILAR_2026-11.md). Proposta de refinamento dos 29 cards existentes, aprovada em direção geral; decisões particulares continuam pendentes. Não substitui o log de decisões, specs ou ADRs vigentes. Numeração é referência de organização, não ordem rígida.

## Protocolo de execução de cada card

1. Ler estratégia, decisões vigentes, spec, design system, código atualizado e protótipo autorizado. Identificar divergências e preservar capacidades existentes.
2. Apresentar plano pequeno, dependências, migração e decisões abertas. Não implementar o próximo módulo automaticamente.
3. Reutilizar componentes oficiais, dados e cálculos compartilhados. Separar regra determinística de sugestões IA.
4. Testar estados normal/vazio/erro/carregando, permissões, isolamento de empresa, idempotência, migração de dados legados e mobile quando aplicável. Para UI seguir regra de antes/depois do repo. Não executar deploy/migração remota a partir de feature.
5. Registrar spec/ADR e critérios de aceite, abrir PR revisável. Não ativar módulos dormentes, alterar preços, contratar serviços ou enviar mensagens sem autorização específica.
6. Validar resultado com cliente real quando o card for estratégico. Atualizar status somente após evidência.

## Cards (escopo, aceite e limites)

### 01 — Fundação visual mínima
- Escala de espaçamento 4/8/12/16/24/32; header 64 e toolbar 52 como referências, não altura obrigatória; controles 36 e compactos 28–32; toque 44–48. Usar tokens existentes, contraste, teclado e foco. Uma ação primária por contexto.
- PilarPage, FormDialog, DataTable, StatusBadge, formatação compartilhada. Filtros frequentes visíveis, avançados no painel, chips removíveis, período com semântica, visualização salva quando necessário. Cadastro inline sem modal aninhado; confirmação proporcional ao risco; desfazer só quando seguro.
- Aceite: tela piloto em notebook e desktop, mobile, 5/50/500 registros, estados e a11y; documentação e varredura sem regressões. Não refazer todas as telas.
### 02 — Fluxos
- Página própria com lista/editor, tipologias sugeridas, disciplinas/entregáveis, dependências paralelas, calendário, aprovações, revisões, responsáveis, etapas opcionais, marcos de pagamento. Distinguir preço por serviço de parcela.
- Rascunho/publicado/arquivado; versões publicadas imutáveis; criar disciplina inline, não editor de fluxo complexo no dropdown. Migrar legado sem romper vínculos.
- Aceite: dependências acíclicas e prazo coerente; editar modelo não altera proposta/contrato anterior; três modelos usados em propostas reais como objetivo. Depende da base mínima.
### 03 — Propostas e linha de base
- Selecionar fluxo, ajustar escopo e entregáveis, calcular prazo por dependências, separar custo estimado, margem, preço e parcelas. Histórico de versões, proposta pública consistente com a versão enviada.
- Política de aceite versus assinatura a aprovar; linha de base congela escopo/valores/revisões/prazos; projeto preparado em planejamento, sem início ou cobrança automática; transação idempotente. Remover modal redundante só após validar a jornada e o legado.
- Aceite: aceitar duas vezes não duplica projeto/parcelas; versão pública igual à aprovada; autorização e auditoria; mudanças do template não afetam contrato. Depende de 02.
### 04 — Projetos e execução
- Página completa, sem modal intermediário; lista/quadro; visão saúde (prazo, margem, escopo, bloqueios). Abas visão geral, cronograma, disciplinas, tarefas, escopo, financeiro, arquivos, atividade.
- Contratado × planejamento atual × realizado; início/conclusão e correções auditadas, tempo de aprovação, períodos bloqueados e dependências. Duração em dias não é esforço. Histórico integrado.
- Aceite: replanejar não altera contrato; aprovações e versões com autoria; margem rotulada por completude; deep links/abas preservados. Depende de 03; harmonizar com 24.
### 05 — Escopo e aditivos
- Distinguir versão técnica, correção interna, revisão solicitada, serviço adicional e mudança de terceiro/norma/prazo; detectar indício, confirmar causa e cobertura contratual. Sem cobrança por mero atraso/custo excedente.
- Rascunho, envio, aceite/recusa, contratado, faturado, recebido; aditivo separado ou redistribuição de parcelas futuras mediante decisão; nunca sobrescrever recebidas.
- Aceite: causa e evidência obrigatórias, aprovação idempotente, linha de base nova preservando anterior, impacto só recebido. Depende de 03/04 e instrumentação 06.
### 06 — Impact e Ultra
- Instrumentar eventos já na primeira entrega; evidência, origem, metodologia, estado, responsável, potencial, confirmado, realizado, reversão. Separar receita recebida, economia comprovada, desembolso postergado, tempo estimado e risco resolvido. Excluir oportunidades descartadas do aberto. Desempenho da empresa não é todo atribuível ao produto.
- Resultados com drill-down, rentabilidade/produtividade, North Star empresas com benefício validado em 30 dias (contagem e taxa). Ultra: MRR, retenção, ativação, custo por empresa, saúde, qualidade de dados e falhas; acesso excepcional auditado.
- Aceite: exemplos contábeis reconciliáveis, deduplicação, estorno, permissões; primeiro valor verificado, não inventado. Fundação em paralelo, painel depois dos eventos.
### 07 — Onboarding
- Cinco diagnósticos manuais primeiro; MVP três entradas: planilha clientes/projetos, contratos/propostas PDF, financeiro simples. Não prometer formatos complexos universais.
- Setup por segmento/dor, modelos de fluxo, biblioteca de referência. Central de importações reutilizável: arquivo original, mapeamento, validação, prévia, duplicidade, datas, totais, parcial, falha explícita, histórico e desfazer seguro.
- Aceite: testes com arquivos reais autorizados, contagens do diagnóstico iguais aos importados, nenhuma gravação silenciosa; informação insuficiente explicitada.
### 08 — Landing Pilar
- Resolver decisão da tagline vigente antes de substituir. Vender resultado, não número de agentes; público amplo e campanha segmentada. Demonstrar jornada disponível; funcionalidades futuras identificadas ou omitidas. Manter CTAs vigentes e preços sem alteração.
- Aceite: revisão da mensagem, provas reais autorizadas, mobile e links; conferir checkout de produção. Pode ajustar texto de recursos existentes já.
### 09 — Portão 1
- Entrevistas sobre fatos e perdas reais, disposição a pagar, cinco diagnósticos, três empresas com benefício validado. Testar formatos diversos e tempo de implantação.
- Aceite: evidência documentada, hipótese revisada, plano seguinte ajustado. Data é meta, não substitui resultado. Pesquisa desde o início.
### 10 — Planta Viva
- Documentos/versões/folhas/vistas/pavimento/escala/orientação; leitor assistido com origem, confiança e conferência visual, correção/desenho manual. Ambiente manual é plano B. Diferenciar espaços e elementos que atravessam cômodos, múltiplos vínculos e serviços gerais.
- Planta 2D: zoom, camadas, legenda, seleção, lista alternativa, revisão de versão. Dados não confirmados não viram orçamento/medição.
- Aceite: dez plantas reais autorizadas como piloto, métricas por formato, falha explícita; sem 3D obrigatório.
### 11 — Campo
- Captura voz/foto/QR, obra/ambiente/elemento/serviço, geral e múltiplos vínculos; recebimento de material, evidência, ocorrência e serviço com estados próprios. QR só contextualiza, exige autorização. Checklists antes de fechar configuráveis; não certificam etapa.
- Offline: salvo local, fila, envio, recebido, processamento, revisão, falha/retry; sem duplicar registros. Ver como somente leitura, usar como eu com autoria.
- Aceite: dois pilotos, captura rápida observada, recuperação após fechamento/offline, permissões e evidência.
### 12 — Físico-financeiro
- Distinguir regime administração, empreitada global, medição e honorários; aportes não são faturamento automaticamente. Separar avanço físico ponderado, valor planejado, agregado, custo incorrido, comprometido e desembolso.
- Projeção por eficiência com premissas e dados suficientes, custo restante e previsão técnica; boletim com contratado, acumulado anterior, período, acumulado atual, preços, adiantamentos, retenções, evidência e aprovação. Medir não paga automaticamente.
- Aceite: cálculos determinísticos e arredondamento, sem pagamento duplicado; projeção validada, sinalizar dados incompletos. Depende de captura e serviços, não de planta perfeita.
### 13 — Caixa de entrada (duas versões)
- V1 antecipada: upload, desvios, importações, aprovações, histórico; estados processando, inconsistência, pendente, resolvido, falha. Original lado a lado, evidência, atribuição, deduplicação e correção.
- V2: e-mail, WhatsApp oficial, integrações bancárias após aprovação de custos, privacidade e demanda. Sem leitura de WhatsApp pessoal.
- Aceite: cada item tem ação e origem, não duplica tarefas/notificações, respeita permissões; aprovação explícita de operação sensível. V1 em paralelo com 05/07.
### 14 — Portal
- Projeto: entregáveis/aprovações/solicitações/pagamentos; obra: progresso/ambientes/evidências. Solicitações conectam escopo. Preview somente leitura separado de configuração/publicação; sem aprovar como cliente.
- Aceite: autorização server-side por cliente/projeto/obra, conteúdo privado nunca vaza, histórico de publicação; resumo com consentimento e autorização.
### 15 — Obra (lista e abas)
- Lista com saúde e filtros; visão geral, planta, diário, cronograma, tarefas, compras, financeiro/medições, documentos, relatórios, cliente/acessos. Preservar rotas e recursos legados; alinhar com 10–14.
- Aceite: cada função anterior localizável, abas respeitam acesso e feature, lista com volumes distintos, mobile contextual.
### 16 — Portão 2
- Duas obras piloto, registros regulares, medição vinculada a evidências, projeção confrontada com dados reais e engenheiro responsável; estudo de caso autorizado; validar disposição a pagar.
- Aceite: evidências, cobertura/qualidade e observações em campo; não avançar por mero merge.
### 17 — Passaporte
- Validar com proprietários; compilar documentos, elementos, materiais, garantias, fotos autorizadas e versões confirmadas. Preservar lacunas, diferenciar evidência de certificação.
- Aceite: entrega navegável e exportável, sem conteúdo interno, rastreabilidade e autorização. Dados começam em 10/11.
### 18 — Inteligência acumulada
- Separar Index individual (ciclo, aprovação, entregas, retrabalho, amostra e comparação), comparação de versões, sobreposição/heurística de ponto sobre pilar, MCP read-only com escopo.
- Aceite: Index sem amostra insuficiente ou benchmark coletivo prematuro; comparador preserva origem e confirmação; geometria é sugestão técnica; MCP respeita tenant e perfil. Não condicionar Index ao gêmeo.
### 19 — Navegação
- Barra única, grupos recolhíveis, favoritos se úteis, módulos por empresa/perfil conforme regras vigentes. Compras e fornecedores acessíveis mesmo sem obra. Busca simples independente de LLM; consulta com fontes e ajuda contextual.
- Aceite: links antigos redirecionam, filtros e contexto preservados, navegação não é autorização. Antecipar shell mínimo com 01.
### 20 — Início e Meu trabalho
- Gestor vê decisões/financeiro/riscos; colaborador vê entregas, dependências e bloqueios. Caixa para ação; notificação para informação. Não confirmar pagamento/aditivo por dispensar alerta.
- Aceite: ações contextuais, responsável e origem; fila derivada de disciplinas sem tarefas duplicadas; permissões.
### 21 — Comercial
- Funil configurável, próxima ação, tempo na etapa, origem, valor, última interação e motivo de perda. Lead página; criação rápida modal, briefing progressivo, documentos e propostas. Cliente com histórico integrado; conversão deduplicada. Agenda deriva eventos sem duplicar.
- Aceite: preservar campos/estágios legados, ações rápidas e filtros, proposta vinculada a lead/cliente existente; priorizar passagem comercial com 03.
### 22 — Financeiro
- Caixa, resultado, rentabilidade e obrigações distintos; previsão com premissas, parcial/confirmado/pago/conciliado/cancelado. Categorias e centro de custo inline, detecção de duplicidade.
- Folha gerencial não processamento trabalhista; carteira e relatórios usam cálculos compartilhados. Margem estimada/apurada com cobertura, sem horas inventadas. Conferir estado atual dos avisos antes de alterar.
- Aceite: conciliação de totais/parcelas/estornos, datas explícitas, permissões, nenhuma movimentação sem confirmação.
### 23 — Compras e estimativas
- Fornecedor com múltiplas categorias, deduplicação, exportação, histórico objetivo de preço/prazo/recebimento separado de avaliação subjetiva. Comparar cotação por unidade equivalente, frete, prazo e condições.
- Necessidade→cotação→pedido→recebimento→estoque/aplicação→financeiro. Quantidade estimada/extraída/confirmada/manual distinta da origem do preço; referência com região/mês/unidade/licença. Clima contextual sem replanejar contrato automaticamente.
- Aceite: sem duplicar custos, origem verificável, quantitativo confirmado não sobrescrito silenciosamente.
### 24 — Visões de projetos
- Lista/quadro e colunas configuráveis, prazo/responsável/status/prioridade; financeiros só autorizados. Cronograma geral e calendário derivados da mesma fonte; disciplinas agregadas por responsável, capacidade estimada não esforço. Mapa opcional.
- Aceite: coerência com 04, ausência de duplicidade, filtros persistentes, não ranquear pessoas só por velocidade.
### 25 — Empresa e conta
- Configurações agrupadas, cadastros, importações, acessos e automações. Equipe/tarefas com critérios transparentes; manter MFA e segurança. Planos/checkout atuais, créditos transparentes; anual só se aprovado.
- Aceite: preços/limites conferidos, sem dados de cartão armazenados, sem mudança comercial implícita.
### 26 — Entrada e páginas públicas
- Login/cadastro/recuperação/MFA, sem acesso, status real, termos; cotação por link limitado, expirável/revogável e mobile.
- Aceite: token inválido/expirado, autorização, recuperação e acessibilidade; sem dados internos expostos.
### 27 — Mobile
- Hoje/Caixa/+/Trabalho/Mais por perfil/contexto; listas e timeline em vez de Gantt/tabela reduzida; formulário tela cheia, filtros inferiores. Captura opcional por câmera; aprovação sensível explícita.
- Aceite: junto de cada módulo, 390px e outros tamanhos, teclado, offline/rede lenta, permissões negadas, upload falho, sessão expirada e interação real.
### 28 — Relatórios/ajuda
- Catálogo único, filtros, exportação e destinatários autorizados. Métricas iguais às visões de origem; ajuda contextual e novidades sem ruído.
- Aceite: permissão, totais, períodos, conteúdo enviado auditável; agendamento somente autorizado.
### 29 — Marca
- Validar Archivo e alternativas para Pilar, Syne como hipótese BEZ; fontes reais, favicon, tamanhos pequenos, fundos claro/escuro, legibilidade. Não trocar identidade antes de aprovar.
- Aceite: escolha registrada no log vigente e arquivos de marca; nenhum redesign automático.

## Dependências sugeridas

01 + shell mínimo 19 + eventos 06 → 02 → 03 → 04 → 05 → 06 (interface). Caixa 13 V1 em paralelo com 05/07, 07 diagnóstico e 09 entrevistas desde o início, 08 apenas capacidades disponíveis. 10/11 pilotos após validação comercial; 12 depende de serviços e evidências, 14/15 compartilham dados; 16 valida; 17 depois de evidências. 18 Index assim que amostra individual permitir, demais capacidades separadas. 21/22/24 entram nas respectivas jornadas, 27 acompanha cada módulo. Não bloquear entrevistas por dependência de software.

## Fonte e limites

Auditoria de protótipo estático: 229 pranchas, 21 módulos, 29 cards e 133 subtarefas exportadas; contagens não provam implementação. Divergências detectadas: modal de aceite vs conversão automática; números diferentes na proposta pública/editor; 34 selecionados vs 37 importados; versão de arquivo vs revisão; aditivo faturado vs recebido; desembolso retido vs economia; avanço físico vs valor agregado; fórmulas demonstrativas e opção anual não decidida. Corrigir dados de demonstração com jornada única antes de validar UI. Ultra Admin ainda incompleto, fontes substituídas em algumas renderizações. Não houve auditoria de produção nesta revisão.
