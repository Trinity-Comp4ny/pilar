/**
 * Renderiza todos os templates de e-mail com dados de exemplo para revisão visual.
 *
 *   npm run email:preview                # grava .email-preview/<template>.html + index.html
 *   deno run -A scripts/email-preview.ts --gallery out.html   # página única com todos (iframes)
 *
 * Não envia nada. Pra ver num cliente real (Gmail, Outlook), use `email:test-send` (SPEC 095).
 */

import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const OUT_DIR = ".email-preview";
const args = [...Deno.args];
const galleryIdx = args.indexOf("--gallery");
const galleryPath = galleryIdx >= 0 ? args[galleryIdx + 1] : null;

// Assets e fonte embutidos como data URI: a revisão visual não depende de host,
// de deploy nem de rede, e mostra a Geist de verdade (no e-mail real a fonte vem
// por @font-face do próprio site, e o Gmail cai no fallback do sistema).
const dataUri = async (rel: string, mime: string) =>
  `data:${mime};base64,${encodeBase64(await Deno.readFile(new URL(rel, import.meta.url)))}`;

const geist = await dataUri("../apps/marketing/public/fonts/geist-variable.woff2", "font/woff2");
const geistItalic = await dataUri("../apps/marketing/public/fonts/geist-variable-italic.woff2", "font/woff2");

Deno.env.set(
  "EMAIL_FONT_CSS",
  `@font-face{font-family:'Geist';font-style:normal;font-weight:100 900;src:url(${geist}) format('woff2');}\n` +
    `@font-face{font-family:'Geist';font-style:italic;font-weight:100 900;src:url(${geistItalic}) format('woff2');}`
);
Deno.env.set("EMAIL_LOGO_URL", await dataUri("../apps/marketing/public/email/logo-v1.png", "image/png"));
Deno.env.set("EMAIL_WAVE_URL", await dataUri("../apps/marketing/public/email/wave-v1.png", "image/png"));
Deno.env.set("APP_URL", "https://app.pilarsoft.com.br");
Deno.env.set("PUBLIC_SITE_URL", "https://www.pilarsoft.com.br");

const T = await import("../supabase/functions/_shared/email/index.ts");
const { escapeHtml } = await import("../supabase/functions/_shared/email/html.ts");

const APP = "https://app.pilarsoft.com.br";
const escritorio = "Meridiana Engenharia";
const escritorioOutro = "Atelier Sul Arquitetura";
const agora = new Date("2026-09-04T11:00:00-03:00");
const minAgo = (m: number) => new Date(agora.getTime() - m * 60000).toISOString();

interface Preview {
  slug: string;
  grupo: "Autenticação" | "Escritório → cliente" | "Plataforma" | "Notificações";
  nota: string;
  email: { subject: string; html: string };
}

