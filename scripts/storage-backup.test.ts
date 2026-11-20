import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { caminhoDoObjeto, listarTudo, verificarIntegridade } from "./storage-backup.mjs";

type Item = { name: string; id: string | null; metadata?: { size: number; mimetype: string } };

const arquivo = (name: string): Item => ({ name, id: `id-${name}`, metadata: { size: 10, mimetype: "image/png" } });
const pasta = (name: string): Item => ({ name, id: null });

/** Fake da API de list: um nível por chamada, paginado de 1000 em 1000, como o Storage. */
function fakeListar(arvore: Record<string, Item[]>) {
  const chamadas: string[] = [];
  const listar = async (_bucket: string, prefixo: string, offset: number) => {
    chamadas.push(`${prefixo}@${offset}`);
    return (arvore[prefixo] ?? []).slice(offset, offset + 1000);
  };
  return { listar, chamadas };
}

describe("listarTudo (backup do Storage)", () => {
  it("desce nas pastas e monta o caminho completo de cada arquivo", async () => {
    const { listar } = fakeListar({
      "": [pasta("empresa-1"), arquivo("logo.png")],
      "empresa-1": [pasta("obra 2"), arquivo("a.png")],
      "empresa-1/obra 2": [arquivo("foto.png")],
    });
    const caminhos = (await listarTudo(listar, "obra-campo")).map((a) => a.caminho);
    expect(caminhos.sort()).toEqual(["empresa-1/a.png", "empresa-1/obra 2/foto.png", "logo.png"]);
  });

  it("pagina quando um nível tem 1000 itens ou mais (não perde o que passa da primeira página)", async () => {
    const muitos = Array.from({ length: 1500 }, (_, i) => arquivo(`f${String(i).padStart(4, "0")}.png`));
    const { listar, chamadas } = fakeListar({ "": muitos });
    const todos = await listarTudo(listar, "b");
    expect(todos).toHaveLength(1500);
    expect(chamadas).toEqual(["@0", "@1000"]);
  });

  it("guarda tamanho e tipo para o manifest", async () => {
    const { listar } = fakeListar({ "": [arquivo("x.png")] });
    expect(await listarTudo(listar, "b")).toEqual([{ caminho: "x.png", tamanho: 10, contentType: "image/png" }]);
  });

  it("bucket vazio não quebra", async () => {
    const { listar } = fakeListar({});
    expect(await listarTudo(listar, "b")).toEqual([]);
  });
});

describe("caminhoDoObjeto (pasta do backup)", () => {
  it("monta o caminho dentro de <pasta>/objetos/<bucket>/", () => {
    expect(caminhoDoObjeto("/tmp/bk", "obra-campo", "empresa-1/obra 2/foto.png")).toBe(
      "/tmp/bk/objetos/obra-campo/empresa-1/obra 2/foto.png"
    );
  });

  it("recusa nome de arquivo que sai da pasta (../ ou absoluto)", () => {
    for (const caminho of ["../../etc/passwd", "a/../../../x", "/etc/passwd", ""]) {
      expect(() => caminhoDoObjeto("/tmp/bk", "obra-campo", caminho), caminho).toThrow(/fora da pasta/);
    }
  });

  it("recusa nome de bucket com barra ou ponto-ponto", () => {
    for (const bucket of ["..", "a/b", "../x", ""]) {
      expect(() => caminhoDoObjeto("/tmp/bk", bucket, "f.png"), bucket).toThrow(/bucket inválido/);
    }
  });

  it("aceita bucket com espaço (existe 'Pilar Logo' em produção)", () => {
    expect(caminhoDoObjeto("/tmp/bk", "Pilar Logo", "logo.png")).toBe("/tmp/bk/objetos/Pilar Logo/logo.png");
  });
});

describe("verificarIntegridade (Storage)", () => {
  async function comBackup(teste: (pasta: string) => Promise<void>) {
    const pasta = await mkdtemp(join(tmpdir(), "pilar-storage-check-"));
    try {
      const objetos = join(pasta, "objetos", "obra-campo");
      await mkdir(objetos, { recursive: true });
      await writeFile(join(objetos, "foto.jpg"), "conteudo correto");
      const bytes = Buffer.from("conteudo correto");
      await writeFile(
        join(pasta, "manifest.json"),
        JSON.stringify({
          buckets: [
            {
              id: "obra-campo",
              arquivos: [
                {
                  caminho: "foto.jpg",
                  tamanhoBaixado: bytes.length,
                  sha256: createHash("sha256").update(bytes).digest("hex"),
                },
              ],
            },
          ],
        })
      );
      await teste(pasta);
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  }

  it("confere arquivo válido sem precisar de rede ou segredo", async () => {
    await comBackup(async (pasta) => {
      expect(await verificarIntegridade(pasta)).toEqual({ buckets: 1, arquivos: 1, bytes: 16 });
    });
  });

  it("recusa arquivo modificado depois do backup", async () => {
    await comBackup(async (pasta) => {
      await writeFile(join(pasta, "objetos", "obra-campo", "foto.jpg"), "conteudo alterado");
      await expect(verificarIntegridade(pasta)).rejects.toThrow(/corrompido/);
    });
  });

  it("recusa backup novo sem checksum, mas aceita backup legado se for explicitamente permitido", async () => {
    await comBackup(async (pasta) => {
      const path = join(pasta, "manifest.json");
      const manifest = JSON.parse(await readFile(path, "utf8"));
      delete manifest.buckets[0].arquivos[0].sha256;
      await writeFile(path, JSON.stringify(manifest));
      await expect(verificarIntegridade(pasta)).rejects.toThrow(/sem tamanho\/checksum/);
      expect((await verificarIntegridade(pasta, false)).arquivos).toBe(1);
    });
  });
});
