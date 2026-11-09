# Original music bed for the Pilar videos: slow maj7 pad + soft arpeggio, 16 s loop, mono 48 kHz.
import math, struct, sys, wave
SR = 48000
CHORDS = [[130.81, 164.81, 196.0, 246.94], [110.0, 130.81, 164.81, 196.0], [87.31, 110.0, 130.81, 164.81], [98.0, 123.47, 146.83, 164.81]]
out = sys.argv[1]
n = SR * 16
frames = bytearray()
for i in range(n):
    t = i / SR
    c = CHORDS[int(t // 4) % 4]
    tc = t % 4
    swell = 0.6 + 0.4 * math.sin(math.pi * tc / 4)
    x = sum(0.05 * math.sin(2 * math.pi * f * t) + 0.012 * math.sin(2 * math.pi * f * 2.001 * t) for f in c) * swell
    k = int((t % 2) // 0.5)
    tn = t % 0.5
    x += 0.03 * math.exp(-6 * tn) * math.sin(2 * math.pi * c[k] * 4 * t)
    frames += struct.pack('<h', int(max(-1, min(1, x)) * 32000))
with wave.open(out, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(bytes(frames))
