# ADR 0064: Toda linha da estimativa tem origem do preço, e a IA só preenche itens de um catálogo fechado

**Data:** 2026-10-20  
**Status:** Accepted

## Contexto

O primeiro teste real da [SPEC 136](../../specs/136-estimativa-de-obra-parametrica.md) (obra Canaã, 461 m², alto padrão)
mostrou dois problemas. Cerca de 35% do total vinha de adicionais com valor provisório do Pilar (piscina por m²,
marcenaria em percentual, arrimo por m²), sem fonte. E faltavam itens que o próprio CUB declara não incluir
(climatização, aquecimento, energia solar, automação, terraplenagem): o provável ficou uns 9% abaixo do esperado.

O dono pediu que a funcionalidade rastreie a origem dos dados em vez de gerar preço fictício, e perguntou se uma IA
poderia entender a descrição livre da casa e mapear fases, serviços e tarefas. A análise do SINAPI de set/2026 mostrou
que ele cobre bem fundação, estrutura e instalações (4.878 insumos, 10.599 composições, por UF e por regime de
desoneração), mas não cobre painel fotovoltaico, automação, churrasqueira, paisagismo nem móveis planejados, e traz
preço de insumo padrão, abaixo do alto padrão.

Opções consideradas:

- **A. Manter valores de referência do Pilar sem fonte**: simples, mas é o preço fictício que o dono não quer, e o
  engenheiro que assina não consegue responder "de onde saiu isso?".
- **B. A IA propõe o preço e o prazo de cada item**: rápido, mas plausível, diferente a cada chamada e sem fonte.
  Rejeitada (reforça a ADR 0063).
- **C. Catálogo curado de itens, origem obrigatória em cada linha, IA só interpreta**: mais trabalho inicial, mas cada
  número tem origem, o resultado é testável e a IA fica restrita ao que sabe fazer bem.

## Decisão

Opção C.

1. **Catálogo fechado.** Cada item da estimativa existe num catálogo versionado, com id estável, unidade, driver de
   quantidade (vem da ficha), regra de preço e lugar no cronograma (fase, etapa, serviços, produtividade). Só itens que
   o CUB **não cobre** entram somando; o que o CUB já cobre fica na base, para não contar duas vezes.
2. **Origem obrigatória.** Toda linha de custo carrega `origem`: `cub`, `sinapi`, `empresa`, `usuario`,
   `referencia_pilar` (provisório, sempre marcado) ou `a_definir` (sem valor, fora do total). Para SINAPI guarda código,
   UF, mês, regime e se o preço foi coletado ou derivado. Linha sem origem é erro do motor, coberto por teste.
3. **Resolução de preço.** Valor informado pelo usuário, depois tabela da empresa, depois SINAPI, depois referência
   provisória do Pilar (enquanto existir), depois `a_definir`. O motor nunca preenche um número sem origem.
4. **A IA só interpreta.** Quando existir, ela transforma texto (e, depois, o PDF da planta) em itens do catálogo com
   quantidade e unidade, validados por schema contra os ids do catálogo. O que não mapear vira `a_definir` ou valor do
   usuário. Preço e cronograma saem do motor e dos metadados do catálogo, nunca da IA. O usuário confirma a lista antes
   de calcular.
5. **Reprodutível.** A versão da estimativa grava a versão do catálogo e a origem de cada linha, então um resultado
   antigo continua explicável mesmo depois de o SINAPI ou o catálogo mudarem.

```ts
type OrigemPreco =
  | { tipo: "cub"; uf: Uf; mesBase: string; regime: Regime; codigo: string }
  | { tipo: "sinapi"; codigo: string; uf: Uf; mesBase: string; regime: Regime; nivel: "coletado" | "derivado" }
  | { tipo: "empresa"; tabelaItemId: string }
  | { tipo: "usuario"; nota?: string; anexoId?: string }
  | { tipo: "referencia_pilar"; provisoria: true }
  | { tipo: "a_definir" };
```

## Consequências

**Positivas:**

- Cada número da estimativa responde "de onde saiu", e o percentual do total com fonte verificável vira uma medida de
  confiança que a faixa de custo pode usar.
- A IA fica pequena, testável (conjunto de avaliação com descrições reais) e barata, porque só preenche uma lista.
- O mesmo catálogo serve ao cronograma, à tabela de preços da empresa e à leitura do PDF.

**Negativas:**

- Curar o catálogo e mantê-lo é trabalho contínuo, e item fora do catálogo sempre cai em "a definir".
- O SINAPI importado cresce a cada mês; a importação precisa rodar no servidor e guardar preço só dos códigos do
  catálogo.
- Itens de alto padrão sem fonte pública (automação, energia solar, churrasqueira, móveis planejados) dependem de a
  empresa ou o usuário informar o valor. Isso torna a estimativa menos "pronta" no começo e mais honesta.

## Decisões relacionadas

- [ADR 0063](./0063-estimativa-de-obra-motor-deterministico-e-parametros-validados.md): motor determinístico, IA só interpreta. Esta ADR a estende com origem obrigatória e catálogo fechado.
- [SPEC 137](../../specs/137-estimativa-de-obra-itens-com-origem-do-preco.md)
- Cards: BEZ-82 (catálogo e origem), BEZ-69 (SINAPI), BEZ-83 (IA sobre o catálogo)
