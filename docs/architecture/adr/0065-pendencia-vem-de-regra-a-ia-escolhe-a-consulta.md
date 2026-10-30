# ADR 0065: A pendência vem de regra em SQL, e a IA só escolhe a consulta e escreve a resposta

**Data:** 2026-10-30  
**Status:** Accepted

## Contexto

O dono quer agentes proativos que achem sozinhos o que está em aberto (parcela vencendo, projeto com prazo próximo,
orçamento incorreto, tarefa da obra vencendo) e um chat que consulte e aja. Hoje a aba Pendências só mostra aditivos
do guardião de margem, que depende de orçamento por disciplina que ninguém preencheu, e o chat devolve só totais.

Opções consideradas:

- **A. Um agente de IA varre os dados e decide o que é pendência.** Flexível, mas caro por empresa por dia, diferente a
  cada execução, sem como provar que uma parcela vencida não foi esquecida, e o resultado não é testável.
- **B. Regras em SQL detectam, gravam e fecham; a IA entra só onde linguagem natural ajuda** (escolher qual consulta
  responde à pergunta e redigir a resposta sobre linhas reais).
- **C. Só notificação (o sino).** Já existe, mas é aviso de evento: repete, não guarda idade nem dono, e tinha filtro
  faltando.

## Decisão

Opção B.

1. **Pendência é derivada.** `agente_pendencias_detectar()` é a fonte única das regras; a varredura grava, mantém a
   idade, fecha o que sumiu e reabre o que voltou. Nenhum campo vem de modelo.
2. **A IA não decide se existe pendência.** No chat, ela escolhe entre ferramentas de leitura fechadas
   (SPEC 147), com argumento validado por schema, teto de rodadas e fallback para os coletores antigos.
3. **Ação continua com confirmação humana.** Marcar como recebido, pagar, aprovar aditivo passam pelo card de
   confirmação; o agente propõe, a pessoa confirma.
4. **Toda leitura passa pela RLS de quem pergunta.** Nunca `service_role` no chat; a fila de pendências é visível por
   área com os mesmos gates das tabelas de origem.

## Consequências

- Detecção é barata, determinística e coberta por teste; custo de IA só aparece quando alguém conversa.
- Regra nova é migration com teste. Em troca, o agente não "percebe" o que não tem regra: o catálogo de tipos
  precisa crescer de propósito (regras por empresa ficam para a fase seguinte).
- Os fatos de cada pendência ficam em `dados` (jsonb), e o chat os cita com link para o registro.
- Mantém a [ADR 0058](./0058-resumo-semanal-fatos-do-codigo-texto-do-modelo.md): fatos do código, texto do modelo.
