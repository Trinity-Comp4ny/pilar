import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useIdleTimeout } from "./useIdleTimeout";

// Mock AuthContext com signOut
const signOutMock = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    signOut: signOutMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("useIdleTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    signOutMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("não desloga antes do timeout", () => {
    renderHook(() => useIdleTimeout({ timeoutMs: 60_000 }), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("desloga após timeout", async () => {
    renderHook(() => useIdleTimeout({ timeoutMs: 10_000 }), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(11_000);
    });

    expect(signOutMock).toHaveBeenCalled();
  });

  it("reset ao detectar atividade", async () => {
    renderHook(() => useIdleTimeout({ timeoutMs: 10_000 }), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
      window.dispatchEvent(new Event("keydown"));
      await vi.advanceTimersByTimeAsync(5_000);
    });

    // 13s total mas reset aos 8s → 5s corridos → sem deslogar
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("disabled não desloga", async () => {
    renderHook(() => useIdleTimeout({ timeoutMs: 1_000, enabled: false }), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(signOutMock).not.toHaveBeenCalled();
  });
});
