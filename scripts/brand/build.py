"""Gera os arquivos do logotipo Pilar (SVG, PNG) e os diagramas do brand book.

    python3 -m venv /tmp/fvenv && /tmp/fvenv/bin/pip install fonttools brotli
    /tmp/fvenv/bin/python scripts/brand/build.py

Saída em brand/assets/logo/. A geometria do símbolo vive aqui, em um lugar só:
os diagramas e as medidas do brand book saem dos mesmos números dos arquivos.
"""

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import glyphs  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "brand/assets/logo"
PNG = OUT / "png"

# Cores do logotipo (hex espelha src/styles/tokens.css)
INK = "#1A1A1A"  # --c-ink-900
WHITE = "#FFFFFF"  # --c-paper-0
BRAND = "#A4EC86"  # --c-brand-500
BLACK = "#000000"  # só impressão a uma cor

# Símbolo: coluna em seis linhas. Unidades u do desenho (mesmas de PilarMark).
STROKE = 1.6
STROKE_SMALL = 2.2  # abaixo de 24 px de altura
PITCH = 5  # módulo M: distância entre eixos das caneluras
CAP = (1.0, 27.0, 2.0)  # x1, x2, y do capitel
ABA = (3.0, 25.0, 6.0)  # x1, x2, y do ábaco
FLUTES = [6.5, 11.5, 16.5, 21.5]  # centradas no eixo x=14, o mesmo do capitel
FLUTE_Y = (9.0, 23.0)
ABA_OPACITY = 0.85


def mark_bbox(w=STROKE):
    h = w / 2
    return (CAP[0] - h, CAP[2] - h, CAP[1] + h, FLUTE_Y[1] + h)


def mark_size(w=STROKE):
    x0, y0, x1, y1 = mark_bbox(w)
    return x1 - x0, y1 - y0


def mark_group(color, scale=1.0, tx=0.0, ty=0.0, w=STROKE, solid=False):
    """Seis linhas. (tx,ty) é o canto superior esquerdo da caixa visível."""
    x0, y0, _, _ = mark_bbox(w)

    def X(v):
        return f"{(v - x0) * scale + tx:.3f}".rstrip("0").rstrip(".")

    def Y(v):
        return f"{(v - y0) * scale + ty:.3f}".rstrip("0").rstrip(".")

    sw = f"{w * scale:.3f}".rstrip("0").rstrip(".")
    op = 1 if solid else ABA_OPACITY
    lines = [
        f'<path d="M{X(CAP[0])} {Y(CAP[2])}H{X(CAP[1])}"/>',
        f'<path d="M{X(ABA[0])} {Y(ABA[2])}H{X(ABA[1])}" stroke-opacity="{op}"/>',
    ]
    for fx in FLUTES:
        lines.append(f'<path d="M{X(fx)} {Y(FLUTE_Y[0])}V{Y(FLUTE_Y[1])}"/>')
    return (
        f'<g stroke="{color}" stroke-width="{sw}" stroke-linecap="round" fill="none">' + "".join(lines) + "</g>"
    )


def svg(w, h, body, title, bg=None):
    rect = f'<rect width="{w:.3f}" height="{h:.3f}" fill="{bg}"/>' if bg else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.3f} {h:.3f}" width="{w:.0f}" height="{h:.0f}" '
        f'role="img" aria-label="{title}"><title>{title}</title>{rect}{body}</svg>\n'
    )


FONT = glyphs.load()

# ---- Lockup horizontal ------------------------------------------------------
# F = tamanho de fonte do nome. Altura do símbolo = K_H × altura de caixa-alta.
# Respiro entre símbolo e nome = 2M (M do símbolo já escalado).
F = 100.0
CAPH = glyphs.metrics(FONT, F)["cap"]
K_H = 1.7


