# ADR 0066: Módulos ocultos por usuário, por lista de exclusão

**Data:** 2026-11-19
**Status:** Proposed

## Contexto

O [ADR 0029](./0029-acesso-por-role-features-por-usuario-saem.md) removeu o acesso por
feature no usuário (`profiles.features`) porque o provisionamento (concessão explícita) e a RLS
divergiram e deixaram um admin recém-convidado sem acesso a nada. A regra virou: tem profile na
empresa e a empresa tem o módulo.

Surgiu a necessidade comercial oposta: o admin do escritório quer que cada pessoa veja só os módulos
do seu trabalho (João só Projetos, Maria Gestão e Projetos, José só Obras), e que escritório que não
usa Obras não carregue o módulo no menu.

## Decisão

1. **Modelo de exclusão, não de concessão.** Guarda-se o que está **oculto**. Vazio = vê tudo.
   Convite novo, admin novo e usuário antigo nascem com acesso total; "ficar sem nada" deixa de ser
   estado possível. É o que separa este desenho do que o ADR 0029 removeu.
2. **Dois níveis, mesma lista.** Módulo oculto para a empresa (`empresas.modulos_ocultos`) e para o
   usuário (`profiles.modulos_ocultos`). O efetivo é a união dos dois.
3. **Granularidade só por módulo** (`gestao`, `projetos`, `obras`). Sem sub-feature por usuário.
4. **Admin da empresa e ultra_admin nunca são restringidos.**
5. **Fase 1 é gate de experiência** (menu, rota, atalhos, cards), no mesmo espírito do
   [ADR 0019](./0019-features-como-controle-de-rollout-nao-de-plano.md): não é fronteira de dados. A
   fronteira de dados (RLS) fica para a fase 2, só se cliente exigir confidencialidade, começando
   pelo Financeiro.
6. **Uma função decide** (`moduloVisivel(modulo)` no front, derivada de `usePermissions`), usada por
   `useModuleNav`, guarda de rota, Home, busca global e cards cruzados. Nada decide por conta própria.
7. **Rotulagem:** a UI diz "ocultar", nunca "arquivar": nenhum dado é movido ou apagado.

## Consequências

- Supera **parcialmente** o ADR 0029 (reintroduz um eixo por usuário, mas só de exclusão).
- Esconder não protege dado: documentar isso na tela para o admin não tratar como controle de acesso.
- Quem oculta Obras também perde os blocos de outras telas que dependem dele (ex.: semáforo de custo).
- Um módulo oculto não pode ser o "último módulo" salvo (`readUltimoModulo`): cair no primeiro visível.
