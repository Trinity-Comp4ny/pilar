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

# Símbolo: coluna em cinco linhas. Unidades u do desenho (mesmas de PilarMark).
STROKE = 1.6
STROKE_SMALL = 2.2  # abaixo de 24 px de altura
PITCH = 7  # módulo X: distância entre eixos das caneluras
CAP = (1.0, 27.0, 2.0)  # x1, x2, y do capitel
ABA = (3.0, 25.0, 6.0)  # x1, x2, y do ábaco
# Três caneluras (DECISOES 2026-11-07): a do meio é o eixo de simetria, x=14.
FLUTES = [7.0, 14.0, 21.0]
FLUTE_Y = (9.0, 23.0)
ABA_OPACITY = 0.85

# Espaços em módulos X. Com X = 7u (três caneluras) as medidas em u ficam quase as da
# coluna de quatro caneluras (X = 5u, 2X/1,5X/2X): os lockups não mudam de proporção.
GAP_H = 1.5  # símbolo-nome no lockup horizontal
GAP_V = 1.0  # símbolo-nome no lockup empilhado
CLEAR = 1.5  # respiro mínimo em volta de qualquer peça


def mark_bbox(w=STROKE):
    h = w / 2
    return (CAP[0] - h, CAP[2] - h, CAP[1] + h, FLUTE_Y[1] + h)


def mark_size(w=STROKE):
    x0, y0, x1, y1 = mark_bbox(w)
    return x1 - x0, y1 - y0


def mark_group(color, scale=1.0, tx=0.0, ty=0.0, w=STROKE, solid=False, flutes=None):
    """Cinco linhas. (tx,ty) é o canto superior esquerdo da caixa visível.

    `flutes` só existe para o diagrama de uso proibido desenhar a coluna errada."""
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
    for fx in flutes or FLUTES:
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
# Respiro entre símbolo e nome = GAP_H × X (X do símbolo já escalado).
F = 100.0
CAPH = glyphs.metrics(FONT, F)["cap"]
K_H = 1.7


def lockup_h(color, mark_color=None, solid=False):
    mw, mh = mark_size()
    hm = K_H * CAPH
    s = hm / mh
    gap = GAP_H * PITCH * s
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
    gap = GAP_V * PITCH * s  # empilhado: 1X entre símbolo e nome
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



# ---- Paisagem (variações claras) -------------------------------------------
# A arte da hero da landing (apps/marketing/src/components/hero/HeroBackdrop.tsx): céu
# branco que esfria para o azul-gelo e três camadas de morro nos verdes da marca. Os
# mesmos degradês, em hex, para o logotipo funcionar fora do navegador.
def _hsl(h, s_, l, a=1.0):
    import colorsys

    r, g, b = colorsys.hls_to_rgb(h / 360, l / 100, s_ / 100)
    hx = "#{:02X}{:02X}{:02X}".format(round(r * 255), round(g * 255), round(b * 255))
    return hx, a


SKY = [(0, _hsl(0, 0, 100)), (62, _hsl(190, 60, 96)), (100, _hsl(102, 73, 73, 0.22))]
HILLS = {
    "longe": [(0, _hsl(160, 45, 78)), (100, _hsl(102, 73, 73, 0.7))],
    "meio": [(0, _hsl(102, 73, 73)), (100, _hsl(78, 62, 58))],
    "perto": [(0, _hsl(88, 55, 52)), (100, _hsl(96, 42, 38))],
}
# Os três morros da hero, no box 1440 de largura (y relativo ao topo da faixa de morro).
HILL_PATHS = {
    "longe": "M0 100 C160 50 260 74 400 62 C560 48 640 0 800 16 C960 32 1060 70 1200 58 C1320 48 1380 66 1440 78 V270 H0Z",
    "meio": "M0 162 C180 124 300 152 460 140 C620 128 720 92 880 110 C1020 126 1140 154 1280 142 C1350 136 1400 146 1440 154 V270 H0Z",
    "perto": "M0 216 C200 188 340 210 520 202 C700 194 800 168 980 182 C1140 194 1260 212 1440 204 V270 H0Z",
}
HILL_OPACITY = {"longe": 0.75, "meio": 0.8, "perto": 0.72}


