"""Narração dos vídeos explicativos.

python3 narrate.py <id>     lê src/<id>.script.json, grava narration/<id>/lNN.wav,
                            voice.wav (a faixa inteira) e timing.json (tempos de cada fala)

A voz vem da primeira fonte disponível, nesta ordem:
  1. gravação manual: narration/<id>/manual/lNN.wav (a sua voz, uma fala por arquivo)
  2. Google Cloud TTS, voz Chirp 3 HD   (variável GOOGLE_TTS_API_KEY; VOICE_GOOGLE muda a voz)
  3. ElevenLabs, multilingual v2         (variáveis ELEVENLABS_API_KEY e ELEVENLABS_VOICE_ID)
  4. Kokoro local, só como voz-guia      (KOKORO_DIR com kokoro-v1.0.onnx e voices-v1.0.bin)
VOICE_PROVIDER=manual|google|elevenlabs|kokoro força uma delas.

Toda fala passa pelo mesmo tratamento (corte de silêncio, filtro de graves, presença,
compressão leve), então trocar a fonte não muda o resto do vídeo: a composição lê timing.json.
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
SR = 44100


def http_json(url, body, headers):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"content-type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def tts_google(text):
    key = os.environ["GOOGLE_TTS_API_KEY"]
    voice = os.environ.get("VOICE_GOOGLE", "pt-BR-Chirp3-HD-Charon")
    out = http_json(
        f"https://texttospeech.googleapis.com/v1/text:synthesize?key={key}",
        {"input": {"text": text}, "voice": {"languageCode": "pt-BR", "name": voice},
         "audioConfig": {"audioEncoding": "LINEAR16", "sampleRateHertz": SR}},
        {},
    )
    return base64.b64decode(json.loads(out)["audioContent"]), voice


def tts_elevenlabs(text):
    key = os.environ["ELEVENLABS_API_KEY"]
    voice = os.environ["ELEVENLABS_VOICE_ID"]
    pcm = http_json(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=pcm_44100",
        {"text": text, "model_id": "eleven_multilingual_v2",
         "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.2, "use_speaker_boost": True}},
        {"xi-api-key": key},
    )
    buf = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    with wave.open(buf.name, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm)
    return Path(buf.name).read_bytes(), voice


_kokoro = None


def tts_kokoro(text):
    global _kokoro
    import soundfile as sf
    from kokoro_onnx import Kokoro

    d = Path(os.environ["KOKORO_DIR"])
    voice = os.environ.get("VOICE_KOKORO", "pm_alex")
    if _kokoro is None:
        _kokoro = Kokoro(str(d / "kokoro-v1.0.onnx"), str(d / "voices-v1.0.bin"))
    audio, sr = _kokoro.create(text, voice=voice, speed=1.0, lang="pt-br")
    buf = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    sf.write(buf.name, audio, sr)
    return Path(buf.name).read_bytes(), f"kokoro/{voice}"


def pick_provider(manual_dir):
    forced = os.environ.get("VOICE_PROVIDER")
    if forced:
        return forced
    if manual_dir.exists() and any(manual_dir.glob("*.wav")):
        return "manual"
    if os.environ.get("GOOGLE_TTS_API_KEY"):
        return "google"
    if os.environ.get("ELEVENLABS_API_KEY") and os.environ.get("ELEVENLABS_VOICE_ID"):
        return "elevenlabs"
    if os.environ.get("KOKORO_DIR"):
        return "kokoro"
    sys.exit("Nenhuma voz disponível: grave narration/<id>/manual/lNN.wav ou defina GOOGLE_TTS_API_KEY, ELEVENLABS_API_KEY ou KOKORO_DIR.")


# Tratamento de voz: tira silêncio das pontas, corta grave, abre presença, comprime leve.
VOICE_CHAIN = (
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,"
    "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,"
    "highpass=f=80,equalizer=f=220:t=q:w=1.2:g=-1.5,equalizer=f=3200:t=q:w=1.4:g=2.5,"
    "equalizer=f=9000:t=h:w=1:g=1.5,acompressor=threshold=-21dB:ratio=3:attack=4:release=90:makeup=2,"
    f"aresample={SR}"
)


def process(raw_bytes, out_path):
    with tempfile.NamedTemporaryFile(suffix=".wav") as src:
        src.write(raw_bytes)
        src.flush()
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src.name, "-af", VOICE_CHAIN, "-ac", "1", "-c:a", "pcm_s16le", str(out_path)], check=True)
    with wave.open(str(out_path)) as w:
        return w.getnframes() / w.getframerate()


def main():
    vid = sys.argv[1]
    script = json.loads((HERE / "src" / f"{vid}.script.json").read_text())
    out = HERE / "narration" / vid
    out.mkdir(parents=True, exist_ok=True)
    manual = out / "manual"
    provider = pick_provider(manual)
    fn = {"google": tts_google, "elevenlabs": tts_elevenlabs, "kokoro": tts_kokoro}.get(provider)
    t = script.get("lead", 0.5)
    lines, voice_name = [], provider
    for ln in script["lines"]:
        dst = out / f"{ln['id']}.wav"
        if provider == "manual":
            raw = (manual / f"{ln['id']}.wav").read_bytes()
        else:
            raw, voice_name = fn(ln.get("say", ln["text"]))
        dur = process(raw, dst)
        lines.append({"id": ln["id"], "text": ln["text"], "start": round(t, 3), "dur": round(dur, 3)})
        print(f"{ln['id']} {t:6.2f}s +{dur:.2f}s  {ln['text'][:60]}")
        t += dur + ln.get("gap", 0.4)
    total = round(t + script.get("tail", 2.0), 3)

    # faixa inteira, alinhada
    track = np.zeros(int(total * SR) + SR, dtype=np.float32)
    for ln in lines:
        with wave.open(str(out / f"{ln['id']}.wav")) as w:
            x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768
        i = int(ln["start"] * SR)
        track[i : i + len(x)] += x
    track = track[: int(total * SR)]
    with wave.open(str(out / "voice.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(track, -1, 1) * 32767).astype("<i2").tobytes())
    (out / "timing.json").write_text(json.dumps({"provider": provider, "voice": voice_name, "total": total, "lines": lines}, ensure_ascii=False, indent=1))
    print(f"ok {provider} ({voice_name}), {total:.1f}s")


if __name__ == "__main__":
    main()
