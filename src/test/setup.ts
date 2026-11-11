import "@testing-library/jest-dom";
import { vi } from "vitest";

// A pergunta "Foi fácil?" (SPEC 156) sorteia 1 em 5 depois de criar lead, proposta ou lançamento e
// abre um toast 1,2 s depois. Nos testes desses fluxos isso virava falha aleatória (toast mockado
// sem `custom`, timer depois do fim do teste). Ela tem regra própria testada em lib/pesquisas.
vi.mock("@/components/pesquisas/perguntarEsforco", () => ({
  perguntarEsforco: vi.fn(() => Promise.resolve(false)),
}));
