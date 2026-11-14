# Bug zero e polimento semanal

Prática adotada em 2026-11-10 (SPEC 160), inspirada na zero-bug policy e nas Quality Wednesdays
da Linear (ver `research/themes/profissionalizacao-saas-referencias.md`).

## Bug zero

- Todo problema relatado pelo app (Feedback → "Reportar problema") tem **7 dias corridos** para
  ser resolvido ou descartado com motivo. O Ultra admin mostra o prazo de cada um e o filtro
  "Bugs com mais de 7 dias".
- O commit da correção leva `Feedback: <id>` (SPEC 145). No release, quem relatou recebe "O que
  você pediu chegou ao Pilar" (SPEC 152).
- **Meta:** zero bugs atrasados no último dia útil de cada mês. Se não der, o primeiro bloco da
  semana seguinte é só isso.

## Polimento semanal

- Um bloco fixo por semana (sugestão: quarta à tarde, 2 horas) para caçar imperfeição que
  ninguém reportou: texto torto, alinhamento, estado vazio pobre, erro com mensagem técnica,
  passo a mais num fluxo.
- Cada achado vira commit pequeno com o escopo da tela e, se o usuário sente, a linha
  `Novidade:` com `Impacto: correcao`.
- **Onde procurar:** Lacunas da ajuda (`/ultra-admin/ajuda`), "Foi fácil?" com polegar para baixo
  (`/ultra-admin/satisfacao`) e comentários de detratores.
- Contagem mensal: quantos polimentos entraram (commits com escopo `polish` ou linha `Novidade:`
  de correção).
