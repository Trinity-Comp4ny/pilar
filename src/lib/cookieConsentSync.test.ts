import { describe, it, expect, beforeEach, vi } from "vitest";

const { maybeSingleMock, insertMock, applyMock } = vi.hoisted(() => ({
  maybeSingleMock: vi.fn(),
  insertMock: vi.fn(),
  applyMock: vi.fn(),
}));

// Cadeia do postgrest: from().select().eq().order().limit().maybeSingle()
vi.mock("@/integrations/supabase/client", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: maybeSingleMock,
    insert: insertMock,
  };
  return { supabase: { from: () => chain } };
});

vi.mock("./analytics", () => ({ applyCookieConsent: applyMock }));

const COOKIE_NAME = "pilar_cookie_consent";

function setConsentCookie(analytics: boolean) {
  const value = encodeURIComponent(JSON.stringify({ analytics, decidedAt: "2026-08-20T00:00:00.000Z" }));
  document.cookie = `${COOKIE_NAME}=${value}; path=/`;
}

function clearConsentCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}

const { syncConsentForUser, setAnalyticsConsent } = await import("./cookieConsentSync");

describe("cookieConsentSync (SPEC 059)", () => {
  beforeEach(() => {
    clearConsentCookie();
    maybeSingleMock.mockReset();
    insertMock.mockReset().mockResolvedValue({ error: null });
    applyMock.mockReset();
  });

  it("preferência da conta vence o cookie do navegador", async () => {
    setConsentCookie(true);
    maybeSingleMock.mockResolvedValue({ data: { analytics: false }, error: null });

    await syncConsentForUser("user-1");

    expect(applyMock).toHaveBeenCalledWith(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("sem registro na conta, promove a decisão vinda da landing a carryover", async () => {
    setConsentCookie(true);
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    await syncConsentForUser("user-1");

    expect(insertMock).toHaveBeenCalledWith({ user_id: "user-1", analytics: true, source: "carryover" });
  });

  it("sem registro e sem cookie, não decide nada por conta própria", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    await syncConsentForUser("user-1");

    expect(applyMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("falha de leitura não liga o rastreamento nem propaga erro", async () => {
    setConsentCookie(true);
    maybeSingleMock.mockRejectedValue(new Error("rede fora"));

    await expect(syncConsentForUser("user-1")).resolves.toBeUndefined();
    expect(applyMock).not.toHaveBeenCalled();
  });

  it("toggle das configurações aplica na hora e registra na conta", async () => {
    await setAnalyticsConsent("user-1", true);

    expect(applyMock).toHaveBeenCalledWith(true);
    expect(insertMock).toHaveBeenCalledWith({ user_id: "user-1", analytics: true, source: "settings" });
  });
});
