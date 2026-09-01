-- Spec 075: upload manual de foto de perfil. Bucket público (mesma leitura sem
-- signed URL de company-logos, usada pelo AvatarStack em dezenas de telas) com
-- escrita restrita ao dono via prefixo de path. Diferente do company-logos
-- (criado fora de migration, achado como gap ao escrever a spec 075), este
-- nasce versionado desde o início. Path esperado: {user_id}/avatar (fixo, upsert;
-- cache-busting fica na querystring da avatar_url gravada, não no nome do arquivo).

insert into storage.buckets (id, name, public)
values ('user-avatars', 'user-avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar do usuário: ler" on storage.objects;
drop policy if exists "Avatar do usuário: escrever" on storage.objects;
drop policy if exists "Avatar do usuário: atualizar" on storage.objects;
drop policy if exists "Avatar do usuário: remover" on storage.objects;

-- Sem esta policy, o upload (INSERT ... RETURNING *, feito pelo storage-api)
-- falha com "new row violates row-level security policy": RETURNING exige que
-- a linha inserida também seja visível por uma policy de SELECT, mesmo o bucket
-- sendo público (a leitura pública do arquivo em si é uma rota HTTP separada,
-- que não passa pela RLS de storage.objects).
create policy "Avatar do usuário: ler"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'user-avatars'
    and (split_part(name, '/', 1))::uuid = auth.uid()
  );

create policy "Avatar do usuário: escrever"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'user-avatars'
    and (split_part(name, '/', 1))::uuid = auth.uid()
  );

create policy "Avatar do usuário: atualizar"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'user-avatars'
    and (split_part(name, '/', 1))::uuid = auth.uid()
  )
  with check (
    bucket_id = 'user-avatars'
    and (split_part(name, '/', 1))::uuid = auth.uid()
  );

create policy "Avatar do usuário: remover"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'user-avatars'
    and (split_part(name, '/', 1))::uuid = auth.uid()
  );
