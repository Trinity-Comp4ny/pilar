# Pricing: Modelo de Cobrança do Pilar

> Rascunho **v3** · atualizado 2026-08-17 (v2 em 2026-08-10, v1 em 2026-07-13) · números indicativos para validação com o design partner, **não** é tabela final de preço.
> Versão visual (para apresentar): artifact "Como o Pilar vai cobrar".

---

## Decisão 2026-08-17: resposta à auditoria externa de posicionamento/pricing (ajusta a v2, não substitui)

Uma auditoria externa de posicionamento/performance revisou o modelo v2. Este bloco registra o parecer de Pricing: o que confirma, o que ajusta, o que rejeita, checado contra o código real (não a proposta). **Prevalece sobre a v2 abaixo onde houver divergência; onde não há divergência, a v2 continua valendo.**

### O que a auditoria acertou e eu confirmo (convergência, não é novidade, reforça a v2)

1. **Usuários ilimitados está certo.** A auditoria cita Procore como comparável: também usa usuários ilimitados, com o **volume anual de construção** como eixo comercial (confirmado via busca: Procore cobra por ACV, "Annual Construction Volume", contrato anual, sem fee por assento; 🟡 faixas de preço são estimativa de terceiros, Procore não publica tabela). Isso é exatamente o padrão que a v2 já defende: seat é regra ruim, a régua tem que ser **o trabalho/valor que passa pela plataforma**, não cabeças. Procore usa volume de obra porque isso é o valor pra construtora; o equivalente do Pilar pro ICP de engenharia multidisciplinar é **projetos ativos** (é o que o escritório projetista pensa), não volume de obra.
2. **"Uma plataforma, todo plano" está certo.** A sugestão da auditoria (planos variam por capacidade/IA/suporte/implantação, nunca por funcionalidade central) é literalmente a decisão de 2026-08-10 (item 1 e 5). Convergência independente reforça a tese; não é preciso mudar nada aqui.
3. **Trocar "crédito de IA" por "ação de IA": adoto.** Comunica valor melhor sem quebrar a doutrina de nunca expor token: "ação" é ainda mais concreto que "crédito" pro cliente AEC. Renomeio a Camada 2 abaixo.
4. **Arquivar obra concluída libera capacidade de graça, reativar consome de novo: adoto.** É a mesma regra que a v2 já aplica a projeto ativo (linha "Arquivar libera a cota, na hora e de graça"). Estender o mesmo contrato de confiança pra obra é consistente, não é um princípio novo.
5. **2 meses grátis no anual: já é a prática, não é mudança.** O seed do banco (`preco_anual` = 10× o mensal em todos os 3 planos hoje) já embute esse desconto. Carregar pra qualquer nova tabela de preço, sem reabrir a conta.
6. **Implantação assistida como diferenciador de tier: adoto o princípio.** Nível de atendimento/onboarding é **serviço**, não feature-flag, cabe na doutrina "tier muda quanto, nunca o quê" sem violar "feature-flag nunca é venda à la carte" (regra 4 do meu cérebro). Preço exato (R$690-1.500 sugerido) fica marcado como hipótese, não validado com cliente.

### O que ajusto (a auditoria tem razão na direção, mas a v2 precisa corrigir o alcance)

