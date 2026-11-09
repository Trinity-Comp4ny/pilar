/**
 * Tipos dos matchers do jest-dom (toBeInTheDocument, toHaveTextContent…) no `expect` do Vitest 5.
 *
 * O Vitest 5 mudou a assinatura para `Assertion<R, T>` (R = retorno), e a augmentação que o
 * jest-dom 7 publica ainda declara `Assertion<T>`: os matchers sumiam dos tipos (o runtime,
 * registrado em src/test/setup.ts, seguia funcionando). O caminho documentado do Vitest para
 * matcher próprio é estender `Matchers<R, T>`. Os tipos do jest-dom chegam pelo `jest.Matchers`
 * global que o próprio pacote declara (types/jest.d.ts), porque `TestingLibraryMatchers` não sai
 * por nenhuma entrada pública. Apagar quando o jest-dom publicar a augmentação para o Vitest 5.
 */
import "vitest";

declare module "vitest" {
  // Interface vazia de propósito: a augmentação existe só para herdar os matchers.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> extends jest.Matchers<R, T> {}
}
