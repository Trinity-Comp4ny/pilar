import { afterEach, describe, expect, it, vi } from "vitest";
import { appEnvironmentFromHost, isProductionAppHost } from "./marketingSite";

function comHost(hostname: string) {
  vi.stubGlobal("window", { location: { hostname } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("appEnvironmentFromHost", () => {
  it("reconhece o host de produção", () => {
    comHost("app.pilarsoft.com.br");
    expect(appEnvironmentFromHost()).toBe("production");
    expect(isProductionAppHost()).toBe(true);
  });

  it("reconhece o host de staging, que vinha chegando como production no Sentry", () => {
    comHost("staging.app.pilarsoft.com.br");
    expect(appEnvironmentFromHost()).toBe("staging");
    expect(isProductionAppHost()).toBe(false);
  });

  it("devolve null em host desconhecido, para o chamador usar o valor do build", () => {
    comHost("pilar-git-fix-algo.vercel.app");
    expect(appEnvironmentFromHost()).toBeNull();
    comHost("localhost");
    expect(appEnvironmentFromHost()).toBeNull();
  });

  it("não confunde subdomínio parecido com o de produção", () => {
    comHost("app.pilarsoft.com.br.evil.test");
    expect(appEnvironmentFromHost()).toBeNull();
    expect(isProductionAppHost()).toBe(false);
  });
});
