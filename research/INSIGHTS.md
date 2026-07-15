# INSIGHTS — Destilado Acionável (cross-source)

Os insights de maior sinal, cruzando fontes, sempre amarrados a uma **decisão do Pilar**.
Não é resumo de fonte (isso fica nas notas) — é "o que isso significa pra gente".

Formato: cada insight = título + tese de 1 linha + evidência (links `[[]]`) + ação Pilar.

Ligações ao trabalho existente: [STRATEGY_V2.md](../docs/strategy/STRATEGY_V2.md) · [docs/SAAS_IS_DEAD_ANALISE_PILAR.md](../docs/strategy/SAAS_IS_DEAD_ANALISE_PILAR.md) · [docs/ANALISE_COMPETITIVA_VOBI.md](../docs/strategy/ANALISE_COMPETITIVA_VOBI.md) · memory `agentic-strategy-2026-06`.

---

### 1. O reposicionamento do Pilar está alinhado com a tese central de YC + a16z + Contrary
**Tese:** "agentes verticais que executam o trabalho" não é aposta isolada — é o consenso de YC (Tan/Friedman), a16z e Contrary para 2025-26.
**Evidência:** [[vertical-ai-agents-10x-bigger-than-saas]] (10x maior por atacar labor budget; <5% adoção em verticais não-tech) · [[contrary-the-vertical-ai-playbook]] (TAM de labor 20-40% vs software 2-5%).
**Ação Pilar:** seguir firme no reposicionamento da memory `agentic-strategy-2026-06`. Pilar = **vender o agente** (caminho 1 YC), não roll-up. Janela <5% confirma urgência vs Vobi.

### 2. Pricing: assinatura agora, por-tarefa só depois de medir aprovação — exatamente o "híbrido" da a16z
**Tese:** outcome-based é pra onde tudo vai, mas migrar cedo demais quebra (COGS de token, comprador quer custo fixo, difícil medir outcome).
**Evidência:** [[ai-is-driving-shift-to-outcome-based-pricing]] ("começar híbrido", "medir obsessivamente") · [[contrary-the-vertical-ai-playbook]] (Harvey/Basis cobram por trabalho).
**Ação Pilar:** lançar com assinatura base (R$200-500, agrada escritório AEC conservador) + instrumentar **"% de orçamentos aprovados sem edição"** como pré-requisito pra cobrar por-tarefa. Sem essa telemetria, não vender outcome.

### 3. Não escalar (eng ou contratação) antes do PMF travado — e o problema do Pilar precisa ser "cabelo em chamas"
**Tese:** a maioria se ilude com PMF e queima caixa otimizando antes da hora; PMF real é estar soterrado por demanda.
**Evidência:** [[the-real-product-market-fit]] (Seibel) · reforça com [[do-things-that-dont-scale]] (PG: empurrar à mão primeiro).
**Ação Pilar:** validar que "saber se o projeto dá lucro antes de terminar" é dor urgente, não nice-to-have. A dívida estrutural (78 queries inline, páginas-deus) é sintoma de otimizar antes do pull — orçar com cuidado, não virar prioridade sobre achar o pull.

### 4. Os moats do Pilar são dados proprietários + virar system-of-record do escritório
**Tese:** defensabilidade de vertical AI vem de workflow embutido e dados de operação ao vivo — não do modelo.
**Evidência:** [[contrary-the-vertical-ai-playbook]] (tabela de moats) · [[vertical-ai-agents-10x-bigger-than-saas]].
**Ação Pilar:** capitalizar o histórico (20 projetos, valor médio/m², taxa de aprovação) como ativo de treino/contexto do agente. Quanto mais o Pilar vira o system-of-record do orçamento/proposta, maior o switching cost. 42% dos projetos de IA enterprise morrem por execução → HITL (`pending_review`) é o seguro.

