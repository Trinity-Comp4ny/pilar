# SPEC: Onboarding guiado no app (checklist + tour por página)

**Data:** 2026-08-12  
**Status:** Em implementação  
**Autor:** Matheus Rezende (CEO)  
**Módulo:** transversal (gestao / projetos / obras)

## Problema

O usuário novo termina o cadastro de conta e cai no app sem saber o que fazer primeiro. O ICP (sócio de escritório de engenharia) não é power-user de SaaS: sem orientação, não descobre a ordem de setup (equipe → cliente → projeto → obra) e o produto parece vazio.

## Objetivo

Depois desta feature, o admin de uma empresa nova é guiado passo a passo pelos 3 pilares, com um checklist flutuante que mostra o progresso real e balões que apontam a ação certa em cada tela, reduzindo o tempo até o primeiro projeto criado.

**Fora de escopo:** onboarding para colaborador não-admin; nudges por e-mail; passos profundos de cada módulo (RDO, medição); Obras como upsell para quem não tem a feature.

## Requisitos

1. Um painel flutuante (canto inferior direito) mostra 3 seções recolhíveis por pilar (Gestão / Projetos / Obras) com progresso por seção e total.
2. Cada passo é marcado como concluído quando existe ≥ 1 entidade real da empresa (derivado de contagem, não gravado).
3. A seção Obras só aparece se a empresa tem `feature: "obras"`; cada passo respeita as feature flags e `adminOnly`.
4. Ao chegar numa tela com passo pendente ainda não visto, um balão (driver.js) destaca a ação primária.
5. O usuário pode minimizar o painel (pílula) e dispensá-lo de vez; a dispensa e os tours vistos sobrevivem a reload e troca de device.
6. O admin pode reativar o guia em Configurações › Conta.
7. O checklist só aparece para admin/owner.

Não-funcionais:

- **Segurança / RLS:** meta-estado em `profiles.onboarding_state`, escrito só pela RPC `set_onboarding_state` escopada a `auth.uid()`. Contagens filtram por `empresa_id`.
- **Performance:** contagens leves (`head: true`, `count: exact`) com `staleTime` de 2 min; sem full-scan de linhas.
- **Multi-tenant:** todas as contagens por `empresa_id`.

## Critérios de aceite

- [x] Dado empresa nova sem feature `obras`, quando o admin entra, então o painel mostra só Gestão e Projetos, 0 concluídos.
- [x] Dado empresa com `obras` ligado, então aparece a 3ª seção (Obras).
- [x] Dado que a empresa cria a 1ª pessoa, então o passo "Cadastre sua equipe" fica concluído sem recarregar (invalidação do react-query).
- [x] Dado não-admin, então o checklist não aparece e passos `adminOnly` são filtrados.
- [x] `nextStep` é o primeiro obrigatório pendente; cai em opcional só quando não há obrigatório pendente.
- [ ] Dado que o admin dispensa o painel, quando recarrega, então o painel não reaparece (persistido no banco). *(verificar em browser)*
- [ ] Dado que o admin chega em `/gestao/equipe` com o passo pendente, então o balão aponta o botão "Nova pessoa". *(verificar em browser)*

## Dados e contratos

- Migration `20260823000000_onboarding_state.sql`: coluna `profiles.onboarding_state jsonb default '{}'` + RPC `set_onboarding_state(patch jsonb) returns jsonb` (SECURITY DEFINER, merge raso).
- Shape do estado: `{ dismissed: boolean, completed_at: string | null, tours_seen: string[] }`.
- Registro dos passos: `src/lib/onboarding/steps.ts` (fonte única).

## Plano de implementação

Ver plano aprovado e ADR 0018. Resumo: migration → `steps.ts` → `state.ts`/`useOnboardingState` → `progress.ts`/`useOnboardingProgress` → `tour.ts` + CSS → `OnboardingTourController` → reescrita do `OnboardingChecklist` (flutuante) → mount no `Layout` → `data-tour` nas telas → reset em `ContaPanel` → testes.

## Decisões e riscos

- Arquitetura em [ADR 0018](../architecture/adr/0018-onboarding-guiado-checklist-e-tour.md).
- **Risco:** o scorecard de maturidade (2026-08) marcou tour como prematuro antes do 1º cliente pagante. Construído por decisão explícita do CEO; medir uso via PostHog antes de investir mais.
- **Suposição:** disciplinas são catálogo global (sem `empresa_id`), por isso o passo de Projetos é Fluxo + Projeto, não "criar disciplina".
