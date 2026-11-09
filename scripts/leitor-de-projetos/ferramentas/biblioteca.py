"""Biblioteca de convenções dos projetos brasileiros, para os agentes lerem com contexto.

Cada entrada guarda `fonte`:
  observado  = visto nos arquivos reais da VRZ/caso A (04/11/2026), com exemplo
  norma      = vem de norma ou padrão público (NBR, AIA/NCS), a confirmar em cada escritório
  hipotese   = leitura provável, ainda sem confirmação; o leitor deve marcar "confirme"
O escritório pode sobrescrever qualquer entrada (a biblioteca aprende com a correção do usuário).
"""
import re

# ---------- esquadrias: P/J/M + movimento + material + largura nominal (cm) + variante
CATEGORIA = {  # 1ª letra
    'P': ('porta', 'observado', 'PCM90, PGM80, PCV260'),
    'J': ('janela', 'observado', 'JBV140, JCV150'),
    'M': ('montante/painel fixo', 'observado', 'MFV260 e MFV475; a prancha tem "Tabela montantes fixos" (PROJETO EXECUTIVO.pdf)'),
}
MOVIMENTO = {  # 2ª letra
    'C': ('correr', 'observado', 'PCV260, JCV150'),
    'G': ('giro (abrir)', 'observado', 'PGM80, PGA80A'),
    'B': ('basculante', 'observado', 'JBV140'),
    'P': ('pivotante', 'observado', 'PPA140 (porta pivotante de ACM)'),
    'F': ('fixo', 'hipotese', 'MFV475'),
    'M': ('maxim-ar', 'hipotese', ''),
}
MATERIAL = {  # 3ª letra
    'M': ('madeira', 'observado', 'PCM90, PGM80'),
    'A': ('alumínio', 'observado', 'PGA80A, PPA140'),
    'V': ('vidro (com caixilho de alumínio)', 'observado', 'PCV260, PGV70, JBV140'),
}
SUFIXO_VARIANTE = ('A/B no fim = variação de altura ou ferragem do mesmo tipo (PGA80A 2,53 m x PGA80B 2,45 m)', 'observado')

COD_ESQ = re.compile(r'^([PJM])([CGBPFM])([MAV])(\d{2,3})([A-Z]?)$')
COD_ESQ_FIXO = re.compile(r'^(MF)([MAV])(\d{2,3})([A-Z]?)$')


def decodificar_esquadria(cod):
    """'PCV260' -> dict com categoria, movimento, material, largura nominal (m) e avisos."""
    m = COD_ESQ.match(cod)
    f = COD_ESQ_FIXO.match(cod)
    if f:
        return dict(codigo=cod, categoria='montante fixo', movimento='fixo', material=MATERIAL[f.group(2)][0],
                    largura_nominal_m=int(f.group(3)) / 100, variante=f.group(4) or None, fonte='observado',
                    aviso='MF* tem tabela própria (montantes fixos), separada da de portas e janelas.')
    if not m:
        return dict(codigo=cod, fonte=None, aviso='formato de código não reconhecido: use a legenda da prancha')
    c, mv, mt, n, v = m.groups()
    out = dict(codigo=cod, categoria=CATEGORIA[c][0], movimento=MOVIMENTO[mv][0], material=MATERIAL[mt][0],
               largura_nominal_m=int(n) / 100, variante=v or None,
               fonte='observado' if all(t[1] == 'observado' for t in (CATEGORIA[c], MOVIMENTO[mv], MATERIAL[mt])) else 'hipotese')
    out['aviso'] = ('A largura do código é a NOMINAL. O vão osso vem da tabela: na casa 328, porta de madeira/alumínio ganha '
                    '+8 cm (PGM80 -> 0,88), vidro de correr e janela ficam iguais (PCV260 -> 2,60). Nunca derivar o vão do código.')
    return out


# ---------- siglas de disciplina e fase (nome de arquivo e carimbo)
DISCIPLINA = {
    'ARQ': ('arquitetônico', 'norma'), 'EST': ('estrutural', 'observado'), 'ESCA': ('estrutural (código interno VRZ)', 'hipotese'),
    'ELE': ('elétrico', 'observado'), 'HID': ('hidráulico (água fria/quente)', 'observado'), 'ESG': ('esgoto sanitário', 'observado'),
    'AP': ('águas pluviais', 'observado'), 'CLIM': ('climatização', 'observado'), 'FOTOV': ('fotovoltaico', 'observado'),
    'SPDA': ('proteção contra descargas', 'norma'), 'PCI': ('prevenção e combate a incêndio', 'norma'), 'COM': ('compatibilização', 'norma'),
    'TEL': ('telecom / dados', 'norma'), 'GAS': ('gás', 'norma'), 'LUM': ('luminotécnico', 'norma'),
}
FASE = {'EX': ('executivo', 'observado'), 'PR': ('projeto / pré-executivo', 'observado'), 'EP': ('estudo preliminar', 'norma'),
        'AP': ('anteprojeto', 'norma'), 'LV': ('levantamento', 'norma'), 'AB': ('as built', 'norma')}