### 5. Collison installation: onboardar os primeiros escritórios AEC à mão
**Tese:** startups decolam porque o fundador empurra; o melhor feedback vem do contato 1:1 com os primeiros usuários.
**Evidência:** [[do-things-that-dont-scale]].
**Ação Pilar:** o design partner (escritório do Matheus) + os 10 primeiros = onboarding manual, gerar o 1º orçamento *com* o cliente. É o moat de atenção que a Vobi (70k users) não escala.

### 6. Pilar provavelmente está em "Hard Fact", não "Hair on Fire" — e isso muda o GTM
**Tese:** Sequoia define 3 arquétipos de PMF. Saber se um projeto dá lucro antes do fim pode ser um problema com que escritórios AEC estão **resignados** (Hard Fact), não um incêndio que procuram apagar ativamente.
**Evidência:** [[the-arc-pmf-framework]] (Hard Fact = cliente não tenta resolver porque "não tem jeito") · contraponto a [[the-real-product-market-fit]] (Seibel foca em "cabelo em chamas").
**Ação Pilar:** se for Hard Fact, o GTM não é vencer comparação — é **educar e quebrar a resignação** (conteúdo, demo com os dados reais do escritório provando que dá pra saber antes). A mensagem muda de "melhor que a planilha" para "você não precisa descobrir o prejuízo só no fim". Validar o arquétipo nas entrevistas.

### 7. Pilar está exatamente na fase de founder-led sales — Matheus vende, não contrata vendedor ainda
**Tese:** venda do fundador é certa (B2B, ACV>US$5k, <US$1M ARR, sem playbook); só contratar vendas após 10-25 clientes e playbook repetível.
**Evidência:** [[founder-led-sales-first-round]] · casa com [[do-things-that-dont-scale]].
**Ação Pilar:** Matheus fecha os 10-25 primeiros escritórios à mão, documentando objeções desde o deal 1 (preço? confiança no orçamento da IA? trocar a planilha?). O playbook nasce daí. Não contratar vendedor cedo. Entrevistar no estilo [[how-to-talk-to-users]] (específicos, não hipóteses).

### 8. Calcular "default alive vs default dead" antes de mexer em pricing ou captar
**Tese:** toda startup com caixa deve saber se chega ao breakeven com a despesa e crescimento atuais. Metade dos fundadores não sabe — e o maior matador é contratar rápido pra mascarar problema de produto.
**Evidência:** [[default-alive-or-default-dead]] (PG) · [[guide-to-seed-fundraising]] (captar por marco, não por valuation).
**Ação Pilar:** fazer a conta default alive/dead agora. Amarrar a **parcela por-tarefa** do agente de orçamento como caminho concreto ao breakeven — reduz dependência de rodada. Não contratar antes do pull.

### 9. A prioridade nº1 é o agente executando trabalho real — não a UI do Asaas nem os recursos dormentes
**Tese:** o vertical de próxima geração vende **"system of action"** (executa o trabalho), não "system of record". Lançar como MVP em semanas, resolvendo UMA dor, batendo a janela.
**Evidência:** [[bessemer-state-of-cloud-vertical-saas]] (system of action; Centaur $100M em 5.7 anos) · [[yc-requests-for-startups-ai-agents]] (vender o trabalho) · [[how-to-build-an-mvp]] (lançar rápido, não esperar tudo).
**Ação Pilar:** focar o agente de orçamento de honorários (HITL) como MVP — **não** esperar os 9 ai-* dormentes nem WIP/DRE. O atraso mais caro é não ter o agente executando, não a UI do Asaas.

### 10. Pricing: cobrar por "orçamento gerado" (value metric), ancorado alto, como add-on — não por assento
**Tese:** o *value metric* (o eixo do que se cobra) move mais receita que o preço exato; cobrar por valor dá ~2x crescimento e metade do churn vs flat-fee. Add-on/crédito protege margem do COGS de token. Erro nº1 = preço baixo demais.
**Evidência:** [[lenny-gtm-pricing-growth]] (value metric) · [[how-to-price-and-package-gen-ai]] (add-on vs core) · [[pricing-playbook-b2b-saas]] (ancorar alto, preço antes do produto) · [[b2b-ai-go-to-market]] (outcome-based).
**Ação Pilar:** value metric = "por orçamento/proposta aprovada". Ancorar contra o **custo da hora do sócio / erro de orçar**, não contra a planilha. Cobrar como add-on sobre a assinatura base. Não subestimar o preço — trava aumento futuro.

