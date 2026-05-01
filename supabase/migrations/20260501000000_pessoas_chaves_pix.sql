alter table pessoas add column if not exists chaves_pix jsonb default '[]'::jsonb;