def lockup_h(color, mark_color=None, solid=False):
    mw, mh = mark_size()
    hm = K_H * CAPH
    s = hm / mh
    gap = 2 * PITCH * s
    word_d, word_w = glyphs.word_path(FONT, "Pilar", F, x=0, baseline=0)
    lsb, rsb = glyphs.ink_insets(FONT, "Pilar", F)
    # linha de base y=0; centro da caixa-alta em y=-CAPH/2; símbolo centrado nele
    top = -CAPH / 2 - hm / 2
    asc = min(top, -CAPH * 1.04)  # 'l' passa um pouco da caixa-alta
    desc = max(top + hm, 0)
    pad_y = -asc
    mx = 0.0
    wx = mw * s + gap - lsb  # o respiro conta da tinta do P, não do avanço da letra
    width = wx + word_w - rsb
    height = desc - asc
    body = mark_group(mark_color or color, s, mx, top + pad_y, solid=solid)
    body += f'<path d="{word_d}" transform="translate({wx:.3f} {pad_y:.3f})" fill="{color}"/>'
    # recalcula path com deslocamento aplicado por transform (mais simples de auditar)
    return width, height, body, {"s": s, "gap": gap, "hm": hm, "cap": CAPH, "word_w": word_w, "lsb": lsb, "wx": wx, "top": top + pad_y, "base": pad_y}


# ---- Lockup empilhado -------------------------------------------------------
K_STACK = 2.0  # altura do símbolo / altura de caixa-alta do nome
OVERSHOOT = 0.02 * F  # o bojo do 'a' passa um pouco da linha de base


def lockup_v(color, mark_color=None, solid=False):
    mw, mh = mark_size()
    hm = K_STACK * CAPH
    s = hm / mh
    gap = 1.5 * PITCH * s  # empilhado: 1,5X entre símbolo e nome
    word_d, word_w = glyphs.word_path(FONT, "Pilar", F, x=0, baseline=0)
    asc_word = CAPH * 1.04
    lsb, rsb = glyphs.ink_insets(FONT, "Pilar", F)
    ink_w = word_w - lsb - rsb
    width = max(mw * s, ink_w)
    mx = (width - mw * s) / 2
    wx = (width - ink_w) / 2 - lsb
    base = hm + gap + asc_word
    height = base + OVERSHOOT
    body = mark_group(mark_color or color, s, mx, 0, solid=solid)
    body += f'<path d="{word_d}" transform="translate({wx:.3f} {base:.3f})" fill="{color}"/>'
    return width, height, body, {"s": s, "gap": gap, "hm": hm, "mw": mw * s, "word_w": word_w, "lsb": lsb, "wx": wx, "base": base}


def wordmark(color):
    word_d, word_w = glyphs.word_path(FONT, "Pilar", F, x=0, baseline=0)
    lsb, rsb = glyphs.ink_insets(FONT, "Pilar", F)
    asc = CAPH * 1.04
    # descendente nenhum em "Pilar"; altura útil = ascendente
    body = f'<path d="{word_d}" transform="translate({-lsb:.3f} {asc + OVERSHOOT:.3f})" fill="{color}"/>'
    return word_w - lsb - rsb, asc + OVERSHOOT * 1.5, body


def write(name, text):
    (OUT / name).write_text(text)