### 11. A narrativa de fundraising já está montada: "Why Now" + "ideia boa que parece ruim" + TAM de serviço
**Tese:** investidor compra clareza e timing. O pivô agêntico do Pilar é uma janela de timing (LLMs viáveis 2024-25), não uma feature; e bate nos marcadores de "ideia boa que parece ruim".
**Evidência:** [[pitch-deck-template]] ("Why Now" é o slide mais forte) · [[how-to-evaluate-startup-ideas]] (tarpit vs ideia boa que parece ruim) · [[yc-requests-for-startups-ai-agents]] (TAM de serviço > software).
**Ação Pilar:** pitch = AEC é mercado chato + execução difícil + Vobi validando (os 3 marcadores de Friedman) + orçar com HITL só viável agora (Why Now) + capturar gasto de serviço, não de software. Isso é financiável.

### 12. O "schlep" do orçamento É o moat — não esconder atrás de UX limpa
**Tese:** PG (Schlep Blindness) diz que as melhores oportunidades são o trabalho chato/sujo que todos evitam — por isso têm pouca concorrência. O orçamento de honorários AEC (dados de horas/custo bagunçados, casos de borda, HITL) é esse schlep.
**Evidência:** [[schlep-blindness]] (Stripe: 1 década todo dev sofreu, ninguém consertava pagamentos) · [[a-guide-to-pricing-yc]] (Kevin Hale: 80% cobram pouco; regra 10-5-20; preço→canal) · [[how-to-make-wealth]] (mensurabilidade).
**Ação Pilar:** posicionar o trabalho chato como diferencial explícito (ingestão de dados imperfeitos + validação humana), não escondê-lo atrás de uma UI "limpa" que vira commodity. E: cobrar como % do valor protegido (margem que o escritório recupera ao não subprecificar projeto), ancorando alto — não centavos por tarefa. Subir preço até sentir pushback (mais fácil baixar que subir).

### 13. IA é "pass-through": a margem do Pilar é pior que SaaS puro — trate inferência como COGS e ancore o moat no dado
**Tese:** negócios de IA têm margem bruta 50-60% (vs 60-80%+ de SaaS) por causa de COGS de inferência + humano no loop; o LLM em si é pass-through, sem moat. O custo de compute tende a cair.
**Evidência:** [[the-new-business-of-ai-economics]] (Casado/Bornstein) · [[ais-600b-question]] (compute é commodity) · [[the-7-most-powerful-moats-for-ai-startups]] (moat ≠ modelo).
**Ação Pilar:** modelar custo de inferência por orçamento gerado como COGS variável (instrumentar `ai_usage_logs`); precificar pelo valor do honorário gerado, não por token; moat = dado proprietário AEC + workflow, nunca "usamos IA".

### 14. Retenção é o KPI de PMF que importa — e dá pra transformar em método (teste dos 40%)
**Tese:** o maior problema da IA generativa não é demanda, é fazer o usuário voltar (DAU/MAU mediano GenAI ~14% vs 60-85% dos melhores). PMF vira métrica acionável: % que ficaria "muito decepcionado" sem o produto, alvo ≥40%.
**Evidência:** [[generative-ai-act-two]] (retenção) · [[superhuman-engine-to-find-pmf]] (teste 40%, 22%→58%) · [[saas-metrics-that-matter]] (Levels of PMF) · [[kevin-hale-products-users-love]] (churn; não-resposta mata).
**Ação Pilar:** rodar o survey dos 40% na base AEC, segmentar por persona (sócio-gestor vs coordenador), e medir retenção/uso recorrente do agente — não cadastro. Só ativar IA Hub dormente após provar retenção.

