# ADR 0063: Estimar obra com motor determinístico e parâmetros com flag de validação

**Data:** 2026-10-19  
**Status:** Accepted

## Contexto

A [SPEC 136](../../specs/136-estimativa-de-obra-parametrica.md) entrega uma faixa de custo e um cronograma a partir da
descrição da obra. O escritório de projeto leva esse número ao cliente final, então ele precisa ser auditável: quem
assina responde pelo valor, e um engenheiro vai perguntar "de onde saiu isso?".

Pressões:

- Um LLM que "sabe" preço de obra devolve número plausível e diferente a cada chamada, sem fonte.
- Os coeficientes do protótipo (percentual por etapa, adicionais, produtividade) são placeholders: o repo é público
  e o produto não pode mostrar número inventado como se fosse referência.
- O cálculo precisa recalcular na hora quando o usuário mexe numa premissa.

Opções consideradas:

- **A. LLM monta o orçamento**: rápido de fazer, impossível de auditar e de testar. Rejeitada.
- **B. Cálculo em função SQL**: um lugar só no servidor, mas duplica a regra com o front (que precisa recalcular ao vivo)
  e é pior de testar.
- **C. Motor em TypeScript puro, parâmetros no banco**: testável, determinístico, e o mesmo código serve ao
  recálculo ao vivo e ao snapshot da versão.
- **D. SINAPI item a item já no MVP**: mais preciso, mas custo de ingestão alto (milhares de itens, 27 UFs, mensal) e
  reabre o debate de composição de custo que a DECISOES de 2026-08-26 fechou.

## Decisão

1. **A IA só interpreta.** Ela transforma texto (e, na Fase 2, PDF) em uma ficha técnica validada por schema. Nunca
   define preço, prazo ou percentual. Consome tokens do usuário (motor de tokens).
2. **Motor determinístico (opção C).** `src/lib/estimativaObra.ts` é uma função pura
   `calcularEstimativa({ ficha, premissas, cub, parametros, ajustes })`. Sem I/O e sem relógio, para o mesmo input dar
   sempre o mesmo resultado. O resultado é guardado como snapshot em cada versão.
3. **Preço de referência = CUB importado.** `cub_valores` é global (UF, subtipo, padrão, mês-base), escrita só por
   `is_ultra_admin()`. A estimativa grava o mês-base usado e cita a fonte.
4. **Parâmetros no banco, com flag.** `estimativa_parametros` (singleton jsonb) guarda percentuais, adicionais,
   natureza e produtividade. Semeado com os valores do protótipo e `validado_em` nulo. Enquanto nulo, a UI avisa e
   PDF e anexo ficam desligados. O ultra admin marca como validado depois de calibrar com obras reais.
5. **Sempre em faixa**, com margem editável (padrão ±12%) e alargada quando o dado de preço é de outro mês ou de
   outra UF.
6. **Feature `estimativa_obra` opt-in por empresa**, desligada por padrão.

## Consequências

**Positivas:**

- Cada número tem fonte e regra. O engenheiro audita, o teste prova.
- Trocar CUB, adicional ou percentual não exige deploy.
- O mesmo motor atende o recálculo ao vivo, o snapshot da versão e, depois, a entrada por PDF.
- Rollback da feature por empresa é um clique, e o código pode ir à produção antes de os números estarem validados.

**Negativas / dívida assumida:**

- O CUB depende de importação mensal manual (BEZ-13); esquecer deixa a faixa mais larga. Automação de coleta fica para
  depois.
- Percentuais por etapa e produtividade são médias do setor, não da empresa. A calibração com o histórico da empresa é
  a Fase 3.
- O cálculo roda no cliente, então um usuário malicioso poderia gravar um snapshot adulterado na própria estimativa.
  Aceito: o dado é da empresa dele, não cruza tenant, e não alimenta cobrança.
- A regra existe só em TypeScript; um segundo consumidor (ex.: edge function) precisaria importar o mesmo módulo ou
  repetir testes.
