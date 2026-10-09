#!/usr/bin/env node
/**
 * Backup e restore do Supabase Storage (todos os buckets), sem dependência: só fetch
 * na API REST do Storage. Roda no backup-nightly.yml depois do dump do banco; o dump
 * do Postgres guarda a tabela storage.objects, mas não os bytes dos arquivos.
 *
 *   node scripts/storage-backup.mjs backup <pasta>            # baixa tudo + manifest.json
 *   node scripts/storage-backup.mjs restore <pasta> [--sobrescrever]
 *
 * Credencial, nesta ordem:
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY            (local, ou restore manual)
 *   SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF        (CI: busca a service key na
 *                                                        Management API, mesmo par de
 *                                                        secrets do deploy)
 *
 * Restore não sobrescreve arquivo que já existe, a não ser com --sobrescrever: o uso
 * normal é repor o que sumiu, não voltar o bucket inteiro no tempo.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

const PAGINA = 1000;

async function credenciais() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF } = process.env;
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    return { url: SUPABASE_URL.replace(/\/$/, ""), chave: SUPABASE_SERVICE_ROLE_KEY };
  }
  if (!SUPABASE_ACCESS_TOKEN || !SUPABASE_PROJECT_REF) {
    throw new Error(
      "Sem credencial: defina SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, ou SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF."
    );
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Management API respondeu ${res.status} ao buscar as chaves do projeto.`);
  const chaves = await res.json();
  const servico = chaves.find((k) => k.name === "service_role" && k.api_key);
  if (!servico) throw new Error("Projeto sem chave service_role na Management API.");
  // A chave fica só em memória: nenhum log deste script a imprime (nem para mascarar).
  return { url: `https://${SUPABASE_PROJECT_REF}.supabase.co`, chave: servico.api_key };
}

function cliente({ url, chave }) {
  const headers = { Authorization: `Bearer ${chave}`, apikey: chave };
  const pedir = async (caminho, init = {}) => {
    const res = await fetch(`${url}/storage/v1${caminho}`, { ...init, headers: { ...headers, ...init.headers } });
    if (!res.ok) {
      const corpo = await res.text().catch(() => "");
      const erro = new Error(`Storage ${init.method ?? "GET"} ${caminho} → ${res.status} ${corpo.slice(0, 200)}`);
      erro.status = res.status;
      throw erro;
    }
    return res;
  };
  const objeto = (bucket, caminho) =>
    `/object/${encodeURIComponent(bucket)}/${caminho.split("/").map(encodeURIComponent).join("/")}`;
  return {
    buckets: async () => (await pedir("/bucket")).json(),
    criarBucket: (b) =>
      pedir("/bucket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: b.id,
          name: b.name,
          public: b.public,
          file_size_limit: b.file_size_limit ?? null,
          allowed_mime_types: b.allowed_mime_types ?? null,
        }),
      }),
    listar: async (bucket, prefixo, offset) =>
      (
        await pedir(`/object/list/${encodeURIComponent(bucket)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefix: prefixo, limit: PAGINA, offset, sortBy: { column: "name", order: "asc" } }),
        })
      ).json(),
    baixar: async (bucket, caminho) => Buffer.from(await (await pedir(objeto(bucket, caminho))).arrayBuffer()),
    enviar: (bucket, caminho, bytes, contentType, sobrescrever) =>
      pedir(objeto(bucket, caminho), {
        method: "POST",
        headers: { "Content-Type": contentType || "application/octet-stream", "x-upsert": String(sobrescrever) },
        body: bytes,
      }),
  };
}

/**
 * Caminho local de um objeto, garantindo que fica dentro da pasta do backup. Nome de
 * bucket e de arquivo vêm da API (no backup) ou do manifest (no restore): um nome com
 * "../" ou absoluto escreveria ou leria fora da pasta. Exportada para teste.
 */