### 15. A janela vertical AI está escancarada e o comprador prefere COMPRAR — atacar AEC agora
**Tese:** gasto enterprise em IA triplicou (US$37B); 76% dos casos são comprados (não construídos); agentes de verdade rodam em só 16% das empresas; vertical AI ainda é só US$3,5B e startups já capturam 63%, sem incumbente no AEC. Diferenciação está no app (49%), não no modelo (14%).
**Evidência:** [[menlo-state-of-generative-ai-enterprise-2025]] · [[iconiq-state-of-ai-growth]] · [[bessemer-vertical-saas-playbook]].
**Ação Pilar:** vender HITL como ponte copilot→agente (não limitação); ocupar o nicho AEC antes que apareça incumbente. A urgência é real, não retórica.

### 16. Não otimizar CAC nem contratar vendas antes do "traction point" / Levels L1-L2
**Tese:** no early (até ~US$1-2M ARR) CAC/LTV/magic number quase não importam; escalar vendas antes de cada rep gerar ~2x o custo (traction point) ou antes de Channel-Model Fit é desperdício. O "animal" (ARPA × nº clientes) define o GTM inteiro.
**Evidência:** [[sequoia-go-to-market]] (Sales Learning Curve) · [[saastr-saas-metrics-lemkin]] · [[saas-metrics-that-matter]] (Levels) · [[brian-balfour-four-fits-framework]] · [[christoph-janz-five-ways-to-100m]].
**Ação Pilar:** Pilar está em L1-L2: medir crescimento + burn baixo + amor do cliente, adiar dashboards de CAC. Decidir o "animal" (provável **veado**, US$10k+/ano, inside sales — o agente de honorários puxa o ARPA pra cima). Não contratar vendedor antes do yield repetível.

### 17. "AI-powered" não é posicionamento — a alternativa real do Pilar é Excel + chute do sócio
**Tese:** posicionamento começa pelas alternativas competitivas reais; "AI-powered" é commodity, não posição. Diferenciação tem que ser legível e opinativa.
**Evidência:** [[positioning-april-dunford]] · [[generative-ai-act-two]] (customer-back).
**Ação Pilar:** a alternativa do agente de orçamento é a planilha + estimativa de cabeça do sócio. Toda a mensagem deve atacar "precificar honorários no escuro" — não "somos um SaaS com IA".

### 18. Harvey prova o caminho do Pilar: agente de profissão regulada vence por CONFIANÇA, não por capacidade — e o moat é workflow co-construído, não modelo
**Tese:** Harvey chegou a ~US$100M ARR e NRR>150% no jurídico (profissão regulada, como AEC) sem modelo próprio — venceu eliminando risco de alucinação via HITL + citação à fonte + raciocínio exposto, e o moat são os workflows bespoke co-construídos com os escritórios.
**Evidência:** [[harvey-ai-vertical-legal-agent]] (28% das Am Law 100; trust>capacidade; sem modelo proprietário) · [[the-rise-of-computer-use-and-agentic-coworkers]] (modelo genérico não navega o domínio out-of-the-box) · [[the-7-most-powerful-moats-for-ai-startups]].
**Ação Pilar:** desenhar o review cockpit do agente de honorários pra **expor o raciocínio** (de onde veio cada hora/custo/margem) e citar a fonte do dado — confiança é a feature, não a UI bonita. Tratar os 10 design partners como co-autores dos workflows que viram produto + moat (não só clientes). Não competir com o modelo base.

