# Trilha original + efeitos sincronizados com a obra (sem licença de terceiros).
import json, sys, wave
import numpy as np

SR = 48000
DUR = 12.6
N = int(SR * DUR)
rng = np.random.default_rng(7)
ev = json.load(open(sys.argv[1]))
out = sys.argv[2]
L = np.zeros(N); R = np.zeros(N)
tt = np.arange(N) / SR

def spec_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); g = np.ones_like(f)
    if hi: g *= 1 / np.sqrt(1 + (f / hi) ** 4)
    if lo: g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** 4)
    return np.fft.irfft(X * g, len(x))

def add(sig, t0, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= N or i0 + len(sig) <= 0: return
    s = sig[max(0, -i0): max(0, min(len(sig), N - i0))]; i0 = max(0, i0)
    L[i0:i0 + len(s)] += s * gain * np.sqrt(0.5 * (1 - pan)); R[i0:i0 + len(s)] += s * gain * np.sqrt(0.5 * (1 + pan))

def env(n, a, d):
    t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)

def note(freq, dur, a=0.005, d=0.3, harm=(1, 0.5, 0.25), detune=0.0):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(h * np.sin(2 * np.pi * freq * (k + 1) * (1 + detune * k) * t) for k, h in enumerate(harm))
    return s * env(n, a, d)

# ---------------- MÚSICA ----------------
BPM = 104; B = 60 / BPM
def m2f(m): return 440 * 2 ** ((m - 69) / 12)
prog = [(57, [57, 60, 64, 67]), (53, [53, 57, 60, 64]), (48, [48, 52, 55, 59]), (55, [55, 59, 62, 66])]  # Am7 Fmaj7 Cmaj7 G
bar = 4 * B
# pad
pad = np.zeros(N)
for i in range(int(DUR / bar) + 1):
    root, ch = prog[i % 4]; t0 = i * bar; n = int(bar * SR * 1.05)
    t = np.arange(n) / SR; e = np.minimum(1, t / 0.6) * np.minimum(1, (bar * 1.05 - t) / 0.4).clip(0)
    s = sum(np.sin(2 * np.pi * m2f(m) * t) + 0.3 * np.sin(2 * np.pi * m2f(m) * 2.003 * t) for m in ch) * e * 0.05
    i0 = int(t0 * SR); s = s[: max(0, N - i0)]; pad[i0:i0 + len(s)] += s
pad = spec_filter(pad, hi=2200)
padgain = np.interp(tt, [0, 2, 7, 9, 10.2, 12.6], [0.7, 0.8, 1.0, 1.1, 1.0, 0.9])
L += pad * padgain; R += pad * padgain
# baixo pulsante a partir do baldrame
for k in range(int(DUR / (B / 2))):
    t0 = 1.15 + k * B / 2
    if t0 > 10.2: break
    root = prog[int(t0 / bar) % 4][0] - 12
    add(spec_filter(note(m2f(root), B / 2, 0.004, 0.12, (1, 0.6, 0.3, 0.15)), hi=900), t0, 0.22 * min(1, (t0 - 1.0) / 2.5))
# bumbo e chimbal
def kick():
    n = int(0.35 * SR); t = np.arange(n) / SR; f = 50 + 110 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
def hat():
    n = int(0.06 * SR); return spec_filter(rng.standard_normal(n), lo=7000) * np.exp(-np.arange(n) / SR * 60)
k0 = 1.15
for k in range(40):
    t0 = k0 + k * B
    if t0 > 10.15: break
    add(kick(), t0, 0.5 if t0 > 2.7 else 0.32)
    if t0 > 2.7: add(hat(), t0 + B / 2, 0.07, 0.3); add(hat(), t0 + B / 4, 0.04, -0.3)
# subida antes do telhado e impacto
n = int(1.4 * SR); rs = spec_filter(rng.standard_normal(n), lo=800, hi=9000) * np.linspace(0, 1, n) ** 2
add(rs, 5.9, 0.11)
add(spec_filter(rng.standard_normal(int(1.2 * SR)), hi=400) * env(int(1.2 * SR), 0.002, 0.35), 7.3, 0.35)
# acorde final (luzes acendem) e assinatura do fechamento
for m in [60, 64, 67, 71, 74]: add(note(m2f(m + 12), 2.6, 0.01, 0.9, (1, 0.3, 0.12)), 8.95, 0.06)
for i, m in enumerate([72, 76, 79]): add(note(m2f(m), 2.0, 0.005, 0.7, (1, 0.25)), 10.5 + i * 0.12, 0.07, (i - 1) * 0.3)

