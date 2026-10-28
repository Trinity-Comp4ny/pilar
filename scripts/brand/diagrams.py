"""Diagramas do brand book (construção, respiro, tamanho mínimo, fundos, usos errados).

Chamado por build.py. Tudo sai da mesma geometria dos arquivos do logotipo.
"""

import colorsys

import build as B

FONTS = "Geist, Inter, system-ui, -apple-system, sans-serif"
PAPER = "#FAFAFA"
PAPER_200 = "#EDEDED"
CARD = "#FFFFFF"
LINE = "#D9DCE1"
MUTED = "#5F646D"
GUIDE = "#2F6B1F"  # --c-modulo-gestao-strong, verde que passa em texto
RED = "#CC2222"  # --c-red-600


def hsl_hex(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h / 360, l / 100, s / 100)
    return "#{:02X}{:02X}{:02X}".format(round(r * 255), round(g * 255), round(b * 255))


def text(x, y, s, size=13, fill=MUTED, weight=400, anchor="start", family=FONTS):
    return (
        f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}" font-size="{size}" font-weight="{weight}" '
        f'fill="{fill}" text-anchor="{anchor}">{s}</text>'
    )


def wrap(w, h, body, title):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" '
        f'aria-label="{title}"><title>{title}</title><rect width="{w}" height="{h}" fill="{PAPER}"/>{body}</svg>\n'
    )


def place(body, z, ox, oy):
    return f'<g transform="translate({ox:.2f} {oy:.2f}) scale({z:.4f})">{body}</g>'


def dim_h(x1, x2, y, label, size=12):
    return (
        f'<path d="M{x1} {y}H{x2}M{x1} {y - 5}V{y + 5}M{x2} {y - 5}V{y + 5}" stroke="{GUIDE}" stroke-width="1" fill="none"/>'
        + text((x1 + x2) / 2, y - 9, label, size, GUIDE, 600, "middle")
    )


def dim_v(x, y1, y2, label, size=12, side="right"):
    tx = x + 10 if side == "right" else x - 10
    anchor = "start" if side == "right" else "end"
    return (
        f'<path d="M{x} {y1}V{y2}M{x - 5} {y1}H{x + 5}M{x - 5} {y2}H{x + 5}" stroke="{GUIDE}" stroke-width="1" fill="none"/>'
        + text(tx, (y1 + y2) / 2 + 4, label, size, GUIDE, 600, anchor)
    )


# ---- 1. Construção do símbolo ----------------------------------------------
def construction():
    s = 17.0
    mw, mh = B.mark_size()
    ox, oy = 175.0, 150.0
    x0, y0, _, _ = B.mark_bbox()

    def px(v):
        return (v - x0) * s + ox

    def py(v):
        return (v - y0) * s + oy

    g = []
    # grade modular: eixos das caneluras, capitel, ábaco, base
    for fx in B.FLUTES:
        g.append(f'<path d="M{px(fx):.1f} {oy - 30}V{oy + mh * s + 30}" stroke="{GUIDE}" stroke-width="1" stroke-dasharray="4 4" opacity=".55"/>')
    for yv in (B.CAP[2], B.ABA[2], B.FLUTE_Y[0], B.FLUTE_Y[1]):
        g.append(f'<path d="M{ox - 30} {py(yv):.1f}H{ox + mw * s + 30}" stroke="{GUIDE}" stroke-width="1" stroke-dasharray="4 4" opacity=".55"/>')
    # eixo central
    cx = px(14.0)
    g.append(f'<path d="M{cx:.1f} {oy - 50}V{oy + mh * s + 50}" stroke="{RED}" stroke-width="1" stroke-dasharray="2 5" opacity=".7"/>')
    g.append(text(cx, oy - 58, "eixo de simetria", 11, RED, 600, "middle"))
    mark = B.mark_group(B.INK, s, ox, oy)
    # módulo X entre as duas primeiras caneluras
    xa, xb = px(B.FLUTES[0]), px(B.FLUTES[1])
    ym = py(B.FLUTE_Y[1]) + 44
    ann = dim_h(xa, xb, ym, "X = 5u", 13)
    # largura do capitel e do ábaco
    ann += dim_h(px(B.CAP[0]), px(B.CAP[1]), oy - 30, "capitel 26u", 13)
    ann += dim_h(px(B.ABA[0]), px(B.ABA[1]), py(B.FLUTE_Y[1]) + 90, "ábaco 22u", 13)
    ann += dim_v(ox + mw * s + 50, py(B.FLUTE_Y[0]), py(B.FLUTE_Y[1]), "caneluras 14u", 13)
    ann += dim_v(ox - 50, oy, oy + mh * s, "altura 22,6u", 13, side="left")
    # legenda
    lx = 800
    rows = [
        ("Traço", "1,6u, ponta redonda (raio 0,8u)"),
        ("Capitel", "linha de 26u, opacidade 100%"),
        ("Ábaco", "linha de 22u, opacidade 85%"),
        ("Caneluras", "4 linhas de 14u, 1 por módulo X"),
        ("Módulo X", "5u, distância entre eixos das caneluras"),
        ("Caixa", "27,6u × 22,6u, já contando o traço"),
        ("Eixo", "capitel, ábaco e caneluras centrados em x = 14"),
    ]
    leg = text(lx, 110, "Medidas", 20, B.INK, 600)
    for i, (a, b) in enumerate(rows):
        yy = 150 + i * 50
        leg += f'<path d="M{lx} {yy - 22}H{lx + 360}" stroke="{LINE}"/>'
        leg += text(lx, yy, a, 14, B.INK, 600) + text(lx, yy + 18, b, 13)
    leg += text(lx, 150 + len(rows) * 50 + 10, "u = unidade do desenho: 1u = altura do símbolo ÷ 22,6.", 12)
    return wrap(1200, 700, "".join(g) + mark + ann + leg, "Construção do símbolo Pilar")