### 19. O análogo perfeito já existe: vertical AI contábil em construção (a16z/Adaptive) — copiar o mapa "doers→reviewers" e a complexidade como moat
**Tese:** a16z aponta contabilidade vertical (CAS +30%a/a) como o melhor wedge de vertical AI, e cita explicitamente CONSTRUÇÃO (job costing, faturamento de subempreiteiro, revenue recognition por % de conclusão) como o caso de maior complexidade — exatamente o terreno do Pilar. A complexidade vertical é o moat, não o problema.
**Evidência:** [[rise-of-vertical-ai-in-accounting]] (doers→reviewers; complexidade = moat; Adaptive em construção) · [[ai-eats-vertical-saas]] · [[harvey-ai-vertical-legal-agent]].
**Ação Pilar:** mapear o pitch de ROI como "horas→minutos" no orçamento/conciliação, promovendo o coordenador de digitador a analista de controle de custo. Usar a complexidade AEC (margem por disciplina civil/estrutural/MEP, aditivos) como diferencial explícito vs ChatGPT genérico. Citar Adaptive no deck como prova de que vertical AI em construção já atrai capital (reforça "Why Now").

### 20. O TAM do Pilar é mão de obra (US$4,6T global), não software — e a meta realista é "Shooting Star" (margem ~60%), não "Supernova"
**Tese:** service-as-software mede o mercado pelo gasto em salário/serviço terceirizado (US$4,6T), não software (~US$0,3T); e a Bessemer mostra que o jogo vencível e sustentável é o da Shooting Star (margem ~60%, capital-eficiente, PMF forte), não a Supernova frágil de hipergrowth. Memória/contexto persistente é o moat.
**Evidência:** [[service-as-software-paradigm-shift]] (TAM = mão de obra; outcome pricing) · [[bessemer-state-of-ai-2025]] (Shooting Star ~60% margem; memória = moat) · [[the-new-business-of-ai-economics]] (IA tem margem pior; trate inferência como COGS).
**Ação Pilar:** reposicionar o slide de TAM do deck no custo do trabalho de orçar/precificar/controlar (hora do sócio + coordenadores), não no preço da planilha. Mirar perfil Shooting Star: crescimento sustentável + margem ~60% + retenção, não cravar ARR de ano 1 queimando caixa. Instrumentar a memória por escritório (histórico de projetos como contexto de cada novo orçamento) — é o lock-in que a Bessemer aponta.

### 21. A escada de vendas é uma sequência inviolável: Matheus vende 10-30 à mão → 2-3 reps → VP só lá pelos US$2M ARR
**Tese:** contratar VP de Vendas (ou rep) antes de existir um engine repetível falha ~80% das vezes — não há playbook pra ele escalar; e o fundador não some das vendas depois do VP (continua puxado pra ~10 deals/mês). Contratar 2-3 reps, não 1, pra provar que o playbook é transferível (não talento individual).
**Evidência:** [[saastr-when-to-hire-vp-sales]] (Lemkin: VP escala "de 3 a 300", não cria; ~70% das 1ªs contratações de vendas falham; mishire = ~1 ano perdido) · [[founder-led-sales-first-round]] (repetibilidade após 10-25 clientes) · [[sequoia-go-to-market]] (não escalar antes do traction point).
**Ação Pilar:** Matheus fecha os 10-30 primeiros escritórios AEC pessoalmente e define "engine repetível" como marco explícito (quando um rep fecharia com o mesmo script). Não contratar vendedor cedo "pra destravar GTM" — é o erro nº1. Ao montar time, contratar 2 reps de uma vez (gente de quem um sócio de engenharia compraria), nunca 1.

### 22. Crescimento do Pilar é loop, não funil — e o pricing por "orçamento aprovado" é o que abre o loop (per-seat o fecharia)
**Tese:** funil é linear e decai; loop reinveste o output (orçamentos, propostas, dados) no input e compõe. O modelo de monetização **habilita ou desabilita** loops: cobrar por seat pune adoção interna e fecha o loop; cobrar por value metric abre expansão. Retenção (ativação→aha) é a fundação que faz o loop fechar.
**Evidência:** [[reforge-growth-loops-monetization]] (loops 20+; retenção é a fundação; pricing habilita/desabilita) · [[lenny-gtm-pricing-growth]] (value metric > preço) · [[contrary-the-vertical-ai-playbook]] (dado proprietário como moat) · [[lenny-activation-rate-benchmarks]] (aha fecha o loop).
**Ação Pilar:** desenhar 2 loops explícitos — (a) **dados:** cada orçamento aprovado melhora o agente e aumenta switching cost; (b) **marca:** cada proposta/portal entregue ao cliente final do escritório vira touchpoint. Cobrar por **orçamento/proposta aprovada** (não por seat) pra não fechar o loop de adoção interna. Reforça os insights #10 e #22.