const previews: Preview[] = [
  // Autenticação
  {
    slug: "convite-usuario",
    grupo: "Autenticação",
    nota: "Convite para a equipe, disparado pelo auth hook",
    email: T.templateConviteUsuario(`${APP}/auth/confirm?token=abc`, "Carla Menezes"),
  },
  {
    slug: "confirmacao-cadastro",
    grupo: "Autenticação",
    nota: "Confirmar e-mail no cadastro self-serve",
    email: T.templateConfirmacaoCadastro(`${APP}/auth/confirm?token=abc`),
  },
  {
    slug: "recuperacao-senha",
    grupo: "Autenticação",
    nota: "Esqueci a senha",
    email: T.templateRecuperacaoSenha(`${APP}/auth/reset?token=abc`),
  },
  {
    slug: "magic-link",
    grupo: "Autenticação",
    nota: 'Login sem senha, botão "Entrar"',
    email: T.templateMagicLink(`${APP}/auth/confirm?token=abc`),
  },

  // Escritório → cliente
  {
    slug: "cobranca-lembrete",
    grupo: "Escritório → cliente",
    nota: "Lembrete de pagamento com chave Pix; o escritório é nomeado no texto",
    email: T.templateCobrancaDireta({
      clienteNome: "Construtora Horizonte",
      empresaNome: escritorio,
      descricao: "Projeto estrutural, Residencial Vila Nova, parcela 3/6",
      valorFormatado: "R$ 18.500,00",
      dataVencimento: "12/09/2026",
      vencida: false,
      pixChave: "12.345.678/0001-90",
      pixInstrucoes: "Envie o comprovante respondendo este e-mail.",
    }),
  },
  {
    slug: "cobranca-atraso",
    grupo: "Escritório → cliente",
    nota: "Fatura vencida, estado negativo",
    email: T.templateCobrancaDireta({
      clienteNome: "Rafael Duarte",
      empresaNome: escritorioOutro,
      descricao: "Projeto de arquitetura, Casa Jardim das Acácias, parcela 2/4",
      valorFormatado: "R$ 7.200,00",
      dataVencimento: "28/08/2026",
      vencida: true,
    }),
  },
  {
    slug: "proposta-envio",
    grupo: "Escritório → cliente",
    nota: "Proposta em anexo, com mensagem livre",
    email: T.templatePropostaEnvio({
      nomeCliente: "Construtora Horizonte",
      tituloProposta: "Proposta 2026-041: projeto estrutural e fundações, Torre B",
      empresaNome: escritorio,
      mensagem:
        "Olá, Marcos.\n\nSegue a proposta revisada com o escopo de fundações que conversamos na terça. Prazo de validade: 15 dias.\n\nQualquer ajuste, é só responder aqui.",
    }),
  },
  {
    slug: "portal-acesso",
    grupo: "Escritório → cliente",
    nota: "Acesso ao portal do cliente criado (senha temporária)",
    email: T.templateAcessoPortalCliente({
      nomeCliente: "Marcos Andrade",
      email: "marcos@horizonte.eng.br",
      senha: "Kx7mP2vQ",
      loginUrl: "https://www.pilarsoft.com.br/cliente/login",
      empresaNome: escritorio,
    }),
  },
  {
    slug: "mensagem-manual",
    grupo: "Escritório → cliente",
    nota: "Mensagem livre do escritório",
    email: T.templateMensagemManual({
      assunto: "Revisão R02 da planta de formas liberada",
      mensagem:
        "Olá, Marcos.\n\nA revisão R02 da planta de formas do 3º pavimento já está no portal. Mudou o detalhe da viga V12 conforme a compatibilização com o hidráulico.\n\nAguardamos sua aprovação até sexta para não impactar o cronograma.",
      empresaNome: escritorio,
    }),
  },

  // Plataforma
  {
    slug: "trial-7d",
    grupo: "Plataforma",
    nota: "Trial expira em 7 dias",
    email: T.templateTrialAviso({ empresaNome: "Meridiana Engenharia", daysLeft: 7, billingUrl: `${APP}/billing` }),
  },
  {
    slug: "trial-1d",
    grupo: "Plataforma",
    nota: "Último dia de trial (estado negativo)",
    email: T.templateTrialAviso({ empresaNome: "Meridiana Engenharia", daysLeft: 1, billingUrl: `${APP}/billing` }),
  },
  {
    slug: "lgpd-exclusao",
    grupo: "Plataforma",
    nota: "Aviso ao admin de pedido de exclusão de dados",
    email: T.templateLgpdExclusaoDados({
      adminNome: "Carla",
      empresaNome: "Meridiana Engenharia",
      solicitanteEmail: "joao.silva@meridiana.eng.br",
      solicitanteNome: "João Silva",
      motivo: "Saí da empresa em agosto.",
      requestedAt: "04/09/2026 10:42",
      adminPanelUrl: `${APP}/admin?tab=privacidade&request=7f3c`,
      requestId: "7f3c2a10-9b1e-4d55-a1c2-0e8d9f6b4c21",
    }),
  },

  // Notificações (SPEC 096)
  {
    slug: "notificacao-imediata-1",
    grupo: "Notificações",
    nota: "Alerta imediato, um item de alta prioridade",
    email: T.templateNotificacoes(
      {
        nome: "Carla",
        modo: "imediato",
        totalOculto: 0,
        gerenciarUrl: `${APP}/?abrir=preferencias-notificacao`,
        sinoUrl: `${APP}/inicio`,
        itens: [
          {
            categoria: "financeiro",
            severidade: "high",
            titulo: "Orçamento excedido: Residencial Vila Nova",
            mensagem:
              "Despesas em R$ 212.400 já passam do orçado (R$ 198.000). Aditivo preparado pelo guardião de margem aguarda aprovação.",
            url: `${APP}/projetos/9a1?aba=escopo`,
            criadoEm: minAgo(7),
          },
        ],
      },
      agora
    ),
  },
  {
    slug: "notificacao-semanal",
    grupo: "Notificações",
    nota: "Resumo semanal, 6 itens em 5 categorias e 3 ocultos",
    email: T.templateNotificacoes(
      {
        nome: "Carla",
        modo: "semanal",
        totalOculto: 3,
        gerenciarUrl: `${APP}/?abrir=preferencias-notificacao`,
        sinoUrl: `${APP}/inicio`,
        itens: [
          {
            categoria: "financeiro",
            severidade: "high",
            titulo: "Parcela vencida: Construtora Horizonte, R$ 18.500",
            mensagem: "Parcela 3/6 do projeto estrutural venceu em 28/08.",
            url: `${APP}/financeiro/carteira`,
            criadoEm: minAgo(60 * 30),
          },
          {
            categoria: "financeiro",
            severidade: "medium",
            titulo: "2 parcelas vencem esta semana",
            mensagem: "R$ 24.300 a receber até sexta.",
            url: `${APP}/financeiro/carteira`,
            criadoEm: minAgo(60 * 8),
          },
          {
            categoria: "projeto",
            severidade: "medium",
            titulo: "Prazo em 5 dias: Galpão Logístico Norte",
            mensagem: "Entrega prevista para 09/09. 2 disciplinas ainda em andamento.",
            url: `${APP}/projetos/4b2`,
            criadoEm: minAgo(60 * 8),
          },
          {
            categoria: "disciplina",
            severidade: "high",
            titulo: "Disciplina atrasada: Hidráulica, Residencial Vila Nova",
            mensagem: "Previsto para 01/09, ainda em andamento. Responsável: Pedro Lima.",
            url: `${APP}/projetos/9a1?aba=disciplinas`,
            criadoEm: minAgo(60 * 26),
          },
          {
            categoria: "obra",
            severidade: "medium",
            titulo: "Obra sem RDO há 4 dias: Casa Jardim das Acácias",
            mensagem: null,
            url: `${APP}/obras/c31`,
            criadoEm: minAgo(60 * 8),
          },
          {
            categoria: "tarefa",
            severidade: "low",
            titulo: "Você foi atribuída a: Revisar memorial descritivo",
            mensagem: "Por Pedro Lima.",
            url: `${APP}/meu-trabalho`,
            criadoEm: minAgo(60 * 3),
          },
        ],
      },
      agora
    ),
  },
];

