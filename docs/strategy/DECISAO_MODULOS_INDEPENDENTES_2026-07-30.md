# Decisão: packaging por módulos — à la carte RECUSADO, base+produtos ADOTADO (2026-07-30)

**Status:** Decidido. À la carte reabre só com o gatilho da seção 5.
**Origem:** dúvida do CEO ao construir "Meu trabalho" (spec 008): a aba de
disciplinas puxa dado do módulo Projetos dentro do módulo Gestão, o que confunde e
"quebra" se a Gestão for vendida sozinha. Daí a proposta inicial de tornar os módulos
independentes e vendáveis à la carte (empresa compra só Gestão, ou Gestão +
Financeiro, features gated por módulo).

Analisado por um painel de 4 agentes (Produto, Pricing, Red Team, ICP simulado):
**à la carte puro = veredito unânime contra** (seções 1-2). Na discussão que seguiu,
o CEO refinou a ideia para um modelo diferente (**base compartilhada + produtos
pagos**), que NÃO é o à la carte recusado e ficou como a estrutura adotada
(seção 3-bis). Este doc é a fonte de verdade.

## 0. TL;DR da decisão

- **Recusado:** vender cada módulo solto à la carte (Gestão avulsa, Financeiro avulso).
- **Adotado:** **Gestão + Financeiro = fundação compartilhada, sempre inclusa, nunca
  vendida sozinha nem de graça** (custo embutido no produto pago). **Projetos** e, no
  futuro, **Obras** são os produtos pagos voltados ao cliente; cada um roda sobre a
  fundação. Para usar o sistema, compra-se pelo menos um produto pago.
- Isso preserva a promessa integrada (margem), evita o "Trello grátis" e deixa o Obras
  reusar o Financeiro sem duplicar.

---

## 1. Separar dois problemas que foram fundidos

- **Problema A (real, barato): confusão de UX.** Mostrar disciplina de projeto dentro
  da Gestão confunde. É arquitetura de informação, não de negócio. **Já resolvido**
  (seção 4).
- **Problema B (a proposta): packaging por SKU.** Vender cada módulo separado.
  Contradiz a decisão canônica (`DECISAO_PILARES_E_AGENTES_2026-07-25.md`, Tese A) e
  não tem cliente pedindo. **Recusado.**

Usar A para justificar B é a armadilha. A se conserta com rótulo e gate; B refunda o
modelo de negócio sobre um bug de tela.

## 2. Por que à la carte é recusado (consenso do painel)

1. **O valor é a promessa integrada.** North Star = "% de projetos com margem
   calculada antes de entregar". Margem = receita/escopo (Projetos) + custo
   (Financeiro) + horas. Um SKU "Gestão sem Projetos" ou "Projetos sem Financeiro"
   vende a versão do produto que remove o motivo de existir. Fatiar destrói a tagline.
2. **O ICP recusa fatias.** Já simulado na decisão canônica e reconfirmado agora:
   "R$400 só pra tarefas? Monday custava menos e abandonei"; "um produto de R$690 com
   a promessa inteira ele defende pro sócio". Módulo avulso força o cliente a comparar
   feature isolada contra o especialista barato de cada nicho (Monday em tarefa,
   ERP em financeiro), onde o Pilar perde. O Pilar só ganha no conjunto com opinião.
3. **A taxonomia dos 3 pilares é navegação, não fronteira de billing.** Prova no
   código (`src/lib/modules.ts`): **Financeiro vive dentro de Gestão**, mas o
   faturamento nasce de marcos de projeto (`rpc_faturar_marco`); Rentabilidade está
   sob Projetos; Leads/Propostas/Clientes convertem em Projetos. "Comprar só Gestão"
   entrega Financeiro sem nada para faturar e Relatórios sobre o vazio. Combinações
   incoerentes por construção.
4. **O gatilho está invertido.** "Meu trabalho quebra se Gestão for vendida sozinha"
   não é argumento a favor de separar: é prova de que os módulos **não são
   separáveis**. O acoplamento é o fosso, não o defeito.
5. **Trabalho oculto enorme para founder solo com 0 pagante.** O gating por plano
   **nem está ligado** (`PRICING.md`, dep. #2: 0 assinaturas, as 5 empresas com as
   mesmas 13 features; `canDo` não lê plano). Tiering exige ligar 1 elo; à la carte
   exige uma **matriz de direitos por combinação de módulos** + estados "degradado/
   bloqueado" em toda superfície transversal + N landing pages, onboardings e preços.
   E os mapas de feature já se contradizem (`planFeatures.ts` morto vs `features.ts`
   vs seed SQL). Multiplicar zero pagante por N SKUs dá zero, com N vezes mais para
   manter. Frase-espelho da decisão canônica: "você prefere desenhar três produtos a
   mandar uma cobrança."

## 3. O que fazer em vez disso

