# Level-up de verdade — o número confiável e auditável

← [voltar ao índice](./README.md) · Status: **ideia registrada, NÃO implementar ainda** · 2026-07-16

Origem: Matheus perguntou "o que mais subiria o nível do sistema?" olhando os docs
[PRODUCT_EXPERIENCE_MODULE.md](./PRODUCT_EXPERIENCE_MODULE.md) e
[HOME_LAUNCHPAD_IDEA.md](./HOME_LAUNCHPAD_IDEA.md). Resposta: para o Pilar, subir de
nível **não é decoração de UI**, é o número de lucro ser confiável e auditável. Um
escritório de engenharia não põe o financeiro inteiro numa ferramenta cujo número ele
não consegue conferir.

Achados verificados no código (2026-07-16): **não existe** export (PDF/CSV/Excel),
**não existe** import de dados, **não existe** drill-down do número. Roles/permissões
**já existem** (`useRole`, `usePermissions`, `useUserRole`, `useFeatureAccess`).

---

## Ranking (o que sobe o nível, específico ao ICP de dinheiro/engenharia)

**1. Rastreabilidade do número (drill-down).** Clicar no "lucro do projeto" e ver as
linhas que o compõem (quais receitas, quais custos, qual parcela). Hoje não existe.
É o que separa "planilha bonita" de "sistema em que confio". Engenheiro não assina
embaixo de número que não audita. **É o item nº 1, acima de tudo.**

**2. Relatório/export com a cara do escritório.** Zero export hoje. Para esse ICP o
relatório é entregável (mostra pro sócio, anexa em reunião). PDF com logo + CSV pra
Excel valem mais que dez features internas. Baixo esforço, alto sinal de
profissionalismo.

**3. Importar os dados atuais.** Zero import hoje. Barreira nº 1 pra trocar de planilha
pro Pilar: ninguém migra histórico na mão. Sem import de projetos/clientes (nem que
seja CSV com mapeamento de coluna), o custo de entrada mata a adoção. É a diferença
entre "testei" e "migrei de verdade".

**4. Confiança visual no dado.** "Atualizado há 2 min", "recalculando...", "bate com X".
Para número de dinheiro reduz a ansiedade de "será que tá certo?". Barato, amarra no nº 1.

**5. Permissões que já existem, bem aplicadas.** Os hooks já estão no código. Sócio vê
margem, estagiário não. Destrava vender pra escritório com mais de uma pessoa (hoje
provavelmente é tudo-ou-nada). Não é feature nova, é usar o que já existe.

## O que NÃO adicionar agora

Command palette, favoritos, "What's New", status page, tour guiado, notificações. Bom,
mas prematuro (é o conteúdo dos outros dois docs de ideias). E a verdade dura: há
**bugs de dinheiro mapeados** (quitar antecipado ignora desconto, cartão em dobro, fuso)
e **cobertura de teste zero no financeiro**. Nenhum launchpad bonito compensa número
errado. Para produto de dinheiro, subir de nível começa em: **o número está certo e eu
consigo provar.** Isso vale mais que qualquer polimento visual.

## Veredito de uma linha

O maior salto de nível do Pilar não é uma tela nova, é tornar o número de lucro
rastreável, exportável, importável e provadamente correto, o resto é enfeite até isso
existir.
