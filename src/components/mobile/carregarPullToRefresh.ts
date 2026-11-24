type Modulo = typeof import("./PullToRefresh");

function SemPullToRefresh() {
  return null;
}

export async function carregarPullToRefresh(
  importar: () => Promise<Modulo | undefined> = () => import("./PullToRefresh")
) {
  const modulo = await importar();
  // O Vite resolve sem módulo se o reload já tratou a falha do preload.
  // Não derruba a tela inteira por causa de um gesto opcional enquanto a aba recarrega.
  return { default: modulo === undefined ? SemPullToRefresh : modulo.PullToRefresh };
}
