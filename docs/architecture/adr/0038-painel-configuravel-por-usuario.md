# ADR 0038: Painel do `/inicio` é montado pelo usuário, e o widget financeiro existe no catálogo

**Data:** 2026-09-04
**Status:** Proposed

Revisa o [ADR 0037](./0037-inicio-e-painel-de-gestao-nao-atalho.md) em dois pontos: o layout
deixa de ser fixo, e a proibição total de dinheiro na tela passa a ser proibição no **layout
padrão**. Todo o resto do 0037 continua valendo (RPC agregada única, baseline imutável para
indicador histórico, definição de indicador no SQL).

## Contexto

O painel de layout fixo entregou os indicadores certos e a tela errada: com 13 blocos e três
cenas, ficou densa e cada papel via muita coisa que não é problema dele. O CEO comparou com o
dashboard da Time 2 Build, onde o usuário escolhe os gráficos e o tamanho de cada um, e pediu
algo mais próximo de BI leve: métricas palpáveis primeiro (total de projetos, concluídos,
atrasados), e o resto por escolha.

Isso muda quem decide o conteúdo da tela, e reabre a questão do dinheiro. Com layout fixo, um
bloco financeiro obrigaria a tela a ter ramo por permissão e inviabilizaria a TV do escritório.
Com layout por usuário, o próprio usuário escolhe, e a permissão dele já decide o que existe no
catálogo dele.

- **Opção A, manter layout fixo e sem dinheiro**: o 0037 como está. Simples, mas mantém a tela
  densa e nega ao sócio a leitura financeira justamente na tela de abertura.
- **Opção B, layout por empresa**: um painel oficial, admin edita. Vira TV do escritório de
  novo, mas coordenador e sócio voltam a ver a mesma tela com perguntas diferentes, e dinheiro
  fica impossível outra vez.
- **Opção C, layout por usuário**: cada um monta o seu. O catálogo é filtrado pela permissão de
  quem monta, então o widget financeiro aparece só para admin e coordenador com
  `financeiro_delegado`. Custo: layout é estado novo por usuário, e a RPC volta a ter bloco
  condicional (que o 0037 tinha eliminado de propósito).

## Decisão

1. **Layout por usuário**, em `profiles.painel_layout jsonb` (mesmo padrão de
   `onboarding_state`, sem tabela nova). É uma lista ordenada de
   `{ w: <id do widget>, s: "kpi" | "terco" | "meia" | "inteira" }`. Ordem do array é a ordem
   na tela. Gravação por RPC `set_painel_layout(jsonb)`, que só escreve no próprio perfil.
2. **Layout vazio significa padrão**, e o padrão vive no front, por papel, não no banco. Um
   perfil novo nunca vê tela vazia, e mudar o padrão não exige migration de dados.
3. **O catálogo é filtrado no servidor pela permissão de quem pede.** Widget financeiro
   (`fin_*`) só é servido a quem passa em `can_view_financeiro()`; o layout pode até citar um
   id que a pessoa perdeu acesso, e o widget simplesmente não renderiza.
4. **O layout padrão não tem nenhum widget financeiro.** Dinheiro no `/inicio` é opt-in de quem
   já pode ver dinheiro em qualquer outra tela do sistema. Isto é o que sobra da regra do 0037.
5. **Uma seção por módulo do produto: Gestão, Projetos e Obras** (mais Financeiro no catálogo,
   para quem tem). Substitui o corte anterior por Comercial / Entrega / Produtividade, que era
   uma taxonomia analítica e não batia com os módulos que o usuário navega.
6. **Modo TV e a máscara de nomes saem.** O painel passa a ser privado por usuário, então não
   há parede pública a proteger. Se a TV do escritório voltar, volta como decisão própria.

```sql
-- Layout: lista ordenada, validada na escrita. Sem tabela nova.
alter table public.profiles
  add column painel_layout jsonb not null default '[]'::jsonb;

create or replace function public.set_painel_layout(p_layout jsonb)
returns void language plpgsql security invoker as $$
begin
  if jsonb_typeof(p_layout) <> 'array' then
    raise exception 'painel_layout deve ser uma lista';
  end if;
  update public.profiles set painel_layout = p_layout where id = auth.uid();
end $$;
```

## Consequências

**Positivas:**

- A tela de abertura passa a caber na cabeça: nasce com poucos números palpáveis, e cresce
  só onde o usuário pede.
- O sócio recupera a leitura financeira no `/inicio` sem que ela vaze para quem não pode ver:
  quem decide é a permissão, e o filtro é no servidor.
- Blocos que existiam e foram cortados da tela (Radar, Calendário, Projetos ativos, barra dos
  agentes) não são deletados, viram itens de catálogo. Nada de código testado no lixo.
- Layout em `jsonb` por usuário custa uma coluna, e o padrão no front pode mudar a qualquer
  release sem tocar em dado de ninguém.

**Negativas:**

- Volta o bloco condicional na RPC, que o 0037 tinha eliminado. A defesa vira um teste: pgTAP
  que chama a RPC como usuário sem financeiro e afirma que a chave `financeiro` é nula.
- Dois usuários da mesma empresa passam a ver telas diferentes, o que torna suporte mais
  difícil ("no meu não aparece") e exige o botão de restaurar padrão bem visível.
- Estado de UI (ordem, tamanho) no banco é dado que envelhece: id de widget removido num
  release futuro precisa ser ignorado na leitura, nunca quebrar a tela.
- Um construtor de layout convida à poluição que esta decisão quer resolver. O antídoto é o
  padrão enxuto e um limite de widgets por seção, não confiar no bom senso de cada um.

## Decisões relacionadas

- [ADR 0037](./0037-inicio-e-painel-de-gestao-nao-atalho.md): revisado aqui nos pontos de layout
  fixo e proibição total de dinheiro. O resto segue valendo.
- [ADR 0034](./0034-financeiro-delegado-eixo-separado-do-role.md): é a permissão que filtra o
  catálogo financeiro.
- [ADR 0008](./0008-design-system-fonte-unica.md): o construtor usa `@hello-pangea/dnd`, já no
  projeto (Kanban de projetos), e nenhuma lib nova de grid entra.
- [SPEC 092](../../specs/092-painel-de-gestao-no-inicio.md): atualizada com este desenho.
