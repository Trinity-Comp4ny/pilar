import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/integrations/supabase/client", () => {
  const mockSubscription = { unsubscribe: vi.fn() };
  const mockSupabase = {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: mockSubscription } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  };
  return { supabase: mockSupabase };
});

vi.mock("./Layout", () => ({
  default: () => <div data-testid="layout">Layout</div>,
}));

import { supabase } from "@/integrations/supabase/client";
import { PrivateRoute } from "./PrivateRoute";

function renderWithRouter(initialRoute = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/" element={<div data-testid="landing">Landing</div>} />
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
          <Route path="/profile-setup" element={<div data-testid="profile-setup">Profile Setup</div>} />
          <Route path="/company-setup" element={<div data-testid="company-setup">Company Setup</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("PrivateRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as unknown as { location?: Location }).location;
    (window as unknown as { location: Partial<Location> }).location = { hash: "" };
  });

  it("shows loading state initially", () => {
    vi.mocked(supabase.auth.getSession).mockImplementation(() => new Promise(() => {}));
    renderWithRouter();
    expect(screen.getByText("Carregando...")).toBeInTheDocument();
  });

  it("redirects to landing when not authenticated", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId("landing")).toBeInTheDocument();
    });
  });

  it("renders layout when authenticated with complete profile", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: "user-123" } } },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);

    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: "user-123",
        nome: "João Silva",
        email: "joao@test.com",
        contato: "(11) 99999-9999",
        role: "user",
        onboarding_completed: true,
        empresas: { nome: "Empresa Real", onboarding_completed: true },
      },
      error: null,
    });
    const mockEq = vi.fn(() => ({ single: mockSingle }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as unknown as ReturnType<typeof supabase.from>);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId("layout")).toBeInTheDocument();
    });
  });

  it("redirects to profile-setup when onboarding not completed", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: "user-123" } } },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);

    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: "user-123",
        nome: "test@email.com",
        email: "test@email.com",
        contato: null,
        role: "user",
        onboarding_completed: false,
        empresas: { nome: "Empresa Real", onboarding_completed: true },
      },
      error: null,
    });
    const mockEq = vi.fn(() => ({ single: mockSingle }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as unknown as ReturnType<typeof supabase.from>);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId("profile-setup")).toBeInTheDocument();
    });
  });

  it("redirects admin to company-setup when company onboarding not completed", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: "user-123" } } },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);

    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: "user-123",
        nome: "Admin User",
        email: "admin@test.com",
        contato: "(11) 99999-9999",
        role: "admin",
        onboarding_completed: true,
        empresas: { nome: "Minha Empresa", onboarding_completed: false },
      },
      error: null,
    });
    const mockEq = vi.fn(() => ({ single: mockSingle }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as unknown as ReturnType<typeof supabase.from>);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId("company-setup")).toBeInTheDocument();
    });
  });
});