### 23. Definir o aha moment medível ("1º orçamento aprovado sem edição") — é ativação, é PMF com N pequeno, e é o gatilho do pricing por-tarefa
**Tese:** ativação = chegar ao aha moment, o evento mais cedo que prevê retenção; aumentá-la é a alavanca de crescimento mais barata, e em B2B high-touch o onboarding white-glove é tática legítima. Benchmark SaaS: média 36% / mediana 30%; bom = p60, ótimo = p80. Medir o evento, não o cadastro.
**Evidência:** [[lenny-activation-rate-benchmarks]] (aha prevê retenção; benchmarks; white-glove vale em B2B) · [[superhuman-engine-to-find-pmf]] (teste dos 40%) · [[do-things-that-dont-scale]] (Collison installation) · [[saastr-saas-metrics-lemkin]] (churn ruidoso cedo — usar ativação como proxy).
**Ação Pilar:** instrumentar "1º orçamento/proposta de honorários gerado pelo agente e aprovado pelo sócio sem (ou com pouca) edição" como **o** evento de ativação. Um evento, três usos: (1) proxy de PMF acionável com poucos clientes; (2) gatilho pra liberar cobrança por-tarefa (insight #2); (3) métrica de retenção. Gerar o 1º orçamento *junto* com o cliente (white-glove) é a forma mais alavancada de subir ativação no early.

### 24. A meta de retenção do Pilar é a régua VERTICAL (NRR ≥112% / GRR ≥91%), não a geral (NRR 101%)
**Tese:** vertical SaaS retém ~7pp mais NRR e churna ~5pp menos que horizontal porque vira infraestrutura operacional; sistemas de back-office vertical chegam a <4% churn anual. A mediana de mercado (NRR 101% / GRR 88%, 2025) é um piso de mercado em queda — não a meta de um vertical com switching cost.
**Evidência:** [[saas-capital-vertical-retention-benchmarks]] (112% NRR vertical; <4% churn back-office; fintech-vertical 96% GRR) · [[benchmarkit-2025-saas-performance-metrics]] (mediana geral 101%/88%; retenção sobe com ACV) · [[bessemer-vertical-saas-playbook]].
**Ação Pilar:** definir metas de board como **GRR ≥91% e NRR ≥112%** (régua vertical), não a mediana geral. O caminho para chegar lá é virar back-office do escritório (orçamento + faturamento + folha) — quanto mais módulos por conta, mais perto do churn <4%. Instrumentar NRR/GRR por coorte de escritório desde o MVP.

### 25. Cobrar barato em AI é sentença de churn: o tier de preço determina a retenção (>R$1.300/mês = saudável)
**Tese:** AI-native tem retenção mediana péssima (GRR 40% / NRR 48%), mas o driver é o PREÇO, não a tecnologia: produtos AI acima de US$250/mês retêm como B2B saudável (GRR 70% / NRR 85%); abaixo de US$50/mês despencam (GRR 23% / NRR 32%). O "churn de turista" some quando o preço seleciona quem incorpora no workflow.
**Evidência:** [[chartmogul-ai-churn-wave-retention]] (tabela por tier de preço; GRR mediano subiu 27%→40% em 2025 com saída de turista) · [[a-guide-to-pricing-yc]] (80% cobram pouco) · [[pricing-playbook-b2b-saas]] (erro nº1 = preço baixo).
**Ação Pilar:** posicionar o ticket combinado (base + agente) **acima de ~US$250/mês (~R$1.300+/conta)** — não por margem apenas, mas por retenção. Vender o agente AEC a sub-R$250/mês projetaria GRR ~23% (morte por churn). Ancorar alto é defesa de coorte, não ganância. Reforça #10/#12.

### 26. Crescimento esperado despenca por banda de ARR — meta de ano 1-2 do Pilar é 2-3x (mediana 165% em US$1-10M)
**Tese:** o "bom crescimento" é função da base. Em US$1-10M ARR a mediana Bessemer é 165% YoY (top-quartil 230%+); cai para ~87% em US$10-25M e ~60% acima de US$50M. Comparar-se sempre dentro da própria banda — e queimar caixa pesado cedo (FCF mediano −167% em US$1-10M) é o padrão, desde que a eficiência melhore com a escala.
**Evidência:** [[bessemer-scaling-to-100-million]] (tabela por banda; "só o quartil inferior tem NRR <100%") · [[startup-equals-growth]] (crescimento como bússola) · [[saastr-saas-metrics-lemkin]] (burn baixo cedo).
**Ação Pilar:** cravar meta de crescimento de ano 1-2 na faixa 2-3x (banda US$1-10M), não um % genérico copiado de empresa madura. No deck/board, não envergonhar-se de FCF negativo no early — a tese é eficiência crescente. Descontar metas otimistas (gap mercado: plano 35% vs realizado 26%).

### 27. Rule of 40 e burn multiple são régua PÓS-Série A; no early o gate é magic number ≥0,75 para escalar vendas
**Tese:** Rule of 40 (crescimento% + margem% ≥40) só vira critério de board após ~US$5M ARR; antes, cobrar-se por ele faz cortar crescimento cedo demais. O número que importa JÁ é o magic number (>0,75 = motor de vendas pronto para escalar) e o burn multiple (<1,5x = disciplina) — como bússola interna, não meta externa.
**Evidência:** [[capital-efficiency-magic-number-burn-multiple-rule40]] (thresholds: magic >0,75, burn <1,5x, CAC payback <18m mid-market) · [[saastr-saas-metrics-lemkin]] (early ignora CAC/LTV) · [[sequoia-go-to-market]] (não escalar antes do traction point).
**Ação Pilar:** NÃO usar Rule of 40 como meta agora. Usar o magic number como **gate de contratação do 1º vendedor** (só contratar quando founder-led gera ≥R$0,75 de ARR novo por R$1 de S&M) — operacionaliza #7/#21 com número. Saber o burn multiple informalmente e alimentar o cálculo default-alive (#8).

### 28. A margem do Pilar é AI-native (~52%), não cloud puro (75%+) — ajustar TODA régua de eficiência para baixo
**Tese:** os benchmarks de "perfil vencedor" (margem >75%, Rule of 40 com folga) são de SaaS puro. AI-native opera margem bruta 50-65% (COGS de inferência 35-50% da receita vs 15-30% em SaaS) — usar a régua errada faz o Pilar parecer ineficiente quando está dentro do esperado para sua classe.
**Evidência:** [[chartmogul-ai-churn-wave-retention]] + [[the-new-business-of-ai-economics]] (margem 50-60%; IA é pass-through) · [[iconiq-state-of-ai-growth]] (margem média AI ~52% em 2026; inferência ~23% da receita em escala) · [[capital-efficiency-magic-number-burn-multiple-rule40]].
**Ação Pilar:** modelar metas de margem em ~52-55% (não 75%), instrumentar inferência como COGS variável por orçamento (`ai_usage_logs`) antes de escalar, e no deck explicar a margem AI-native como característica de classe — não defeito. Precificar pelo valor do honorário gerado para empurrar a margem para o topo da faixa (top-quartil ~53%).

### 29. Medir retenção do agente a partir de M3 (não M0) — é a régua honesta para AI-native com N pequeno
**Tese:** produtos de IA inflam o M0 com "AI tourists" que testam e somem; a curva achata ~M3. Rebasear retenção/CAC para M3 e acompanhar **M12/M3** dá leitura honesta de PMF e prevê NDR de longo prazo >100% — funciona como leading indicator mesmo com poucos meses e poucos clientes, exatamente a situação do Pilar early.
**Evidência:** [[retention-is-all-you-need]] (rebase M0→M3; M12/M3 → NDR >100%; curva achata ~M3) · [[chartmogul-ai-churn-wave-retention]] (preço >US$250/mês mata churn de turista) · [[lenny-activation-rate-benchmarks]] (aha prevê retenção) · [[superhuman-engine-to-find-pmf]].
**Ação Pilar:** instrumentar coortes de escritório por mês e medir retenção/uso do agente **a partir de M3**, não do cadastro/M0 — evita pânico precoce e adoção falsa. Resolve o backlog #3 (medir PMF sem N grande) com um número acionável. Amarrar: aha (1º orçamento aprovado sem edição, #23) precisa ocorrer ANTES de M3 para o cliente chegar retido; preço alto (#25) seleciona contra turista — rebase M3 + preço alto são a mesma defesa de coorte.

### 30. A régua de crescimento do Pilar é a coorte AI-NATIVE (~110% YoY em US$1-5M), não SaaS tradicional — e a margem AI-native (−10pts) é o preço dessa velocidade
**Tese:** AI-native cresce ~2-3x mais rápido que B2B SaaS tradicional em toda banda de ARR (110% vs 40% em US$1-5M), mas paga ~10pts de margem bruta a mais por COGS de inferência. O "crescimento eficiente" (NRR alta × CAC payback baixo) é raro — só 13% chegam lá (e crescem 71% com Rule of 40 de 47%). Híbrido (assinatura+uso) lidera NRR; outcome-based lidera crescimento.
**Evidência:** [[high-alpha-2025-saas-benchmarks]] (crescimento por banda AI-native vs tradicional; margem −10pts; matriz NRR×CAC payback; pricing) · [[tidemark-2025-vertical-smb-saas-benchmark]] (NRR>115%+fintech = prêmio 25-30%; multi-produto é a alavanca; GRR fintech 96%) · refina [[bessemer-scaling-to-100-million]] (#26, que usava banda geral 165%) e [[iconiq-state-of-ai-growth]] (#28, margem ~52%).
**Ação Pilar:** (1) cravar meta de crescimento ano 1-2 contra a coorte **AI-native** (~100-110% mínimo na banda <US$5M), não contra SaaS maduro nem contra o 165% geral da Bessemer. (2) Mira o quadrante NRR alta × CAC payback baixo: founder-led (CAC baixo) + back-office sticky (NRR alta) é o caminho estrutural. (3) Pricing híbrido (base R$1.300+ + por orçamento aprovado) está alinhado ao que lidera NRR — confirma #2/#10/#22 com dado fresco. (4) Tidemark prova que o roadmap multi-produto (orçamento→faturamento→folha) + Asaas/fintech embarcado é o que destrava NRR>115% e o prêmio de valuation de 25-30% — reposicionar o Asaas dormente como alavanca de valuation, não feature secundária (reforça #24).

## Backlog de perguntas a responder com a base
Perguntas estratégicas do Pilar que a coleta deve mirar:
1. Como precificar AI agents (por tarefa vs assinatura)? O que YC/a16z/First Round recomendam?
2. Vertical AI agents: qual o playbook YC/a16z pra escolher 1ª tarefa e expandir?
3. PMF em vertical SaaS B2B com poucos clientes — como medir sem N grande?
4. Founder-led sales / design partner: táticas concretas (Migicovsky, First Round).
5. Defensibilidade de vertical AI (dados proprietários, workflow lock-in) — moats reais?
6. GTM PT-BR / mercado emergente: o que adaptar do playbook americano?
7. Quando um vertical SaaS vira plataforma? Sinais de expansão de escopo.
