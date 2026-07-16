# SPEC: Nome da feature

**Data:** AAAA-MM-DD  
**Status:** Draft | Aprovada | Em implementação | Entregue  
**Autor:** —  
**Módulo:** projetos | financeiro | clientes | portal | ...

<!--
Como usar:
1. Copie para docs/specs/NNN-nome-em-kebab-case.md antes de codar qualquer feature não-trivial.
2. Escreva o QUÊ e o PORQUÊ. O COMO fica no plano (seção "Plano de implementação"),
   que o agente de IA propõe e você aprova ANTES de gerar código.
3. Os "Critérios de aceite" viram os testes. Se não dá pra testar, não é critério.
4. Passe esta spec inteira como contexto pro agente em vez do pedido solto.
   A spec é o artefato durável; o código é descartável.
Regra de ouro: se você não consegue escrever os critérios de aceite, ainda não
entendeu a feature o suficiente pra construí-la (nem pra pedir pro agente construir).
-->

## Problema

Que dor do usuário isto resolve. Uma frase. Amarre ao ICP (engenharia
multidisciplinar) quando fizer sentido: quem sente essa dor e quando.

## Objetivo

O resultado esperado em uma frase mensurável. O que passa a ser possível
depois desta feature que não era antes.

**Fora de escopo:** o que esta feature explicitamente NÃO faz (corta discussão depois).

## Requisitos

Requisitos funcionais, numerados, testáveis:

1. O usuário pode ...
2. Ao ..., o sistema deve ...
3. ...

Requisitos não-funcionais (só os que importam aqui):

- **Segurança / RLS:** que tabela, qual policy, `auth.uid()` de quem.
- **Performance:** limite aceitável (ex. lista não pode fazer full-scan).
- **Multi-tenant:** isolamento por `empresa_id` mantido.

## Critérios de aceite

Cenários concretos no formato dado → quando → então. Cada um vira um teste.

- [ ] Dado ..., quando ..., então ...
- [ ] Dado ..., quando ..., então ...
- [ ] Caso de borda: dado ..., então ... (ex. valor zero, sem permissão, fuso horário)

## Dados e contratos

- Tabelas/colunas novas ou alteradas (vira migration + `npm run gen:types`).
- Assinatura de RPC / edge function, se houver.
- Shape do retorno que o front consome.

## Plano de implementação

Preenchido junto com o agente (plan mode) e aprovado antes de gerar código.
Passos ordenados, cada um verificável.

1. ...
2. ...

## Decisões e riscos

- Decisão de arquitetura relevante? Abra um [ADR](../architecture/README.md) e linke aqui.
- Risco conhecido / suposição que pode furar.