def _grad(gid, stops, vertical=True):
    xy = 'x1="0" y1="0" x2="0" y2="1"' if vertical else 'x1="0" y1="0" x2="1" y2="1"'
    st = "".join(
        f'<stop offset="{o}%" stop-color="{c}"' + (f' stop-opacity="{a}"' if a < 1 else "") + "/>" for o, (c, a) in stops
    )
    return f'<linearGradient id="{gid}" {xy}>{st}</linearGradient>'


def paisagem(w, h, top, band, trama=False, pid="p"):
    """Céu em w×h e morros numa faixa de altura `band` a partir de y=`top`.

    A trama de pontos (o grão de dithering da hero) só entra em peça grande: em ícone
    pequeno ela vira moiré."""
    defs = _grad(f"{pid}c", SKY) + "".join(_grad(f"{pid}{k}", v) for k, v in HILLS.items())
    body = f'<rect width="{w:.3f}" height="{h:.3f}" fill="url(#{pid}c)"/>'
    sx, sy = w / 1440, band / 270
    for k, d in HILL_PATHS.items():
        body += (
            f'<path d="{d}" fill="url(#{pid}{k})" opacity="{HILL_OPACITY[k]}" '
            f'transform="translate(0 {top:.3f}) scale({sx:.5f} {sy:.5f})"/>'
        )
    if trama:
        cell = max(3.0, w / 480)
        defs += (
            f'<pattern id="{pid}t" width="{cell:.2f}" height="{cell:.2f}" patternUnits="userSpaceOnUse">'
            f'<circle cx="{cell / 3:.2f}" cy="{cell / 3:.2f}" r="{cell * 0.2:.2f}" fill="#FFFFFF"/></pattern>'
            f'<linearGradient id="{pid}tf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFF" stop-opacity="0"/>'
            f'<stop offset="100%" stop-color="#FFF" stop-opacity=".35"/></linearGradient>'
            f'<mask id="{pid}tm"><rect width="{w:.3f}" height="{h:.3f}" fill="url(#{pid}tf)"/></mask>'
        )
        body += f'<rect width="{w:.3f}" height="{h:.3f}" fill="url(#{pid}t)" mask="url(#{pid}tm)"/>'
    return f"<defs>{defs}</defs>{body}"


def _icon_mark(scale=8.0, cy=0.0):
    mw, mh = mark_size(STROKE_SMALL)
    return mark_group(INK, scale, 256 - mw * scale / 2, 256 - mh * scale / 2 + cy, w=STROKE_SMALL, solid=True)


def icon_paisagem():
    # A coluna fica de pé no morro do meio: as caneluras terminam onde o verde começa.
    body = paisagem(512, 512, top=300, band=212, pid="i") + _icon_mark(8.0, -14)
    return svg(512, 512, body, "Pilar")


def icon_verde():
    g = _grad("v", [(0, _hsl(102, 73, 80)), (100, _hsl(88, 55, 56))], vertical=False)
    body = f'<defs>{g}</defs><rect width="512" height="512" fill="url(#v)"/>' + _icon_mark(8.0)
    return svg(512, 512, body, "Pilar")


def icon_disco():
    # O disco verde do favicon, agora sobre papel em vez do tile preto.
    d = (
        '<defs><radialGradient id="d" cx="50%" cy="40%" r="65%"><stop offset="0%" stop-color="#D8F7CA"/>'
        '<stop offset="100%" stop-color="#A4EC86"/></radialGradient></defs>'
        '<rect width="512" height="512" fill="#F7F7F7"/><circle cx="256" cy="256" r="196" fill="url(#d)"/>'
    )
    return svg(512, 512, d + _icon_mark(7.4), "Pilar")


# formato: (largura, altura, lockup). "h" horizontal, "v" empilhado.
PAISAGEM_FORMATOS = {
    "horizontal": (1600, 800, "h"),  # capa de documento, slide 2:1
    "vertical": (1080, 1080, "v"),  # post, avatar grande, capa quadrada
    "banner": (1584, 396, "h"),  # capa do LinkedIn, cabeçalho de e-mail marketing
}


