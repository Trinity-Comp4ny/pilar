# ADR 0012: Obra não exige projeto e tem localização própria (amenda o 0011)

**Data:** 2026-07-30
**Status:** Accepted

## Contexto

O [ADR 0011](./0011-reabrir-obras-como-fase-de-execucao-do-projeto.md) modelou a obra
como a fase de execução de um projeto, com `obras.projeto_id` **NOT NULL**. Ao usar o
módulo, o CEO concluiu que na prática a obra **não precisa de um projeto**: no fluxo
real da VRZ não há dado a compartilhar por padrão, e obrigar um projeto antes de criar
a obra é fricção sem retorno.

Em paralelo, entrou o pedido de uma tela de **Clima** (previsão do tempo por obra). Clima
é por localização, e como a obra deixa de herdar a localização do projeto, ela passa a
precisar de **localização própria**.

## Decisão

Amenda o ADR 0011 em dois pontos; o resto do 0011 (obra reusa Financeiro/Calendário
quando ligada, feature flag, faseamento) segue valendo.

- **`obras.projeto_id` vira NULLABLE.** A obra nasce sozinha. O vínculo é opcional e,
  quando existe, mantém a ponte para faturamento/margem do projeto. No front, o campo
  de projeto **só aparece se a empresa tem o módulo Projetos** (`can("projetos","view")`);
  empresa sem Projetos nem vê a opção. As policies de insert/update passam a aceitar
  `projeto_id IS NULL` (padrão de `tarefas`). O índice "1 obra por projeto" é removido.
- **Obra ganha localização própria:** colunas `cep`, `localizacao`, `cidade`,
  `latitude`, `longitude`. Preenchidas pelo mesmo gesto do projeto: CEP → endereço
  (BrasilAPI) → coordenadas. O geocode usa **Open-Meteo** (grátis, sem chave, CORS),
  não a edge function `geocode-address`, para não depender de função server-side e
  casar com a API do Clima.
- **Clima** entra como o segundo item da sidebar de Obras (primeiro item "pra fora",
  coerente com a decisão de 30/07 de pilar que cresce sob demanda). Usa Open-Meteo
  (clima atual + previsão de 7 dias + geocoding). Tela pergunta "clima de qual obra ou
  qual cidade": obra com localização usa suas coordenadas; busca livre geocoda a cidade.

Migration: `20260730180000_obras_projeto_opcional_e_local.sql`.

## Consequências

**Positivas:**

- Menos fricção: criar obra não exige um projeto. Empresa sem Projetos não vê o campo.
- Clima sem custo nem secret: Open-Meteo é grátis e sem chave, o que é bom num repo
  público (nada a vazar).
- A ponte execução↔margem continua possível: quem quer, vincula a obra ao projeto.

**Negativas (assumidas):**

- Sem vínculo, a obra não conecta à margem/faturamento por padrão. O elo vira opt-in;
  o valor "margem do projeto" depende de o usuário lembrar de ligar. Aceito: a fricção
  do vínculo obrigatório custava mais que o ganho.
- Duas fontes de geocoding no código (edge `geocode-address` para projetos, Open-Meteo
  para obras). Trade-off aceito para manter o Clima client-side e sem secret.
- Localização por cidade (via CEP) é aproximada para clima; suficiente para previsão,
  não para posição exata no mapa.

## Decisões relacionadas

- ADR 0011: modelo original (obra = fase de execução), amendado aqui.
- ADR 0010: calendário por camadas (a camada "obra" segue válida).
- SPEC 015 (Obras): atualizada com projeto opcional, localização e Clima.