PADRAO_ARQUIVO = re.compile(r'^(?P<obra>[A-Z0-9]{2,4})[- ]+(?P<disc>[A-Z]{2,5})[- ]+(?P<fase>[A-Z]{2})[- ]+(?P<folha>[A-Z0-9-]+?)[- ]+R(?P<rev>\d{1,3})', re.I)


def decodificar_arquivo(nome):
    """'328-ESCA-EX-100-R00.pdf' -> obra, disciplina, fase, folha, revisão."""
    m = PADRAO_ARQUIVO.match(re.sub(r'\.[A-Za-z0-9]+$', '', nome).strip())
    if not m:
        return dict(arquivo=nome, aviso='nome fora do padrão; ler disciplina e revisão no carimbo')
    d = m.groupdict()
    return dict(arquivo=nome, obra=d['obra'], disciplina=DISCIPLINA.get(d['disc'].upper(), (d['disc'], 'desconhecida'))[0],
                fase=FASE.get(d['fase'].upper(), (d['fase'], 'desconhecida'))[0], folha=d['folha'], revisao=int(d['rev']))


# ---------- camadas CAD (AIA/NCS, norte-americano) e convenções brasileiras
CAMADAS = {
    'A-AREA-IDEN': ('contorno e nome de ambiente', 'observado'), 'A-ANNO-NOTE': ('notas', 'observado'), 'A-ANNO-IDEN': ('identificação', 'observado'),
    'A-ANNO-DIMS': ('cotas', 'observado'), 'A-DETL': ('detalhes', 'observado'), 'A-WALL': ('paredes', 'norma'), 'A-DOOR': ('portas', 'norma'),
    'A-GLAZ': ('janelas/vidro', 'norma'), 'A-FLOR': ('piso', 'norma'), 'A-CLNG': ('forro', 'norma'), 'A-FURN': ('mobiliário', 'norma'),
    'E-POWR-CNDT': ('eletroduto', 'observado'), 'E-LITE-EQPM': ('luminárias', 'observado'), 'E-LITE': ('iluminação', 'observado'),
    'E-ELEC-FIXT': ('pontos de tomada e interruptor', 'observado'), 'E-ELEC-EQPM': ('quadros e equipamentos elétricos', 'observado'),
    'G-ANNO-TEXT': ('texto geral', 'observado'), 'G-ANNO-TTLB': ('carimbo', 'observado'), 'P-SANR': ('esgoto', 'norma'), 'P-DOMW': ('água', 'norma'),
    'PAREDES': ('paredes (padrão em português)', 'observado'), 'ESQUADRIAS': ('portas e janelas', 'observado'), 'PILAR': ('pilares', 'observado'),
    'LAYOUT': ('mobiliário e layout', 'observado'),
}


def camada_conhecida(nome):
    n = nome.upper()
    for k in sorted(CAMADAS, key=len, reverse=True):
        if n.startswith(k):
            return CAMADAS[k]
    return None


# ---------- nomes de ambiente: grafias reais -> ambiente canônico + classe de uso
AMBIENTES = {
    'sala': ['sala', 'sala de estar', 'estar', 'living', 'sala de tv', 'home theater', 'sala íntima'],
    'jantar': ['sala de jantar', 'jantar', 'copa'],
    'cozinha': ['cozinha', 'estar/ cozinha', 'estar/cozinha', 'área gourmet', 'gourmet', 'churrasqueira'],
    'dormitorio': ['suíte', 'suite', 'quarto', 'dormitório', 'quarto casal', 'suíte máster', 'apartamento'],
    'banheiro': ['banho', 'banheiro', 'bwc', 'wc', 'sala de banho', 'lavabo', 'lavatório', 'toalete', 'sanitário'],
    'servico': ['lavanderia', 'área de serviço', 'despensa', 'depósito', 'dep.', 'casa de máquinas'],
    'circulacao': ['hall', 'circulação', 'corredor', 'escada', 'antecâmara', 'foyer'],
    'closet': ['closet', 'roupeiro', 'vestiário'],
    'externa': ['varanda', 'terraço', 'deck', 'jardim', 'garagem', 'quintal', 'piscina', 'spa', 'pergolado', 'área externa', 'sauna', 'fire pit'],
    'escritorio': ['escritório', 'home office', 'biblioteca'],
    'adega': ['adega'],
}
ABREV = {'lavand.': 'lavanderia', 'dep.': 'depósito', 'circ.': 'circulação', 'bwc': 'banheiro', 'wc': 'banheiro', 's.': 'sala', 'apto.': 'apartamento'}
MOLHADO = {'banheiro', 'servico', 'cozinha', 'externa'}