# ---- 2. Respiro ------------------------------------------------------------
def clearspace(measures):
    panels = []
    # (largura painel, corpo, w, h, X em unidades do corpo)
    wh, hh, bh, mh_ = B.lockup_h(B.INK)
    wv, hv, bv, mv = B.lockup_v(B.INK)
    mw, mhk = B.mark_size()
    mark_s = 6.0
    items = [
        ("Lockup horizontal", wh, hh, bh, mh_["s"] * B.PITCH),
        ("Lockup empilhado", wv, hv, bv, mv["s"] * B.PITCH),
        ("Símbolo", mw * mark_s, mhk * mark_s, B.mark_group(B.INK, mark_s), mark_s * B.PITCH),
    ]
    widths = [520, 360, 260]
    out = []
    x = 30
    for (name, w, h, body, X), pw in zip(items, widths):
        ph = 470
        z = min((pw - 30) / (w + 4 * X), (ph - 110) / (h + 4 * X))
        cw, ch = (w + 4 * X) * z, (h + 4 * X) * z
        ox = x + (pw - cw) / 2 + 2 * X * z
        oy = 70 + (ph - 110 - ch) / 2 + 2 * X * z
        # área de respiro
        out.append(
            f'<rect x="{ox - 2 * X * z:.1f}" y="{oy - 2 * X * z:.1f}" width="{cw:.1f}" height="{ch:.1f}" fill="#A4EC86" fill-opacity=".16" '
            f'stroke="{GUIDE}" stroke-dasharray="5 4"/>'
        )
        out.append(f'<rect x="{ox:.1f}" y="{oy:.1f}" width="{w * z:.1f}" height="{h * z:.1f}" fill="{CARD}" stroke="{LINE}"/>')
        out.append(place(body, z, ox, oy))
        # quadrados X nos quatro cantos externos
        sq = X * z
        for cx_, cy_ in [
            (ox - sq, oy - sq),
            (ox + w * z, oy - sq),
            (ox - sq, oy + h * z),
            (ox + w * z, oy + h * z),
        ]:
            out.append(
                f'<rect x="{cx_:.1f}" y="{cy_:.1f}" width="{sq:.1f}" height="{sq:.1f}" fill="{GUIDE}" fill-opacity=".18" stroke="{GUIDE}"/>'
            )
            out.append(text(cx_ + sq / 2, cy_ + sq / 2 + 5, "X", 14, GUIDE, 700, "middle"))
        top_y = oy - 2 * X * z
        out.append(dim_v(ox - 2 * X * z - 8, top_y, oy, "2X", 12, side="left"))
        out.append(dim_h(ox, ox + 2 * X * z, oy + h * z + 2 * X * z + 14, "2X", 12))
        out.append(text(x + pw / 2, 52, name, 15, B.INK, 600, "middle"))
        out.append(text(x + pw / 2, 70 + ph - 55, "respiro mínimo = 2X em todos os lados", 12, MUTED, 400, "middle"))
        x += pw + 20
    out.append(text(30, 560, "X = módulo do símbolo (distância entre eixos de duas caneluras vizinhas), medido no próprio lockup. Nada entra na área verde: texto, borda, imagem, outro logo.", 13))
    return wrap(1200, 600, "".join(out), "Respiro do logotipo Pilar")


