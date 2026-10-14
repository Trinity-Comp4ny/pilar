# Auditoria de produção de 14/10/2026: o que a primeira auditoria não viu

Segunda leitura da produção (`main` = `staging` pela árvore, release #618), conferindo a
auditoria externa do mesmo dia contra o código, o GitHub e os dados ao vivo do Supabase de
produção. ← [voltar](./README.md)

As notas abaixo são estimativa de quem auditou, não medição. Nota 10 em todas as áreas não é
alcançável só com código: a seção 5 separa o que depende de dinheiro, conta ou tempo.

## 1. Resumo

A primeira auditoria acertou o estado do release (árvore idêntica, migrations e 48 Edge
Functions no ar, SHA propagado). Dos 7 itens que ela listou, 3 tinham causa exata e foram
fechados aqui. O que ela não viu veio de olhar só o log do deploy e o repositório: faltou
cruzar com os advisors do banco de produção, com os headers e o DNS reais, e com a própria
interface rodando sob teclado e Axe. Esta PR fecha o que é código e deixa a lista do que
depende do dono na seção 6.

## 2. Conferência da primeira auditoria

| Afirmação                                   | Verificado                                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main` e `staging` têm a mesma árvore       | Confirmado (`git diff --stat origin/main origin/staging` vazio).                                                                                                    |
| Smoke de produção foi pulado (sem anon key) | Confirmado: o Environment `Production` não tinha `SUPABASE_ANON_KEY`. **Corrigido:** secret cadastrado, `/health` de produção responde 200 com a versão do release. |
| CodeQL não é obrigatório na `main`          | Confirmado (só `CI OK`). **Corrigido:** agora é check obrigatório, igual ao staging.                                                                                |
| `enforce_admins` falso na `main`            | Confirmado e **mantido de propósito**: o release usa `gh pr merge --admin` (ver DECISOES.md de 14/10).                                                              |
| `[inbucket]` deprecado no `config.toml`     | Confirmado. **Corrigido:** `[local_smtp]`.                                                                                                                          |
| CLI do Supabase 2.109.1 atrás da 2.121.0    | Confirmado. **Mantido**: ver DECISOES.md de 14/10.                                                                                                                  |
| Monitor sintético a cada 10 min             | O cron está em 10 min, mas o GitHub atrasa schedule: os runs reais saem a cada 3 a 8 horas. Tratar como alarme de horas, não de minutos.                            |
| "365 migrations"                            | Correto, e o `CLAUDE.md` ainda dizia 183 (corrigido).                                                                                                               |

## 3. O que a primeira auditoria não viu

| #   | Achado                                                                                                                                                                                 | Estado                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | CI testava migrations e pgTAP em Postgres 15; produção e staging rodam 17.                                                                                                             | Corrigido: o runner sobe em 17. Provado: reset do zero e 60 arquivos pgTAP (725 testes).                                     |
| 2   | 135 chaves estrangeiras sem índice em produção (advisor), incluindo `tarefas.projeto_id`, `tarefas.responsavel_id`, `obras.projeto_id` e toda FK para `empresas`.                      | Corrigido: 83 índices; as 52 FKs de auditoria para `auth.users` ficam de fora por decisão.                                   |
| 3   | 26 funções com `search_path` mutável (advisor).                                                                                                                                        | Corrigido e travado por pgTAP.                                                                                               |
| 4   | Foco do modal: ao fechar (Esc ou Cancelar), o foco caía no `<body>`. Vale para todo modal aberto por estado, que é quase todo o app.                                                   | Corrigido no Dialog, AlertDialog e Sheet, com teste.                                                                         |
| 5   | Dois landmarks `main` aninhados em 75 páginas; o skip link não levava o foco ao conteúdo.                                                                                              | Corrigido.                                                                                                                   |
| 6   | O Axe cobria 13 telas. Ao ampliar para 21, 7 telas reprovaram: selects sem nome acessível (5 telas), contraste do texto nas barras do cronograma, rosca do financeiro sem alternativa. | Corrigido, 24 specs passando.                                                                                                |
| 7   | Textos de leitor de tela em inglês no Dialog, Sheet e Sidebar ("Close", "Toggle Sidebar").                                                                                             | Corrigido.                                                                                                                   |
| 8   | 4 Edge Functions chamáveis por usuário sem rate limit (`campo-upload-foto`, `reset-cliente-portal-password`, `pilar-subscription-manage`, `upload-portal-entrega`).                    | Corrigido, com helper compartilhado e régua no teste de padrão das funções.                                                  |
| 9   | Cifragem do backup com o padrão do openssl (10 mil iterações de PBKDF2).                                                                                                               | Endurecido para 600 mil e chave com menos de 32 caracteres derruba o backup; o drill lê os dois formatos e a chave anterior. |
| 10  | Sem `security.txt`, sem SBOM por release.                                                                                                                                              | Corrigido (ambos).                                                                                                           |
| 11  | Sem teto de tamanho de arquivo no front: `RdoFormDialog.tsx` tem 1,5 mil linhas.                                                                                                       | Catraca criada (18 arquivos acima de 700 linhas, teto só desce). Divisão em si: dívida.                                      |
| 12  | `COMPLIANCE.md` dizia "DPIA a fazer" com o RIPD já publicado.                                                                                                                          | Corrigido.                                                                                                                   |
| 13  | Orçamento de bundle com 0,8% de folga (322,3 kB de 325 kB iniciais).                                                                                                                   | Aberto: o próximo PR que somar JS vai reprovar; decidir entre subir o teto e cortar peso.                                    |
| 14  | 181 policies permissivas múltiplas e 72 índices sem uso (advisors de performance).                                                                                                     | Aberto: reescrever policies é mudança de risco; só vale com volume real.                                                     |
| 15  | `moderate` no `npm audit` (`mammoth` > `argparse` > `sprintf-js`): não há versão corrigida do pacote.                                                                                  | Aceito: `argparse` não roda no caminho do app (só no CLI do mammoth). O gate é nível alto.                                   |

## 4. Notas por área (estimativa)

| Área                | Primeira auditoria | Depois desta PR | O que segura a nota                                                |
| ------------------- | -----------------: | --------------: | ------------------------------------------------------------------ |
| Segurança           |                9,8 |             9,8 | Pentest externo; itens de configuração do Auth fora do repositório |
| Banco / RLS         |                9,8 |             9,9 | Policies permissivas múltiplas, `pg_trgm` em `public`              |
| CI/CD               |                9,7 |             9,9 | Upgrade do CLI é deliberadamente manual                            |
| Release engineering |                9,3 |             9,6 | Primeiro release com smoke obrigatório ainda não aconteceu         |
| DR / backups        |                9,2 |             9,3 | PITR exige plano Pro; RPO segue 24 h                               |
| Front architecture  |                8,7 |             8,9 | 18 arquivos acima de 700 linhas, 13 pares de módulos cruzados      |
| Edge architecture   |                8,5 |             8,8 | 5 funções sem chamador conhecido ainda publicadas                  |
| Acessibilidade      |                8,9 |             9,3 | Rodada manual com VoiceOver ainda não feita                        |
| Compliance          |                8,9 |             9,0 | DPO, DPA assinados, revisão jurídica, SOC 2                        |
| FinOps              |                8,5 |             8,5 | Vercel Hobby dividido com projetos pessoais                        |
| E-mail              |                9,2 |             9,2 | DMARC ausente (DNS, ver DEPLOY_CHECKLIST)                          |

## 5. O que não chega a 10 só com código

- **PITR e backup gerenciado:** plano Pro do Supabase. Sem ele o RPO é de 24 h.
- **Vercel:** a conta Hobby é compartilhada com 6 projetos pessoais e não cobre uso comercial.
- **Pentest externo, SOC 2, DPO nomeado, DPAs assinados:** tempo e contrato.
- **Acessibilidade 10:** exige rodada manual com leitor de tela (roteiro em ACESSIBILIDADE.md).
- **Front 10:** dividir os 18 arquivos grandes é trabalho de módulo, não de PR de auditoria.

## 6. Pendências do dono

- [ ] Antes do release que leva esta PR à `main`: conferir/rotacionar a `BACKUP_ENCRYPTION_KEY` pelo runbook de DISASTER_RECOVERY.md (chave com menos de 32 caracteres derruba o backup noturno).
- [ ] Primeiro release depois desta PR: conferir que o job de deploy mostra `health OK` com o SHA novo.
- [ ] Primeiro run do `Monitor de produção` depois do release.
- [ ] DNS: registro DMARC do `pilarsoft.com.br` (texto pronto no DEPLOY_CHECKLIST).
- [ ] Decidir Vercel (time Pro ou tirar os projetos pessoais).
- [ ] Rodada manual de acessibilidade e registro na tabela de ACESSIBILIDADE.md.
- [ ] Depois do release, rodar `node scripts/audit-security.mjs prod` e só gravar `--snapshot` depois de ver `fk_sem_indice` e `search_path` realmente caírem.
- [ ] Renovar `security.txt` antes de 14/10/2027 (o teste avisa 60 dias antes).
