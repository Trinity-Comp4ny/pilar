import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
  });

const rel = (file: string) => file.replace(`${ROOT}/`, "");

// Regra do design system: tabela vazia tem tudo centralizado (texto, ícone, ação).
describe("varredura: tabela vazia centralizada", () => {
  it("linha de vazio de tabela escrita à mão é centralizada", () => {
    // `x.length === 0 ? ( <TableRow> <TableCell ...attrs> conteúdo </TableCell>`: o text-center
    // pode estar na célula ou no conteúdo (EmptyState e PageLoader já são centralizados).
    const vazio = /length === 0\s*\?\s*\(\s*<(?:TableRow|tr)\b[^>]*>\s*<(TableCell|td)\b([^>]*)>([\s\S]*?)<\/\1>/g;
    const centralizado = (attrs: string, conteudo: string) =>
      /text-center/.test(attrs) || /text-center|<EmptyState\b|<PageLoader\b/.test(conteudo);
    const offenders = sourceFiles(join(ROOT, "src")).flatMap((file) => {
      const src = readFileSync(file, "utf8");
      return [...src.matchAll(vazio)].filter((m) => !centralizado(m[2], m[3])).map(() => rel(file));
    });
    expect(offenders).toEqual([]);
  });

  it("lista vazia do portal Ultra não é parágrafo solto à esquerda", () => {
    // `<p className="...">Nenhum…` sem text-center: use <EmptyState compact title="…" />
    const solto = /<p className="([^"]*)">\s*(?:Nenhum|Nenhuma|Nada)\b/g;
    const offenders = sourceFiles(join(ROOT, "src/pages/ultra-admin")).flatMap((file) => {
      const src = readFileSync(file, "utf8");
      return [...src.matchAll(solto)].filter((m) => !m[1].includes("text-center")).map(() => rel(file));
    });
    expect(offenders).toEqual([]);
  });
});