# ---- 3. Anatomia do lockup horizontal -------------------------------------
def anatomy():
    w, h, body, m = B.lockup_h(B.INK)
    z = 1.8
    ox, oy = 230.0, 120.0
    cap = m["cap"]
    base = m["base"]
    xh = B.glyphs.metrics(B.FONT, B.F)["xheight"]
    g = [place(body, z, ox, oy)]

    def hline(yv, label, color=GUIDE):
        yy = oy + yv * z
        return (
            f'<path d="M{ox - 60:.1f} {yy:.1f}H{ox + w * z + 40:.1f}" stroke="{color}" stroke-dasharray="4 4" opacity=".7"/>'
            + text(ox - 66, yy + 4, label, 11, color, 600, "end")
        )

    g.append(hline(0, "topo do símbolo"))
    g.append(hline(base - cap, "caixa-alta"))
    g.append(hline(base - xh, "altura x"))
    g.append(hline(base, "linha de base"))
    g.append(hline(m["top"] + m["hm"], "base do símbolo"))
    # eixo central do símbolo na caixa-alta
    mid = base - cap / 2
    g.append(hline(mid, "centro da caixa-alta", RED))
    # respiro símbolo-nome
    mw, _ = B.mark_size()
    gx1 = ox + mw * m["s"] * z
    gx2 = ox + (m["wx"] + m["lsb"]) * z
    yy = oy + (m["top"] + m["hm"]) * z + 44
    g.append(dim_h(gx1, gx2, yy, "2X", 13))
    g.append(dim_v(ox + w * z + 20, oy, oy + m["hm"] * z, "símbolo = 1,7 × caixa-alta", 13))
    g.append(text(60, 440, "O centro do símbolo coincide com o centro da caixa-alta do nome. O nome é Geist Medium (500), tracking -0,025 em, convertido em curva.", 13))
    return wrap(1240, 470, "".join(g), "Anatomia do lockup horizontal")


# ---- 4. Tamanho mínimo -----------------------------------------------------
def minsize():
    out = []
    x = 50.0

    def mark_at(px_h, small=False):
        w = B.STROKE_SMALL if small else B.STROKE
        mw, mh = B.mark_size(w)
        s = px_h / mh
        return mw * s, px_h, B.mark_group(B.INK, s, 0, 0, w=w, solid=small)

    # cartões de tamanho real
    def card(x, label, sub, draw_w, draw_h, draw):
        cw = max(draw_w + 40, 130)
        out.append(f'<rect x="{x}" y="90" width="{cw}" height="150" rx="10" fill="{CARD}" stroke="{LINE}"/>')
        out.append(f'<g transform="translate({x + (cw - draw_w) / 2:.1f} {90 + (150 - draw_h) / 2:.1f})">{draw}</g>')
        out.append(text(x + cw / 2, 268, label, 13, B.INK, 600, "middle"))
        out.append(text(x + cw / 2, 286, sub, 12, MUTED, 400, "middle"))
        return x + cw + 16

    out.append(text(50, 56, "Símbolo", 18, B.INK, 600))
    for hpx, small in [(16, True), (20, True), (24, False), (40, False)]:
        w_, h_, d = mark_at(hpx, small)
        tag = "traço reforçado" if small else "traço padrão"
        x = card(x, f"{hpx} px", tag + (" (mínimo)" if hpx == 16 else ""), w_, h_, d)

    out.append(text(x + 30, 56, "Lockup horizontal", 18, B.INK, 600))
    x += 30
    for fpx in (14, 20, 28):
        w, h, body, _ = B.lockup_h(B.INK)
        z = fpx / B.F
        label = f"nome {fpx} px"
        sub = f"{w * z:.0f} px de largura" + (" (mínimo)" if fpx == 14 else "")
        x = card(x, label, sub, w * z, h * z, place(body, z, 0, 0))
    out.append(text(50, 330, "Abaixo de 24 px de altura o símbolo troca para a versão de traço reforçado (2,2u, ábaco opaco). Abaixo de 16 px não use o símbolo: use o ícone do app (disco verde).", 13))
    out.append(text(50, 352, "Impressão: símbolo ≥ 5 mm de altura, lockup horizontal ≥ 15 mm de largura, empilhado ≥ 11 mm. Tamanhos reais em 96 dpi.", 13))
    return wrap(max(1200, int(x) + 40), 400, "".join(out), "Tamanhos mínimos do logotipo")