await Deno.mkdir(OUT_DIR, { recursive: true });
for (const p of previews) {
  await Deno.writeTextFile(`${OUT_DIR}/${p.slug}.html`, p.email.html);
}

/**
 * Renderiza o catálogo `docs/operations/EMAILS.md` na galeria: a matriz de quem
 * recebe o quê vive no doc versionado, aqui ela só é exibida junto dos templates.
 * Parser mínimo, cobre o que o doc usa: título, parágrafo, lista e tabela.
 */
function markdownParaHtml(md: string): string {
  const inline = (t: string) =>
    escapeHtml(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) =>
        href.startsWith("http") ? `<a href="${href}" target="_blank" rel="noopener">${label}</a>` : label
      );

  const out: string[] = [];
  const linhas = md.split("\n");
  let i = 0;
  let lista: string[] = [];
  let paragrafo: string[] = [];
  const fechaLista = () => {
    if (lista.length) {
      out.push(`<ol>${lista.map((l) => `<li>${l}</li>`).join("")}</ol>`);
      lista = [];
    }
  };
  const fechaParagrafo = () => {
    if (paragrafo.length) {
      out.push(`<p>${inline(paragrafo.join(" "))}</p>`);
      paragrafo = [];
    }
  };
  const fecha = () => {
    fechaLista();
    fechaParagrafo();
  };

  const celulas = (linha: string) =>
    linha
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

  while (i < linhas.length) {
    const l = linhas[i];

    if (l.startsWith("|") && linhas[i + 1]?.startsWith("|")) {
      fecha();
      const head = celulas(l);
      i += 2;
      const rows: string[][] = [];
      while (i < linhas.length && linhas[i].startsWith("|")) rows.push(celulas(linhas[i++]));
      out.push(
        `<div class="tabela"><table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead>` +
          `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
      );
      continue;
    }

    if (/^#{1,3} /.test(l)) {
      fecha();
      const nivel = l.match(/^#+/)![0].length;
      // o h1 e o parágrafo de procedência já estão no cabeçalho da galeria
      if (nivel > 1) out.push(`<h${nivel}>${inline(l.replace(/^#+ /, ""))}</h${nivel}>`);
      i++;
      continue;
    }

    if (/^\d+\. /.test(l)) {
      fechaParagrafo();
      lista.push(inline(l.replace(/^\d+\. /, "")));
      i++;
      continue;
    }

    if (l.trim() === "") {
      fecha();
      i++;
      continue;
    }

    // continuação de item de lista (o doc indenta com 3 espaços)
    if (lista.length && /^\s{2,}/.test(l)) {
      lista[lista.length - 1] += " " + inline(l.trim());
      i++;
      continue;
    }

    // pula o bloco de procedência (links de ADR/SPEC) e a linha de volta ao índice
    if (l.startsWith("Fonte única") || l.startsWith("Todo e-mail que")) {
      while (i < linhas.length && linhas[i].trim() !== "") i++;
      continue;
    }

    paragrafo.push(l.trim());
    i++;
  }
  fecha();
  return out.join("\n");
}

const catalogo = markdownParaHtml(await Deno.readTextFile(new URL("../docs/operations/EMAILS.md", import.meta.url)));

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const grupos = [...new Set(previews.map((p) => p.grupo))];

function galleryBody(inlineSrcdoc: boolean): string {
  const cards = grupos
    .map(
      (g) => `
<section class="grupo">
  <h2>${esc(g)}</h2>
  <div class="grid">
    ${previews
      .filter((p) => p.grupo === g)
      .map(
        (p) => `
    <article class="card">
      <header>
        <div class="slug">${esc(p.slug)}</div>
        <div class="assunto">${esc(p.email.subject)}</div>
        <div class="nota">${esc(p.nota)}</div>
      </header>
      <iframe title="${esc(p.slug)}" loading="lazy" ${inlineSrcdoc ? `srcdoc="${esc(p.email.html)}"` : `src="./${p.slug}.html"`}></iframe>
    </article>`
      )
      .join("")}
  </div>
</section>`
    )
    .join("");

  return `<title>E-mails da Pilar</title>
<style>
  @font-face{font-family:'GeistPreview';font-style:normal;font-weight:100 900;src:url(${geist}) format('woff2')}
  :root{--bg:#F7F7F7;--card:#fff;--ink:#1A1A1A;--soft:#3D3D3D;--muted:#6B7280;--border:#E5E7EB;--brand:#A4EC86}
  @media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#111;--card:#1A1A1A;--ink:#F5F5F5;--soft:#D4D4D4;--muted:#9CA3AF;--border:#2A2A2A}}
  :root[data-theme="dark"]{--bg:#111;--card:#1A1A1A;--ink:#F5F5F5;--soft:#D4D4D4;--muted:#9CA3AF;--border:#2A2A2A}
  body{background:var(--bg);color:var(--ink);font-family:'GeistPreview',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;margin:0;padding:32px 24px 64px;letter-spacing:-0.01em}
  h1{font-size:22px;font-weight:600;letter-spacing:-0.02em;margin:0 0 4px}
  .sub{color:var(--muted);font-size:14px;margin:0 0 28px;max-width:70ch;line-height:1.5}
  .grupo{margin-top:36px}
  h2{font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);margin:0 0 14px;padding-bottom:8px;border-bottom:1px solid var(--border)}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));gap:20px}
  .card{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
  .card header{padding:12px 14px;border-bottom:1px solid var(--border)}
  .slug{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--muted)}
  .assunto{font-size:14px;font-weight:600;margin-top:2px;color:var(--ink)}
  .nota{font-size:12px;color:var(--soft);margin-top:2px}
  iframe{width:100%;height:880px;border:0;background:#F7F7F7;color-scheme:light}
  .legenda{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
  .legenda span{font-size:12px;color:var(--soft);border:1px solid var(--border);border-radius:999px;padding:3px 10px}
  .doc{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px 22px}
  .doc h2{font-size:15px;font-weight:600;letter-spacing:-0.01em;text-transform:none;color:var(--ink);margin:26px 0 10px;padding:0;border:0}
  .doc h2:first-child{margin-top:0}
  .doc p{font-size:13.5px;line-height:1.6;color:var(--soft);margin:0 0 10px;max-width:80ch}
  .doc ol{font-size:13.5px;line-height:1.6;color:var(--soft);margin:0;padding-left:20px}
  .doc ol li{margin-bottom:7px}
  .doc code{font-family:ui-monospace,Menlo,monospace;font-size:12px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:1px 4px}
  .doc a{color:var(--ink)}
  .tabela{overflow-x:auto;margin:0 0 14px}
  .doc table{border-collapse:collapse;width:100%;font-size:13px}
  .doc th{text-align:left;font-weight:600;color:var(--muted);font-size:11px;letter-spacing:0.06em;text-transform:uppercase;padding:7px 12px 7px 0;border-bottom:1px solid var(--border);white-space:nowrap}
  .doc td{padding:9px 12px 9px 0;border-bottom:1px solid var(--border);color:var(--soft);vertical-align:top;line-height:1.45}
  .doc td:first-child{color:var(--ink);font-weight:500}
  .fonte{font-size:12px;color:var(--muted);margin-top:10px}
</style>
<h1>E-mails da Pilar</h1>
<p class="sub">Todos os templates renderizados com dados de exemplo pelo mesmo módulo (<code>_shared/email/</code>). A identidade é a da landing: fonte Geist, título com itálico de destaque, paisagem de morros fechando o cabeçalho, botão em pílula verde. O layout varia por tipo; o design system é um só. Cada quadro é o e-mail exatamente como sai, em 600px.</p>
<div class="legenda"><span>${previews.length} templates</span><span>${grupos.length} grupos</span><span>Geist embutida na prévia</span><span>tema claro fixo</span><span>assets: public/email/</span></div>
<section class="grupo" id="catalogo">
  <h2>Quem recebe o quê</h2>
  <div class="doc">${catalogo}</div>
  <p class="fonte">Fonte: <code>docs/operations/EMAILS.md</code>, renderizado aqui direto do arquivo.</p>
</section>
${cards}`;
}

await Deno.writeTextFile(
  `${OUT_DIR}/index.html`,
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${galleryBody(false)}</html>`
);
// eslint-disable-next-line no-console
console.log(`${previews.length} templates em ${OUT_DIR}/ (abra ${OUT_DIR}/index.html)`);

if (galleryPath) {
  await Deno.writeTextFile(galleryPath, galleryBody(true));
  // eslint-disable-next-line no-console
  console.log(`galeria única em ${galleryPath}`);
}
