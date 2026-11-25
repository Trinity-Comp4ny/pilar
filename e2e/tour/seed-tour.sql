-- Conta do Pilar Campo para o tour (sessão já válida, sem troca de senha).
-- O token cru vai no sessionStorage do teste; o banco guarda o sha256, como no login real.
insert into public.campo_accounts (id, empresa_id, obra_id, nome, email, must_change_senha, token_sessao, token_expira_em, ativo)
values (
  '00000000-0000-0000-0000-000000000c01',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000a01',
  'Encarregado de campo',
  'campo@local.test',
  false,
  encode(extensions.digest('tour-campo-token-0123456789abcdef', 'sha256'), 'hex'),
  now() + interval '3 days',
  true
)
on conflict (id) do update
  set token_sessao = excluded.token_sessao,
      token_expira_em = excluded.token_expira_em,
      must_change_senha = false,
      ativo = true;
