// Renderiza out/<id>.html quadro a quadro (seek determinístico) e codifica com ffmpeg.
//   node render.cjs <id>                      vídeo inteiro em renders/<id>.video.mp4
//   node render.cjs <id> --still 1.2,9.6      quadros soltos para revisão
// Sobe um servidor estático na raiz do repo (fontes de apps/marketing, logotipo de brand/).
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const id = args[0];
const opt = (k, d) => {
  const i = args.indexOf("--" + k);
  return i >= 0 ? args[i + 1] : d;
};
const REPO = path.join(__dirname, "../../..");
const BASE = "/" + path.relative(REPO, __dirname).split(path.sep).join("/");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };

const server = http.createServer((req, res) => {
  const file = path.join(REPO, decodeURIComponent(req.url.split("?")[0]));
  if (!file.startsWith(REPO) || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("erro na página:", e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}${BASE}/out/${id}.html`);
  await page.waitForFunction(() => window.__meta);
  const meta = await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
    return window.__meta;
  });
  await page.setViewportSize({ width: meta.w, height: meta.h });
  const dir = path.join(__dirname, "renders");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, id + ".cues.json"), JSON.stringify(meta, null, 1));
  const cdp = await page.context().newCDPSession(page);
  const shot = async (t) => {
    await page.evaluate((t) => window.__seek(t), t);
    const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 93, clip: { x: 0, y: 0, width: meta.w, height: meta.h, scale: 1 } });
    return Buffer.from(data, "base64");
  };

  const stills = opt("still");
  if (stills) {
    for (const t of stills.split(",").map(Number)) fs.writeFileSync(path.join(dir, `${id}_${t.toFixed(2)}.jpg`), await shot(t));
  } else {
    const out = path.join(dir, id + ".video.mp4");
    const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(meta.fps), "-c:v", "mjpeg", "-i", "-",
      "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
    const frames = Math.round(meta.duration * meta.fps);
    for (let f = 0; f < frames; f++) {
      const buf = await shot(f / meta.fps);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
      if (f % 300 === 0) console.log(`quadro ${f}/${frames}`);
    }
    ff.stdin.end();
    await new Promise((r) => ff.on("close", r));
    console.log("ok", path.relative(process.cwd(), out));
  }
  await browser.close();
  server.close();
})();