# ---------------- EFEITOS ----------------
def whoosh(dur, lo, hi):
    n = int(dur * SR); s = rng.standard_normal(n); s = spec_filter(s, lo=lo, hi=hi)
    return s * np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5
add(whoosh(1.3, 300, 3500), 0.95, 0.20, -0.4); add(whoosh(1.0, 250, 2500), 4.1, 0.10, 0.4); add(whoosh(1.1, 200, 2200), 6.2, 0.10, -0.3)
def thud(): n = int(0.4 * SR); t = np.arange(n) / SR; return (np.sin(2 * np.pi * (70 + 60 * np.exp(-t * 25)) * t) + 0.3 * spec_filter(rng.standard_normal(n), hi=600)) * np.exp(-t * 12)
for t0 in ev['baldrame']: add(thud(), t0, 0.30, rng.uniform(-0.5, 0.5))
def ping(f): n = int(0.5 * SR); t = np.arange(n) / SR; return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t)) * np.exp(-t * 14)
for t0 in ev['rebar']: add(ping(rng.uniform(1800, 2600)), t0, 0.035, rng.uniform(-0.7, 0.7))
def pour(dur): n = int(dur * SR); return spec_filter(rng.standard_normal(n), lo=80, hi=700) * np.sin(np.pi * np.linspace(0, 1, n))
for t0 in ev['pour']: add(pour(0.9), t0, 0.22)
def click():
    n = int(0.05 * SR); t = np.arange(n) / SR
    return (spec_filter(rng.standard_normal(n), lo=900, hi=5000) * 0.6 + np.sin(2 * np.pi * rng.uniform(380, 620) * t)) * np.exp(-t * 90)
blocks = sorted(ev['blocks']); clicks = [click() for _ in range(24)]
for i, t0 in enumerate(blocks[::2]): add(clicks[i % 24], t0 + rng.uniform(-0.01, 0.01), 0.03, rng.uniform(-0.8, 0.8))
def knock(): n = int(0.25 * SR); t = np.arange(n) / SR; f = rng.uniform(180, 260); return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.3 * t)) * np.exp(-t * 28)
for t0 in ev['trusses']: add(knock(), t0, 0.16, rng.uniform(-0.6, 0.6))
def tile():
    n = int(0.12 * SR); t = np.arange(n) / SR
    return (spec_filter(rng.standard_normal(n), lo=1500, hi=7000) + 0.6 * np.sin(2 * np.pi * rng.uniform(900, 1400) * t)) * np.exp(-t * 40)
for t0 in ev['tiles']:
    for j in range(3): add(tile(), t0 + j * 0.03, 0.05, rng.uniform(-0.8, 0.8))
def motor(dur): n = int(dur * SR); t = np.arange(n) / SR; s = np.sin(2 * np.pi * 55 * t + 2 * np.sin(2 * np.pi * 7 * t)); return spec_filter(s + 0.4 * rng.standard_normal(n), hi=500) * np.sin(np.pi * np.linspace(0, 1, n))
add(motor(0.9), ev['crane'][0], 0.10, -0.6); add(motor(0.8), ev['crane'][1], 0.08, -0.6); add(motor(1.2), 5.9, 0.06, -0.5)
def rattle(dur): n = int(dur * SR); return spec_filter(rng.standard_normal(n) * (rng.random(n) > 0.995), lo=1200, hi=6000) * np.sin(np.pi * np.linspace(0, 1, n))
add(rattle(0.6), ev['scaffold'][0], 0.6); add(rattle(0.4), ev['scaffold'][1], 0.5)
add(whoosh(0.5, 600, 6000), ev['windows'][0], 0.07, 0.3)
add(whoosh(0.8, 2000, 9000), ev['grass'][0], 0.05)

# ---------------- MIX ----------------
fade = np.interp(tt, [0, 0.05, DUR - 0.6, DUR], [0, 1, 1, 0])
mix = np.stack([L, R], 1) * fade[:, None]
peak = np.max(np.abs(mix)); mix = np.tanh(mix / peak * 1.6) / np.tanh(1.6) * 0.89
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('ok', out)
