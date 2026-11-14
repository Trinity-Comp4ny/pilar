"""Confere a conexão com o ElevenLabs e lista as vozes da conta (gasta 0 crédito).

python3 check_elevenlabs.py
"""
import json
import os
import sys
import urllib.error
import urllib.request

key = os.environ.get("ELEVENLABS_API_KEY")
if not key:
    sys.exit("Falta a variável ELEVENLABS_API_KEY no ambiente.")


def get(path):
    req = urllib.request.Request(f"https://api.elevenlabs.io{path}", headers={"xi-api-key": key})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


try:
    sub = get("/v1/user/subscription")
except urllib.error.HTTPError as e:
    sys.exit(f"A API respondeu {e.code}: {e.read().decode()[:300]}")
except urllib.error.URLError as e:
    sys.exit(f"Sem acesso a api.elevenlabs.io ({e.reason}). Libere o domínio na rede do ambiente.")

print(f"Plano: {sub.get('tier')} · créditos usados {sub.get('character_count')} de {sub.get('character_limit')}")
voices = get("/v1/voices").get("voices", [])
print(f"\n{len(voices)} vozes na conta (use o voice_id em ELEVENLABS_VOICE_ID):\n")
for v in voices:
    lab = v.get("labels") or {}
    print(f"  {v['voice_id']}  {v['name']:<22} {lab.get('gender', ''):<7} {lab.get('accent', '')} {lab.get('language', '')}")
