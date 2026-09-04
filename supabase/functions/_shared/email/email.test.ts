// Roda com: deno test --no-check --allow-env --allow-read supabase/functions/_shared/email
//
// O que importa aqui: (1) nenhum dado de entrada vira HTML sem escape, em NENHUM
// template; (2) o client falha alto sem chave e respeita dry-run; (3) remetente e
// reply-to por classe; (4) text/plain sai do HTML; (5) nenhum HTML de e-mail fora do módulo.

import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.env.set("EMAIL_DRY_RUN", "true");
Deno.env.set("APP_URL", "https://app.test");
Deno.env.set("RESEND_FROM", "Pilar <no-reply@test.dev>");
Deno.env.delete("RESEND_REPLY_TO");

const { escapeHtml, html, htmlToText, multiline, raw } = await import("./html.ts");
const { fromAddress, resolveFrom, resolveReplyTo, sendEmail } = await import("./client.ts");
const T = await import("./index.ts");
const N = await import("./templates/notificacoes.ts");

const XSS = `<img src=x onerror="alert(1)">`;
const XSS_ESCAPED = escapeHtml(XSS);

// ---------------------------------------------------------------------------
// html.ts
// ---------------------------------------------------------------------------

Deno.test("escapeHtml escapa os 5 caracteres", () => {
  assertEquals(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});

Deno.test("html`` escapa interpolação comum e preserva Html", () => {
  const out = html`<p>${"<b>"}${raw("<i>ok</i>")}</p>`.value;
  assertEquals(out, "<p>&lt;b&gt;<i>ok</i></p>");
});

Deno.test("multiline escapa antes de trocar quebra de linha", () => {
  assertEquals(multiline("a<b\nc").value, "a&lt;b<br/>c");
});

Deno.test("htmlToText extrai texto e links legíveis", () => {
  const text = htmlToText(
    `<html><head><style>p{}</style></head><body><p>Olá, <strong>Ana</strong>.</p><a href="https://x.dev/a">Abrir</a><br/>fim &amp; tal</body></html>`
  );
  assertEquals(text, "Olá, Ana.\nAbrir: https://x.dev/a\nfim & tal");
});

// ---------------------------------------------------------------------------
// Templates: nenhum campo entra sem escape
// ---------------------------------------------------------------------------

const empresaX = XSS;

const casos: Array<[string, () => { subject: string; html: string }]> = [
  ["convite", () => T.templateConviteUsuario("https://l", XSS)],
  ["recuperacao", () => T.templateRecuperacaoSenha(`https://l?x=${XSS}`)],
  ["magic", () => T.templateMagicLink(`https://l?x=${XSS}`)],
  ["confirmacao", () => T.templateConfirmacaoCadastro(`https://l?x=${XSS}`)],
  [
    "mensagem-manual",
    () => T.templateMensagemManual({ assunto: XSS, mensagem: `linha1\n${XSS}`, empresaNome: empresaX }),
  ],
  [
    "cobranca",
    () =>
      T.templateCobrancaDireta({
        clienteNome: XSS,
        empresaNome: empresaX,
        descricao: XSS,
        valorFormatado: XSS,
        dataVencimento: XSS,
        vencida: true,
        pixChave: XSS,
        pixInstrucoes: XSS,
      }),
  ],
  [
    "portal",
    () =>
      T.templateAcessoPortalCliente({
        nomeCliente: XSS,
        email: XSS,
        senha: XSS,
        loginUrl: "https://l",
        empresaNome: empresaX,
      }),
  ],
  [
    "proposta",
    () => T.templatePropostaEnvio({ nomeCliente: XSS, tituloProposta: XSS, empresaNome: empresaX, mensagem: XSS }),
  ],
  ["trial", () => T.templateTrialAviso({ empresaNome: XSS, daysLeft: 3, billingUrl: "https://l" })],
  [
    "lgpd",
    () =>
      T.templateLgpdExclusaoDados({
        adminNome: XSS,
        empresaNome: XSS,
        solicitanteEmail: XSS,
        solicitanteNome: XSS,
        motivo: XSS,
        requestedAt: XSS,
        adminPanelUrl: "https://l",
        requestId: XSS,
      }),
  ],
  [
    "notificacoes",
    () =>
      T.templateNotificacoes({
        nome: XSS,
        modo: "digest",
        totalOculto: 2,
        gerenciarUrl: "https://l/g",
        sinoUrl: "https://l/s",
        itens: [
          {
            categoria: "financeiro",
            severidade: "high",
            titulo: XSS,
            mensagem: XSS,
            url: "https://l/i",
            criadoEm: new Date().toISOString(),
          },
        ],
      }),
  ],
];

for (const [nome, build] of casos) {
  Deno.test(`template ${nome}: escapa todo dado de entrada`, () => {
    const { subject, html: out } = build();
    assert(!out.includes(XSS), `HTML cru vazou em ${nome}`);
    assertStringIncludes(out, XSS_ESCAPED);
    assert(subject.length > 0);
    assertStringIncludes(out, "<!DOCTYPE html>");
    assertStringIncludes(out, 'color-scheme" content="light only"');
    // identidade da landing: Geist declarada, faixa de morros e botão/pílula verde
    assertStringIncludes(out, "font-family:'Geist'");
    assertStringIncludes(out, "/email/wave-v1.png");
  });
}

Deno.test("e-mail de escritório nomeia a empresa no texto e no rodapé, sem logo de terceiro", () => {
  const { html: out } = T.templateCobrancaDireta({
    clienteNome: "Construtora Horizonte",
    empresaNome: "Meridiana Engenharia",
    descricao: "d",
    valorFormatado: "R$ 1,00",
    dataVencimento: "01/01/2026",
    vencida: false,
  });
  assertStringIncludes(out, "Meridiana Engenharia</strong> enviou esta cobrança");
  assertStringIncludes(out, "Você recebeu esta cobrança de Meridiana Engenharia via Pilar.");
  // o único <img> além da faixa de morros é o símbolo da Pilar
  const imgs = [...out.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  assertEquals(imgs.length, 2);
  assert(
    imgs.every((src) => src.includes("/email/")),
    `img inesperada: ${imgs.join(", ")}`
  );
});

// ---------------------------------------------------------------------------
// Notificações: agrupamento, assunto, limite
// ---------------------------------------------------------------------------

type NotifItem = import("./templates/notificacoes.ts").NotifItem;
const item = (categoria: string, severidade = "medium", titulo = "t"): NotifItem => ({
  categoria,
  severidade,
  titulo,
  mensagem: null,
  url: "https://l",
  criadoEm: new Date().toISOString(),
});

Deno.test("agruparPorCategoria segue a ordem fixa e junta desconhecidas em sistema", () => {
  const g = N.agruparPorCategoria([item("tarefa"), item("obra"), item("financeiro"), item("xyz"), item("obra")]);
  assertEquals(
    g.map((x) => [x.categoria, x.itens.length]),
    [
      ["financeiro", 1],
      ["obra", 2],
      ["tarefa", 1],
      ["sistema", 1],
    ]
  );
});

Deno.test("assunto: imediato com 1 item usa o título; digest conta total incluindo ocultos", () => {
  assertEquals(
    N.assuntoNotificacoes({
      modo: "imediato",
      itens: [item("financeiro", "high", "Orçamento excedido")],
      totalOculto: 0,
    }),
    "Orçamento excedido"
  );
  assertEquals(
    N.assuntoNotificacoes({ modo: "imediato", itens: [item("financeiro"), item("obra")], totalOculto: 0 }),
    "2 alertas importantes no Pilar"
  );
  assertEquals(
    N.assuntoNotificacoes({ modo: "digest", itens: [item("financeiro")], totalOculto: 4 }),
    "Seu resumo do Pilar: 5 pendências"
  );
});

Deno.test("severidadeTone: high/critical negativo, medium aviso, low neutro", () => {
  assertEquals(N.severidadeTone("critical"), "negative");
  assertEquals(N.severidadeTone("high"), "negative");
  assertEquals(N.severidadeTone("medium"), "warning");
  assertEquals(N.severidadeTone("low"), "neutral");
});

Deno.test("digest mostra 'E mais N' quando há ocultos e link de gerenciar", () => {
  const { html: out } = T.templateNotificacoes({
    nome: null,
    modo: "digest",
    totalOculto: 5,
    gerenciarUrl: "https://l/gerenciar",
    sinoUrl: "https://l/sino",
    itens: [item("projeto")],
  });
  assertStringIncludes(out, "E mais");
  assertStringIncludes(out, "https://l/gerenciar");
  assertStringIncludes(out, "Gerenciar notificações por e-mail");
});

// ---------------------------------------------------------------------------
// client.ts
// ---------------------------------------------------------------------------

Deno.test("fromAddress extrai o endereço", () => {
  assertEquals(fromAddress("Pilar <no-reply@test.dev>"), "no-reply@test.dev");
  assertEquals(fromAddress("no-reply@test.dev"), "no-reply@test.dev");
});

Deno.test("resolveFrom: escritório vira '<Empresa> via Pilar' no mesmo endereço", () => {
  assertEquals(resolveFrom({ classe: "plataforma" }), "Pilar <no-reply@test.dev>");
  assertEquals(
    resolveFrom({ classe: "escritorio", empresa: { nome: 'Meridiana "Eng" <x>' } }),
    '"Meridiana Eng x via Pilar" <no-reply@test.dev>'
  );
});

Deno.test("resolveReplyTo: explícito > e-mail da empresa > padrão da plataforma (vazio = undefined)", () => {
  assertEquals(
    resolveReplyTo({ classe: "escritorio", empresa: { nome: "X", email: "contato@x.dev" } }),
    "contato@x.dev"
  );
  assertEquals(
    resolveReplyTo({ classe: "escritorio", empresa: { nome: "X", email: "contato@x.dev" }, replyTo: "outro@x.dev" }),
    "outro@x.dev"
  );
  assertEquals(resolveReplyTo({ classe: "plataforma" }), undefined);
});

Deno.test("sendEmail em dry-run não envia e devolve skipped", async () => {
  const r = await sendEmail({ classe: "plataforma", tipo: "t", to: "a@b.c", subject: "s", html: "<p>x</p>" });
  assertEquals(r, { ok: false, skipped: "dry_run" });
});

Deno.test("sendEmail escritório sem empresa lança", async () => {
  await assertRejects(
    () => sendEmail({ classe: "escritorio", tipo: "t", to: "a@b.c", subject: "s", html: "<p>x</p>" }),
    Error,
    "exige `empresa`"
  );
});

// ---------------------------------------------------------------------------
// Fronteira: nenhum HTML de e-mail fora do módulo (ADR 0039)
// ---------------------------------------------------------------------------

Deno.test({
  name: "nenhuma edge function monta HTML de e-mail ou chama o Resend fora de _shared/email/",
  permissions: { read: true, env: true },
  fn: async () => {
    const root = new URL("../../", import.meta.url);
    const ofensores: string[] = [];
    async function walk(dir: URL) {
      for await (const e of Deno.readDir(dir)) {
        const p = new URL(e.name + (e.isDirectory ? "/" : ""), dir);
        if (e.isDirectory) {
          if (e.name === "email" && dir.pathname.endsWith("/_shared/")) continue;
          await walk(p);
        } else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) {
          const src = await Deno.readTextFile(p);
          const isHealth = p.pathname.endsWith("/_shared/healthcheck.ts");
          if (/<!DOCTYPE html|<html[\s>]/i.test(src) || (!isHealth && src.includes("api.resend.com/emails"))) {
            ofensores.push(p.pathname.split("/functions/")[1]);
          }
        }
      }
    }
    await walk(root);
    assertEquals(ofensores, [], `HTML de e-mail fora do módulo: ${ofensores.join(", ")}`);
  },
});

// ---------------------------------------------------------------------------
// Identidade da marca no shell (landing traduzida para e-mail)
// ---------------------------------------------------------------------------

Deno.test("botão é pílula verde com tinta escura e seta, nunca verde no texto", () => {
  const { html: out } = T.templateMagicLink("https://l");
  assertStringIncludes(out, "background-color:#A6EC88");
  assertStringIncludes(out, "border-radius:999px");
  assertStringIncludes(out, "&rarr;");
  assert(!/[^-]color:#A6EC88/.test(out), "verde não pode ser cor de texto (regra da marca)");
});

Deno.test("cabeçalho de plataforma usa peso 500 no wordmark, não negrito", () => {
  const { html: out } = T.templateRecuperacaoSenha("https://l");
  assertStringIncludes(out, "font-weight:500;color:#1A1A1A;letter-spacing:-0.025em");
  assert(!out.includes("font-weight:700"), "wordmark não usa 700");
});

Deno.test("rodapé mostra o domínio como link para o site", () => {
  const { html: out } = T.templateConfirmacaoCadastro("https://l");
  assertStringIncludes(out, '<a href="https://www.pilarsoft.com.br"');
  assertStringIncludes(out, "pilarsoft.com.br</a>");
});

Deno.test("copy não usa 'no Pilar' nem 'Entrar no Pilar'", () => {
  const amostras = [
    T.templateMagicLink("https://l").html,
    T.templateConviteUsuario("https://l", "Ana").html,
    T.templateTrialAviso({ empresaNome: "X", daysLeft: 3, billingUrl: "https://l" }).html,
    T.templateNotificacoes({
      nome: "Ana",
      modo: "digest",
      itens: [item("projeto")],
      totalOculto: 1,
      gerenciarUrl: "https://l/g",
      sinoUrl: "https://l/s",
    }).html,
  ];
  for (const out of amostras) {
    assert(!/no Pilar/.test(out), `copy com "no Pilar": ${out.match(/.{0,40}no Pilar.{0,20}/)?.[0]}`);
  }
  assertStringIncludes(T.templateMagicLink("https://l").html, ">Entrar&nbsp;&nbsp;&rarr;<");
});