def ambiente_canonico(nome):
    n = re.sub(r'\s+', ' ', nome.strip().lower())
    n = ABREV.get(n, n)
    for canon, vs in AMBIENTES.items():
        if n in vs or any(n.startswith(v) for v in vs):
            return dict(nome=nome, canonico=canon, molhado=canon in MOLHADO)
    return dict(nome=nome, canonico=None, molhado=None, aviso='ambiente desconhecido: perguntar uma vez e guardar no escritório')


# ---------- blocos elétricos (nome de bloco do Revit/AutoCAD) -> classe
BLOCO_ELETRICO = [
    (re.compile(r'interrup|tecla', re.I), 'interruptor'),
    (re.compile(r'tomada', re.I), 'tomada'),
    (re.compile(r'for[cç]a', re.I), 'ponto de força'),
    (re.compile(r'ponto de luz|lumin[aá]ria|balizador', re.I), 'ponto de luz'),
    (re.compile(r'eletroduto|conduite|wireinconduit', re.I), 'eletroduto'),
]


def classe_bloco_eletrico(nome):
    for rx, c in BLOCO_ELETRICO:
        if rx.search(nome):
            return c
    return None


if __name__ == '__main__':
    for c in ('PCV260', 'PGM80', 'JBV140', 'JCV150', 'PPA140', 'PGA80A', 'PGA80B', 'MFV475', 'PCM90', 'XYZ1'):
        d = decodificar_esquadria(c)
        print(f"{c:7} {d.get('categoria','?'):14} {d.get('movimento','?'):14} {d.get('material','?'):34} nominal={d.get('largura_nominal_m')}  [{d.get('fonte')}]")
    print(decodificar_arquivo('328-ESCA-EX-100-R01.dwg'))
    print(decodificar_arquivo('GWY-EST-PR-CL-F100-CON-R02.ifc'))
    print(decodificar_arquivo('328-AP-EX-01-R00.pdf'))
    for a in ('Estar/ Cozinha', 'Lavand.', 'Banho S02', 'Área gourmet', 'Suíte 03', 'Closet', 'HOME THEATER', 'Sauna'):
        print(a, '->', ambiente_canonico(a))
    print(classe_bloco_eletrico('1.b_2 Tomadas 2P+T_Conjunto 4x2'), classe_bloco_eletrico('x. Módulo de Tecla Interrupor não listavel'), camada_conhecida('E-LITE-EQPM-IDEN'))


def normalizar_codigo_ocr(t):
    """Erros típicos do OCR em código de esquadria: O por 0 e I/l por 1 nos dígitos finais (PCM9O -> PCM90)."""
    m = re.match(r'^([A-Z]{2,4})([0-9OIl]{2,3})([A-Z]?)$', t.strip())
    if not m:
        return t
    dig = m.group(2).replace('O', '0').replace('I', '1').replace('l', '1')
    return f"{m.group(1)}{dig}{m.group(3)}"


# ---------- esquadria com a medida no próprio rótulo: "0,90×2,10", "80x210", "PM-80x210", "80x60/1,90", "260x460/0"
_DIM = re.compile(r'^(?P<cod>[A-Za-z]{1,5}\d{0,3})?\s*[-–:]?\s*(?P<w>\d{1,3}(?:[.,]\d{1,2})?)\s*[xX×]\s*(?P<h>\d{1,3}(?:[.,]\d{1,2})?)(?:\s*/\s*(?P<p>\d{1,3}(?:[.,]\d{1,2})?))?$')


def _num(s):
    return float(s.replace(',', '.'))


def _para_m(v, ambos_ge10):
    """Valores >= 10 num par vêm em centímetros ('80x210'); o resto já está em metros."""
    return v / 100 if ambos_ge10 else v


def parse_dimensao(txt, permitir_invertido=True, preferir_invertido=False):
    """'PM-80x210' -> dict(codigo, largura_m, altura_m, peitoril_m, unidade, invertido) ou None. Rejeita medida implausível para porta/janela."""
    t = txt.strip()
    cands = [(t, False)] + ([(t[::-1], True)] if permitir_invertido else [])
    if preferir_invertido and permitir_invertido:
        cands.reverse()                                            # texto girado: a leitura invertida vem primeiro
    for s, inv in cands:
        m = _DIM.match(s)
        if not m:
            continue
        w, h = _num(m.group('w')), _num(m.group('h'))
        p = _num(m.group('p')) if m.group('p') else None
        cm = w >= 10 and h >= 10                                    # par em cm
        W, H = _para_m(w, cm), _para_m(h, cm)
        P = None if p is None else (p / 100 if cm and p >= 10 else p)
        if 0.35 <= W <= 8.0 and 0.30 <= H <= 6.0 and (P is None or 0 <= P <= 3.0):
            return dict(codigo=m.group('cod'), largura_m=round(W, 3), altura_m=round(H, 3), peitoril_m=None if P is None else round(P, 3),
                        unidade='cm' if cm else 'm', invertido=inv, altura_dupla=H > 3.3)
    return None