export function caminhoDoObjeto(pasta, bucket, caminho) {
  if (!/^[\w .-]+$/.test(bucket) || bucket === "." || bucket === "..") {
    throw new Error(`Nome de bucket inválido no backup: ${JSON.stringify(bucket)}`);
  }
  const base = resolve(pasta, "objetos", bucket);
  const destino = resolve(base, caminho);
  if (!caminho || !destino.startsWith(base + sep)) {
    throw new Error(`Caminho de objeto fora da pasta do backup: ${JSON.stringify(`${bucket}/${caminho}`)}`);
  }
  return destino;
}

/**
 * Lista recursiva: a API devolve arquivos e "pastas" (entrada com id null) de um
 * nível só, paginado. Exportada para teste.
 */
export async function listarTudo(listar, bucket, prefixo = "") {
  const arquivos = [];
  for (let offset = 0; ; offset += PAGINA) {
    const pagina = await listar(bucket, prefixo, offset);
    for (const item of pagina) {
      const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
      if (item.id === null) arquivos.push(...(await listarTudo(listar, bucket, caminho)));
      else
        arquivos.push({ caminho, tamanho: item.metadata?.size ?? null, contentType: item.metadata?.mimetype ?? null });
    }
    if (pagina.length < PAGINA) break;
  }
  return arquivos;
}

async function backup(pasta) {
  const api = cliente(await credenciais());
  const buckets = await api.buckets();
  const manifest = { gerado_em: new Date().toISOString(), buckets: [] };
  let total = 0;
  let bytes = 0;

  for (const b of buckets) {
    const arquivos = await listarTudo(api.listar, b.id);
    for (const a of arquivos) {
      const conteudo = await api.baixar(b.id, a.caminho);
      const destino = caminhoDoObjeto(pasta, b.id, a.caminho);
      await mkdir(dirname(destino), { recursive: true });
      await writeFile(destino, conteudo);
      total += 1;
      bytes += conteudo.length;
    }
    manifest.buckets.push({
      id: b.id,
      name: b.name,
      public: b.public,
      file_size_limit: b.file_size_limit ?? null,
      allowed_mime_types: b.allowed_mime_types ?? null,
      arquivos,
    });
    console.log(`${b.id}: ${arquivos.length} arquivo(s)`);
  }

  await mkdir(pasta, { recursive: true });
  await writeFile(join(pasta, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `Backup do Storage: ${buckets.length} bucket(s), ${total} arquivo(s), ${(bytes / 1024 / 1024).toFixed(1)} MB.`
  );
}

async function restore(pasta, sobrescrever) {
  const api = cliente(await credenciais());
  const manifest = JSON.parse(await readFile(join(pasta, "manifest.json"), "utf8"));
  const existentes = new Set((await api.buckets()).map((b) => b.id));
  let enviados = 0;
  let pulados = 0;

  for (const b of manifest.buckets) {
    if (!existentes.has(b.id)) await api.criarBucket(b);
    for (const a of b.arquivos) {
      const bytes = await readFile(caminhoDoObjeto(pasta, b.id, a.caminho));
      try {
        await api.enviar(b.id, a.caminho, bytes, a.contentType, sobrescrever);
        enviados += 1;
      } catch (err) {
        // Já existe e não pedimos para sobrescrever: caso normal de reposição. O
        // Storage responde 409 ou 400 com "Duplicate"; qualquer outro 400 é erro real.
        if (err.status === 409 || /duplicate|already exists/i.test(err.message)) pulados += 1;
        else throw err;
      }
    }
  }
  console.log(`Restore do Storage: ${enviados} enviado(s), ${pulados} já existia(m).`);
}

const [modo, pasta, flag] = process.argv.slice(2);
const executado = import.meta.url === `file://${process.argv[1]}`;
if (executado) {
  if (!pasta || !["backup", "restore"].includes(modo)) {
    console.error("Uso: node scripts/storage-backup.mjs backup|restore <pasta> [--sobrescrever]");
    process.exit(2);
  }
  (modo === "backup" ? backup(pasta) : restore(pasta, flag === "--sobrescrever")).catch((err) => {
    console.error(`::error::${err.message}`);
    process.exit(1);
  });
}
