# SPEC: Onboarding inteligente e plano de configuração por dependências

**Data:** 2026-11-13
**Status:** Aprovada (2026-11-13). Fases 1 a 3 implementadas; Fase 4 pendente
**Autor:** Claude, a pedido do Matheus
**Módulo:** onboarding | início | ultra-admin
**Complementa:** [SPEC 149](149-onboarding-empresa-usuario-e-primeira-semana.md) (não a substitui: reaproveita dados, eventos e o checklist derivado de dado real)

## Problema

O dono entra, preenche cinco telas de cadastro (perfil com 8 campos, escritório com 6) e cai num `/inicio`
vazio com um checklist flutuante ordenado por módulo, não por dependência. Duas perdas:

1. **Para o cliente:** a primeira impressão é burocrática (formulário), não encantadora, e o checklist deixa
   abrir "Crie uma proposta" ou "Abra um projeto" antes de ter cliente e equipe. O financeiro
   (contas, cartões) nem aparece como passo.
2. **Para o Pilar:** a única pergunta de intenção é "por onde começar" (3 opções). Não sabemos **que dor**
   trouxe o escritório, como ele resolve hoje, nem o tamanho da operação. É o dado que mais vale para
   vender, priorizar produto e acionar a régua da SPEC 130.

## Objetivo

Todo dono sai do cadastro em menos de 2 minutos, passa por um onboarding animado de 5 a 6 telas que
**pergunta a dor e devolve um plano de configuração personalizado**, e o checklist passa a seguir a ordem
em que as coisas realmente dependem umas das outras. O Pilar guarda as respostas para ler o mercado.

**Métricas:** (a) % de donos que terminam o onboarding inteligente (meta inicial 80%, convidados pelo
Matheus após demo); (b) tempo do convite até o plano (meta < 4 min); (c) % de empresas com cliente + equipe

- conta cadastrados em 48h; (d) ativação da SPEC 149 (`empresa_ativada`) em 7 dias.

**Fora de escopo:** reabrir self-serve; importação por planilha (SPEC própria se virar gargalo);
chamar IA para gerar o plano (o plano é regra determinística sobre as respostas; IA fica para depois, ADR 0049
e módulos `ai-*` seguem dormentes); depoimentos e números de clientes (ver "Prova social").

## Diagnóstico do fluxo atual