def lockup_paisagem(w, h, kind):
    if kind == "h":
        lw, lh, body, _ = lockup_h(INK)
        z = (w * (0.42 if w / h < 3 else 0.25)) / lw
    else:
        lw, lh, body, _ = lockup_v(INK)
        z = (h * 0.4) / lh
    # o logo fica no céu, acima da faixa dos morros, centrado na largura
    band = h * (0.36 if kind == "v" else 0.42 if w / h < 3 else 0.4)
    top = h - band
    x = (w - lw * z) / 2
    y = (top - lh * z) / 2 + h * (0.04 if kind == "v" else 0.02)
    g = f'<g transform="translate({x:.3f} {y:.3f}) scale({z:.5f})">{body}</g>'
    return svg(w, h, paisagem(w, h, top, band, trama=True, pid="l") + g, "Pilar")

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

    # Ícone do app: a paisagem da hero da landing, coluna em ink de pé sobre os morros.
    # Fundo claro por decisão do CEO (DECISOES 2026-11-07); o tile escuro saiu.
    write("pilar-app-icon.svg", icon_paisagem())
    write("pilar-app-icon-verde.svg", icon_verde())
    write("pilar-app-icon-disco.svg", icon_disco())

    # Lockups sobre a paisagem: capa, slide, banner e post. Sempre o nome em ink.
    for tag, (w, h, kind) in PAISAGEM_FORMATOS.items():
        write(f"pilar-logo-{tag}-paisagem.svg", lockup_paisagem(w, h, kind))

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
        ("pilar-app-icon-verde", 1024),
        ("pilar-app-icon-disco", 1024),
        ("pilar-logo-horizontal-paisagem", 1600),
        ("pilar-logo-vertical-paisagem", 1080),
        ("pilar-logo-banner-paisagem", 1584),
    ]
    for name, width in exports:
        subprocess.run(
            ["rsvg-convert", "-w", str(width), str(OUT / f"{name}.svg"), "-o", str(PNG / f"{name}-{width}.png")],
            check=True,
        )

    return measures


# ---- Produção ---------------------------------------------------------------
# O que o app e a landing servem. logotipo.oficial.test.tsx reprova se divergir.
EMAIL_LOGO = "logo-v3.png"  # versione ao trocar o desenho: cliente de e-mail guarda cache


def build_producao():
    import shutil

    copias = {
        "pilar-favicon.svg": ["public/favicon.svg", "apps/marketing/public/favicon.svg"],
        "pilar-app-icon.svg": ["public/app-icon.svg"],
        "pilar-mark-ink.svg": ["public/pilar-logo.svg", "apps/marketing/public/pilar-logo.svg"],
    }
    for ofic, destinos in copias.items():
        for d in destinos:
            shutil.copyfile(OUT / ofic, ROOT / d)
    icone = str(OUT / "pilar-app-icon.svg")
    for nome, lado in [("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512), ("maskable-512.png", 512)]:
        subprocess.run(["rsvg-convert", "-w", str(lado), icone, "-o", str(ROOT / "public" / nome)], check=True)
    # E-mail: o símbolo em ink, 96 px (3x), centrado num quadrado transparente.
    mw, mh = mark_size()
    s = 88 / mw
    corpo = mark_group(INK, s, (96 - mw * s) / 2, (96 - mh * s) / 2)
    tmp = OUT / "_email.svg"
    tmp.write_text(svg(96, 96, corpo, "Pilar"))
    subprocess.run(["rsvg-convert", "-w", "96", str(tmp), "-o", str(ROOT / "apps/marketing/public/email" / EMAIL_LOGO)], check=True)
    tmp.unlink()


if __name__ == "__main__":
    m = build_assets()
    build_producao()
    (OUT / "measures.json").write_text(json.dumps(m, indent=2) + "\n")
    import diagrams

    diagrams.build_diagrams(m)
    print(json.dumps(m, indent=2))