# ---- 5. Fundos -------------------------------------------------------------
def luminance(hexv):
    hexv = hexv.lstrip("#")
    r, g, b = [int(hexv[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def backgrounds():
    tiles = [
        ("Paper", "#FAFAFA", B.INK, None, "ink", True),
        ("Paper 200", "#EDEDED", B.INK, None, "ink", True),
        ("Verde da marca", "#A4EC86", B.INK, None, "ink", True),
        ("Ink", "#1A1A1A", WHITE_ := "#FFFFFF", None, "branco", True),
        ("Ink, símbolo verde", "#1A1A1A", "#FFFFFF", "#A4EC86", "branco + verde", True),
        ("Verde sobre claro", "#FAFAFA", "#A4EC86", None, "verde", False),
        ("Cinza médio", "#6B6B6B", "#1A1A1A", None, "ink", False),
        ("Verde sobre verde", "#A4EC86", "#A4EC86", None, "verde", False),
    ]
    out = []
    w, h, body, _ = B.lockup_h(B.INK)
    tw, th, gap = 270, 170, 20
    for i, (name, bg, fg, mc, lab, ok) in enumerate(tiles):
        col, row = i % 4, i // 4
        x = 30 + col * (tw + gap)
        y = 60 + row * (th + 78)
        out.append(f'<rect x="{x}" y="{y}" width="{tw}" height="{th}" rx="12" fill="{bg}" stroke="{LINE}"/>')
        _, _, b2, _ = B.lockup_h(fg, mc)
        z = (tw - 80) / w
        out.append(place(b2, z, x + (tw - w * z) / 2, y + (th - h * z) / 2))
        ratio = contrast(bg, mc or fg)
        mark = "✓" if ok else "✕"
        color = GUIDE if ok else RED
        out.append(text(x, y + th + 22, name, 14, B.INK, 600))
        out.append(text(x, y + th + 40, f"{lab}, contraste {ratio:.1f}:1", 12))
        out.append(text(x + tw, y + th + 22, mark, 18, color, 700, "end"))
    out.append(text(30, 36, "Combinações aprovadas (✓) e proibidas (✕)", 18, B.INK, 600))
    out.append(text(30, 60 + 2 * (th + 78) - 10, "Mínimo de contraste entre logo e fundo: 4,5:1. Foto: só com véu escuro que leve o fundo a esse contraste, com o logo branco.", 13))
    return wrap(1200, 60 + 2 * (th + 78) + 14, "".join(out), "Fundos permitidos e proibidos")


# ---- 6. Usos errados -------------------------------------------------------
def misuse():
    w, h, body, m = B.lockup_h(B.INK)
    tw, th, gap = 270, 150, 20
    cases = []

    def add(label, content, bg=CARD):
        cases.append((label, content, bg))

    z = (tw - 70) / w
    cx, cy = (tw - w * z) / 2, (th - h * z) / 2

    add("Não distorça", f'<g transform="translate({cx - 22:.1f} {cy:.1f}) scale({z * 1.2:.4f} {z:.4f})">{body}</g>')
    add("Não gire", f'<g transform="rotate(-10 {tw / 2} {th / 2})">{place(body, z, cx, cy)}</g>')
    _, _, blue, _ = B.lockup_h("#2563EB")
    add("Não recolora", place(blue, z, cx, cy))
    add("Não aplique sombra nem brilho", f'<defs><filter id="sh" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="3" dy="5" stdDeviation="3" flood-color="#000" flood-opacity=".45"/></filter></defs><g filter="url(#sh)">{place(body, z, cx, cy)}</g>')
    # nome em outra fonte
    mw, mh = B.mark_size()
    s = (h * z) / mh
    other = B.mark_group(B.INK, s, cx, cy) + text(cx + mw * s + 14, cy + h * z * 0.68, "Pilar", 40, B.INK, 400, family="Georgia, serif")
    add("Não troque a fonte do nome", other)
    # cinco caneluras
    five = B.mark_group(B.INK, s, cx, cy).replace("</g>", "") + ""
    extra = f'<path d="M{cx + (B.FLUTES[3] + 5 - B.mark_bbox()[0]) * s:.2f} {cy + (B.FLUTE_Y[0] - B.mark_bbox()[1]) * s:.2f}V{cy + (B.FLUTE_Y[1] - B.mark_bbox()[1]) * s:.2f}"/>'
    five = five + extra + "</g>"
    add("Não mude o desenho do símbolo", five + place(f'<path d="{B.glyphs.word_path(B.FONT, "Pilar", B.F)[0]}" transform="translate({m["wx"] + 5 * m["s"]:.2f} {m["base"]:.2f})" fill="{B.INK}"/>', z, cx, cy))
    # contorno
    d, _ = B.glyphs.word_path(B.FONT, "Pilar", B.F)
    outline = B.mark_group(B.INK, s, cx, cy) + place(f'<path d="{d}" transform="translate({m["wx"]:.2f} {m["base"]:.2f})" fill="none" stroke="{B.INK}" stroke-width="2"/>', z, cx, cy)
    add("Não use só o contorno", outline)
    _, _, grey, _ = B.lockup_h("#BDBDBD")
    add("Não use sem contraste", place(grey, z, cx, cy), "#E5E5E5")

    out = [text(30, 36, "Usos proibidos", 18, B.INK, 600)]
    for i, (label, content, bg) in enumerate(cases):
        col, row = i % 4, i // 4
        x = 30 + col * (tw + gap)
        y = 60 + row * (th + 70)
        out.append(f'<rect x="{x}" y="{y}" width="{tw}" height="{th}" rx="12" fill="{bg}" stroke="{LINE}"/>')
        out.append(f'<g transform="translate({x} {y})">{content}</g>')
        out.append(f'<circle cx="{x + tw - 18}" cy="{y + 18}" r="11" fill="{RED}"/>' + text(x + tw - 18, y + 23, "✕", 13, "#FFFFFF", 700, "middle"))
        out.append(text(x, y + th + 24, label, 14, B.INK, 600))
    return wrap(1200, 60 + 2 * (th + 70) + 6, "".join(out), "Usos proibidos do logotipo")


def type_path(font, txt, size, x, y, fill=None, tracking=0.0):
    d, w = B.glyphs.word_path(font, txt, size, x=x, baseline=y, tracking=tracking)
    return f'<path d="{d}" fill="{fill or B.INK}"/>', w


def typography_scale():
    geist = {w: B.glyphs.load(B.glyphs.FONT, w) for w in (300, 500)}
    geist[400] = B.glyphs.load(B.glyphs.FONT, 400)
    inter = {w: B.glyphs.load(B.glyphs.INTER, w) for w in (400, 500, 600)}
    out = []
    # amostras das duas famílias
    for i, (name, role, fnt, wts) in enumerate(
        [
            ("Geist", "Marca: títulos, landing, e-mail, logotipo", geist[500], "300 · 400 · 500"),
            ("Inter", "Produto: tabela, formulário, botão, menu", inter[500], "400 · 500 · 600"),
        ]
    ):
        x = 40 + i * 580
        out.append(f'<rect x="{x}" y="30" width="560" height="270" rx="14" fill="{CARD}" stroke="{LINE}"/>')
        p, _ = type_path(fnt, "Aa", 150, x + 30, 190, tracking=-0.03)
        out.append(p)
        out.append(text(x + 290, 90, name, 22, B.INK, 600))
        out.append(text(x + 290, 114, role, 13))
        out.append(text(x + 290, 136, "Pesos: " + wts, 13))
        out.append(text(x + 290, 158, "SIL OFL 1.1", 13))
        p, _ = type_path(fnt, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", 20, x + 30, 232, tracking=0.02)
        out.append(p)
        p, _ = type_path(fnt, "abcdefghijklmnopqrstuvwxyz áãçéêóõú", 20, x + 30, 260, tracking=0.02)
        out.append(p)
        p, _ = type_path(fnt, "0123456789  R$ 12.480,50  38%", 20, x + 30, 288, tracking=0.02)
        out.append(p)
    # escala
    rows = [
        ("Hero", "Geist 500, 62 px, -0,035 em", geist[500], 62, -0.035, "Gestão sem caos"),
        ("Título de página", "Geist 500, 58 px, -0,035 em", geist[500], 58, -0.035, "Planos simples"),
        ("Título de seção", "Geist 500, 52 px, -0,035 em", geist[500], 52, -0.035, "Lucro de cada projeto"),
        ("Subtítulo", "Geist 500, 24 px", geist[500], 24, -0.01, "Proposta, projeto e cobrança"),
        ("Corpo de apoio", "Geist 300, 17 px", geist[300], 17, 0, "Saiba se cada projeto está dando lucro antes de terminar."),
        ("Corpo do app", "Inter 400, 14 px (text-sm)", inter[400], 14, 0, "Receita prevista para o mês de novembro"),
        ("Rótulo", "Inter 500, 14 px", inter[500], 14, 0, "Valor do contrato"),
        ("Legenda, o piso", "Inter 500, 12 px (text-xs)", inter[500], 12, 0, "Atualizado há 2 minutos"),
    ]
    y = 350
    out.append(text(40, y - 20, "Escala em uso, tamanho real", 18, B.INK, 600))
    for label, spec, fnt, size, trk, sample in rows:
        row_h = max(size * 1.25, 44)
        out.append(f'<path d="M40 {y - 8}H1160" stroke="{LINE}"/>')
        out.append(text(40, y + 14, label, 14, B.INK, 600))
        out.append(text(40, y + 32, spec, 12))
        p, _ = type_path(fnt, sample, size, 330, y + 8 + size * 0.72, tracking=trk)
        out.append(p)
        y += row_h + 20
    return wrap(1200, int(y + 10), "".join(out), "Escala tipográfica Pilar")


def shape_elevation():
    out = [
        '<defs>'
        '<filter id="s1" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#1A1A1A" flood-opacity=".08"/></filter>'
        '<filter id="s2" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#1A1A1A" flood-opacity=".10"/></filter>'
        '<filter id="s3" x="-30%" y="-30%" width="160%" height="190%"><feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#1A1A1A" flood-opacity=".12"/></filter>'
        "</defs>"
    ]
    out.append(text(40, 44, "Forma: pílula é o que se toca, retângulo arredondado é o que contém", 18, B.INK, 600))
    # linha de formas
    y0 = 90
    # botão
    out.append(f'<rect x="40" y="{y0}" width="150" height="40" rx="20" fill="#A4EC86"/>')
    out.append(text(115, y0 + 25, "Novo projeto", 14, B.INK, 500, "middle"))
    out.append(text(115, y0 + 66, "Botão: pílula", 13, B.INK, 600, "middle"))
    out.append(text(115, y0 + 84, "rounded-full", 12, MUTED, 400, "middle"))
    # badge
    out.append(f'<rect x="230" y="{y0 + 8}" width="88" height="24" rx="12" fill="#F2FDF5" stroke="#BBF7D0"/>')
    out.append(text(274, y0 + 25, "Pago", 12, "#166434", 600, "middle"))
    out.append(text(274, y0 + 66, "Badge: pílula", 13, B.INK, 600, "middle"))
    out.append(text(274, y0 + 84, "rounded-full", 12, MUTED, 400, "middle"))
    # campo
    out.append(f'<rect x="360" y="{y0}" width="170" height="40" rx="10" fill="#FFFFFF" stroke="#D1D5DB"/>')
    out.append(text(376, y0 + 25, "Valor do contrato", 14, "#5F6572"))
    out.append(text(445, y0 + 66, "Campo: 10 px", 13, B.INK, 600, "middle"))
    out.append(text(445, y0 + 84, "rounded-md", 12, MUTED, 400, "middle"))
    # cartão
    out.append(f'<rect x="570" y="{y0 - 6}" width="190" height="60" rx="12" fill="#FFFFFF" stroke="#E5E7EB" filter="url(#s1)"/>')
    out.append(text(588, y0 + 14, "Receita do mês", 12, "#5F6572"))
    out.append(text(588, y0 + 40, "R$ 128.400", 20, B.INK, 600))
    out.append(text(665, y0 + 66, "Cartão: 12 px", 13, B.INK, 600, "middle"))
    out.append(text(665, y0 + 84, "rounded-lg", 12, MUTED, 400, "middle"))
    # avatar e ícone do app
    out.append('<circle cx="830" cy="' + str(y0 + 20) + '" r="22" fill="#A4EC86"/>')
    out.append(B.mark_group(B.INK, 0.62, 830 - 27.6 * 0.62 / 2, y0 + 20 - 22.6 * 0.62 / 2, solid=True))
    out.append(text(830, y0 + 66, "Avatar, ícone", 13, B.INK, 600, "middle"))
    out.append(text(830, y0 + 84, "círculo", 12, MUTED, 400, "middle"))
    # sombras
    ys = 260
    out.append(text(40, ys - 20, "Elevação: três sombras, todas em Ink com baixa opacidade", 18, B.INK, 600))
    levels = [
        ("Cartão", "--shadow-card", "filter=\"url(#s1)\"", "Em repouso, sobre Paper 50"),
        ("Elevado", "--shadow-elegant", "filter=\"url(#s2)\"", "Menu, cartão em destaque"),
        ("Sobreposição", "--shadow-popover", "filter=\"url(#s3)\"", "Popover, modal"),
    ]
    for i, (nm, tk, flt, use) in enumerate(levels):
        x = 40 + i * 290
        out.append(f'<rect x="{x}" y="{ys + 14}" width="250" height="90" rx="12" fill="#FFFFFF" stroke="#E5E7EB" {flt.replace(chr(92), "")}/>')
        out.append(text(x + 20, ys + 48, nm, 15, B.INK, 600))
        out.append(text(x + 20, ys + 70, tk, 12, MUTED))
        out.append(text(x + 20, ys + 88, use, 12, MUTED))
    return wrap(1200, 410, "".join(out), "Forma e elevação")


def pattern(dark=False):
    """Colunata: o símbolo repetido como arquitetura. Só decoração, nunca informação."""
    bg = B.INK if dark else PAPER
    line = "#3D3D3D" if dark else "#D9D9D9"
    w, h, pitch = 1200, 360, 60
    out = [f'<rect width="{w}" height="{h}" fill="{bg}"/>']
    out.append(f'<path d="M-10 52H{w + 10}" stroke="{line}" stroke-width="10" stroke-linecap="round"/>')
    out.append(f'<path d="M-10 100H{w + 10}" stroke="{line}" stroke-width="10" stroke-linecap="round" stroke-opacity=".85"/>')
    for i, x in enumerate(range(30, w, pitch)):
        col = B.BRAND if i == 9 else line  # um traço verde, nunca mais
        out.append(f'<path d="M{x} 150V330" stroke="{col}" stroke-width="10" stroke-linecap="round"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="Padrão colunata">{"".join(out)}</svg>\n'


def build_diagrams(measures):
    (B.ROOT / "brand/assets/pattern-colunata.svg").write_text(pattern())
    (B.ROOT / "brand/assets/pattern-colunata-ink.svg").write_text(pattern(True))
    (B.ROOT / "brand/assets/shape-elevation.svg").write_text(shape_elevation())
    (B.ROOT / "brand/assets/typography-scale.svg").write_text(typography_scale())
    files = {
        "diagram-construction.svg": construction(),
        "diagram-clearspace.svg": clearspace(measures),
        "diagram-anatomy.svg": anatomy(),
        "diagram-minsize.svg": minsize(),
        "diagram-backgrounds.svg": backgrounds(),
        "diagram-misuse.svg": misuse(),
    }
    for name, content in files.items():
        (B.OUT / name).write_text(content)
