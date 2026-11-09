"""Trilha original e desenho de som dos vídeos da Pilar (sem licença de terceiros).

python3 audio.py renders/<id>.cues.json renders/<id>.wav

A trilha segue o mapa de seções do vídeo (SECTIONS, em segundos); os efeitos seguem
os cues que a composição registrou (texto entrando, contador, clique, desenho do símbolo).
"""
import json
import sys
import wave

import numpy as np

SR = 44100
BPM = 120.0
BEAT = 60.0 / BPM
rng = np.random.default_rng(20261109)


def secs(n):
    return np.arange(int(n * SR)) / SR


def env(n, a=0.005, d=0.2, curve=4.0):
    t = secs(n)
    e = np.minimum(1.0, t / max(a, 1e-4)) * np.exp(-curve * np.maximum(0, t - a) / max(d, 1e-4))
    return e


def lp_fast(x, cutoff):
    # versão vetorizada (FFT) para sinais longos
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    H = 1 / np.sqrt(1 + (f / cutoff) ** 4)
    return np.fft.irfft(X * H, len(x))


def hp_fast(x, cutoff):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    H = (f / cutoff) ** 2 / np.sqrt(1 + (f / cutoff) ** 4)
    return np.fft.irfft(X * H, len(x))


def bp_sweep(n, f0, f1, q=6.0):
    """Ruído filtrado com centro que varre de f0 a f1 (whoosh/riser)."""
    noise = rng.standard_normal(int(n * SR))
    out = np.zeros_like(noise)
    blk = 512
    for i in range(0, len(noise), blk):
        p = i / len(noise)
        fc = f0 * (f1 / f0) ** p
        seg = noise[max(0, i - blk) : i + blk]
        X = np.fft.rfft(seg)
        f = np.fft.rfftfreq(len(seg), 1 / SR)
        H = 1 / (1 + ((f - fc) / (fc / q)) ** 2)
        y = np.fft.irfft(X * H, len(seg))
        out[i : i + blk] = y[min(i, blk) : min(i, blk) + blk][: len(out[i : i + blk])]
    return out / (np.abs(out).max() + 1e-9)


