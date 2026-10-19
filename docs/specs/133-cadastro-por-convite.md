# SPEC: Cadastro por convite (fim do teste grátis self-serve)

**Data:** 2026-10-19
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** auth / landing
**Supera:** [039: cadastro self-serve](039-self-serve-signup-e-google.md) e a parte de self-serve da [104: trial de 3 dias](104-trial-3-dias-e-empresa-convidada.md)

## Problema

O Pilar está aberto ao público: qualquer pessoa cria conta pela landing e entra
no teste de 3 dias sem falar com ninguém. O único cadastro orgânico de produção
usou o produto 5 minutos e sumiu. Com poucos clientes e venda de alto contato,
o CEO decidiu (19/10, `DECISOES.md`) que toda empresa entra conversando com o time.

## Objetivo

Nenhuma empresa nova entra sem o time: a landing leva para agendar a
demonstração e o banco recusa conta nova sem convite. Quem já tem conta, quem
recebe convite e quem paga pelo link que o time envia continua entrando.

**Fora de escopo:**

- Bot de WhatsApp que qualifica e agenda (ideia registrada para depois).
- Agendamento por calendário (Cal.com e afins): o contato é o WhatsApp do time.
- Mudar o trial das empresas que já existem ou o fluxo de empresa convidada.
- Remover o checkout: ele segue para o link que o time manda.

## Requisitos

1. Todo CTA de entrada da landing (header, hero, fecho, planos, módulos,
   comparativos, rodapé) vira "Agendar demonstração" e abre o WhatsApp do time
   com o texto pronto. Some a promessa "3 dias grátis, sem cartão".
2. `/cadastro` no app mostra "Fale com o time para começar", com
   "Agendar demonstração" (WhatsApp), "Já tenho conta" (login) e a dica de abrir
   o link do e-mail para quem recebeu convite. O formulário não aparece.
3. O banco recusa conta nova sem `invite_token` vinda do GoTrue (e-mail e Google)
   enquanto `platform_settings.cadastro_aberto = false` (padrão).
4. Convite de membro, empresa criada pelo ultra-admin e checkout pago continuam
   funcionando (todos chegam com `invite_token`).
5. Quem tenta entrar com um Google sem conta vê "Este e-mail ainda não tem conta
   no Pilar. Fale com o time para criar a da sua empresa.", não um erro técnico.
6. Reabrir o cadastro é `cadastro_aberto = true` mais `CADASTRO_ABERTO` no
   `Signup.tsx`, sem migration nova.

Não-funcionais:

- **Segurança:** a regra mora no `handle_new_user` (`SECURITY DEFINER`), não no
  front: chamar `auth.signUp` direto com a anon key também é recusado. A função
  `cadastro_sem_convite_permitido` não é executável por anon nem authenticated.
- **Testes do banco:** a regra só vale para o login do GoTrue
  (`supabase_auth_admin`). Os testes e seeds que inserem em `auth.users` como
  `postgres` seguem criando empresa pelo caminho de sempre.

## Critérios de aceite

- [x] Dado o cadastro fechado, quando o GoTrue cria um usuário sem convite, então
      o trigger recusa (pgTAP `cadastro_por_convite_spec_133.sql`).
- [x] Dado o cadastro reaberto, então o mesmo cadastro passa.
- [x] Insert direto como `postgres` continua criando empresa e admin.
- [x] O erro genérico do GoTrue vira a mensagem do requisito 5 (`authErrors.test.ts`).
- [ ] Depois do deploy em staging: cadastro pelo `/cadastro` antigo (ou `auth.signUp`
      com a anon key) e Google com e-mail novo falham com a mensagem certa;
      convite de membro continua entrando.

## Decisões e riscos

- **Decisão:** bloquear no banco, não no painel do Supabase ("Allow new users to
  sign up"). O painel não é versionado nem passa pelo release; a flag no banco é.
- **Risco:** a origem (UTM) da landing não chega mais à conta, porque não há
  cadastro. Follow-up: levar a origem no texto do WhatsApp ou num formulário de
  demonstração.
- **Risco:** o termo de uso e a política ainda citam o teste grátis; o trial
  segue existindo para as empresas criadas pelo time, então o texto não ficou
  falso. Revisar na próxima versão dos termos.
