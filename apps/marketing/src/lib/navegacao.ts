/**
 * Dados mínimos de módulos e comparativos para o header e o rodapé, que entram
 * no bundle inicial de TODA página.
 *
 * `modules.ts` e `comparativos.ts` carregam o texto inteiro das páginas (~40 KB
 * de fonte) e só as páginas preguiçosas precisam deles. Importá-los daqui para
 * montar um menu puxava tudo para o primeiro carregamento (Lighthouse:
 * "Reduce unused JavaScript"). O teste de navegacao.test.ts garante que estas
 * listas não divergem das fontes.
 */
import type { ComparativoSlug } from "./comparativos";
import type { ModuloSlug } from "./modules";

export interface ModuloNav {
  slug: ModuloSlug;
  nome: string;
  resumo: string;
  /** Classe do ponto de cor no menu (a mesma de Modulo.cor.strong). */
  corStrong: string;
}

export interface ComparativoNav {
  slug: ComparativoSlug;
  adversario: string;
}

export const MODULOS_NAV: ModuloNav[] = [
  { slug: "gestao", nome: "Gestão", resumo: "Do lead ao dinheiro na conta.", corStrong: "bg-modulo-gestao-strong" },
  {
    slug: "projetos",
    nome: "Projetos",
    resumo: "Disciplina, prazo e responsável.",
    corStrong: "bg-modulo-projetos-strong",
  },
  { slug: "obra", nome: "Obra", resumo: "O canteiro alimenta o escritório.", corStrong: "bg-modulo-obra-strong" },
  {
    slug: "portal",
    nome: "Portal do cliente",
    resumo: "Seu cliente acompanha sozinho.",
    corStrong: "bg-modulo-gestao-strong",
  },
  { slug: "campo", nome: "Pilar Campo", resumo: "O canteiro registra, sem sinal.", corStrong: "bg-modulo-obra-strong" },
];

export const COMPARATIVOS_NAV: ComparativoNav[] = [
  { slug: "planilha", adversario: "Planilha" },
  { slug: "trello", adversario: "Trello" },
  { slug: "whatsapp", adversario: "WhatsApp" },
  { slug: "notion", adversario: "Notion" },
  { slug: "erp-construtora", adversario: "ERP de construtora" },
];
