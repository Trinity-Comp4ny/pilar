# SPEC: Estimativa paramétrica de obra (custo em faixa e cronograma)

**Data:** 2026-10-19
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** obras
**Origem:** [DECISOES.md](../strategy/DECISOES.md) de 2026-10-19 (gate D2 reaberto e as 5 decisões de escopo)
**Protótipo:** [v0 clicável, 18 telas](https://claude.ai/artifact/PGsfphRTCM9gRQsrs3zCkb) (fonte em `.context/prototipo-estimativa/` do workspace de 19/10)
**ADRs:** [0063](../architecture/adr/0063-estimativa-de-obra-motor-deterministico-e-parametros-validados.md), [0012](../architecture/adr/0012-obra-sem-projeto-obrigatorio-e-local-proprio.md)
**Estende:** [111: cronograma da obra em quatro níveis](111-cronograma-obra-quatro-niveis-lista-e-gantt.md)

## Problema

Na primeira reunião o cliente do escritório de projeto pergunta "quanto custa construir e quanto tempo leva?".
Hoje o sócio responde no chute ou numa planilha própria, e a resposta não chega ao Pilar: quando a obra começa, o
cronograma e o previsto por etapa são digitados do zero. Quem fecha a proposta sem uma faixa de custo perde a
conversa para quem tem número.

## Objetivo

O usuário descreve a obra (tipo, padrão, local, área, o que ela tem) e recebe em menos de 5 minutos uma faixa de
custo com fonte de preço e um cronograma fase › etapa › serviço. Com um clique isso vira a obra no Pilar ou um PDF
para o cliente. Medida de sucesso: tempo até a primeira estimativa e % de estimativas que viram obra.

**Fora de escopo (MVP 1):**

- Ler o PDF do projeto (Fase 2). O assistente já nasce com a ficha técnica como contrato, para a leitura de PDF ser
  só outra entrada.
- SINAPI item a item (MVP 1.5), curva ABC, orçamento por ambiente (continua fora, DECISOES de 2026-08-26).
- Dependência entre serviços e recálculo de datas.
- Calibração com o histórico de obras da empresa (Fase 3).

## Requisitos

1. **Item próprio.** A estimativa vive em Obras › Estimativas, ligada opcionalmente a cliente, lead e proposta. Ela
   existe antes de haver projeto ou obra.
2. **Ficha técnica.** Tipo (residencial, comercial, industrial), subtipo, padrão (baixo, normal, alto), UF, área,
   pavimentos, terreno, início previsto e programa (quartos, suítes, banheiros, vagas, piscina, área gourmet,
   elevador, subsolo, marcenaria, paisagismo). A ficha é validada na entrada com schema (zod).
3. **Cálculo determinístico.** Custo = base do CUB (área × R$/m² da UF, subtipo e padrão) + adicionais + taxa de
   administração. O mesmo input dá sempre o mesmo resultado. A IA nunca define preço nem prazo (ADR 0063).
4. **Sempre em faixa.** O resultado traz mínimo, provável e máximo (padrão ±12%, editável por estimativa), R$/m² e a
   fonte com mês-base ("CUB R1-A · SP · set/2026").
5. **Adicionais.** Fundação, piscina, área gourmet, marcenaria, paisagismo, elevador e subsolo. Valor de referência do
   Pilar com ajuste por empresa. Item sem valor (ex.: subsolo, que depende de sondagem) aparece como "A definir" e
   fica fora do total.
6. **Por etapa e por natureza.** O custo é distribuído por etapa e por natureza (material, mão de obra, equipamentos,
   despesas, administração) com percentuais dos parâmetros.
7. **Prazo e desembolso.** Prazo = horas de mão de obra por m² (por padrão) ÷ equipe × horas por mês. O cronograma
   distribui as fases no prazo e o desembolso mensal sai da distribuição do custo pelas fases.
8. **UF sem tabela no mês.** Usa o mês mais recente da própria UF; sem nenhum dado da UF, usa a UF vizinha mais
   próxima; em qualquer um dos dois casos avisa e alarga a faixa. Sem CUB algum, o assistente explica e para.
9. **Versões.** Cada "salvar como versão" grava um snapshot imutável (ficha, premissas, resultado, mês-base e se os
   parâmetros estavam validados). A versão enviada ao cliente nunca muda.
10. **Cenários.** Comparar a estimativa em outro padrão, lado a lado, sem criar outra estimativa.
11. **Criar obra.** Um clique cria a obra (não exige projeto, ADR 0012), a árvore fase › etapa › serviço em
    `obra_frente` e o previsto por etapa em `obra_orcamento_etapa`. A estimativa passa a "Virou obra" e guarda o
    vínculo.
12. **PDF e proposta.** PDF de uma página A4 para o cliente e anexo à proposta (visível no portal). Ambos ficam
    bloqueados enquanto os parâmetros não estiverem validados (requisito 15).
13. **Sem leitura de texto livre por IA.** A ficha vem só do assistente. A IA entra depois, lendo o PDF da planta
    (decisão de 2026-10-20), e consome os tokens do usuário.
    13a. **Terreno inclinado.** A ficha informa o relevo do terreno (plano ou inclinado). Inclinado soma o muro de arrimo
    (m² de parede, valor provisório por m²) e lista terraplenagem e fundação especial como "a definir", porque dependem
    de levantamento topográfico e sondagem. Sem a medida do muro, o arrimo também fica "a definir".
    13b. **Padrão médio.** O padrão "normal" do CUB aparece como "Médio" nas telas. Os dados continuam com a chave `normal`.
14. **CUB mensal, com e sem desoneração.** O ultra admin importa a planilha do mês (UF × subtipo × padrão), uma por
    regime (sem desoneração, a série clássica, ou com desoneração). A estimativa usa o regime das premissas; sem
    escolha, sem desoneração. Regime sem tabela para o tipo de obra dá erro claro, sem cair no outro. A importação valida o formato
    antes de gravar e guarda a data-base. Só o ultra admin escreve; todas as empresas leem.
15. **Parâmetros validados.** Percentual por etapa, adicionais, natureza e produtividade moram em
    `estimativa_parametros`. Enquanto `validado_em` for nulo, a tela mostra o aviso "Parâmetros em validação" e o
    PDF e o anexo ficam desligados. O ultra admin marca como validado depois de calibrar com obras reais.
16. **Feature por empresa.** `estimativa_obra` é opt-in: desligada por padrão, ligada pelo ultra admin por empresa.
    Rollback é um clique.

Requisitos não-funcionais:

- **Segurança / RLS:** `estimativas_obra`, versões e ajustes por `empresa_id = get_user_empresa_id()`. `cub_valores` e
  `estimativa_parametros` leem para qualquer autenticado e escrevem só com `is_ultra_admin()`. Versões são
  insert-only. Nenhuma função nova executável por `anon`.
- **Multi-tenant:** `empresa_id` nunca vem do client; o vínculo com cliente, lead, proposta e obra é revalidado contra
  a empresa nas policies (padrão `obra_frente`).
- **Validação na fronteira:** ficha, premissas, parâmetros e planilha do CUB passam por schema antes de entrar.
- **Performance:** o cálculo roda no cliente e é instantâneo (premissa muda, resultado recalcula na hora). O CUB de
  uma UF e subtipo cabe em 3 linhas por mês.

## Critérios de aceite

- [ ] Dado CUB R1 alto de R$ 3.350/m² em SP, 320 m², sem nenhum adicional marcado e adm 12%, então a base é
      320 × 3.350, a fundação (6% da base, sempre incluída porque não entra no CUB) entra como adicional, o provável é
      base × 1,06 × 1,12 e a faixa é ±12% (teste do motor).
- [ ] Dado o mesmo input duas vezes, então o resultado é idêntico (determinismo).
- [ ] Dado um resultado, então a soma das etapas e dos adicionais mais a taxa é igual ao provável, e a soma do
      desembolso mensal é igual ao provável.
- [ ] Dado UF sem o mês atual mas com mês anterior, então usa o anterior, avisa e a faixa fica mais larga.
- [ ] Dado adicional sem valor (subsolo), então ele sai como "A definir" e fora do total.
- [ ] Dado `validado_em` nulo, então o resultado indica `parametrosValidados = false`.
- [ ] Dado um usuário de outra empresa, então não lê nem escreve estimativa, versão ou ajuste da primeira (pgTAP).
- [ ] Dado um usuário comum, então não escreve em `cub_valores` nem em `estimativa_parametros` (pgTAP).
- [ ] Dada uma versão gravada, então ela não pode ser alterada nem apagada por update ou delete direto (pgTAP).
- [ ] Dada a feature `estimativa_obra` ausente do JSONB da empresa, então a empresa não a tem.

## Dados e contratos

Tabelas novas (migrations `20261114000000_feature_catalog_add_estimativa_obra.sql` e `20261114000100_estimativa_obra.sql`):

- `cub_valores(uf, subtipo, padrao, mes_base, regime, valor_m2, fonte)`, única por (uf, subtipo, padrao, mes_base,
  regime). `regime` é `onerado` (padrão) ou `desonerado`. Global.
- `estimativa_parametros(id='default', parametros jsonb, validado_em, validado_por)`. Singleton global, semeado com os
  valores do protótipo como **placeholder não validado**.
- `estimativa_ajustes_empresa(empresa_id, adicionais jsonb)`. Uma linha por empresa.
- `estimativas_obra(empresa_id, nome, cliente_id, cliente_nome, lead_id, proposta_id, obra_id, status, versao_atual,
ficha jsonb, premissas jsonb, resultado jsonb, created_by)`.
- `estimativa_obra_versoes(estimativa_id, versao, nota, ficha, premissas, resultado, created_by)`. Insert-only.

Contrato do motor (`src/lib/estimativaObra.ts`): `calcularEstimativa({ ficha, premissas, cub, parametros, ajustes })`
devolve `{ provavel, minimo, maximo, porM2, base, adicionais[], etapas[], natureza[], fases[], desembolso[], meses,
fonte, avisos[], parametrosValidados }`. Função pura, sem I/O.

## Plano de implementação

Cada fatia é um PR com o seu card no Linear (título `[BEZ-NN]`).

1. **Base** ([BEZ-17](https://linear.app/bez-company/issue/BEZ-17)): esta SPEC, ADR 0063, migration, feature,
   motor com schemas e testes, pgTAP. Sem tela.
2. **CUB** ([BEZ-13](https://linear.app/bez-company/issue/BEZ-13)) e **adicionais por empresa**
   ([BEZ-14](https://linear.app/bez-company/issue/BEZ-14)): telas do ultra admin e da empresa.
3. **Fluxo** ([BEZ-18](https://linear.app/bez-company/issue/BEZ-18)): lista, assistente, resultado, versões, cenários.
4. **Saídas** ([BEZ-19](https://linear.app/bez-company/issue/BEZ-19)): criar obra, PDF, anexar à proposta.
5. **IA:** fora desta SPEC. A leitura do PDF da planta vira uma SPEC própria.
6. **Liberar** ([BEZ-20](https://linear.app/bez-company/issue/BEZ-20)): validar com obras reais
   ([BEZ-16](https://linear.app/bez-company/issue/BEZ-16)), marcar os parâmetros como validados, ligar numa empresa
   piloto.

## Decisões e riscos

- **Decisão (ADR 0063):** a IA estrutura, o motor precifica; parâmetros com flag de validação; feature opt-in.
- **Risco: número inventado em produção.** Os percentuais por etapa, os adicionais e a produtividade do protótipo
  são placeholders. Mitigação: `validado_em` nulo mostra aviso e bloqueia PDF e anexo, e a feature nasce desligada.
- **Risco: fonte do CUB.** Cada Sinduscon publica o seu, e o formato varia. O Claudio confirma a fonte e a planilha
  (BEZ-13). Sem CUB importado, a estimativa não calcula.
- **Risco: responsabilidade técnica.** Toda saída ao cliente leva "estimativa paramétrica, não substitui orçamento
  executivo".
- **Risco: posicionamento.** A estimativa fica para o escritório de projeto responder ao cliente; não vira orçamento
  executivo de construtora (ICP, DECISOES de 2026-09-01). Não entra em material de venda até estar na branch principal
  e validada (regra do PRICING.md).
