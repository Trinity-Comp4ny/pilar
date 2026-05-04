import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("remove tags <script>", () => {
    const out = sanitizeHtml("<p>Hello</p><script>alert(1)</script>");
    expect(out).toContain("<p>Hello</p>");
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("alert(1)");
  });

  it("remove handlers inline (onerror, onclick)", () => {
    const out = sanitizeHtml('<img src="x" onerror="alert(1)" /><div onclick="bad()">x</div>');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("alert(1)");
  });

  it("preserva tags permitidas (p, h1, table)", () => {
    const html = "<h1>Título</h1><p>Texto <strong>negrito</strong></p><table><tr><td>cell</td></tr></table>";
    const out = sanitizeHtml(html);
    expect(out).toContain("<h1>");
    expect(out).toContain("<strong>");
    expect(out).toContain("<table>");
    expect(out).toContain("<td>");
  });

  it("remove iframes e embeds", () => {
    const out = sanitizeHtml('<iframe src="evil"></iframe><embed src="bad" />');
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("<embed");
  });

  it("retorna string vazia para input vazio", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("preserva atributo class e style mas não eventos", () => {
    const out = sanitizeHtml('<div class="ok" style="color:red" onmouseover="hack()">x</div>');
    expect(out).toContain('class="ok"');
    expect(out).not.toContain("onmouseover");
  });

  it("preserva links com href mas remove javascript: scheme", () => {
    const out = sanitizeHtml('<a href="https://ok.com">ok</a><a href="javascript:alert(1)">bad</a>');
    expect(out).toContain('href="https://ok.com"');
    expect(out).not.toContain("javascript:alert(1)");
  });
});
