import { useEffect, useState } from "react";

/**
 * URL temporária (blob:) para pré-visualizar um arquivo local. Cria uma vez por
 * arquivo e revoga quando o arquivo muda ou o componente sai, em vez de chamar
 * `URL.createObjectURL` a cada render (que vaza memória).
 */
export function useObjectUrl(file: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const criada = URL.createObjectURL(file);
    setUrl(criada);
    return () => URL.revokeObjectURL(criada);
  }, [file]);

  return url;
}
