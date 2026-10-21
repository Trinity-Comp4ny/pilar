/**
 * Os `adicionais` dos parâmetros do motor, lidos das migrations do repositório (sem banco): é o que a função lê de
 * `estimativa_parametros` em produção. Mantém a avaliação com o mesmo catálogo que o banco tem, sem copiar nomes.
 * Roda a partir da raiz do repositório.
 */
const MIGRATIONS = [
  "supabase/migrations/20261114000100_estimativa_obra.sql",
  "supabase/migrations/20261116000100_estimativa_terreno_inclinado.sql",
  "supabase/migrations/20261117000100_estimativa_itens_catalogo.sql",
];

function jsonDaMigration(sql: string): Record<string, unknown> {
  const m = sql.match(/\$json\$([\s\S]*?)\$json\$/);
  if (!m) throw new Error("JSON de parâmetros não encontrado na migration");
  return JSON.parse(m[1]) as Record<string, unknown>;
}

export async function adicionaisDasMigrations(raiz = "."): Promise<Record<string, unknown>> {
  const adicionais: Record<string, unknown> = {};
  for (const arquivo of MIGRATIONS) {
    const json = jsonDaMigration(await Deno.readTextFile(`${raiz}/${arquivo}`));
    // A migration base traz `adicionais` dentro de `parametros`; as seguintes trazem as chaves soltas ou em `adicionais`.
    const bloco = (json.adicionais ?? json) as Record<string, unknown>;
    Object.assign(adicionais, bloco);
  }
  return adicionais;
}
