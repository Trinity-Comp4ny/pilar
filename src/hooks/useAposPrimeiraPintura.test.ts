import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAposPrimeiraPintura } from "./useAposPrimeiraPintura";

describe("useAposPrimeiraPintura", () => {
  it("começa false e libera depois de 1 s", async () => {
    const { result } = renderHook(() => useAposPrimeiraPintura());
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true), { timeout: 3000 });
  });
});
