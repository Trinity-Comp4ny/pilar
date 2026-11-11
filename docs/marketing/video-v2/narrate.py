"""Narração dos vídeos explicativos.

python3 narrate.py <id>     lê src/<id>.script.json, grava narration/<id>/lNN.wav,
                            voice.wav (a faixa inteira) e timing.json (tempos de cada fala)

A voz vem da primeira fonte disponível, nesta ordem:
  1. gravação manual: narration/<id>/manual/lNN.wav (a sua voz, uma fala por arquivo)
  2. Gemini TTS, cota grátis do AI Studio, sem cartão (GEMINI_API_KEY; VOICE_GEMINI muda a voz)
  3. Google Cloud TTS, voz Chirp 3 HD   (GOOGLE_TTS_API_KEY; 1 milhão de caracteres grátis/mês)
  4. ElevenLabs, multilingual v2         (ELEVENLABS_API_KEY e ELEVENLABS_VOICE_ID; uso comercial
                                         pede plano pago; liberar api.elevenlabs.io na rede)
  5. Kokoro local, só como voz-guia      (KOKORO_DIR com kokoro-v1.0.onnx e voices-v1.0.bin)
VOICE_PROVIDER=manual|gemini|google|elevenlabs|kokoro força uma delas.

A cota grátis do Gemini é pequena (poucas requisições por dia): cada fala gerada fica em cache
(narration/<id>/cache/), e só as falas cujo texto mudou voltam a ser pedidas.

Toda fala passa pelo mesmo tratamento (corte de silêncio, filtro de graves, presença,
compressão leve), então trocar a fonte não muda o resto do vídeo: a composição lê timing.json.
"""
import base64
import hashlib
import json
import os
import re
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


# Direção de voz para o Gemini: o tom de um sócio explicando, não de locutor de anúncio.
GEMINI_STYLE = os.environ.get(
    "GEMINI_STYLE",
    "Leia em português do Brasil, com sotaque neutro, no tom de um sócio de escritório de engenharia "
    "explicando algo a um colega: calma, confiante, próxima, sem empolgação de propaganda. "
    "Pronuncie IA como 'i-á'. Texto:",
)


