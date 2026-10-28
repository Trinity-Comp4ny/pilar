"""Contornos do logotipo a partir da Geist variável (wght 500).

O nome "Pilar" vira curva (path), então o SVG do logotipo não depende de fonte
instalada. Requer `pip install fonttools brotli`. Uso interno de build.py.
"""

from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FONT = Path(__file__).resolve().parents[2] / "apps/marketing/public/fonts/geist-variable.woff2"
WEIGHT = 500
TRACKING = -0.025  # em, o mesmo tracking-tight do componente Logo


INTER = FONT.parent / "inter-variable-latin.woff2"


def load(path=FONT, weight=WEIGHT):
    return instancer.instantiateVariableFont(TTFont(path), {"wght": weight})


def word_path(font, text, size, x=0.0, baseline=0.0, tracking=TRACKING):
    """Path SVG do texto, com tracking, e a largura total em unidades do SVG."""
    upm = font["head"].unitsPerEm
    scale = size / upm
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    hmtx = font["hmtx"]
    d = []
    cursor = x
    for ch in text:
        name = cmap.get(ord(ch), ".notdef")
        pen = SVGPathPen(glyphs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, cursor, baseline)))
        d.append(pen.getCommands())
        cursor += hmtx[name][0] * scale + tracking * size
    width = cursor - x - tracking * size
    return " ".join(p for p in d if p), width


def metrics(font, size):
    upm = font["head"].unitsPerEm
    os2 = font["OS/2"]
    return {
        "cap": os2.sCapHeight * size / upm,
        "xheight": os2.sxHeight * size / upm,
    }


def ink_insets(font, text, size):
    """Folga lateral (esquerda da 1ª letra, direita da última) entre o avanço e a tinta."""
    upm = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    glyf = font["glyf"]
    hmtx = font["hmtx"]
    first, last = cmap[ord(text[0])], cmap[ord(text[-1])]
    lsb = hmtx[first][1] * size / upm
    adv, _ = hmtx[last]
    rsb = (adv - glyf[last].xMax) * size / upm
    return lsb, rsb
