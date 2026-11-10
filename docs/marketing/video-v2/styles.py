"""Estilos de trilha e efeitos extras, para os vídeos não soarem todos iguais.

Cada estilo é escolhido em `finalize(..., { style: "<nome>", ... })` da composição:

  cinematic  drone grave, tambores e impactos ("braam") nos tempos de `hits`, risers antes
  lofi       piano elétrico com trêmulo, bateria arrastada (swing), chiado de vinil, 84 BPM
  clock      tique-taque de relógio, pizzicato em ostinato e pulsos graves, 100 BPM
  quirky     marimba, palmas e baixo saltado, 128 BPM (animado, com humor)
  piano      piano esparso e pad, sem bateria (para conta séria ou narração)
  foley      sem música: só os efeitos e um ar de sala
Opções comuns: `start` (a música só entra nesse segundo) e `end` (acorde final e fade).
Tudo sintetizado aqui, sem licença de terceiros.
"""
import numpy as np

from audio import (SR, add, bell, bp_sweep, env, hat, hp_fast, kick, clap, lp_fast, note, pad, reverb, rng, saw, secs, sine)


def _beats(bpm, t0, t1):
    b = 60.0 / bpm
    n = int(max(0, t1 - t0) / b)
    return b, [t0 + i * b for i in range(n)]


def rhodes(m, n):
    f = note(m)
    t = secs(n)
    x = sine(f, n) + 0.35 * sine(2 * f, n) * np.exp(-t * 3) + 0.12 * sine(3 * f, n) * np.exp(-t * 6)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 5.2 * t)
    return x * env(n, 0.004, n * 0.8, 2.2) * trem


def piano(m, n=2.5):
    f = note(m)
    t = secs(n)
    x = sine(f, n) + 0.5 * sine(2.001 * f, n) * np.exp(-t * 2.5) + 0.25 * sine(3.003 * f, n) * np.exp(-t * 4) + 0.1 * sine(4.01 * f, n) * np.exp(-t * 7)
    hammer = hp_fast(rng.standard_normal(len(t)), 3000) * np.exp(-t * 180) * 0.15
    return (x + hammer) * env(n, 0.002, n * 0.55, 3.2)


def pizz(m, n=0.28):
    f = note(m)
    x = saw(f, n) * 0.5 + sine(f, n)
    return lp_fast(x * env(n, 0.002, n * 0.4, 7), 2200)


def marimba(m, n=0.35):
    f = note(m)
    t = secs(n)
    x = sine(f, n) + 0.4 * sine(4 * f, n) * np.exp(-t * 30) + 0.2 * sine(10 * f, n) * np.exp(-t * 60)
    return x * env(n, 0.001, n * 0.35, 6)


def woodblock(high=True):
    n = 0.08
    f = 1900 if high else 1400
    return (sine(f, n) + 0.4 * sine(f * 2.7, n)) * env(n, 0.0005, 0.02, 6)


def tom(m, n=0.5):
    t = secs(n)
    f = note(m) * (1 + 0.6 * np.exp(-t * 20))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 6) + hp_fast(rng.standard_normal(len(t)), 1500) * np.exp(-t * 60) * 0.15


def braam(m, n=2.2):
    x = sum(saw(note(m + o), n, 0.008) for o in (0, 7, 12, -12)) / 4
    t = secs(n)
    x = lp_fast(x, 900) * np.minimum(1, t / 0.05) * np.exp(-t * 1.1)
    return np.tanh(x * 3)


def crackle(n):
    x = np.zeros(int(n * SR))
    idx = rng.integers(0, len(x), int(n * 40))
    x[idx] = rng.uniform(-1, 1, len(idx))
    return lp_fast(x, 4000) * 0.6 + lp_fast(rng.standard_normal(len(x)), 900) * 0.02


def _finish(mus, dur, fade=1.4):
    fe = int((dur - fade) * SR)
    mus[:, fe : int(dur * SR)] *= np.linspace(1, 0, int(dur * SR) - fe)
    mus[:, int(dur * SR) :] = 0
    return mus


