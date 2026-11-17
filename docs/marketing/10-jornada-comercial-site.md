# Jornada comercial no site

Proposta de implementação de 13/11/2026. Escopo: aquisição assistida, explicação da entrada e medição dos cliques.
Não altera o checkout, as assinaturas existentes ou a política jurídica publicada.

## Caminhos

- `/engenharia` e `/arquitetura`: demonstração como ação principal; preços ao lado. São destinos para conversas
  iniciadas pelo fundador e para campanhas por público.
- Home e `/planos`: contratação direta continua disponível. A demonstração segue como alternativa para quem
  precisa avaliar o produto antes de contratar.
- `/planos#implantacao`: início por uma rotina real, ajuda incluída no plano e serviço adicional opcional.
- `/faq`: respostas sobre implantação dedicada e continuidade do suporte após o período de entrada.

## O que está incluído e o que depende de proposta

Preservar o atendimento publicado: Essencial com suporte por e-mail e WhatsApp, Profissional com migração assistida
da planilha e Escala com implantação acompanhada e canal direto. Não cobrar novamente por esse mesmo trabalho.

Organização de histórico, treinamentos extras e visitas podem receber proposta específica quando excederem o
atendimento incluído. Antes de contratar, definir entregas, dados necessários, responsáveis, período, sessões e preço.
O fim desse trabalho dedicado não encerra o suporte de uso da assinatura ativa.

Os pacotes dedicados não têm preço ou SLA novo publicado neste PR. Limites novos não devem ser aplicados
retroativamente a compromissos existentes. Nenhuma demonstração ou visita é obrigatória para assinar.

## Medição

O evento existente `landing_cta_clicked` permanece sujeito ao consentimento de analytics. Usar as propriedades
`cta`, `location`, `canal` e `pagina` para comparar origem e intenção. Exemplos:

| Ação                                     | `cta`                   | `location`            |
| ---------------------------------------- | ----------------------- | --------------------- |
| Abrir a agenda pela página de engenharia | `agende_demo`           | `publico_engenharia`  |
| Ver preços pela página de arquitetura    | `ver_planos`            | `publico_arquitetura` |
| Pedir escopo de implantação pelos planos | `consultar_implantacao` | `implantacao_planos`  |
| Tirar dúvida comercial pelo WhatsApp     | `contato_comercial`     | `planos`              |
| Assinar o Profissional                   | `assinar`               | `planos_pro`          |

O WhatsApp de dúvidas antes usava `agende_demo`, que também registra interesse em demonstração. Separar as intenções
evita inflar essa medida. Clique em agenda não comprova reunião marcada; clique em checkout não comprova pagamento.

Para fechar o funil, registrar no controle comercial: empresa, origem, reunião marcada, reunião realizada, proposta,
pagamento, primeira rotina concluída, revisão e motivo de perda. Respeitar pedidos para encerrar contato. Nenhum dado
pessoal de lead entra no analytics do site ou neste documento público.

## Critérios de revisão

- Os três planos mantêm preços, capacidade, cotas de IA e caminhos de checkout.
- A tagline e a assinatura dos agentes continuam as da marca.
- O destaque do Profissional é recomendação, sem alegação de que a maioria o escolhe.
- A copy de atualizações não compromete módulos futuros nem retira direitos de clientes existentes.
- Os links de agenda e WhatsApp abrem em nova aba, com `noopener noreferrer`.
- Antes de abrir o PR, gerar e inspecionar a comparação visual desktop e mobile na pasta
  `docs/design/antes-depois/comercial-implantacao/`. A captura está pendente até a conclusão dessa revisão.

## Validação

Na base `97c5b50d77478dbfea083d187e2806f6544b07c0`, passaram o typecheck do marketing, os 297 testes em 22 arquivos,
o build com 62 rotas pré-renderizadas e o lint dos arquivos alterados. A revisão visual continua pendente: o navegador
local não inicia neste ambiente. As capturas devem usar a base real e atual de staging e a branch proposta na mesma
rota e viewport, sem dados de clientes. Não abrir o PR visual antes de produzir, inspecionar e incorporar o antes/depois
exigido em `CLAUDE.md`, salvo orientação explícita do dono.
