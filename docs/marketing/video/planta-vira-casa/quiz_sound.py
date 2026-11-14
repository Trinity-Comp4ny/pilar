# Trilha do quiz V-21: base leve + tique de pergunta + acerto na resposta + assinatura no fechamento.
import json, sys, wave
import numpy as np

SR = 48000
d = json.load(open(sys.argv[1])); ev = d['ev']; out = sys.argv[2]
DUR = len(d['seq']) / 30; N = int(DUR * SR); tt = np.arange(N) / SR
rng = np.random.default_rng(3)
L = np.zeros(N); R = np.zeros(N)

def lp(x, hi=None, lo=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); g = np.ones_like(f)
    if hi: g *= 1 / np.sqrt(1 + (f / hi) ** 4)
    if lo: g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** 4)
    return np.fft.irfft(X * g, len(x))
def add(s, t0, g=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= N: return
    s = s[: N - i0]; L[i0:i0 + len(s)] += s * g * np.sqrt(0.5 * (1 - pan)); R[i0:i0 + len(s)] += s * g * np.sqrt(0.5 * (1 + pan))
def tone(f, dur, dec, harm=(1, 0.4, 0.15)):
    n = int(dur * SR); t = np.arange(n) / SR
    return sum(h * np.sin(2 * np.pi * f * (k + 1) * t) for k, h in enumerate(harm)) * np.minimum(1, t / 0.004) * np.exp(-t / dec)
m2f = lambda m: 440 * 2 ** ((m - 69) / 12)

# base: pad + baixo + bumbo suave a 96 bpm
B = 60 / 96; bar = 4 * B
prog = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]]
pad = np.zeros(N)
for i in range(int(DUR / bar) + 1):
    n = int(bar * 1.05 * SR); t = np.arange(n) / SR; e = np.minimum(1, t / 0.5) * np.clip((bar * 1.05 - t) / 0.4, 0, 1)
    s = sum(np.sin(2 * np.pi * m2f(m) * t) + 0.3 * np.sin(2 * np.pi * m2f(m) * 2.003 * t) for m in prog[i % 4]) * e * 0.045
    i0 = int(i * bar * SR); s = s[: max(0, N - i0)]; pad[i0:i0 + len(s)] += s
pad = lp(pad, hi=1800); L += pad; R += pad
def kick():
    n = int(0.3 * SR); t = np.arange(n) / SR; return np.sin(2 * np.pi * np.cumsum(50 + 90 * np.exp(-t * 30)) / SR) * np.exp(-t * 10)
k = 0.0
while k < DUR - 0.1:
    add(kick(), k, 0.3); root = prog[int(k / bar) % 4][0] - 12
    add(lp(tone(m2f(root), B, 0.18, (1, 0.6, 0.3)), hi=800), k, 0.16); k += B
# pergunta: tique-taque; resposta: acerto (duas notas)
tick = lp(rng.standard_normal(int(0.03 * SR)), lo=2500, hi=8000) * np.exp(-np.arange(int(0.03 * SR)) / SR * 150)
for t0 in ev['ask']:
    add(lp(rng.standard_normal(int(0.25 * SR)), lo=500, hi=4000) * np.sin(np.pi * np.linspace(0, 1, int(0.25 * SR))), t0 - 0.1, 0.06)
    for j in range(4): add(tick, t0 + 0.15 + j * 0.24, 0.12, 0.4 if j % 2 else -0.4)
for t0 in ev['answer']:
    add(tone(m2f(79), 0.6, 0.25), t0, 0.10); add(tone(m2f(84), 0.8, 0.35), t0 + 0.09, 0.10)
for t0 in ev['play']:
    n = int(0.6 * SR); add(lp(rng.standard_normal(n), lo=300, hi=3000) * np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5, t0, 0.06)
# fechamento
n = int(1.1 * SR); add(lp(rng.standard_normal(n), lo=500, hi=6000) * np.linspace(0.2, 1, n) ** 2, ev['end'], 0.2)
fade = np.interp(tt, [0, 0.02, DUR - 0.25, DUR], [0.6, 1, 1, 0.6])
mix = np.stack([L, R], 1) * fade[:, None]; mix = np.tanh(mix / np.max(np.abs(mix)) * 1.5) / np.tanh(1.5) * 0.89
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('ok', out, round(DUR, 2))