def note(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def saw(f, n, detune=0.0):
    t = secs(n)
    out = np.zeros_like(t)
    for d in (-detune, 0, detune):
        ph = (t * f * (1 + d)) % 1.0
        out += 2 * ph - 1
    return out / 3


def sine(f, n, phase=0.0):
    return np.sin(2 * np.pi * f * secs(n) + phase)


def add(buf, x, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= buf.shape[1] or i + len(x) <= 0:
        return
    x = x[: buf.shape[1] - i]
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    buf[0, i : i + len(x)] += x * gain * l * 1.414
    buf[1, i : i + len(x)] += x * gain * r * 1.414


def reverb(x, seconds=2.2, mix=0.25):
    n = int(seconds * SR)
    ir_l = rng.standard_normal(n) * np.exp(-6 * secs(seconds) / seconds)
    ir_r = rng.standard_normal(n) * np.exp(-6 * secs(seconds) / seconds)
    ir_l = lp_fast(ir_l, 6000)
    ir_r = lp_fast(ir_r, 6000)
    L = len(x[0]) + n
    out = np.zeros((2, L))
    for c, ir in enumerate((ir_l, ir_r)):
        X = np.fft.rfft(x[c], L)
        out[c] = np.fft.irfft(X * np.fft.rfft(ir, L), L)
    out /= np.abs(out).max() + 1e-9
    wet = out[:, : x.shape[1]] * np.abs(x).max()
    return x * (1 - mix) + wet * mix * 1.6


# ---------------- instrumentos ----------------

def kick(strong=1.0):
    n = 0.45
    t = secs(n)
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7.5)
    click = rng.standard_normal(len(t)) * np.exp(-t * 300) * 0.25
    return np.tanh((body + click) * 1.6 * strong)


def clap():
    n = 0.35
    t = secs(n)
    x = rng.standard_normal(len(t))
    e = np.zeros_like(t)
    for k, off in enumerate((0, 0.011, 0.022)):
        e += np.exp(-np.maximum(0, t - off) * (90 if k < 2 else 18)) * (t >= off)
    return hp_fast(x * e, 900) * 0.8


def hat(open_=False):
    n = 0.25 if open_ else 0.06
    x = rng.standard_normal(int(n * SR))
    return hp_fast(x, 7000) * env(n, 0.001, n * 0.5, 5)


def pluck(m, n=0.35, bright=3500):
    x = saw(note(m), n, 0.004)
    return lp_fast(x * env(n, 0.003, n, 5), bright)


def bell(m, n=1.8):
    f = note(m)
    x = sine(f, n) + 0.5 * sine(f * 2.76, n) * np.exp(-secs(n) * 3) + 0.25 * sine(f * 5.4, n) * np.exp(-secs(n) * 6)
    return x * env(n, 0.002, n * 0.6, 3.5)


def pad(ms, n, cutoff=1800):
    x = sum(saw(note(m), n, 0.006) for m in ms) / len(ms)
    a = np.minimum(1, secs(n) / 0.6) * np.minimum(1, (n - secs(n)) / 0.5)
    return lp_fast(x, cutoff) * a


def bass(m, n):
    x = saw(note(m), n, 0.0) * 0.6 + sine(note(m), n) * 0.7
    return lp_fast(x * env(n, 0.004, n * 0.9, 2.2), 600)


# progressão em Ré menor: Dm9 · Bbmaj7 · Fmaj7 · C(add9), um acorde por compasso (2 s)
CHORDS = [[50, 57, 60, 64, 65], [46, 53, 57, 60, 62], [41, 53, 57, 60, 64], [48, 55, 60, 62, 67]]
ROOTS = [38, 34, 41, 36]
ARP = [[62, 65, 69, 72], [62, 65, 70, 74], [60, 65, 69, 72], [60, 64, 67, 72]]


def build_music(dur, S):
    mus = np.zeros((2, int((dur + 3) * SR)))
    drums = np.zeros_like(mus)
    padbus = np.zeros_like(mus)
    beats = int(dur / BEAT) + 1

    # ---- gancho e prejuízo: pulso tenso, hats, arpejo filtrado subindo ----
    for b in range(int(S["brand"] / BEAT)):
        t = b * BEAT
        add(drums, kick(0.7), t, 0.55)
        for k in range(4):
            add(drums, hat(), t + k * BEAT / 4, 0.10 if k % 2 else 0.16, pan=0.3)
        if b % 2 == 1:
            add(drums, clap(), t, 0.22)
    for k in range(int(S["brand"] / (BEAT / 4))):
        t = k * BEAT / 4
        bar = int(t / (4 * BEAT)) % 4
        m = ARP[bar][k % 4] - 12
        bright = 900 + 2600 * (t / S["brand"])
        add(mus, pluck(m, 0.22, bright), t, 0.16, pan=-0.35 if k % 2 else 0.35)
    for b in range(int(S["brand"] / (4 * BEAT))):
        add(mus, bass(ROOTS[b % 4], 4 * BEAT), b * 4 * BEAT, 0.35)

    # riser até a marca
    r0 = S["brand"] - 1.6
    rs = bp_sweep(1.6, 300, 6000, 4) * np.linspace(0, 1, int(1.6 * SR)) ** 2
    add(mus, rs, r0, 0.22)

    # ---- marca: impacto, pad e sinos ----
    t0 = S["brand"]
    boom = sine(42, 2.5) * np.exp(-secs(2.5) * 1.6)
    add(mus, np.tanh(boom * 2), t0, 0.7)
    add(drums, kick(1.3), t0, 0.9)
    add(padbus, pad(CHORDS[0], S["flow"] - t0 + 0.6, 2200), t0, 0.32)
    for k, m in enumerate([74, 77, 81, 84, 81]):
        add(mus, bell(m), t0 + 0.35 + k * BEAT / 2, 0.11, pan=(k - 2) * 0.25)

    # ---- módulos: groove completo ----
    g0, g1 = S["flow"], S["grid"]
    nb = int((g1 - g0) / BEAT)
    for b in range(nb):
        t = g0 + b * BEAT
        add(drums, kick(), t, 0.75)
        if b % 2 == 1:
            add(drums, clap(), t, 0.42, pan=0.05)
        add(drums, hat(), t + BEAT / 2, 0.20, pan=0.25)
        add(drums, hat(), t + BEAT / 4, 0.07, pan=-0.25)
        add(drums, hat(), t + 3 * BEAT / 4, 0.07, pan=-0.25)
        if b % 8 == 7:
            add(drums, hat(True), t + BEAT / 2, 0.12)
    for bar in range(int((g1 - g0) / (4 * BEAT)) + 1):
        t = g0 + bar * 4 * BEAT
        c = bar % 4
        add(padbus, pad(CHORDS[c], 4 * BEAT + 0.3, 1500), t, 0.22)
        for k in range(8):
            add(mus, bass(ROOTS[c] + (12 if k in (3, 7) else 0), BEAT / 2 * 0.9), t + k * BEAT / 2, 0.42)
        for k in range(16):
            if k in (0, 3, 6, 8, 10, 13):
                add(mus, pluck(ARP[c][k % 4], 0.28, 3200), t + k * BEAT / 4, 0.14, pan=-0.4 if k % 2 else 0.4)

    # ---- grade: rufo e riser para o fechamento ----
    gr0, end0 = S["grid"], S["end"]
    for b in range(int((end0 - gr0) / BEAT)):
        t = gr0 + b * BEAT
        add(drums, kick(0.9), t, 0.6)
        add(drums, hat(), t + BEAT / 2, 0.18)
    roll_n = int(2 / (BEAT / 4))
    for k in range(roll_n):
        t = end0 - 2 + k * 2 / roll_n
        add(drums, lp_fast(clap(), 5000), t, 0.03 + 0.12 * k / roll_n)
    add(mus, bp_sweep(2.0, 400, 9000, 4) * np.linspace(0, 1, int(2 * SR)) ** 2, end0 - 2, 0.22)
    add(padbus, pad(CHORDS[1], end0 - gr0, 1800), gr0, 0.2)

    # ---- fechamento: impacto suave, acorde aberto e sinos ----
    add(drums, kick(1.2), end0, 0.85)
    add(mus, np.tanh(sine(41, 3) * np.exp(-secs(3) * 1.3) * 2), end0, 0.55)
    add(padbus, pad([41, 53, 57, 60, 64, 67], dur - end0 + 2, 2600), end0, 0.34)
    for k, m in enumerate([72, 76, 79, 84]):
        add(mus, bell(m, 2.5), end0 + 0.4 + k * BEAT, 0.10, pan=(k - 1.5) * 0.3)

    # sidechain no pad e no baixo pelo bumbo
    sc = np.ones(mus.shape[1])
    for b in range(beats):
        t = b * BEAT
        if S["flow"] <= t < S["end"]:
            i = int(t * SR)
            n = int(0.3 * SR)
            sc[i : i + n] = np.minimum(sc[i : i + n], 1 - 0.55 * np.exp(-secs(0.3)[: len(sc[i : i + n])] * 9))
    padbus *= sc
    mus = reverb(mus, 1.8, 0.22) + reverb(padbus, 2.8, 0.35) + drums
    # fade final
    fe = int((dur - 1.2) * SR)
    mus[:, fe : int(dur * SR)] *= np.linspace(1, 0, int(dur * SR) - fe)
    mus[:, int(dur * SR) :] = 0
    return mus


def build_bed(dur, S):
    """Trilha de fundo para vídeo narrado: harmonia e pulso leves, sem disputar com a voz."""
    mus = np.zeros((2, int((dur + 3) * SR)))
    drums = np.zeros_like(mus)
    padbus = np.zeros_like(mus)
    end0 = S.get("end", dur - 4)
    nbar = int(end0 / (4 * BEAT)) + 1
    for bar in range(nbar):
        t = bar * 4 * BEAT
        c = bar % 4
        add(padbus, pad(CHORDS[c], 4 * BEAT + 0.4, 1300), t, 0.24)
        add(mus, bass(ROOTS[c], 4 * BEAT * 0.95), t, 0.28)
        for k in range(8):
            add(mus, pluck(ARP[c][k % 4], 0.3, 2400), t + k * BEAT / 2, 0.075, pan=-0.45 if k % 2 else 0.45)
        if t > 1.0:
            add(drums, kick(0.6), t, 0.32)
            add(drums, kick(0.5), t + 2 * BEAT, 0.22)
            for k in range(8):
                add(drums, hat(), t + k * BEAT / 2 + BEAT / 4, 0.045, pan=0.3)
    for b0 in S.get("brand", []):
        add(mus, bp_sweep(1.2, 300, 5000, 4) * np.linspace(0, 1, int(1.2 * SR)) ** 2, b0 - 1.2, 0.14)
        add(mus, np.tanh(sine(42, 2.2) * np.exp(-secs(2.2) * 1.8) * 2), b0, 0.45)
        for k, m in enumerate([74, 77, 81, 84]):
            add(mus, bell(m), b0 + 0.3 + k * BEAT / 2, 0.07, pan=(k - 1.5) * 0.3)
    add(drums, kick(1.0), end0, 0.5)
    add(padbus, pad([41, 53, 57, 60, 64, 67], dur - end0 + 2, 2400), end0, 0.3)
    for k, m in enumerate([72, 76, 79, 84]):
        add(mus, bell(m, 2.5), end0 + 0.3 + k * BEAT, 0.08, pan=(k - 1.5) * 0.3)
    mus = reverb(mus, 1.8, 0.25) + reverb(padbus, 2.8, 0.35) + drums
    fe = int((dur - 1.5) * SR)
    mus[:, fe : int(dur * SR)] *= np.linspace(1, 0, int(dur * SR) - fe)
    mus[:, int(dur * SR) :] = 0
    return mus


# ---------------- efeitos ----------------

def sfx(cues, dur):
    fx = np.zeros((2, int((dur + 3) * SR)))
    for c in cues:
        k, t = c["kind"], c["t"]
        if k == "text":
            add(fx, bp_sweep(0.22, 2500, 7000, 3) * env(0.22, 0.03, 0.12, 4), t, 0.05)
        elif k in ("whoosh", "lift"):
            n = 0.45
            w = bp_sweep(n, 500, 4500, 3) * np.sin(np.pi * secs(n) / n) ** 2
            add(fx, w, t - 0.08, 0.16 if k == "whoosh" else 0.12, pan=-0.2)
            if k == "lift":
                add(fx, pluck(84, 0.12, 6000), t + 0.3, 0.07)
        elif k == "pop":
            add(fx, sine(900, 0.08) * env(0.08, 0.001, 0.03, 5) + sine(1800, 0.08) * env(0.08, 0.001, 0.02, 5) * 0.3, t, 0.12)
        elif k == "tick":
            add(fx, sine(2400, 0.04) * env(0.04, 0.0005, 0.01, 6), t, 0.12)
        elif k == "count":
            d = c.get("dur", 1.0)
            n = int(d * 22)
            for i in range(n):
                p = i / n
                tt = t + d * (1 - (1 - p) ** 1.8)
                add(fx, sine(2000 + 1200 * p, 0.025) * env(0.025, 0.0005, 0.008, 6), tt, 0.05 * (1 - p * 0.5))
            add(fx, bell(88, 0.6), t + d, 0.05)
        elif k == "type":
            d = c.get("dur", 0.4)
            n = max(1, int(d * 30))
            for i in range(n):
                x = hp_fast(rng.standard_normal(int(0.02 * SR)), 2500) * env(0.02, 0.0005, 0.006, 6)
                add(fx, x, t + i * d / n + rng.uniform(0, 0.008), 0.10, pan=rng.uniform(-0.3, 0.3))
        elif k == "click":
            x = hp_fast(rng.standard_normal(int(0.03 * SR)), 1800) * env(0.03, 0.0005, 0.008, 6)
            add(fx, x, t, 0.35)
            add(fx, sine(1200, 0.05) * env(0.05, 0.001, 0.02, 5), t, 0.08)
            add(fx, bell(84, 0.9) + bell(91, 0.9) * 0.6, t + 0.05, 0.07)
        elif k == "draw":
            n = 0.8
            add(fx, bp_sweep(n, 1500, 9000, 8) * np.sin(np.pi * secs(n) / n), t, 0.06)
        elif k == "chime":
            for i, m in enumerate([79, 83, 86]):
                add(fx, bell(m, 1.2), t + i * 0.12, 0.06, pan=(i - 1) * 0.4)
        elif k == "thud":
            add(fx, np.tanh(sine(55, 0.5) * np.exp(-secs(0.5) * 9) * 2), t, 0.35)
    return fx


def load_track(path, dur):
    """Música de biblioteca (ex.: YouTube Audio Library, Pixabay Music) no lugar da sintetizada."""
    import subprocess

    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-t", str(dur + 3), "-f", "s16le", "-ac", "2", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    x = np.frombuffer(raw, dtype="<i2").astype(np.float64).reshape(-1, 2).T / 32768
    out = np.zeros((2, int((dur + 3) * SR)))
    out[:, : x.shape[1]] = x[:, : out.shape[1]]
    fe = int((dur - 1.5) * SR)
    out[:, fe : int(dur * SR)] *= np.linspace(1, 0, int(dur * SR) - fe)
    out[:, int(dur * SR) :] = 0
    return out / (np.abs(out).max() + 1e-9)


def main():
    meta = json.load(open(sys.argv[1]))
    dur = meta["duration"]
    S = meta.get("sections")
    # music/<nome do vídeo>.mp3 (ou .wav), se existir, substitui a trilha sintetizada
    from pathlib import Path

    name = Path(sys.argv[1]).name.replace(".cues.json", "")
    track = next((p for p in (Path(__file__).parent / "music").glob(f"{name}.*") if p.suffix in (".mp3", ".wav", ".m4a")), None)
    if track:
        mus = load_track(track, dur)
        print("trilha:", track.name)
    else:
        mus = build_bed(dur, S) if S.get("style") == "bed" else build_music(dur, S)
    fx = sfx(meta["cues"], dur)
    if S.get("voice"):
        fx *= 0.6  # com narração, os efeitos ficam por baixo
    L = int(dur * SR)
    mix = mus[:, :L] * 0.8 + fx[:, :L]
    mix = np.tanh(mix * 1.1) * 0.9
    mix /= np.abs(mix).max() + 1e-9
    mix *= 0.89
    data = (mix.T * 32767).astype("<i2")
    with wave.open(sys.argv[2], "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print("ok", sys.argv[2], f"{dur:.1f}s")


if __name__ == "__main__":
    main()
