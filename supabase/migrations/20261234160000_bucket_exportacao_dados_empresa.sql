-- Exportação dos dados da empresa (saída de quem teve a assinatura suspensa).
--
-- Bucket privado empresa-exportacoes. Sem policy de propósito: ninguém além da service
-- role lê ou escreve; o admin baixa por link assinado de 10 minutos que a edge
-- exportar-dados-empresa gera. Só a última cópia de cada empresa fica guardada (a edge
-- remove as anteriores).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('empresa-exportacoes', 'empresa-exportacoes', false, 104857600, ARRAY['application/zip'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