def build_assets():
    OUT.mkdir(parents=True, exist_ok=True)
    PNG.mkdir(parents=True, exist_ok=True)
    measures = {}

    # Símbolo
    for tag, color in [("ink", INK), ("white", WHITE), ("brand", BRAND), ("black", BLACK)]:
        mw, mh = mark_size()
        s = 4.0
        # black é de impressão a uma cor: ábaco opaco, sem meio-tom
        write(f"pilar-mark-{tag}.svg", svg(mw * s, mh * s, mark_group(color, s, solid=tag == "black"), "Pilar"))
    mw, mh = mark_size(STROKE_SMALL)
    write(
        "pilar-mark-small-ink.svg",
        svg(mw * 4, mh * 4, mark_group(INK, 4, w=STROKE_SMALL, solid=True), "Pilar"),
    )
    write(
        "pilar-mark-small-white.svg",
        svg(mw * 4, mh * 4, mark_group(WHITE, 4, w=STROKE_SMALL, solid=True), "Pilar"),
    )

    # Lockups
    for tag, color, mc in [("ink", INK, None), ("white", WHITE, None), ("black", BLACK, None), ("brand", WHITE, BRAND)]:
        w, h, body, m = lockup_h(color, mc, solid=tag == "black")
        write(f"pilar-logo-horizontal-{tag}.svg", svg(w, h, body, "Pilar"))
        if tag == "ink":
            measures["horizontal"] = {k: round(v, 3) for k, v in m.items()} | {"w": round(w, 3), "h": round(h, 3)}
        w, h, body, m = lockup_v(color, mc, solid=tag == "black")
        write(f"pilar-logo-vertical-{tag}.svg", svg(w, h, body, "Pilar"))
        if tag == "ink":
            measures["vertical"] = {k: round(v, 3) for k, v in m.items()} | {"w": round(w, 3), "h": round(h, 3)}

    # Só o nome
    for tag, color in [("ink", INK), ("white", WHITE)]:
        w, h, body = wordmark(color)
        write(f"pilar-wordmark-{tag}.svg", svg(w, h, body, "Pilar"))

    # Ícone do app: disco verde sobre tile escuro, símbolo ink (mesma regra do public/app-icon.svg)
    mw, mh = mark_size()
    s = 8.0
    tx = 256 - mw * s / 2
    ty = 256 - mh * s / 2
    icon = (
        '<defs><radialGradient id="d" cx="50%" cy="40%" r="65%"><stop offset="0%" stop-color="#C6F3AB"/>'
        '<stop offset="100%" stop-color="#88D46A"/></radialGradient></defs>'
        '<circle cx="256" cy="256" r="188" fill="url(#d)"/>' + mark_group(INK, s, tx, ty, solid=True)
    )
    write("pilar-app-icon.svg", svg(512, 512, icon, "Pilar", bg="#0A0A0A"))

    # Favicon: disco verde cheio, símbolo ink
    f = 32
    s = 0.85
    mw, mh = mark_size(1.6 * 1.0)
    tx = f / 2 - mw * s / 2
    ty = f / 2 - mh * s / 2 + 0.2
    fav = (
        '<defs><radialGradient id="d" cx="50%" cy="40%" r="65%"><stop offset="0%" stop-color="#D8F7CA"/>'
        '<stop offset="100%" stop-color="#A4EC86"/></radialGradient></defs>'
        '<circle cx="16" cy="16" r="16" fill="url(#d)"/>' + mark_group(INK, s, tx, ty, w=1.6)
    )
    write("pilar-favicon.svg", svg(f, f, fav, "Pilar"))

    # PNG para quem não abre SVG (apresentação, redes sociais, documentos)
    exports = [
        ("pilar-mark-ink", 1024),
        ("pilar-mark-white", 1024),
        ("pilar-logo-horizontal-ink", 2000),
        ("pilar-logo-horizontal-white", 2000),
        ("pilar-logo-horizontal-brand", 2000),
        ("pilar-logo-vertical-ink", 1200),
        ("pilar-logo-vertical-white", 1200),
        ("pilar-app-icon", 1024),
    ]
    for name, width in exports:
        subprocess.run(
            ["rsvg-convert", "-w", str(width), str(OUT / f"{name}.svg"), "-o", str(PNG / f"{name}-{width}.png")],
            check=True,
        )

    return measures


if __name__ == "__main__":
    m = build_assets()
    (OUT / "measures.json").write_text(json.dumps(m, indent=2) + "\n")
    import diagrams

    diagrams.build_diagrams(m)
    print(json.dumps(m, indent=2))
