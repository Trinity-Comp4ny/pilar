import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useObjectUrl } from "./useObjectUrl";

describe("useObjectUrl", () => {
  const criar = vi.fn((b: Blob) => `blob:${(b as File).name}`);
  const revogar = vi.fn();
  URL.createObjectURL = criar as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revogar;

  afterEach(() => vi.clearAllMocks());

  it("sem arquivo devolve null e não cria URL", () => {
    const { result } = renderHook(() => useObjectUrl(null));
    expect(result.current).toBeNull();
    expect(criar).not.toHaveBeenCalled();
  });

  it("cria uma vez por arquivo, mesmo com vários renders", () => {
    const arquivo = new File(["x"], "logo.png");
    const { result, rerender } = renderHook(({ f }) => useObjectUrl(f), { initialProps: { f: arquivo } });
    rerender({ f: arquivo });
    rerender({ f: arquivo });
    expect(result.current).toBe("blob:logo.png");
    expect(criar).toHaveBeenCalledTimes(1);
  });

  it("revoga a anterior ao trocar de arquivo e ao desmontar", () => {
    const a = new File(["a"], "a.png");
    const b = new File(["b"], "b.png");
    const { result, rerender, unmount } = renderHook(({ f }) => useObjectUrl(f), {
      initialProps: { f: a as File | null },
    });
    rerender({ f: b });
    expect(revogar).toHaveBeenCalledWith("blob:a.png");
    expect(result.current).toBe("blob:b.png");
    unmount();
    expect(revogar).toHaveBeenCalledWith("blob:b.png");
  });

  it("descarta o que não for URL blob:", () => {
    criar.mockReturnValueOnce("javascript:alert(1)");
    const { result } = renderHook(() => useObjectUrl(new File(["x"], "x.png")));
    expect(result.current).toBeNull();
  });
});
