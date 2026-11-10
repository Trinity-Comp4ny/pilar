import fs from 'fs';
const items = fs.readFileSync('quiz_items.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
const seq = []; const ev = { ask: [], answer: [], play: [], end: 0, last: 0 };
const push = (o) => seq.push(o);
for (let f = 0; f <= items[0].frame; f++) push({ src: f, mode: 'hook', u: f / 30 });
items.forEach((it, i) => {
  ev.ask.push(seq.length / 30); ev.answer.push(seq.length / 30 + 1.1);
  for (let k = 0; k < 66; k++) push({ src: it.frame, mode: 'item', i, u: k / 30 });
  const nx = items[i + 1];
  if (nx && nx.frame > it.frame) { ev.play.push(seq.length / 30); for (let f = it.frame; f < nx.frame; f += 2) push({ src: Math.round(f), mode: 'play', i }); }
});
ev.last = seq.length / 30;
const last = items[items.length - 1].frame;
for (let f = last; f <= 306; f++) push({ src: f, mode: 'score', u: (f - last) / 30 });
ev.end = seq.length / 30;
for (let k = 0; k < 84; k++) push({ src: 306, mode: 'end', u: k / 30 });
fs.writeFileSync('quiz_seq.json', JSON.stringify({ items, seq, ev }));
console.log('frames', seq.length, 'dur', (seq.length / 30).toFixed(2), JSON.stringify(ev));
