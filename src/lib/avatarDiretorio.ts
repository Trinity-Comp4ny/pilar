export type PessoaComFoto = { nome: string; profiles: { avatar_url: string | null } | null };
export type PerfilComFoto = {
  nome: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

/** Chave de busca por nome: sem acento, caixa nem espaço duplicado. */
export function chaveDeNome(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Nome → URL da foto, para telas que só têm o nome da pessoa. A foto da pessoa
 * vinculada a um perfil vale primeiro; depois, o perfil com o mesmo nome. Esse
 * segundo passo cobre quem tem login mas cuja pessoa não foi vinculada ao perfil
 * (caso do sócio que se cadastrou como pessoa sem ligar a conta).
 */
export function montarDiretorioDeFotos(pessoas: PessoaComFoto[], perfis: PerfilComFoto[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const p of pessoas) {
    const url = p.profiles?.avatar_url;
    if (url && p.nome) mapa.set(chaveDeNome(p.nome), url);
  }
  for (const perfil of perfis) {
    if (!perfil.avatar_url) continue;
    const nome = perfil.nome || [perfil.first_name, perfil.last_name].filter(Boolean).join(" ");
    if (!nome) continue;
    const chave = chaveDeNome(nome);
    if (!mapa.has(chave)) mapa.set(chave, perfil.avatar_url);
  }
  return mapa;
}