- **"Pacote cheio, nunca feature avulsa"** continua valendo (PRICING.md).
- Se um cliente achar caro, a alavanca é **tier por capacidade** (starter/pro/
  enterprise por faixa de projetos), como o Monday empacota por capacidade de
  coordenação. Pré-requisito: ligar o elo plano→features (PRICING.md dep. #2).
- **Expansão medida** via créditos de IA (ortogonal ao debate), não via 2º módulo.
  Depende de `ai_usage_logs` com uso real + ledger de créditos (ambos inexistentes).

## 3-bis. Modelo adotado: base compartilhada + produtos pagos

Refinamento do CEO que resolve a objeção do painel sem fragmentar a promessa.

- **Fundação compartilhada = Gestão + Financeiro.** Sempre presente. **Nunca vendida
  sozinha e nunca de graça:** o custo mora embutido no preço de qualquer produto pago.
  "Gestão incluso" é mensagem de valor, não doação.
- **Produtos pagos voltados ao cliente: Projetos** (existe) e **Obras** (futuro). Cada
  um roda sobre a fundação e já a carrega no preço.
- **Regra que mantém seguro:** para usar o sistema, compra-se pelo menos um produto
  pago. Não existe cliente "só Gestão". Como não há venda de Gestão avulsa, nunca se
  cai no "Financeiro sem nada para faturar" nem no "Trello grátis" que o painel
  alertou. O dinheiro fica embutido porque todo caminho de uso passa por um produto
  pago.
- **Por que o Financeiro fica na fundação (e não dentro do Projetos):** ele é
  transversal. Quando Obras entrar, faturamento de projeto e de obra saem do mesmo
  lugar, sem duplicar o módulo do dinheiro. Fundação compartilhada, um Financeiro só.
- **SKUs de comunicação = Projetos e Obras.** O cliente vê um produto com promessa,
  não um menu de peças. "Gestão + Financeiro inclusos" é o que enche o pacote.

**Sobre "invisto na Gestão e perco preço?":** não, se o eixo de cobrança
(faixa de projetos ativos, usuários, créditos de IA) e o gerador de valor (o número
da margem) continuarem no que se paga. Construir muito na Gestão é seguro e até
estratégico: é a camada de hábito diário que aumenta o valor do produto pago. O único
jeito de perder preço é dar de graça algo com disposição a pagar própria, o que aqui
não acontece, porque a fundação nunca é vendida sozinha.

**Cuidados guardados (para quando tocar em trial/preço):**

- Trial/free não pode expor a margem inteira sem o produto pago junto (vazaria o valor
  da fundação). Limitar o que a fundação mostra no trial.
- Gating por produto (Projetos/Obras) é barato de ligar (feature-flags por empresa),
  mas o elo plano→features ainda não está ligado (`PRICING.md`, dep. #2). Pré-requisito
  antes de cobrar por produto.
- Números de preço: fora de escopo deste doc (decisão do CEO em 2026-07-30, "sem preço
  ainda"). Este doc fixa só a ESTRUTURA de packaging.

## 4. Ajuste de UX já feito (Problema A)

Na tela "Meu trabalho" (spec 008):

- A aba de disciplinas só renderiza se a empresa tem o módulo Projetos
  (`can('projetos')`). Empresa só-Gestão vê "Meu trabalho" = apenas Tarefas,
  autocontido, degrada bem.
- Renomeada de "Projetos" para **"Minhas disciplinas"** (mata a ambiguidade com o
  módulo Projetos). É uma lente pessoal ("o que está no meu colo"), não o módulo.

Isso resolve a confusão sem tocar em packaging.

## 5. Gatilho de reabertura

Reabrir à la carte só com **evidência de cliente**, não observação de arquitetura:
um prospect real (VRZ/BM3 ou o próximo) recusar o pacote cheio de R$690 **por
escrito**, citando módulos específicos que não vai usar e não quer pagar, com
disposição a pagar declarada por um subconjunto que entregue valor standalone sem as
dependências transversais. Mesmo rigor de gatilho que Obras e o anúncio do produto 2.

Hoje nenhum módulo do Pilar passa nesse teste, porque o valor é a integração.

## 6. Próximo passo real

O passo de pricing não é escolher formato na planilha: é **mandar a proposta de R$690
por escrito para a VRZ esta semana** (gate 3 da sequência de 90 dias). Se ela assinar,
a pergunta de à la carte morre. Se recusar dizendo "só quero X", aí nasce a única
evidência que autorizaria carvar um módulo, sem ter escrito uma linha de matriz de
entitlement.

## Relacionados

- `docs/strategy/DECISAO_PILARES_E_AGENTES_2026-07-25.md` (Tese A, sequência de gates)
- `docs/strategy/PRICING.md` (modelo v1, dependências técnicas abertas)
- `research/aec/monday-com-benchmark-2026.md` (empacotamento por capacidade)
- `docs/specs/008-gestao-meu-trabalho.md` (o gatilho concreto)
- `brand/personas.md` (ICP vs anti-persona)
