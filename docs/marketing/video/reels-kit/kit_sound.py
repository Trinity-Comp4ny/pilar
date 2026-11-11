# Trilha genérica dos Reels: base (pad + baixo + bumbo) e efeitos a partir de cues.json {dur, cues:[{t,type}]}.
# Uso: python3 -I kit_sound.py cues.json saida.wav [bpm] [extra_cues.json ...]
import json, sys, wave
import numpy as np

SR = 48000
d = json.load(open(sys.argv[1])); out = sys.argv[2]; BPM = float(sys.argv[3]) if len(sys.argv) > 3 else 100
cues = list(d['cues'])
for extra in sys.argv[4:]: cues += json.load(open(extra))
DUR = d['dur']; N = int(DUR * SR); tt = np.arange(N) / SR
rng = np.random.default_rng(11)
L = np.zeros(N); R = np.zeros(N)

def filt(x, hi=None, lo=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); g = np.ones_like(f)
    if hi: g *= 1 / np.sqrt(1 + (f / hi) ** 4)
    if lo: g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** 4)
    return np.fft.irfft(X * g, len(x))
def add(s, t0, g=1.0, pan=0.0):
    i0 = int(max(0, t0) * SR)
    if i0 >= N: return
    s = s[: N - i0]; L[i0:i0 + len(s)] += s * g * np.sqrt(0.5 * (1 - pan)); R[i0:i0 + len(s)] += s * g * np.sqrt(0.5 * (1 + pan))
def tone(f, dur, dec, harm=(1, 0.4, 0.15)):
    n = int(dur * SR); t = np.arange(n) / SR
    return sum(h * np.sin(2 * np.pi * f * (k + 1) * t) for k, h in enumerate(harm)) * np.minimum(1, t / 0.004) * np.exp(-t / dec)
m2f = lambda m: 440 * 2 ** ((m - 69) / 12)
noise = lambda n: rng.standard_normal(n)

end_t = next((c['t'] for c in cues if c['type'] == 'end'), DUR)
B = 60 / BPM; bar = 4 * B
prog = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]]
pad = np.zeros(N)
for i in range(int(DUR / bar) + 1):
    n = int(bar * 1.05 * SR); t = np.arange(n) / SR; e = np.minimum(1, t / 0.5) * np.clip((bar * 1.05 - t) / 0.4, 0, 1)
    s = sum(np.sin(2 * np.pi * m2f(m) * t) + 0.3 * np.sin(2 * np.pi * m2f(m) * 2.003 * t) for m in prog[i % 4]) * e * 0.045
    i0 = int(i * bar * SR); s = s[: max(0, N - i0)]; pad[i0:i0 + len(s)] += s
pad = filt(pad, hi=1800); L += pad; R += pad
def kick(): n = int(0.3 * SR); t = np.arange(n) / SR; return np.sin(2 * np.pi * np.cumsum(50 + 90 * np.exp(-t * 30)) / SR) * np.exp(-t * 10)
hat = filt(noise(int(0.05 * SR)), lo=7000) * np.exp(-np.arange(int(0.05 * SR)) / SR * 70)
k = 0.0
while k < end_t - 0.1:
    add(kick(), k, 0.28); add(hat, k + B / 2, 0.05, 0.3)
    root = prog[int(k / bar) % 4][0] - 12; add(filt(tone(m2f(root), B, 0.18, (1, 0.6, 0.3)), hi=800), k, 0.14); k += B

SFX = {
  'pop': lambda: tone(rng.uniform(900, 1100), 0.18, 0.05, (1, 0.2)) * 0.9,
  'send': lambda: filt(noise(int(0.25 * SR)), lo=1500, hi=7000) * np.sin(np.pi * np.linspace(0, 1, int(0.25 * SR))) ** 2 * 0.5,
  'tick': lambda: filt(noise(int(0.03 * SR)), lo=2500, hi=8000) * np.exp(-np.arange(int(0.03 * SR)) / SR * 150) * 1.6,
  'hit': lambda: (filt(noise(int(0.9 * SR)), hi=300) * 1.5 + np.sin(2 * np.pi * 55 * np.arange(int(0.9 * SR)) / SR)) * np.exp(-np.arange(int(0.9 * SR)) / SR * 4) * 0.5,
  'whoosh': lambda: filt(noise(int(0.7 * SR)), lo=300, hi=3500) * np.sin(np.pi * np.linspace(0, 1, int(0.7 * SR))) ** 1.5 * 0.5,
  'rain': lambda: filt(noise(int(4.5 * SR)), lo=900, hi=9000) * np.interp(np.arange(int(4.5 * SR)) / SR, [0, 0.8, 3.6, 4.5], [0, 1, 1, 0]) * 0.55,
  'thunder': lambda: filt(noise(int(2.5 * SR)), hi=180) * np.exp(-np.arange(int(2.5 * SR)) / SR * 1.4) * 2.2,
  'pour': lambda: filt(noise(int(1.2 * SR)), lo=80, hi=700) * np.sin(np.pi * np.linspace(0, 1, int(1.2 * SR))) * 0.9,
}
for c in cues:
    ty, t0 = c['type'], c['t']
    if ty == 'ding': add(tone(m2f(79), 0.6, 0.25), t0, 0.10); add(tone(m2f(84), 0.8, 0.35), t0 + 0.09, 0.10)
    elif ty == 'end':
        for i, m in enumerate([72, 76, 79, 84]): add(tone(m2f(m), 2.2, 0.8), t0 + 0.3 + i * 0.12, 0.07, (i - 1.5) * 0.25)
    elif ty in SFX: add(SFX[ty](), t0, 0.12 if ty in ('pop', 'tick') else 0.25, rng.uniform(-0.3, 0.3))
fade = np.interp(tt, [0, 0.05, DUR - 0.6, DUR], [0, 1, 1, 0])
mix = np.stack([L, R], 1) * fade[:, None]; mix = np.tanh(mix / np.max(np.abs(mix)) * 1.5) / np.tanh(1.5) * 0.89
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('ok', out, round(DUR, 2))
