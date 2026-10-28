"""Renderiza os templates de Instagram (brand/social/templates) em PNG com dado de exemplo.

    python3 scripts/brand/render-social.py

Usa o chrome-headless-shell do Playwright (~/Library/Caches/ms-playwright). Saída em
brand/assets/social/. Os templates usam placeholders {{nome}}, o mesmo contrato do
post-automation (hook, badge, brand, handle).
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TPL = ROOT / "brand/social/templates"
OUT = ROOT / "brand/assets/social"

BASE = {"brand": "Pilar", "handle": "@pilar.software"}
SAMPLES = {
    "foto-pergunta": {"badge": "Pergunta", "hook_a": "Qual projeto seu deu prejuízo em", "hook_pill": "2026", "hook_b": "?"},
    "carrossel-capa": {"badge": "Dica prática", "hook_a": "Como saber o lucro do projeto", "hook_pill": "antes de terminar", "body": "5 passos, sem planilha nova."},
    "carrossel-item": {"n": "02", "titulo": "Separe a hora do sócio da hora da equipe", "body": "A hora do sócio vale mais. Se ela cai no mesmo balde, a margem do projeto mente."},
    "dado": {"badge": "Número", "valor": "R$ 18.400", "legenda": "de revisão não cobrada num projeto de R$ 96.000", "l1": "Honorário", "v1": "R$ 96.000", "l2": "Custo das horas", "v2": "R$ 114.400", "l3": "Resultado", "v3": "-R$ 18.400"},
    "carrossel-final": {"badge": "Pilar", "hook_a": "Veja o lucro de cada projeto", "hook_pill": "antes de terminar", "body": "Gestão para escritórios de engenharia e arquitetura.", "cta": "Teste grátis por 3 dias"},
    "prova": {"badge": "Cliente real", "depoimento": "Hoje eu sei a margem do projeto na semana, não no fechamento.", "iniciais": "NS", "nome": "Nome Sobrenome", "cargo": "Sócio, escritório de engenharia"},
    "story": {"badge": "Enquete", "hook_a": "Você cobra a revisão 3 ou faz de", "hook_pill": "graça", "adesivo": "Adesivo de enquete aqui"},
    "reel-capa": {"badge": "Conta rápida", "hook_a": "Seu projeto dá lucro? Veja em", "hook_pill": "30 segundos"},
}


def chrome():
    base = Path.home() / "Library/Caches/ms-playwright"
    found = sorted(base.glob("chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell"))
    if not found:
        sys.exit("chrome-headless-shell não encontrado em ~/Library/Caches/ms-playwright")
    return str(found[-1])


def render(name, html, w, h):
    tmp = TPL / f"_render-{name}.html"
    tmp.write_text(html)
    try:
        subprocess.run(
            [chrome(), "--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1",
             f"--window-size={w},{h}", "--virtual-time-budget=2500",
             f"--screenshot={OUT / (name + '.png')}", tmp.as_uri()],
            check=True, capture_output=True,
        )
    finally:
        tmp.unlink(missing_ok=True)


def overview():
    """Folha com todos os templates, para o brand book."""
    posts = ["foto-pergunta", "carrossel-capa", "carrossel-item", "dado", "carrossel-final", "prova"]
    high = ["como-funciona", "clientes", "dicas", "bastidores", "planos"]
    img = lambda n, w, h, extra="": f'<img src="../../assets/social/{n}.png" style="width:{w}px;height:{h}px;object-fit:cover;{extra}">'
    top = "".join(img(n, 270, 338, "border-radius:12px;box-shadow:0 1px 3px rgba(26,26,26,.12)") for n in posts)
    bottom = (
        img("story", 190, 338, "border-radius:12px;box-shadow:0 1px 3px rgba(26,26,26,.12)")
        + img("reel-capa", 190, 338, "border-radius:12px;box-shadow:0 1px 3px rgba(26,26,26,.12)")
        + img("avatar", 150, 150, "border-radius:50%")
        + "".join(img(f"destaque-{n}", 150, 150, "border-radius:50%;object-position:center") for n in high)
    )
    html = (
        '<!doctype html><meta charset="utf-8"><style>*{margin:0;box-sizing:border-box}body{width:1800px;height:760px;background:#F7F7F7;padding:40px;'
        'display:flex;flex-direction:column;gap:30px}.r{display:flex;gap:20px;align-items:center}</style>'
        f'<div class="r">{top}</div><div class="r">{bottom}</div>'
    )
    tmp = TPL / "_overview.html"
    tmp.write_text(html)
    try:
        subprocess.run(
            [chrome(), "--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1800,760",
             "--virtual-time-budget=2500", f"--screenshot={OUT / 'overview.png'}", tmp.as_uri()],
            check=True, capture_output=True,
        )
    finally:
        tmp.unlink(missing_ok=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for path in sorted(TPL.glob("*.html")):
        name = path.stem
        if name.startswith("_"):
            continue
        src = path.read_text()
        w = int(re.search(r"--w:(\d+)px", src).group(1))
        h = int(re.search(r"--h:(\d+)px", src).group(1))
        vals = {**BASE, **SAMPLES.get(name, {})}
        html = re.sub(r"\{\{(\w+)\}\}", lambda m: vals.get(m.group(1), m.group(0)), src)
        render(name, html, w, h)
        if "guides" in src:
            render(f"{name}-guia", html.replace('<body class="">', '<body class="show-guides">'), w, h)
        print("ok", name)
    overview()
    print("ok overview")


if __name__ == "__main__":
    main()