7. **Separar "obras ativas" de "projetos ativos" como eixo: a crítica é real e ficou MAIS válida desde 2026-08-10, não menos.** Quando a v2 foi escrita (10/08), Obras era "em breve, incluído sem custo extra" (feature off por default, só a VRZ ligada). Desde então (specs 015→019→026→027, migrations `20260730`→`20260829`) o módulo cresceu: RDO, cronograma de frentes, cotações, estoque, conta da obra, portal do cliente na obra. Não é mais "em breve": é produto real rodando com um design partner. A auditoria está certa: um escritório com 30 projetos de engenharia e 2 obras é um perfil comum do ICP (projetista que só ocasionalmente administra a obra), e cobrar tudo pela mesma régua de "projeto" sub ou sobre-precifica esse caso. **Decisão: obras ativas vira um segundo eixo de capacidade, distinto de projetos ativos, mas SEM números de faixa fixados hoje.** Motivo (ver "Dependências técnicas" #7): não existe `max_obras` no banco, não existe contador/RPC de obra ativa amarrado a plano, e Obras ainda é toggle por empresa, não entitlement por plano. Fixar "2/5/12 obras" na tabela de venda hoje seria vender um limite que o sistema não sabe aplicar (o mesmo erro que a v2 original cometeu com projetos: feature-flags setados fixos, plano não muda acesso). Antes de vender por obra, fechar o mesmo elo plano→capacidade que já está pendente pra projeto, agora estendido a obra.
8. **Preço de entrada: nem R$199 (real hoje) nem R$349 (sugestão da auditoria): mantenho a âncora da v2 até validar.** A auditoria usa Obra Prima (a partir de R$399,20 🟡 confirmado por busca, faixa "planos a partir de R$399") e Gestor Obras (~R$499 🟡 não confirmado por fonte primária, só citado pela auditoria) como piso de comparação pra justificar subir o Essencial. **Discordo do benchmark, não da direção.** Obra Prima e Gestor Obras vendem gestão de obra pra construtora/pequena construtora, ICP diferente do Pilar (engenharia multidisciplinar projetista, ver `ANALISE_COMPETITIVA_VOBI.md`: "não atende diretamente: engenharia elétrica, ambiental, consultoria técnica" é o espaço do Pilar). Ancorar o preço do Pilar no piso de ferramenta de obra é ancorar na cesta errada: arrisca subprecificar de novo, só que contra o comparável errado. O comparável certo é Monograph (US$25-55/seat, ~R$1.700/mês pra um time de 7) e o custo da hora do sócio/orçamentista (`research/themes/pricing.md`: "ancorar contra o custo da hora do sócio, não a planilha"), não a ferramenta de obra brasileira mais barata. **Ação:** manter a hipótese de ancoragem R$490/690/1.290 da v2 (Profissional e Escala convergem com a sugestão da auditoria: 690 e 1.290 batem; só o Essencial diverge, 490 vs 349) até a resposta escrita do design partner. Não baixar pra 349 sem dado de cliente que sustente isso: ir na direção contrária do a16z ("erro nº1 é preço baixo, ancorar alto", `research/themes/pricing.md`) sem necessidade.
9. **Resolver a divergência de preço "real" ANTES de qualquer copy de "Founding Customer".** A auditoria cita R$199/490/990 como preço público monitorado hoje. O seed em `027_pilar_saas_subscriptions.sql` grava R$97/197/397, e usa `ON CONFLICT (slug) DO NOTHING`, ou seja, se o banco de produção já tinha outros valores quando essa migration rodou, ela **não sobrescreveu**; o valor real em produção pode ser um terceiro número, diferente dos dois. Não encontrei página de preço pública no código do repo (`src/`) com nenhum dos três conjuntos de número: a fonte da auditoria provavelmente é um site de marketing fora deste repo, ou o checkout self-serve lendo direto de `pilar_subscription_plans` em produção. **Antes de escrever "preço protegido por 12 meses" pra qualquer cliente**, confirmar por query direta em produção qual é o preço que está de fato sendo cobrado hoje (`SELECT slug, preco_mensal, preco_anual FROM pilar_subscription_plans WHERE ativo`). Prometer proteção de preço sobre um número que pode estar errado é passivo jurídico com o próprio cliente early.
10. **Correção factual na lista "não vender/anunciar": parcialmente ampla demais.** A auditoria lista, corretamente, um conjunto de capacidades que **não existem** na branch principal hoje (confirmado por busca no código: zero menção a SINAPI, ORSE, "Curva S"/EAP, SEFAZ, RDO por áudio, leitura de prancha/RAG, medições de campo, BI, modelo dedicado/API corporativa/SLA configurável, nenhum desses tem implementação). **Mas "OCR de documento" como categoria inteira está incorreto como proibição total**: existem hoje, implementadas e vivas no código, leitura de PDF via Gemini em `ai-cotacao-import` (cotação de material, cesta multi-item) e em `ai-import-financeiro` (extrato/fatura). O que NÃO existe é OCR de **nota fiscal de compra na obra** e leitura de **prancha/desenho técnico**. A tabela de "ações de IA" abaixo reflete essa distinção fina: vender "leitura de cotação em PDF" é honesto; vender "OCR de nota fiscal" ou "leitura de plantas" não é.

### O que rejeito

11. **Obra adicional a R$149/mês e bloco de +10 projetos por R$99: rejeito como SKU de self-serve.** A auditoria tem razão no diagnóstico (R$199 + 3 obras a R$80 = R$439 < Profissional R$690, canibaliza o upgrade) mas a correção proposta (vender capacidade extra em unidades avulsas) viola a doutrina de packaging do Pilar (decisão 2026-08-10, item 1: "nunca vender módulo/SKU separado"; e regra 4 do meu mandato: "feature-flags = segmentação de tier, nunca venda à la carte"). Preço variável por unidade também vai contra o que o ICP quer: **custo fixo e previsível** (`ai-is-upending-saas-pricing.md`; o próprio ICP é "financeiro na planilha", conservador a conta variável). **Alternativa que resolve o mesmo problema sem abrir avulso:** manter "passou da cota, sobe de plano" como mecanismo único e público (já é a regra da v2 para projetos); um estouro pontual (ex.: cliente pegou 1 obra extra por 2 meses perto da renovação) é negociação de Vendas caso a caso, não item de checkout self-serve: evita a corrida ao fundo que a própria auditoria identificou (barato demais no complemento, incentivo de não fazer upgrade).
12. **Tabela de planos da auditoria como veredito fechado: rejeito, é hipótese como qualquer outra neste doc.** A própria auditoria já se qualifica como "sugestão inicial". Trato como tal: entra na seção de hipótese abaixo, com o mesmo aviso que todo número deste documento carrega até o design partner validar.

---

### Tabela de planos: hipótese v3 (ajusta a v2, ainda não validada com cliente)

| Plano | Projetos ativos | Obras ativas* | Preço/mês (hipótese) | Usuários | Ações de IA/mês | Perfil |
|---|---|---|---|---|---|---|
| **Essencial** | até 15 | até 2* | R$ 490 | ilimitado | 40 | escritório pequeno (5-8 pessoas) |
| **Profissional** *(âncora)* | até 40 | até 5* | **R$ 690** | ilimitado | 150 | centro do ICP (VRZ entra com folga) |
| **Escala** | ilimitado | até 12* | R$ 1.290 | ilimitado | 500 | escritório maior / multi-equipe |
| **Enterprise** | ilimitado | ilimitado | sob consulta | ilimitado | sob consulta | implantação assistida, suporte dedicado |

\* **Coluna "obras ativas" é diretriz de produto, não capacidade vendável ainda.** Sem `max_obras` no banco e sem elo plano→capacidade (ver dependência #7 abaixo), este número não é aplicado por nada no sistema: é a meta de packaging pra quando o elo for fechado, não uma promessa de venda hoje. Enquanto isso, Obras continua "incluído, sem cobrar separado" (mantém a v2), mas o produto já mede internamente quantas obras ativas cada empresa tem, pra calibrar essa faixa com dado real antes de vender por ela.

Preço do Essencial (R$490) mantém a v2; diverge da sugestão da auditoria (R$349) pelo motivo do item 8. Profissional e Escala convergem com a auditoria.

---

### Camada 2 renomeada: "ações de IA" (era "créditos de IA")

Mesmo mecanismo da v2 (token nunca exposto, cota no plano + pacote extra, margem ~2,5× o custo), só troca o nome que o cliente vê: **crédito → ação**.

| Ação do agente | Ações consumidas (hipótese, NÃO instrumentada) | Implementado hoje? |
|---|---|---|
| Consulta / resumo textual (ex.: pergunta ao chat de Agentes) | 1 | ✅ `ai-chat` existe |
| Criação/alteração estruturada (ex.: gerar proposta, aditivo) | 2 | ✅ `ai-proposta-copilot`, `ai-aditivo-copilot` |
| Leitura de cotação em PDF (cesta multi-item) | 3 | ✅ `ai-cotacao-import` |
| Leitura de extrato/fatura em PDF | 3 | ✅ `ai-import-financeiro` |
| OCR de nota fiscal de compra (obra) | N/A | ❌ não existe, não anunciar |
| RDO por áudio | N/A | ❌ não existe, não anunciar |
| Leitura de prancha/desenho técnico (RAG) | N/A | ❌ não existe, não anunciar |
| Análise extensa de documento (10+) | N/A | ❌ nenhum agente hoje processa documento longo/multi-página com essa profundidade |

**Pré-requisito inalterado da v2:** os pesos acima são placeholder. Antes de fixar a franquia, instrumentar 60 dias de `ai_usage_logs` real por `feature_key` (tokens_input/output → custo em R$) e calcular o peso de cada ação a partir do custo medido, não do chute. Checar primeiro se `ai_usage_logs` já tem linhas: na verificação de 2026-07-13 tinha 0; boa parte dos agentes acima (`ai-cotacao-import`, `ai-import-financeiro`) foi construída depois disso (spec 023, 08-11), então o estado pode ter mudado. **Query direta em produção antes de assumir qualquer coisa aqui.**

---

### O que explicitamente NÃO vender/anunciar ainda (confirmado por busca no código, 2026-08-17)

Zero implementação encontrada em `src/` ou `supabase/functions/` para: **SINAPI/ORSE** (composição de custo referenciada), **Curva S / EAP**, **integração SEFAZ**, **OCR de nota fiscal de compra**, **RDO por áudio**, **leitura de planta/prancha via RAG**, **previsibilidade de risco** (existe pesquisa competitiva sobre o conceito, `research/aec/proactive-margin-agent-landscape.md`, mas não existe agente nível 3/proativo implementado), **medições de campo/BI do plano Escala**, **modelo de IA dedicado / API corporativa / SLA configurável**. Nenhum desses entra em material de venda, deck ou landing até virar código na branch principal; regra vale mesmo se a tabela de planos acima virar oficial.

---

## Ações antes de fechar qualquer número (checklist desta revisão)

1. Query direta em produção: preço real hoje em `pilar_subscription_plans` (resolve item 9).
2. Query direta em produção: `SELECT count(*) FROM ai_usage_logs` e por `feature_key`: saber se a Camada 2 tem dado real agora que `ai-cotacao-import`/`ai-import-financeiro` existem.
3. Contar, por empresa, quantas têm `obras` com `status IN ('em_andamento','planejada')` e `deleted_at IS NULL`: dá a distribuição real de "obras ativas" pra calibrar a faixa 2/5/12 antes de vender por ela (item 7).
4. Alinhar com Produto o elo plano→features (pendente desde a v2): sem ele, nenhuma tabela de planos nova é aplicável no sistema, só é copy de venda.
5. Alinhar com Vendas antes de usar "Founding Customer, preço protegido por 12 meses" em qualquer conversa; depende do item 1.

---

## Decisão 2026-08-10: plataforma única + eixo de cobrança (prevalece)

Painel de 5 vozes (pricing, produto, red team, ICP, vendas) fechou o modelo de cobrança. Isto prevalece sobre o texto v1 abaixo onde houver divergência.

**1. Uma plataforma, um plano. Nunca vender módulo separado nem SKU por produto.** Confirma e radicaliza a [decisão de 2026-07-30](./DECISAO_MODULOS_INDEPENDENTES_2026-07-30.md): não há à la carte nem SKU por produto pago. Vender junto protege a North Star: margem só existe com receita + custo + horas no mesmo lugar. O tier muda **o quanto** (projetos, créditos), nunca **o quê** (a plataforma é inteira em todo plano).

**2. Eixo de cobrança = faixa de projetos ativos.** É a métrica que o escritório já pensa ("quantos projetos tenho rodando") e a que escala com o valor (mais projetos = mais margem em risco = mais valor entregue). Na conversa de venda, o pitch é **flat por empresa** ("R$690, a firma inteira, sem cobrar por cabeça nem por clique"); a faixa de projetos é o degrau de upgrade silencioso, não se menciona na primeira conversa.

**3. Seat (por usuário): rejeitado como régua.** Usuários **ilimitados** em todos os planos. Cobrar por assento faz o dono economizar assento e deixar estagiário/colaborador de fora, justamente quem lança a hora que faz o projeto estourar. Seat trava a captura de horas, que é o dado que sustenta a margem. Um teto de seats pode existir só como **limite de fair-use** (evitar o escritório de 40 pessoas no plano de entrada), nunca como base de cobrança.

**4. "Por uso" cru: rejeitado na base.** Conta variável assusta o ICP conservador (caixa apertado, financeiro na planilha) e não há infra de medição (`ai_usage_logs` com 0 linhas, sem ledger de créditos). Uso entra **só** como créditos de IA opcionais, com teto claro, ortogonais à base; nunca no coração do sistema.

**5. Packaging por maturidade (o que "a plataforma inteira" significa hoje):**
- **Incluído (vende como valor central):** tudo que está vivo: Projetos+Escopos+Aditivos, Financeiro (Visão/Fluxo/Mensal/Folha/Faturas/Contas), Propostas, Leads, Clientes, Pessoas, Mapa, Relatórios, Portal cliente.
- **"Em breve", incluído sem custo extra:** Obras (usar o badge `emBreve`/feature-flag que já existe em `src/lib/modules.ts`, off por default). Mostra a direção, não fatura, não promete data. **Nota 2026-08-17: reavaliar. Obras já não é "em breve", é produto rodando com design partner; ver item 7 da revisão acima.**
- **Fora do material de venda até ter uso real:** IA Hub (11 `ai-*`) e sub-financeiros dormentes (Projeção de caixa, Aging, DRE, Rentabilidade, WIP), atrás de flag desligada. **Nunca** prometer IA nem Asaas para fechar: queima o design partner. **Nota 2026-08-17: o número de `ai-*` já é 14, não 11; parte deles (`ai-cotacao-import`, `ai-import-financeiro`) tem uso real de leitura de documento; ver correção no item 10.**

**6. Próximo passo (custo R$0 de código):** mandar a proposta de R$690 por escrito à VRZ e colher a resposta. Os números das faixas abaixo são **hipótese de ancoragem até a VRZ responder**: pricing se acha iterando com cliente real, não na planilha. Só depois: ligar o elo plano→features (esforço S, ver Dependências técnicas).

## TL;DR

Modelo **híbrido em 3 camadas**, não modelo único:

1. **Assinatura** por faixa de **projetos ativos** (feature-flags definem o pacote de cada tier); ativar agora. **2026-08-17: mais um eixo de capacidade em preparação (obras ativas), sem números fixados ainda.**
2. **Créditos/ações** para os agentes de IA (1 ação = 1 tarefa concluída; cota no plano + pacote extra); quando a IA subir.
3. **Outcome** (por resultado, ex.: orçamento aprovado sem edição), só depois de instrumentar a telemetria.

Racional de fundo em [SAAS_IS_DEAD_ANALISE_PILAR.md](./SAAS_IS_DEAD_ANALISE_PILAR.md) e [ICP_E_PLANO_DESIGN_PARTNER_2026-05.md](./ICP_E_PLANO_DESIGN_PARTNER_2026-05.md); tendência de mercado em `research/themes/pricing.md`.

---

## ⚠️ Estado real vs proposto (verificado em produção 2026-07-13; revalidar itens marcados 🔄)

Um red team verificou este modelo contra o banco de produção. **Os números abaixo, nas seções seguintes, são PROPOSTA: não é o que o sistema cobra hoje.** Reconciliar antes de qualquer conversa de preço.

| Item | Proposto neste doc (v2/v3) | Cobrado/estado HOJE (produção) |
|---|---|---|
| Preço mensal | R$ 490 / 690 / 1.290 (âncora R$ 690) | 🔄 **Divergência sem reconciliar**: seed do código = R$ 97/197/397 (`pilar_subscription_plans`, `ON CONFLICT DO NOTHING`, pode não refletir o valor real se o banco já tinha outro); auditoria externa (08-17) monitorou R$ 199/490/990 publicamente. Nenhum dos dois bate com o código do repo. Query direta em produção antes de qualquer copy de preço. |
| Preço anual | N/A | R$ 970 / 1.970 / 3.970 (seed) |
| Nomes dos planos | Essencial / Profissional / Escala (+ Enterprise) | slugs `starter` / `pro` / `enterprise` |
| Limite por faixa | até 15 / até 40 / ∞ projetos (+ obras ativas, sem número fixado) | **10 / 50 / ∞ projetos + 3 / 10 / ∞ usuários** (limita por ambos); sem `max_obras` |
| Métrica de cota | **projetos ativos** (usuários ilimitados) + obras ativas (futuro) | por **usuário E projeto** (`max_usuarios` + `max_projetos`); remover o teto de usuários |
| Tiering aplicado | feature-flags por plano | **NÃO aplicado**; plano→features ainda não ligado (mesmo gap da v2, 08-10) |
| Ações de IA (créditos) | 40 / 150 / 500 + medição | `ai_usage_logs` existia com 0 linhas em 07-13; 🔄 revalidar: agentes com leitura de documento real (`ai-cotacao-import`, `ai-import-financeiro`) foram construídos depois (08-11) |

**Decisões pré-requisito (do CEO), antes de fixar preço:**
1. ✅ **Resolvido na v2 (2026-08-10):** a régua é subir o preço para o valor (âncora R$ 690), não ajustar ao banco. Número final pende da resposta escrita da VRZ.
2. ✅ **Resolvido na v2:** a cota é por **projeto ativo** só; remover o teto de usuários do banco (usuários ilimitados). Ver a decisão no topo.
3. 🔄 **Aberto na v3 (2026-08-17):** obras ativas como segundo eixo: decisão de produto tomada (adotar o eixo), números pendentes de instrumentação (ver checklist).
4. Só então: ligar o elo plano→features e unificar os mapas divergentes (ver "Dependências técnicas").

---

## Por que NÃO por usuário (seat)

Quase todo concorrente cobra por assento (ver comparativo abaixo). Na era da IA, o valor escala com **o trabalho que o software executa**, não com o número de pessoas. Cobrar por seat penaliza justamente a automação que se vende: coloca a empresa "torcendo para o cliente não usar o produto" (a16z, `research/a16z/ai-is-upending-saas-pricing.md`). **Projeto ativo** é a métrica que o escritório já entende e que mantém o custo previsível. Procore (construção, escala enterprise) valida o mesmo padrão do lado de fora do ICP do Pilar: usuários ilimitados, régua = volume de trabalho (ACV), não cabeça.

O argumento decisivo, porém, não é margem, é **adoção**: se cobra por cabeça, o dono compra só os assentos dos sócios e deixa estagiário e engenheiro de execução de fora. Mas são eles que lançam a hora que faz o projeto estourar. Sem eles dentro, o dado de horas nunca é capturado, e sem horas não existe margem real, que é o motivo do produto existir. Seat trava a base que alimenta a própria promessa. Por isso: usuários ilimitados, e um eventual teto de seats só como **limite de fair-use**, nunca como régua de cobrança.

---

## Camada 1: Assinatura por faixa de projetos ativos

Preço **flat/mês**, a plataforma inteira em todo plano. A faixa de **projetos ativos** é o único gatilho de upgrade hoje: passou da cota, sobe de plano (não cobra por unidade extra). **Usuários ilimitados em todos os planos.** Obras ativas entra como segundo eixo quando o elo técnico existir (ver revisão 2026-08-17 acima); enquanto isso, incluído sem cobrar separado.

> **Faixas hipótese (v3, 2026-08-17), âncora R$690 no plano do meio.** Números indicativos até a VRZ responder por escrito. O que muda vs. o banco: remove o teto de usuários como régua e sobe o preço para o valor. Ver "Estado real" no topo: divergência de preço real não reconciliada.

| Plano | Projetos ativos | Preço/mês (hipótese) | Usuários | Ações IA/mês | Perfil |
|---|---|---|---|---|---|
| **Essencial** | até 15 | R$ 490 | ilimitado | 40 | escritório pequeno (5-8 pessoas), não trava na entrada |
| **Profissional** *(âncora)* | até 40 | **R$ 690** | ilimitado | 150 | centro do ICP (VRZ, 7 pessoas, ~20 projetos, entra com folga) |
| **Escala** | ilimitado | R$ 1.290 | ilimitado | 500 | escritório maior / multi-equipe |

Todo plano tem a plataforma inteira (Projetos, Financeiro, Propostas, Leads, Clientes, Portal, Relatórios, Mapa, Pessoas, Obras). O salto de plano é por **capacidade** (projetos ativos, e depois obras ativas), nunca por feature.

**Definição de "projeto ativo":** projeto não-arquivado e não-concluído. Arquivar libera a cota, na hora e de graça. Essa é a métrica de cobrança: a definição e o contador precisam ficar cristalinos na UI para o cliente confiar (senão a régua vira atrito). É o contrato de confiança do modelo. Mesma regra vale para "obra ativa" quando esse eixo for cobrado.

**Nota:** os feature-flags que já existem no código são o mecanismo que liga/desliga o pacote; **não** se vende feature avulsa (à la carte). O flag serve para o packaging por maturidade (esconder dormente), não para diferenciar tier. Ver dependências técnicas abaixo.

---

## Camada 2: Ações de IA (era "créditos")

O cliente **nunca vê "token"**. Vê **ação concluída**: a unidade que ele entende. O token é o COGS interno (escondido). Ver tabela de pesos hipotéticos e status de implementação na revisão 2026-08-17 acima, que substitui a tabela simplificada anterior.

- **Cota inclusa** no plano (40/150/500 ações/mês, hipótese).
- **Pacote extra:** hipótese ~R$ 49 por 50 ações, com teto claro para o cliente prever a conta.
- **Margem no pacote extra:** ~60% (preço ≈ 2,5× o custo). IA é pass-through de custo: margem AI-native fica em 50-60%, não 80% (`research/a16z/the-new-business-of-ai-economics.md`). Precificar a ação como defesa de margem, não 1:1.

**Pré-requisito técnico (corrigido 2026-07-13, revalidar 2026-08-17):** a tabela `ai_usage_logs` **já existe e loga** `tokens_input`/`tokens_output` (COGS) via `_shared/ai-client.ts`; em 07-13 tinha **0 linhas**; desde então mais agentes com uso real de documento foram construídos (`ai-cotacao-import`, `ai-import-financeiro`, spec 023, 08-11), então esse número pode ter mudado: checar antes de assumir. O que falta continua sendo o **ledger de ações** (contador, cota por plano, decremento, item extra no Asaas); isso não existe ainda, independente de quantas linhas `ai_usage_logs` tiver.

---

## Camada 3: Outcome (futuro)

"Pague pelos orçamentos aprovados sem edição." É o modelo com maior correlação com crescimento (`research/a16z/ai-is-driving-shift-to-outcome-based-pricing.md`), mas exige medir a **taxa de aprovação** antes de cobrar. **Não vender no escuro**: só após a telemetria da Camada 2 provar alta aprovação.

---

## Comparativo de concorrentes (atualizado 2026-08-17)

Câmbio de referência ~R$ 5,50/US$. Confiança: ✅ fonte primária · 🟡 estimativa de review/busca agregada · 🔒 sem preço público.

| Produto | Modelo | Preço de referência | Público? |
|---|---|---|---|
| **Pilar** (proposto) | **flat / projetos (+ obras em preparação)** | R$ 490-1.290/mês (time todo, usuários ilimitados) | ✅ sim |
| Vobi (BR) | assinatura | ~R$ 103/mês 🟡 | 🔒 convite |
| Monograph (US) | por assento | US$ 25-55/seat ✅ (≈ R$ 138-303/pessoa) | ✅ sim |
| BQE Core (US) | assento + módulos | US$ 40-60/seat 🟡 (≈ R$ 220-330) | 🔒 cotação |
| Deltek Ajera (US) | por assento | ~US$ 200/seat 🟡 (≈ R$ 1.100) | 🔒 oculto |
| Deltek Vantagepoint (US) | assento + módulos | US$ 75-200/seat 🟡 | 🔒 oculto |
| Sienge / Prevision (BR) | custom | N/A | 🔒 oculto |
| Procore (US, construção, fora do ICP) | volume de obra (ACV), usuários ilimitados | ~US$ 700-1.000 por US$1M de ACV/ano 🟡; contrato anual, sem tabela pública | 🔒 cotação |
| Obra Prima (BR, construtora, fora do ICP) | assinatura por plano | a partir de R$ 399,20 🟡 (confirmado "a partir de R$399") | ✅ parcial |
| Gestor Obras (BR, construtora, fora do ICP) | assinatura por plano | ~R$ 499 citado pela auditoria, 🔒 não confirmado por fonte primária nesta revisão | 🔒 não confirmado |

**Leitura:** só a **Monograph** publica preço no ICP direto do Pilar, e **todos os concorrentes diretos cobram por assento**. Procore/Obra Prima/Gestor Obras são referência de **modelo** (usuário ilimitado + eixo de volume, no caso Procore) ou de **piso de mercado BR para obra** (Obra Prima/Gestor Obras), não são o comparável de preço do Pilar, porque atendem construtora, não engenharia multidisciplinar projetista. Um escritório de 7 pessoas paga ~R$ 1.700/mês na Monograph (7 × R$ 248); no Pilar cabe no **Profissional por R$ 690 flat, com usuários ilimitados**. Preço transparente + flat por projeto + não cobrar por cabeça é diferencial real no mercado AEC.

Detalhe da concorrência em [ANALISE_COMPETITIVA_VOBI.md](./ANALISE_COMPETITIVA_VOBI.md).

---

## O que validar antes de fechar os números

Pricing certo se acha iterando com 1-3 clientes reais, não na planilha. Perguntas para o design partner:

1. **Quantos projetos ativos ele tem hoje? Quantas obras ativas?** Valida os cortes das faixas (15/40/∞ projetos) e a nova faixa de obras (2/5/12, hipótese).
2. **R$ 690 é teto ou tem folga?** O Profissional pode estar subvalorizado vs. o valor de "saber se o projeto dá lucro". Testar o topo (topa R$ 690? topa R$ 890?).
3. **Quantos orçamentos/propostas por mês? Quantas cotações lê por PDF? Quantos extratos importa?** Calibra a cota de ações de IA e o preço do pacote extra com base no uso real, não no chute da tabela.
4. **Ancorar contra o quê?** A hora do sócio/orçamentista, não a planilha grátis nem o preço de ferramenta de obra de construtora. Esse é o value gap.

---

## Dependências técnicas (o que o modelo assume no código)

Estado atual verificado no código (atualizado 2026-08-17):

1. **Motor de feature-flags: existe e funciona.** `src/lib/permissions.ts` (`canDo`), `src/hooks/usePermissions.ts`, `src/components/FeatureRoute.tsx`; colunas `empresas.features` / `profiles.features` / `convites.features` (migration `20260425000001_features_columns_and_rls.sql`). **Manter**: é o que empacota os tiers.
2. **Resolvido em 18/08 (ADR 0026, spec 052): elo plano → features fechado para toda feature madura, sem esperar o eixo de capacidade.** Em vez de ligar `empresas.features` ao plano (o que a v2 pedia), a decisão foi mais direta: Dashboard, Financeiro, Projetos, Leads, Propostas, Clientes, Pessoas, Metas, Portal Cliente, Mapa, Relatórios, Meu trabalho, Agentes e Obras (+ 7 sub-features) viram **universais** (`universal: true` em `src/lib/features.ts`) e toda empresa já tem, sem depender do JSONB nem do plano. `isFeatureEnabledForCompany` e as três checagens equivalentes no banco (`user_has_feature`, `_validate_features_payload`, `tg_validate_features_subset`/`tg_validate_convite_features_subset`) bypassam o gate de empresa pra essas chaves via `_universal_features()` (migration `20260845000000`). Só o que ainda não está pronto pra ninguém (IA Hub, Capacidade, Templates, Timesheet) continua atrás de toggle, agora só como early access controlado pelo ultra-admin, nunca mais como paywall de plano. **O que continua em aberto:** capacidade (`max_projetos`) segue sem enforcement real no código (existe na tabela de planos, só alimenta um contador de exibição); ver item 7 abaixo, que já registrava isso pro eixo de obras e vale igual pro de projetos.
3. **Resolvido em 18/08: três mapas divergentes viram um.** `src/lib/planFeatures.ts` (código morto) foi removido; `includedInPlans` saiu do catálogo (`src/lib/features.ts`) porque não existe mais "plano inclui feature X": todo plano tem toda feature madura. `pilar_subscription_plans.features` (coluna JSONB) continua existindo só como bullet de marketing na página de planos (`PlanCard`), não é mais lido por nenhuma checagem de acesso.
4. **Ultra-admin: manter** (`src/pages/ultra-admin/`), mas o escopo do toggle de features encolheu de ~19 chaves pra 4 (só as `dormant`/não-universais). O que sobra pro ultra-admin fazer ali é early access a módulo não pronto, não mais provisionamento de módulo maduro.
5. **`ai_usage_logs`: JÁ existe** (`20260514200003_ai_usage_logs.sql`), loga tokens/COGS, mas com **0 uso em prod** na verificação de 07-13; revalidar (item 2 do checklist 08-17), porque agentes com leitura real de documento foram construídos depois. O que falta é o **ledger de ações** (cota/decremento/cobrança), não a tabela: ver Camada 2.
6. **Preços do banco (`027_pilar_saas_subscriptions.sql`): seed R$ 97/197/397**, com limites `max_usuarios` (3/10/∞) e `max_projetos` (10/50/∞); `ON CONFLICT (slug) DO NOTHING`, não garante que é o valor real em produção hoje. Divergem tanto da proposta v2/v3 (490/690/1.290) quanto do preço R$199/490/990 monitorado pela auditoria externa: **três números diferentes, nenhum reconciliado**. Query direta em produção antes de qualquer copy.
7. **Eixo "obras ativas" não tem NENHUMA wiring de billing.** Confirmado por busca: `pilar_subscription_plans` não tem coluna `max_obras`; nenhuma RPC ou hook conta "obras ativas" por empresa; a tabela `obras` (`20260730165000_obras_mvp.sql`) tem `status` (`planejada`/`em_andamento`/`paralisada`/`concluida`) e `deleted_at`, o que dá a matéria-prima pra um contador de "obra ativa" (mesmo padrão de "projeto ativo"), mas ninguém lê isso hoje pra aplicar limite de plano. **Atualizado 18/08:** Obras deixou de ser toggle por empresa (item 2), é universal agora; o que falta pra vender por "obras ativas" não é mais o entitlement (isso já está resolvido, é universal igual a tudo mais), é só a métrica de capacidade em si: (a) coluna `max_obras` (ou JSON de limites) em `pilar_subscription_plans`, (b) contador de obras ativas por empresa, (c) enforcement real (mesmo gap que `max_projetos` tem hoje, ver item 2). Escopo menor do que antes, mas ainda não fechado.
8. **Novo (08-17): parte do IA Hub já tem uso real de documento, ao contrário do que a v2 registrava.** `ai-cotacao-import` (leitura de cotação em PDF/Gemini, cesta multi-item, spec 023) e `ai-import-financeiro` (leitura de extrato/fatura, spec 017) existem e são funcionais na branch principal; não são só infra dormente. `ai_chat` (Agentes) está com `dormant: false` em `src/lib/features.ts`, incluído em pro/enterprise. Isso muda o que é honesto anunciar (ver tabela de ações de IA na revisão acima) mas **não** muda o gap do ledger de créditos/ações (item 5) nem o elo plano→features (item 2): a capacidade de execução avançou, a capacidade de cobrar por ela não.

---

## Referências

- `research/themes/pricing.md`: teoria de pricing SaaS/AI (4 modelos, tendências 2025-26).
- `research/a16z/ai-is-upending-saas-pricing.md`, `research/a16z/ai-is-driving-shift-to-outcome-based-pricing.md`, `research/a16z/how-to-price-and-package-gen-ai.md`, `research/a16z/the-new-business-of-ai-economics.md`.
- `research/techstars-500/iconiq-state-of-ai-growth.md`, `research/techstars-500/high-alpha-2025-saas-benchmarks.md`, `research/techstars-500/bessemer-vertical-saas-playbook.md`.
- [ICP_E_PLANO_DESIGN_PARTNER_2026-05.md](./ICP_E_PLANO_DESIGN_PARTNER_2026-05.md), [ESTRATEGIA_PRODUTO.md](./ESTRATEGIA_PRODUTO.md), [SAAS_IS_DEAD_ANALISE_PILAR.md](./SAAS_IS_DEAD_ANALISE_PILAR.md), [ANALISE_COMPETITIVA_VOBI.md](./ANALISE_COMPETITIVA_VOBI.md).
- Busca externa 2026-08-17 (Procore ACV/unlimited users, Obra Prima "a partir de R$399", Gestor Obras não confirmado): usada só para marcar confiança dos números da auditoria externa, não substitui fonte primária onde não achada.