| Tela                     | Hoje                                                                                  | Veredito                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/profile-setup` (dono)  | nome, sobrenome, celular, função, LinkedIn, senha, confirmar senha, termos (8 campos) | **Cortar para 4:** nome, sobrenome, senha (com "mostrar", sem confirmar), termos. Celular e função migram para o onboarding como pergunta conversacional. LinkedIn sai da entrada (fica em Perfil).                 |
| `/company-setup` etapa 1 | nome, CNPJ, site, disciplinas, porte, "como conheceu"                                 | **Virar "Confirme seu escritório":** um cartão com o que o ultra-admin já preencheu, o dono só confere/ajusta. Sai "como conheceu" (o ultra-admin já grava a origem, SPEC 149). Mantém consulta de CNPJ na Receita. |
| `/company-setup` etapa 2 | "Por onde começar" (3 cartões) + convidar até 3 colegas                               | **Substituída pelo onboarding inteligente.** Convite de colegas vira passo do plano (depois de ter o que mostrar a eles).                                                                                           |
| Indicador de etapas      | texto "Etapa 1 de 3"                                                                  | **Barra de progresso animada** contínua do cadastro ao plano (ex.: 8 etapas, uma só barra).                                                                                                                         |
| Checklist (`steps.ts`)   | agrupado por módulo; "equipe" opcional; sem conta/cartão; "lançamento" sem conta      | **Reordenado por dependência** (ver abaixo) com passos que ficam bloqueados e explicam o motivo.                                                                                                                    |
| Convidado                | 1 tela com função, celular, LinkedIn, senha                                           | **Nome, senha, termos; função + celular em 1 pergunta no onboarding curto** (2 telas: boas-vindas ao escritório e "o que você faz aqui"). Não repete dores do dono.                                                 |

## Onboarding inteligente (dono)

Tela cheia (sem sidebar), barra de etapas fixa no topo, uma pergunta por tela, transição animada entre
telas e **cada resposta é refletida na tela seguinte** (progresso percebido). Todas puláveis, menos o que
destrava o plano.

| #   | Tela                      | Pergunta / conteúdo                                                                                                          | O que muda no produto                                         |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Boas-vindas               | "Oi, {nome}. Vamos deixar o {escritório} pronto." Animação da marca (`EntryVeil`/`BusyMark`, ADR 0049).                      | Nada; cria a sensação de "já estou dentro".                   |
| 2   | Sua função e contato      | Função (chips) + celular/WhatsApp.                                                                                           | Texto do plano e régua da SPEC 130.                           |
| 3   | **Dores**                 | "O que mais pesa hoje?" Cartões multi-seleção (até 3) + campo livre "Conta com suas palavras". Ver lista abaixo.             | Define a dor principal e os módulos que o plano põe primeiro. |
| 4   | Aprofundamento            | 1 a 2 perguntas condicionais à dor principal (ex.: prazo → "Como controla hoje?"; financeiro → "Quem lança?").               | Ajusta passos e dicas do plano; vira dado de mercado.         |
| 5   | Tamanho da operação       | Pessoas na equipe e projetos ativos hoje (faixas). Resposta vira espelho: "Com 12 projetos ativos, uma planilha cobra caro." | Porte; ordem do plano (equipe grande → equipe antes de tudo). |
| 6   | Como faz hoje             | Ferramentas que usa (Excel, Sults, Notion, WhatsApp, outro, nada) multi-seleção.                                             | Dado competitivo; copy do plano ("sai da planilha").          |
| 7   | Prévia do que o Pilar faz | Para a dor escolhida: mini-demonstração estática do módulo (print real do seed) com "é assim que isso fica resolvido".       | Mostra o resultado antes do trabalho de cadastro.             |
| 8   | **Seu plano**             | Lista ordenada de passos gerados, com tempo estimado ("~15 min no total"), botão "Começar pelo passo 1".                     | Grava o plano e abre o checklist já na ordem.                 |

### Dores oferecidas (tela 3)

Escolher 3 para destaque e deixar "Outra" livre. Rascunho a validar com o `engenheiro-icp`:

- Não sei o lucro de cada projeto
- Estouro de prazo e cronograma
- Proposta lenta ou sem padrão
- Financeiro em planilha (receber, pagar, caixa)
- Equipe sem visão de quem faz o quê
- Cliente pergunta andamento e eu não tenho resposta rápida
- Aditivos e escopo que crescem sem cobrar
- Controle de obra (diário, medição, fornecedor)
- Tudo espalhado em WhatsApp, e-mail e planilha

### Prova social

Ainda não há clientes com depoimento autorizado. **Não inventar.** Neste release a tela 7 usa
demonstração do produto como prova. Quando houver design partner autorizado, entra um bloco de depoimento
real na mesma tela (slot previsto, desligado por feature flag).

## Plano de configuração por dependências

O checklist deixa de ser "por módulo" e passa a ser um **grafo**: cada passo diz do que depende, fica
bloqueado com o motivo ("falta um cliente") e o botão leva ao pré-requisito. Dependências levantadas no
código (a confirmar item a item na implementação):

```
Camada 0  Conta            perfil pronto · foto (opcional)
Camada 1  Base (sem dep.)  Dados do escritório · Equipe (pessoas) · Clientes ·
                           Contas bancárias · Cartões · Fornecedores · Fluxo de disciplinas
Camada 2                   Convidar usuários (depende de Equipe: é quem vira acesso)
                           Proposta           ← Cliente
                           Projeto            ← Cliente (parcelas nascem com o cliente) + Equipe (responsável por disciplina)
                           Obra               ← Cliente
Camada 3                   Lançamentos        ← Conta bancária (e Projeto, para o lucro por projeto)
                           Fatura de cartão   ← Cartão
                           Folha              ← Equipe com custo
