-- Trigger ausente no pg_dump (schema auth não é capturado).
-- Necessário para criar profiles automaticamente ao cadastrar usuários.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
