# SPEC 171: Ocultar módulos por empresa e por usuário

**Data:** 2026-11-19
**Status:** Draft
**Autor:** —
**Módulo:** configurações, menu, admin da empresa

## Problema

Escritório de arquitetura que não usa Obras vê o módulo no menu e acha o sistema "sujo". Dentro de um
escritório, cada pessoa só trabalha em parte do produto (João em Projetos, José em Obras), mas todos
veem tudo.

## Objetivo

O admin da empresa oculta módulos para a empresa toda e/ou para usuários específicos, e quem está
oculto não vê o módulo em lugar nenhum nem consegue abri-lo por URL. Nenhum dado é apagado e
reativar é um clique.

**Fora de escopo:** segurança de dados (RLS por módulo, fase 2); sub-features por usuário; permissão
de leitura vs. edição por módulo; ocultar itens soltos do menu.

## Requisitos

1. Tela "Configurações → Módulos" (admin): liga/desliga Gestão, Projetos, Obras para a empresa.
2. Na tela de Pessoas/acesso, o admin define, por usuário, quais módulos ficam ocultos.
3. Padrão sempre "tudo visível" (lista de exclusão vazia), inclusive para convites e usuários existentes.
4. Admin da empresa e ultra_admin ignoram a restrição.
5. Módulo oculto some da sidebar, do menu mobile, da Home, da busca global e de cards cruzados
   (ex.: semáforo de custo da obra nos projetos).
6. Rota direta de módulo oculto redireciona para o primeiro módulo visível, com aviso.
7. Impossível ocultar todos os módulos de um usuário (mínimo um visível).
8. Onboarding: o pilar escolhido pode pré-ocultar os outros, mas só como sugestão confirmável.
9. Texto da tela avisa: "Ocultar não restringe o acesso aos dados."

Não-funcionais:

- **Segurança / RLS:** colunas editáveis só por admin da empresa; usuário não altera a própria lista.
- **Multi-tenant:** isolamento por `empresa_id` mantido.

## Critérios de aceite

- [ ] Dado empresa com Obras oculto, quando qualquer usuário abre o app, então Obras não aparece em lugar nenhum.
- [ ] Dado usuário João com Obras e Gestão ocultos, quando abre `/obras`, então vai para Projetos com aviso.
- [ ] Dado convite novo, quando aceito, então vê todos os módulos da empresa.
- [ ] Dado admin da empresa com módulo oculto na própria linha, então continua vendo tudo.
- [ ] Dado Obras oculto, então o semáforo de custo some dos projetos sem estado vazio quebrado.
- [ ] Caso de borda: último módulo usado está oculto, então abre no primeiro visível.
- [ ] Caso de borda: tentar ocultar o último módulo visível do usuário é bloqueado com mensagem.
- [ ] Usuário comum não consegue gravar a própria `modulos_ocultos` (teste de RLS).

## Dados e contratos

- `empresas.modulos_ocultos text[] not null default '{}'` e `profiles.modulos_ocultos text[] not null default '{}'`,
  com check de valores válidos (`gestao`, `projetos`, `obras`).
- RPC `set_modulos_ocultos(p_alvo, p_usuario_id, p_modulos)`, só admin, valida mínimo de um visível.
- Front: `moduloVisivel(id)` e `modulosVisiveis` em `usePermissions`; `useModuleNav` filtra por eles.

## Plano de implementação

1. Migration + RLS + pgTAP; `gen:types:local`.
2. `moduloVisivel` em `usePermissions` + testes unitários.
3. Filtrar `useModuleNav`, `MoreSheet`, guarda de rota e `readUltimoModulo`.
4. Varredura de cards cruzados (Home, busca, semáforo de custo).
5. Telas: Configurações → Módulos e coluna em Pessoas (`FormDialog`, `ConfirmDialog` quando couber).
6. Protótipo no Claude Design (desktop + mobile) **antes** do passo 5; antes/depois no PR.

## Decisões e riscos

- [ADR 0066](../architecture/adr/0066-modulos-ocultos-por-usuario-lista-de-exclusao.md), que supera parcialmente o ADR 0029.
- Risco: admin confundir "ocultar" com restrição de acesso (mitigado pelo aviso, requisito 9).
- Risco: cards cruzados esquecidos mostrarem link para módulo oculto (mitigado pela varredura do passo 4).