Camada 4                   Cronograma/Diário  ← Projeto / Obra
```

Fatos verificados: o banco só exige `nome` em projeto, proposta e obra; a dependência real está na UX
(formulário de projeto bloqueia parcelas sem cliente, `useProjetoForm.ts:528`; responsável vem de
`pessoas`; fatura exige `cartao_id`; conta exige `banco`; cartão exige `limite`). Se o lançamento deve
exigir conta é **decisão de produto** (ver abaixo).

O plano é montado em 3 etapas: (1) passos obrigatórios das dores escolhidas, (2) pré-requisitos desses
passos puxados automaticamente, (3) o resto em "depois". Exemplo: dor "Não sei o lucro por projeto" →
Clientes → Equipe (com custo) → Projeto → Lançamento vinculado.

## Requisitos

### Fase 1 · Cadastro enxuto e barra de etapas

1. `/profile-setup` do dono com nome, sobrenome, senha (botão mostrar, sem confirmar) e termos.
2. `/company-setup` vira "Confirme seu escritório" (1 tela).
3. Barra de etapas única e animada atravessando perfil → escritório → onboarding.
4. Convidado: mesma tela enxuta; função e celular numa pergunta curta depois.

### Fase 2 · Onboarding inteligente

5. Wizard tela cheia com as 8 telas acima, transição animada, voltar/pular, retomar de onde parou.
6. Tabela `onboarding_respostas` (empresa_id, user_id, versao, dores, dor_principal, texto_livre,
   contexto jsonb, concluido_em) com RLS por empresa; escrita só do próprio usuário; leitura geral só
   ultra-admin.
7. Eventos: `onboarding_pergunta_respondida`, `onboarding_dor_escolhida`, `onboarding_plano_gerado`.
8. Pular não bloqueia: sem resposta, o plano usa a ordem padrão.

### Fase 3 · Plano e checklist por dependência

9. Registro de passos em `steps.ts` ganha `dependeDe` e `motivoBloqueio`; passos novos: Contas
   bancárias, Cartões, Dados do escritório; "Equipe" deixa de ser opcional quando o plano inclui Projeto.
10. Checklist e tour respeitam bloqueio; botão "Fazer o pré-requisito" leva à tela certa.
11. O plano gerado (ordem e tempo estimado) aparece no `/inicio` até a ativação.
12. Passos de exemplo (`exemplo=true`) seguem sem contar (SPEC 149).

### Fase 4 · Leitura das dores (ultra-admin)

13. Painel "Dores do mercado" no ultra-admin: ranking de dores, texto livre por empresa, ferramentas
    usadas, cruzamento com porte/disciplina. Exportável.

## Critérios de aceite

- Dono novo conclui perfil + escritório em até 6 campos preenchidos no total.
- Cada tela do onboarding mostra "Etapa N de M" e a barra avança sem recarregar.
- Resposta da tela 5 aparece refletida na tela 6 ou 8 (teste de componente).
- Com dor "lucro por projeto", o plano contém Cliente antes de Projeto e Projeto antes de Lançamento.
- Passo bloqueado mostra o motivo e o botão leva ao pré-requisito.
- Usuário que fecha a aba na tela 4 volta na tela 4.
- RLS: usuário de outra empresa não lê `onboarding_respostas`; ultra-admin lê todas.
- Nenhuma tela usa `Loader2`/`animate-spin`; cores só por token; mobile 390px sem rolagem horizontal.
- Antes/depois em imagem única no PR (regra do dono).

## Entregue e pendente

**Fase 1 (branch `docs/spec-165-onboarding-inteligente`, sem PR ainda):**

- `/profile-setup` em duas etapas na mesma tela: "Seu acesso" (nome, sobrenome, senha com "mostrar" e sem
  confirmação, termos) e "Seu contato" (celular e função). LinkedIn saiu da entrada (segue em Perfil).
  Celular e função ficaram aqui, e não no wizard, para o dado não se perder enquanto a Fase 2 não existe;
  a Fase 2 os move para a tela 2 do onboarding.
- `/company-setup` virou "Confirme seu escritório" (sem "como conheceu"); a etapa "Por onde começar" e o
  convite de colegas seguem até a Fase 2 substituí-las.
- `EtapasProgress`: barra segmentada animada ("Etapa N de M") nas duas telas. Dono: 4 etapas; convidado: 2.
- Sem migration, sem mudança de banco.

**Fase 2 (branch `feat/onboarding-inteligente-fase-2`, empilhada sobre a Fase 1):**

- Migration `20261230000000_onboarding_respostas`: uma linha por pessoa (`user_id` único) com dores (até 3),
  dor principal, texto livre, contexto (aprofundamento, projetos ativos, ferramentas), `etapa_atual` e
  `concluido_em`. RLS: a pessoa lê e escreve só a própria linha, na própria empresa; o ultra-admin lê todas.
- `OnboardingWizard`: tela cheia, uma pergunta por tela, entrada animada (respeita movimento reduzido),
  barra de etapas do cadastro (etapa 4 de 4) e "Pergunta N de 7". Cada tela grava o rascunho; fechou a aba,
  volta de onde parou, sem refazer o escritório. Tudo pulável.
- Telas finais (7): boas-vindas, dores (até 3 + texto livre), aprofundamento da dor principal (some se
  pulou as dores), projetos ativos (espelha o porte já sabido), ferramentas (espelha os projetos ativos),
  prévia do que o Pilar faz para a dor e **plano** com passos, minutos e a dor que puxou cada um.
- O plano é regra determinística (`lib/onboarding/plano.ts`) com a ordem de dependência (cliente, equipe,
  colegas, proposta, projeto, fluxo, financeiro, obra, fornecedor). A fase 3 troca a tabela pelo grafo.
- A dor principal define o pilar de partida (`empresas.objetivo_inicial`) e a ordem do checklist. O passo
  "Por onde começar" e o convite de até 3 colegas saíram daqui; convidar colegas é passo do plano.
- Eventos: `onboarding_pergunta_respondida`, `onboarding_dor_escolhida`, `onboarding_plano_gerado`.
- Desvios do desenho original: função e celular ficam no `/profile-setup` (já entregues na Fase 1), então o
  wizard tem 7 telas, não 8. A prévia é texto sobre o que existe no produto, sem prints do seed.
- **Não verificado:** a migration não foi aplicada (sem Docker nesta máquina); o `types.ts` foi escrito à
  mão no formato do gerador e o job `types-sync` do CI é quem confirma.

**Fase 3 (branch `feat/onboarding-inteligente-fase-3`, empilhada sobre a Fase 2):**

- `steps.ts` ganha o grafo: `dependeDe` (obrigatório: bloqueia) e `sugereAntes` (recomendado: só ordena e vira
  dica). Obrigatórios: proposta e obra pedem cliente; projeto pede cliente e equipe. Recomendados: lançamento
  pede conta bancária e projeto; convidar colega pede equipe. Pré-requisito que a pessoa não vê (feature ou
  admin) não bloqueia, e passo já feito nunca aparece bloqueado.
- Passos novos de Gestão: **conta bancária** (obrigatório) e **cartão** (opcional), com contagem real de
  `contas` e `cartoes`. **Equipe** deixou de ser opcional, porque o projeto depende dela.
- `ordemTopologica()` e `prerequisitosObrigatorios()`: o plano do onboarding deixou de usar tabela própria
  de ordem; os pré-requisitos obrigatórios entram sozinhos e a ordem vem do grafo. Ciclo lança erro (testado).
- Checklist: passo bloqueado mostra cadeado, "Falta: cliente" e o toque leva ao pré-requisito. O tour não
  dispara em passo bloqueado, e o "próximo passo" nunca é um bloqueado.
- `/inicio`: o cartão de boas-vindas mostra **o plano** de quem concluiu o onboarding (passos da dor, em
  ordem, com minutos que faltam, feito e bloqueado). Sem onboarding concluído, segue com os três pilares.
- Decisões em aberto 1 e 4 resolvidas como recomendado: o lançamento não exige conta (só sugere), e o
  trabalho foi fatiado em PRs por fase.
- Fora desta fase: passo de fatura de cartão e tours dos passos novos (a aba Carteira não tem âncora de tour).

**Pendente:** Fase 4 (painel de dores no ultra-admin).

## Decisões em aberto

1. **Lançamento exige conta bancária?** Hoje o banco aceita sem. Exigir melhora a confiabilidade do caixa,
   mas atrito no primeiro lançamento. Recomendação: não exigir, mas o plano põe Conta antes.
2. **Celular continua obrigatório?** A régua (SPEC 130) usa WhatsApp. Recomendação: manter obrigatório,
   mas na tela 2 do onboarding, com motivo explícito, não no cadastro.
3. **Wizard roda para convidado?** Recomendação: não; só pergunta de função e vai ao `/inicio`.
4. **Fatiar em quantos PRs?** Recomendação: 3 (Fase 1; Fases 2+3 juntas pois o plano depende das respostas;
   Fase 4 depois de haver dado).

## Riscos

- Wizard longo cansa. Mitigação: 8 telas de 1 pergunta, todas puláveis, tempo estimado visível.
- Pergunta que não muda nada. Mitigação: cada tela da tabela declara o que muda no produto.
- Animação pesada em celular. Mitigação: CSS/`prefers-reduced-motion`, sem biblioteca nova (o projeto
  não tem `framer-motion`; usar as animações da marca do ADR 0049).
- Prova social falsa. Mitigação: vedada; só depoimento autorizado.