def pcm_to_wav(pcm, rate):
    buf = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    with wave.open(buf.name, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return Path(buf.name).read_bytes()


def tts_gemini(text):
    key = os.environ["GEMINI_API_KEY"]
    model = os.environ.get("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")
    voice = os.environ.get("VOICE_GEMINI", "Kore")  # feminina
    out = http_json(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        {
            "contents": [{"parts": [{"text": f"{GEMINI_STYLE} {text}"}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
            },
        },
        {"x-goog-api-key": key},
    )
    data = json.loads(out)["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
    return pcm_to_wav(base64.b64decode(data), 24000), f"gemini/{voice}"


def tts_google(text):
    key = os.environ["GOOGLE_TTS_API_KEY"]
    voice = os.environ.get("VOICE_GOOGLE", "pt-BR-Chirp3-HD-Leda")  # feminina, escolhida pelo CEO em 2026-11-11
    out = http_json(
        f"https://texttospeech.googleapis.com/v1/text:synthesize?key={key}",
        {"input": {"text": text}, "voice": {"languageCode": "pt-BR", "name": voice},
         "audioConfig": {"audioEncoding": "LINEAR16", "sampleRateHertz": SR}},
        {},
    )
    return base64.b64decode(json.loads(out)["audioContent"]), voice


def tts_google_full(says):
    """Chirp 3 HD com o roteiro inteiro numa chamada só: a entonação emenda de uma fala para a outra
    (gerar frase a frase soa como leitura). As falas vão separadas por [pause long] e são cortadas
    de volta nos N-1 silêncios mais longos. Devolve uma lista de WAVs, um por fala."""
    import io
    key = os.environ["GOOGLE_TTS_API_KEY"]
    voice = os.environ.get("VOICE_GOOGLE", "pt-BR-Chirp3-HD-Leda")
    out = http_json(
        f"https://texttospeech.googleapis.com/v1/text:synthesize?key={key}",
        {"input": {"markup": " [pause long] ".join(says)}, "voice": {"languageCode": "pt-BR", "name": voice},
         "audioConfig": {"audioEncoding": "LINEAR16", "sampleRateHertz": SR}},
        {},
    )
    with wave.open(io.BytesIO(base64.b64decode(json.loads(out)["audioContent"]))) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2")
    win = int(0.02 * sr)
    rms = np.sqrt(np.mean((x[: len(x) // win * win].astype(np.float32).reshape(-1, win) / 32768) ** 2, axis=1))
    quiet = rms < max(0.004, rms.max() * 0.03)
    runs, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if i > 0 and j < len(quiet):
                runs.append((j - i, i, j))
            i = j
        else:
            i += 1
    # cada fronteira entre falas cai na pausa que melhor combina com a posição esperada (proporcional ao
    # número de letras, contando só o tempo de fala) e com a duração da pausa; programação dinâmica mantém a ordem
    K, cand = len(says) - 1, [(n * 0.02, a * 0.02, b) for n, a, b in sorted(runs, key=lambda r: r[1]) if n * 0.02 >= 0.25]
    if len(cand) < K:
        raise RuntimeError(f"só achei {len(cand)} pausas para {len(says)} falas")
    # posição esperada de cada fronteira: a duração de cada fala gerada sozinha (mesma voz, ritmo quase igual)
    # mais a média das pausas entre falas
    def dur_fala(raw):
        with wave.open(io.BytesIO(raw)) as w2:
            y = np.frombuffer(w2.readframes(w2.getnframes()), dtype="<i2")
        e = np.sqrt(np.mean((y[: len(y) // win * win].astype(np.float32).reshape(-1, win) / 32768) ** 2, axis=1))
        on = np.nonzero(e >= max(0.004, e.max() * 0.03))[0]
        return (on[-1] - on[0] + 1) * 0.02 if len(on) else 0.0
    sozinhas = [dur_fala(tts_google(s_)[0]) for s_ in says]
    pausa = max(0.0, (len(x) / sr - sum(sozinhas)) / K)
    esp = list(np.cumsum(sozinhas)[:-1] + pausa * (np.arange(K) + 0.5))
    st = [t + n / 2 for n, t, _ in cand]
    INF = 1e9
    M = len(cand)
    dp = [[INF] * M for _ in range(K)]
    bk = [[-1] * M for _ in range(K)]
    for k in range(K):
        best, bi = (0.0, -1) if k == 0 else (INF, -1)
        for m in range(M):
            if k and m and dp[k - 1][m - 1] < best:
                best, bi = dp[k - 1][m - 1], m - 1
            if best >= INF:
                continue
            dp[k][m] = best + abs(st[m] - esp[k]) - 0.8 * min(cand[m][0], 2.0)
            bk[k][m] = bi
    m = min(range(M), key=lambda j: dp[K - 1][j])
    esc = []
    for k in range(K - 1, -1, -1):
        esc.append(m)
        m = bk[k][m]
    cuts = sorted(int((cand[j][1] + cand[j][0] / 2) * sr) for j in esc)
    edges = [0] + cuts + [len(x)]
    wavs = []
    for a, b in zip(edges, edges[1:]):
        # tira o silêncio das pontas (a pausa entre falas é do roteiro, campo "gap"), com 80 ms de folga
        fa, fb = a // win, min(b // win, len(quiet))
        while fa < fb and quiet[fa]:
            fa += 1
        while fb > fa and quiet[fb - 1]:
            fb -= 1
        a, b = max(a, fa * win - int(0.08 * sr)), min(b, fb * win + int(0.08 * sr))
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(x[a:b].tobytes())
        wavs.append(buf.getvalue())
    return wavs, voice


def tts_elevenlabs(text, prev="", nxt=""):
    """ElevenLabs. prev/next dão o contexto da fala vizinha: a entonação emenda entre as frases."""
    key = os.environ["ELEVENLABS_API_KEY"]
    voice = os.environ["ELEVENLABS_VOICE_ID"]
    model = os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2")
    body = {
        "text": text,
        "model_id": model,
        "voice_settings": {
            "stability": float(os.environ.get("ELEVENLABS_STABILITY", "0.45")),
            "similarity_boost": 0.8,
            "style": float(os.environ.get("ELEVENLABS_STYLE", "0.15")),
            "use_speaker_boost": True,
            "speed": float(os.environ.get("ELEVENLABS_SPEED", "1.0")),
        },
        "previous_text": prev,
        "next_text": nxt,
    }
    if "v2_5" in model or "flash" in model or "turbo" in model or "v3" in model:
        body["language_code"] = "pt"
    pcm = http_json(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=pcm_44100", body, {"xi-api-key": key})
    return pcm_to_wav(pcm, SR), f"elevenlabs/{voice}"


_kokoro = None

# Correções de pronúncia para o fonetizador local (espeak), que é treinado com sons do inglês:
#   "IA" sai emendado como "iá" numa sílaba só  -> as duas letras, cada uma com acento
#   "a" final átono sai como o "a" de "cat" (æ) -> [ɐ], como se fala no Brasil
#   "e" final átono sai como "ü" (y) ou some (j) -> [i]
def fix_phonemes(ph):
    out = []
    for tok in ph.split(" "):
        m = re.match(r"^(.*?)([.,:;!?]*)$", tok)
        w, punct = m.group(1), m.group(2)
        if w == "ˌiˈa":
            w = "ˈiː ˈaː"
        else:
            w = re.sub(r"æ(s|z)?$", lambda g: "ɐ" + (g.group(1) or ""), w)
            w = re.sub(r"y(s|z)?$", lambda g: "i" + ("s" if g.group(1) else ""), w)
            w = re.sub(r"(?<=[^aeiouɐɛɔʊiɪ̃ˈˌ])j$", "i", w)
        out.append(w + punct)
    return " ".join(out)


def tts_kokoro(text):
    global _kokoro
    import soundfile as sf
    from kokoro_onnx import Kokoro

    d = Path(os.environ["KOKORO_DIR"])
    voice = os.environ.get("VOICE_KOKORO", "pf_dora")  # feminina (pedido do CEO, 2026-11-09)
    speed = float(os.environ.get("KOKORO_SPEED", "1.0"))
    if _kokoro is None:
        _kokoro = Kokoro(str(d / "kokoro-v1.0.onnx"), str(d / "voices-v1.0.bin"))
    ph = fix_phonemes(_kokoro.tokenizer.phonemize(text, "pt-br"))
    audio, sr = _kokoro.create(ph, voice=voice, speed=speed, lang="pt-br", is_phonemes=True)
    buf = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    sf.write(buf.name, audio, sr)
    return Path(buf.name).read_bytes(), f"kokoro/{voice}"


def pick_provider(manual_dir):
    forced = os.environ.get("VOICE_PROVIDER")
    if forced:
        return forced
    if manual_dir.exists() and any(manual_dir.glob("*.wav")):
        return "manual"
    if os.environ.get("GEMINI_API_KEY"):
        return "gemini"
    if os.environ.get("GOOGLE_TTS_API_KEY"):
        return "google"
    if os.environ.get("ELEVENLABS_API_KEY") and os.environ.get("ELEVENLABS_VOICE_ID"):
        return "elevenlabs"
    if os.environ.get("KOKORO_DIR"):
        return "kokoro"
    sys.exit("Nenhuma voz disponível: grave narration/<id>/manual/lNN.wav ou defina GEMINI_API_KEY, GOOGLE_TTS_API_KEY, ELEVENLABS_API_KEY ou KOKORO_DIR.")


# Tratamento de voz: tira silêncio das pontas, corta grave, abre presença, comprime leve.
VOICE_CHAIN = (
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,"
    "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,"
    "highpass=f=80,equalizer=f=220:t=q:w=1.2:g=-1.5,equalizer=f=3200:t=q:w=1.4:g=2.5,"
    "equalizer=f=9000:t=h:w=1:g=1.5,deesser=i=0.4,acompressor=threshold=-21dB:ratio=3:attack=4:release=90:makeup=2,"
    "aecho=0.9:0.6:18|31:0.07|0.05,"
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
    fn = {"gemini": tts_gemini, "google": tts_google, "elevenlabs": tts_elevenlabs, "kokoro": tts_kokoro}.get(provider)
    cache = out / "cache"
    cache.mkdir(exist_ok=True)
    t = script.get("lead", 0.5)
    lines, voice_name = [], provider
    lines_in = script["lines"]
    ckey = lambda say: hashlib.sha1(f"{provider}|{os.environ.get('VOICE_' + provider.upper(), '')}|{os.environ.get('KOKORO_SPEED', '')}|fon3|{say}".encode()).hexdigest()[:16]
    if provider == "google" and os.environ.get("GOOGLE_PER_LINE") != "1":
        says = [ln.get("say", ln["text"]) for ln in lines_in]
        if not all((cache / f"{ckey('full|' + s)}.wav").exists() for s in says):
            wavs, voice_name = tts_google_full(says)
            for s_, w_ in zip(says, wavs):
                (cache / f"{ckey('full|' + s_)}.wav").write_bytes(w_)
    for idx, ln in enumerate(lines_in):
        dst = out / f"{ln['id']}.wav"
        if provider == "manual":
            raw = (manual / f"{ln['id']}.wav").read_bytes()
        else:
            say = ln.get("say", ln["text"])
            key = ckey(("full|" if provider == "google" and os.environ.get("GOOGLE_PER_LINE") != "1" else "") + say)
            hit = cache / f"{key}.wav"
            if hit.exists():
                raw = hit.read_bytes()
            else:
                if provider == "elevenlabs":
                    prev = lines_in[idx - 1].get("say", lines_in[idx - 1]["text"]) if idx else ""
                    nxt = lines_in[idx + 1].get("say", lines_in[idx + 1]["text"]) if idx + 1 < len(lines_in) else ""
                    raw, voice_name = fn(say, prev, nxt)
                else:
                    raw, voice_name = fn(say)
                hit.write_bytes(raw)
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
