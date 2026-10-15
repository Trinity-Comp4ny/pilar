# ADR 0058: Resumo semanal por IA: fatos do código, texto do modelo, escopo no servidor

**Data:** 2026-10-15  
**Status:** Accepted

## Contexto

O Início ganha um resumo semanal escrito por IA ([SPEC 121](../../specs/121-inicio-com-cabecalho-vivo-e-resumo-semanal.md)).
Diferente dos agentes que gravam rascunho (ADR 0050), este texto é lido por gente que decide
em cima dele: "3 projetos atrasados" ou "recebemos R$ 40 mil" errados valem mais que um erro
de formato. Duas forças puxam em sentidos opostos:

- O modelo escreve bem, mas inventa número e suaviza notícia ruim quando o dado é longo.
- O resumo existe em dois níveis de acesso: o admin vê a empresa e o dinheiro, os demais só o
  que é seu. Um erro de escopo vaza dado financeiro para quem não pode ver.

Opções consideradas:

- **A: o modelo recebe linhas cruas e calcula.** Prompt grande, número calculado por LLM,
  escopo decidido por prompt ("só fale do usuário"). Rejeitada: o limite de acesso não pode
  depender de o modelo obedecer.
- **B: o banco calcula os fatos sob o RLS de quem pede, o modelo só redige, o código confere.**
- **C: sem LLM, só frases por template.** Seguro, mas é o que o painel já faz e é o que o
  pedido quer superar.

## Decisão

Adotar a **B**:

1. **Fatos por RPC `SECURITY INVOKER`** (`get_resumo_semanal_fatos`), chamada com o JWT de
   quem abre o Início. O escopo (`empresa` ou `pessoa`) sai de `can_view_financeiro()` no
   banco, nunca do front nem do prompt. No escopo `pessoa` o filtro por responsável é
   explícito, porque tarefas são visíveis a toda a empresa (SPEC 118) e o RLS sozinho não
   restringe.
2. **O modelo recebe só os fatos do escopo** e devolve JSON com formato fixo (Zod). Dinheiro
   chega já formatado, para o modelo copiar em vez de calcular.
3. **O código confere a saída**: todo número do texto precisa existir nos fatos, e, havendo
   atraso nos fatos, ao menos um destaque tem tom `atencao`. Falhou: uma nova tentativa com o
   erro no prompt; falhou de novo: resumo determinístico montado dos mesmos fatos.
4. **O resumo é guardado** em `resumos_semanais` junto dos `fatos` que o geraram. A leitura é
   por RLS (pessoa vê o próprio, empresa só quem passa em `can_view_financeiro()`); a escrita
   é só da edge function.
5. **Geração sob demanda**, uma vez por semana e escopo, sem botão de atualizar: o custo em
   tokens é previsível (um resumo por escopo e semana, debitado no ledger do ADR 0035).

## Consequências

- O limite de acesso é do banco: errar o prompt não vaza dinheiro, porque o dinheiro nem
  chega ao prompt do escopo `pessoa`.
- Todo resumo é auditável: o `fatos` guardado diz de onde saiu cada número.
- Prompt ou modelo novo para o resumo passa pelo mesmo critério da ADR 0048 (caso novo na
  suíte antes da mudança).
- O texto nunca compara com a semana anterior: não há snapshot, e o modelo inventaria a
  variação. Entra quando houver tabela de snapshot.
- Primeira abertura da semana espera a geração (poucos segundos). Se incomodar, um cron de
  segunda cedo reusa a mesma função.
