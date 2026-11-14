/**
 * Árvore da pasta "Cliente" (SPEC 163). O cliente só vê a pasta Cliente do projeto e as
 * subpastas registradas abaixo dela. Cada pasta registrada conhece o pai (pasta_pai_id);
 * subir pela corrente até achar a raiz do cliente prova que a pasta é dele.
 */
export interface PastaDaArvore {
  pasta_id: string;
  pasta_pai_id: string | null;
}

const PROFUNDIDADE_MAXIMA = 20;

export function dentroDaPastaDoCliente(pastaId: string, raizClienteId: string, pastas: PastaDaArvore[]): boolean {
  const pai = new Map(pastas.map((p) => [p.pasta_id, p.pasta_pai_id]));
  let atual: string | null | undefined = pastaId;
  for (let i = 0; atual && i <= PROFUNDIDADE_MAXIMA; i++) {
    if (atual === raizClienteId) return true;
    atual = pai.get(atual);
  }
  return false;
}

/** Caminho da raiz do cliente até a pasta, para o "voltar" do portal. Vazio se fora da árvore. */
export function caminhoAte(pastaId: string, raizClienteId: string, pastas: (PastaDaArvore & { nome: string })[]) {
  const porId = new Map(pastas.map((p) => [p.pasta_id, p]));
  const caminho: { id: string; nome: string }[] = [];
  let atual = porId.get(pastaId);
  for (let i = 0; atual && i <= PROFUNDIDADE_MAXIMA; i++) {
    caminho.unshift({ id: atual.pasta_id, nome: atual.nome });
    if (atual.pasta_id === raizClienteId) return caminho;
    atual = atual.pasta_pai_id ? porId.get(atual.pasta_pai_id) : undefined;
  }
  return [];
}
