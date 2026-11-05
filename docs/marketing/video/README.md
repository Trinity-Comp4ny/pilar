# Pipeline dos vídeos de marketing

Vídeos da Pilar feitos com a UI real (dado fictício "Atrium Engenharia"), gravados com Playwright e
montados em HyperFrames. Roteiros e estado: [../04-roteiros-de-video.md](../04-roteiros-de-video.md).

| Arquivo | O que é |
|---|---|
| `seed/01..05-*.sql` | empresa fictícia de vídeo (login `video@local.test` / `123456`), só no Supabase LOCAL |
| `rec.cjs` | grava os takes (screencast CDP em 2x, cursor desenhado) em `takes/` |
| `recon.cjs` | prints rápidos das telas para conferir o seed |
| `cuts.mjs` | roteiro de cada corte: cenas, narração, enquadramento (focus em px da tela 1440x900) |
| `build.mjs` | gera um projeto HyperFrames por corte em `cuts/<id>/`: narração edge-tts, trilha, mix e `index.html` |
| `music.py` | trilha original (pad + arpejo), sem licença de terceiros |
| `takes/` | takes já gravados (reaproveitáveis) |
| `renders/` | vídeos prontos e legendas `.srt` |
| `prints/` | prints do seed e snapshots de revisão |

## Retomar numa máquina nova

```bash
# 1. ambiente local com Supabase (Docker) e o app
npm ci && supabase start && supabase migration up --local
for f in docs/marketing/video/seed/*.sql; do
  docker exec -i -e PGPASSWORD=postgres supabase_db_rizaklgstyfrwgmdsldf psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres < "$f"
done
npx vite --port 8090 --strictPort &

# 2. ferramentas (fora do repo, porque o .npmrc do repo trava pacote recente)
python3 -m venv docs/marketing/video/.venv && docs/marketing/video/.venv/bin/pip install edge-tts
npm install --prefix docs/marketing/video/vendor gsap@3

# 3. (opcional) regravar takes; os de takes/ já servem
cd docs/marketing/video && NODE_PATH=../../../node_modules node rec.cjs

# 4. montar e renderizar (rodar o hyperframes de fora do repo)
node build.mjs all
cd /tmp && for c in v01-pilar-em-90s v03a-agentes v03b-fluxo v03c-clima v03d-diario v03e-numeros; do
  npx -y hyperframes@0.9.16 render "$OLDPWD/cuts/$c" -o "$OLDPWD/renders/$c.mp4" --video-frame-format png --quiet
done
```

Cuidados:

- O alerta de clima depende da previsão REAL do Open-Meteo para Campinas. As tarefas sensíveis do seed ficam em
  `current_date + 2` (concretagem) e `+7` (impermeabilização); se não houver chuva prevista nesses dias, ajustar
  as datas em `seed/04-obras.sql` para um dia chuvoso antes de gravar o take `obra`.
- `cuts/` e `shared/` são gerados (não versionar). `cuts/<id>/index.html` abre no HyperFrames Studio para editar.
- `npx hyperframes check <dir>` deve dar 0 erros; os avisos de "subcomposição" são esperados (cena única por corte).
