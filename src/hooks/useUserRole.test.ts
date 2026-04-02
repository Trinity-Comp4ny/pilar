import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import type { UserRole } from "./useUserRole";

vi.mock("@/integrations/supabase/client", () => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  };
  return { supabase: mockSupabase };
});

import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no user is authenticated", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    } as any);

    const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("returns the user role when authenticated", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    } as any);

    const mockSingle = vi.fn().mockResolvedValue({
      data: { role: "admin" },
      error: null,
    });
    const mockEq = vi.fn(() => ({ single: mockSingle }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

    const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe("admin");
    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(mockSelect).toHaveBeenCalledWith("role");
    expect(mockEq).toHaveBeenCalledWith("id", "user-123");
  });

  it("throws on supabase error", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    } as any);

    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "DB error" },
    });
    const mockEq = vi.fn(() => ({ single: mockSingle }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

    const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});

describe("UserRole type", () => {
  it("accepts valid roles", () => {
    const roles: UserRole[] = ["admin", "financeiro", "marketing", "operacional", "user"];
    expect(roles).toHaveLength(5);
  });
});
