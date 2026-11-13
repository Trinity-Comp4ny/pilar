"""Prepara uma gravação real (o fundador falando para a câmera) para o motor de vídeo.

python3 footage.py <id>      lê footage/<id>.mp4 (ou .mov) e src/<id>.script.json

1. extrai os quadros (30 fps) para footage/<id>/frames/, que a composição troca a cada quadro;
2. trata a voz (grave, presença, compressão) sem cortar nada, para não perder a sincronia,
   e grava narration/<id>/voice.wav, que o make.sh mistura com a trilha (a trilha abaixa na fala);
3. alinha o roteiro à fala: detecta os trechos com voz (silencedetect) e distribui as falas do
   roteiro por eles, na proporção do tamanho de cada fala. Sai narration/<id>/timing.json, o mesmo
   formato da narração sintética: a legenda palavra a palavra e as telas seguem a sua voz.

Leia o roteiro como está escrito (pode pausar entre as falas). Se improvisar muito, corrija o
texto do roteiro para bater com o que você disse antes de rodar de novo.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
FPS = 30
CHAIN = (
    "highpass=f=80,equalizer=f=220:t=q:w=1.2:g=-1.5,equalizer=f=3200:t=q:w=1.4:g=2.5,"
    "deesser=i=0.4,acompressor=threshold=-22dB:ratio=3:attack=4:release=90:makeup=3,aresample=44100"
)


def run(*a, capture=False):
    return subprocess.run(a, check=True, capture_output=capture, text=True)


def main():
    vid = sys.argv[1]
    src = next((HERE / "footage" / f"{vid}{ext}" for ext in (".mp4", ".mov", ".MOV", ".MP4") if (HERE / "footage" / f"{vid}{ext}").exists()), None)
    if not src:
        sys.exit(f"Grave e salve o vídeo em footage/{vid}.mp4 (vertical, 1080x1920 ou maior).")
    out = HERE / "footage" / vid
    frames = out / "frames"
    frames.mkdir(parents=True, exist_ok=True)
    for f in frames.glob("*.jpg"):
        f.unlink()
    # quadros em 1080 de largura, 30 fps (o enquadramento final é feito na composição)
    run("ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", f"fps={FPS},scale=1080:-2", "-q:v", "3", str(frames / "%05d.jpg"))
    n = len(list(frames.glob("*.jpg")))
    dur = n / FPS
    (out / "info.json").write_text(json.dumps({"frames": n, "duration": dur}))

    nar = HERE / "narration" / vid
    nar.mkdir(parents=True, exist_ok=True)
    run("ffmpeg", "-v", "error", "-y", "-i", str(src), "-vn", "-af", CHAIN, "-ac", "1", "-c:a", "pcm_s16le", str(nar / "voice.wav"))

    # trechos com voz
    log = run("ffmpeg", "-i", str(nar / "voice.wav"), "-af", "silencedetect=noise=-38dB:d=0.35", "-f", "null", "-", capture=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    silences = list(zip(starts, ends + [dur] * (len(starts) - len(ends))))
    speech, cur = [], 0.0
    for a, b in silences:
        if a > cur + 0.05:
            speech.append((cur, a))
        cur = b
    if cur < dur - 0.05:
        speech.append((cur, dur))
    total_speech = sum(b - a for a, b in speech) or dur

    script = json.loads((HERE / "src" / f"{vid}.script.json").read_text())
    lines = script["lines"]
    chars = [len(l["text"]) for l in lines]
    tot = sum(chars)

    def at(frac):
        """posição real (s) de uma fração do tempo de fala"""
        left = frac * total_speech
        for a, b in speech:
            if left <= b - a:
                return a + left
            left -= b - a
        return speech[-1][1] if speech else dur * frac

    acc, timing = 0, []
    for l, c in zip(lines, chars):
        s0, s1 = at(acc / tot), at((acc + c) / tot)
        timing.append({"id": l["id"], "text": l["text"], "start": round(s0, 3), "dur": round(max(0.4, s1 - s0), 3)})
        acc += c
    (nar / "timing.json").write_text(json.dumps({"provider": "gravacao", "voice": "fundador", "total": round(dur + script.get("tail", 3.0), 3), "lines": timing}, ensure_ascii=False, indent=1))
    print(f"ok {vid}: {n} quadros, {dur:.1f}s de vídeo, {len(speech)} trechos de fala, {len(lines)} falas alinhadas")


if __name__ == "__main__":
    main()