def build_style(style, dur, S):
    mus = np.zeros((2, int((dur + 4) * SR)))
    t0 = S.get("start", 0.0)
    end = S.get("end", dur - 3)

    if style == "cinematic":
        drone = lp_fast(saw(note(26), dur + 2, 0.01) + saw(note(33), dur + 2, 0.01) * 0.6, 300)
        add(mus, drone * np.minimum(1, secs(dur + 2) / 1.5), t0, 0.22)
        b, beats = _beats(100, t0, end)
        for i, t in enumerate(beats):
            if i % 4 in (0, 3):
                add(mus, tom(38 if i % 8 < 4 else 36), t, 0.5, pan=-0.2)
            if i % 2 == 1:
                add(mus, tom(45, 0.3), t + b / 2, 0.25, pan=0.25)
            add(mus, hat(), t + b / 2, 0.04)
        for h in S.get("hits", []):
            add(mus, bp_sweep(1.0, 400, 6000, 4) * np.linspace(0, 1, SR) ** 2, h - 1.0, 0.16)
            add(mus, braam(38), h, 0.5)
            add(mus, kick(1.3), h, 0.6)
        add(mus, braam(41, 3.0), end, 0.45)
        mus = reverb(mus, 2.6, 0.3)

    elif style == "lofi":
        b, beats = _beats(84, t0, end + 4 * 60 / 84)
        chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]
        lo = np.zeros_like(mus)
        for i, t in enumerate(beats):
            bar, k = divmod(i, 4)
            sw = b * 0.08 if k % 2 else 0
            if k == 0:
                for j, m in enumerate(chords[bar % 4]):
                    add(lo, rhodes(m, 4 * b), t + j * 0.012, 0.12)
                add(lo, sine(note(chords[bar % 4][0] - 12), 4 * b) * env(4 * b, 0.01, 3.5 * b, 1.5), t, 0.35)
            if k in (0, 2):
                add(lo, kick(0.7), t + sw, 0.45)
            if k in (1, 3):
                add(lo, lp_fast(clap(), 3500), t + sw, 0.22)
            add(lo, hat(), t + b / 2 + b * 0.12, 0.05)
            add(lo, hat(), t, 0.035)
        add(lo, crackle(dur + 2), t0, 0.25)
        lo = lp_fast(lo[0], 5000), lp_fast(lo[1], 5000)
        mus += np.vstack(lo)
        mus = reverb(mus, 1.6, 0.2)

    elif style == "clock":
        b, beats = _beats(100, t0, end)
        prog = [57, 53, 60, 55]
        for i, t in enumerate(beats):
            add(mus, woodblock(i % 2 == 0), t, 0.18, pan=0.3 if i % 2 else -0.3)
            bar = (i // 4) % 4
            r = prog[bar]
            for k, o in enumerate((0, 7, 12, 7)):
                add(mus, pizz(r + o, 0.22), t + k * b / 4, 0.09 + 0.05 * min(1, i / 32), pan=(k - 1.5) * 0.2)
            if i % 4 == 0:
                add(mus, lp_fast(saw(note(r - 24), 4 * b * 0.9, 0.005), 400) * env(4 * b * 0.9, 0.02, 3 * b, 1.2), t, 0.3)
        for h in S.get("hits", []):
            add(mus, bell(84, 1.5) + bell(88, 1.5) * 0.6, h, 0.12)
        add(mus, pad([57, 64, 69, 72], 3.5, 2200), end, 0.3)
        mus = reverb(mus, 1.8, 0.2)

    elif style == "quirky":
        b, beats = _beats(128, t0, end)
        scale = [60, 62, 64, 67, 69, 72]
        for i, t in enumerate(beats):
            if i % 2 == 0:
                add(mus, kick(0.8), t, 0.45)
            else:
                add(mus, clap(), t, 0.3)
            add(mus, hat(), t + b / 2, 0.06)
            root = [36, 41, 43, 36][(i // 4) % 4]
            add(mus, lp_fast(saw(note(root + (12 if i % 2 else 0)), b * 0.45), 700) * env(b * 0.45, 0.003, b * 0.3, 4), t, 0.4)
            m = scale[(i * 3 + (i // 4)) % len(scale)]
            add(mus, marimba(m + 12), t + (b / 2 if i % 3 == 1 else 0), 0.16, pan=(i % 3 - 1) * 0.4)
        for h in S.get("hits", []):
            for k, m in enumerate([72, 76, 79, 84]):
                add(mus, marimba(m, 0.4), h + k * 0.06, 0.2)
        add(mus, pad([48, 55, 60, 64, 67], 3.0, 2600), end, 0.3)
        mus = reverb(mus, 1.2, 0.15)

    elif style == "piano":
        prog = [[45, 57, 60, 64], [41, 53, 57, 60], [36, 55, 60, 64], [43, 55, 59, 62]]
        b = 60 / 72
        bar = 4 * b
        t = t0
        k = 0
        while t < end + 2:
            ch = prog[k % 4]
            add(mus, piano(ch[0] - 12 if ch[0] > 40 else ch[0], 4.0), t, 0.3, pan=-0.1)
            for j, m in enumerate(ch[1:]):
                add(mus, piano(m, 3.0), t + 0.9 * b * j + (0.4 * b if k % 2 else 0), 0.16, pan=(j - 1) * 0.3)
            add(mus, pad(ch[1:], bar + 0.5, 1200), t, 0.12)
            t += bar
            k += 1
        for h in S.get("hits", []):
            add(mus, piano(81, 3.0) + piano(88, 3.0) * 0.5, h, 0.2)
        mus = reverb(mus, 3.2, 0.4)

    elif style == "foley":
        room = lp_fast(rng.standard_normal(int((dur + 2) * SR)), 400) * 0.02
        add(mus, room, 0, 1.0)

    return _finish(mus, dur)


def sfx_extra(fx, c):
    """Efeitos que só os formatos novos usam. Devolve True se tratou o cue."""
    k, t = c["kind"], c["t"]
    if k == "notif":  # notificação de celular, dois tons
        add(fx, sine(1320, 0.09) * env(0.09, 0.001, 0.05, 5), t, 0.12, pan=c.get("pan", 0.2))
        add(fx, sine(1760, 0.14) * env(0.14, 0.001, 0.08, 5), t + 0.08, 0.1, pan=c.get("pan", 0.2))
    elif k == "msg":  # bolha de mensagem
        add(fx, sine(620, 0.06) * env(0.06, 0.001, 0.02, 6) + sine(1240, 0.04) * env(0.04, 0.001, 0.01, 6) * 0.3, t, 0.14, pan=c.get("pan", -0.2))
    elif k == "error":
        add(fx, lp_fast(saw(110, 0.25) * env(0.25, 0.003, 0.2, 2), 900), t, 0.22)
    elif k == "glitch":
        n = c.get("dur", 0.18)
        x = rng.standard_normal(int(n * SR))
        x = np.repeat(x[::40], 40)[: int(n * SR)]
        add(fx, hp_fast(x, 600) * env(n, 0.001, n * 0.7, 3), t, 0.18)
    elif k == "ding":
        for i, m in enumerate([84, 88, 91]):
            add(fx, bell(m, 1.0), t + i * 0.07, 0.1)
    elif k == "buzz":
        add(fx, lp_fast(saw(80, 0.35, 0.01), 600) * env(0.35, 0.003, 0.3, 2), t, 0.25)
    elif k == "typewriter":
        d = c.get("dur", 0.6)
        n = max(1, int(d * 14))
        for i in range(n):
            x = hp_fast(rng.standard_normal(int(0.03 * SR)), 1200) * env(0.03, 0.0005, 0.01, 6) + sine(180, 0.03) * env(0.03, 0.0005, 0.01, 6) * 0.6
            add(fx, x, t + i * d / n, 0.2)
        add(fx, bell(96, 0.4), t + d, 0.06)
    elif k == "shutter":
        x = hp_fast(rng.standard_normal(int(0.06 * SR)), 2000) * env(0.06, 0.0005, 0.02, 6)
        add(fx, x, t, 0.25)
        add(fx, x * 0.7, t + 0.07, 0.2)
    elif k == "tick-clock":
        add(fx, woodblock(True), t, 0.15)
    elif k == "braam":
        add(fx, braam(38), t, 0.4)
    elif k == "riser":
        d = c.get("dur", 1.2)
        add(fx, bp_sweep(d, 300, 7000, 4) * np.linspace(0, 1, int(d * SR)) ** 2, t, 0.15)
    else:
        return False
    return True
