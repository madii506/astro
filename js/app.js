// Astro app: scan, live gate, clean launches, launch card, saved scans. Hash routes: #scan[/mint] #live #clean #card #saved
import { $, $$, esc, short, ago, pct, identicon, countTo, copy, config } from './util.js';
import { icon } from './icons.js';
import { LiveGate, mountBoard, statusText } from './live.js';
import { mountScanner, recentScans, forget } from './scan.js';
import { mountCard } from './card.js';

const VIEWS = ['scan', 'live', 'clean', 'card', 'saved'];
$$('[data-i]').forEach(el => { el.innerHTML = icon('i-' + el.dataset.i); });
const live = new LiveGate();
const scanner = mountScanner({ form: $('#scanForm'), input: $('#scanInput'), res: $('#scanRes'), paste: $('#scanPaste'), recent: $('#scanTry'), live });
mountBoard(live, $('#board'), { rows: 60, onScan: m => { location.hash = 'scan/' + m; } });
mountCard();
live.connect();

let current = '';
function show(v) {
  current = v;
  $$('.view').forEach(el => el.classList.toggle('on', el.dataset.view === v));
  $$('.side a.it[data-v]').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  document.title = `Astro · ${{ scan: 'scan', live: 'live gate', clean: 'clean launches', card: 'launch card', saved: 'saved scans' }[v]}`;
  if (v === 'saved') drawSaved(); if (v === 'clean') drawClean();
  scrollTo({ top: 0 });
}
function route() {
  const [v, arg] = location.hash.slice(1).split('/');
  const view = VIEWS.includes(v) ? v : 'scan'; show(view);
  if (view === 'scan' && arg) scanner.run(decodeURIComponent(arg));
}
const q = new URLSearchParams(location.search).get('scan');
if (q) history.replaceState(null, '', `/app#scan/${encodeURIComponent(q)}`);
addEventListener('hashchange', route); route();
$$('[data-quick]').forEach(f => f.addEventListener('submit', e => { e.preventDefault(); const v = f.querySelector('input').value.trim(); if (v) { f.querySelector('input').value = ''; location.hash = 'scan/' + v; } }));

// feed status and numbers
const st = () => { const [s, t] = statusText(live); $('#feedDot').className = 'dot' + (s === 'on' ? '' : ' off'); $('#feedTxt').textContent = live.state === 'live' ? 'Live' : t; };
live.addEventListener('status', st); st();
let pend = false;
live.addEventListener('stats', () => {
  if (pend) return; pend = true;
  setTimeout(() => { pend = false; for (const el of $$('#liveStats [data-k]')) countTo(el, live.stats[el.dataset.k] || 0, 600); $('#nLive').textContent = live.stats.seen ? live.stats.seen.toLocaleString('en-US') : ''; }, 250);
});

// clean launches, biggest first
function drawClean() {
  const list = live.list('clean').sort((a, b) => b.mcap - a.mcap).slice(0, 48), root = $('#cleanCards');
  $('#nClean').textContent = list.length || '';
  if (!list.length) {
    root.innerHTML = `<div class="empty" style="grid-column:1/-1">${live.state === 'offline' ? 'The live feed is not answering right now.<br><button class="btn g sm" type="button" data-retry>Retry the feed ↻</button>' : 'No clean launches yet. A new coin counts as clean once it has traded for 20 seconds with nothing flagged.'}</div>`;
    const b = root.querySelector('[data-retry]'); if (b) b.onclick = () => live.reconnect(); return;
  }
  const keep = new Map([...root.querySelectorAll('.ccard')].map(e => [e.dataset.m, e]));
  root.textContent = '';
  for (const c of list) {
    let el = keep.get(c.mint);
    if (!el) {
      el = document.createElement('article'); el.className = 'ccard'; el.dataset.m = c.mint;
      el.innerHTML = `<div class="hd"><span class="ic"></span><div style="min-width:0"><b>${esc(c.name)}</b><span>$${esc(c.symbol)} · ${esc(short(c.mint, 4))}</span></div></div>
        <div class="kv"><div><b class="mc"></b><span>mcap sol</span></div><div><b>${pct(c.devPct, 1)}</b><span>dev buy</span></div><div><b class="ag"></b><span>age</span></div></div>
        <div style="display:flex;gap:8px"><a class="btn p sm" href="#scan/${encodeURIComponent(c.mint)}">Full scan →</a><a class="btn g sm" href="https://solscan.io/token/${encodeURIComponent(c.mint)}" target="_blank" rel="noopener">Solscan ↗</a></div>`;
      el.querySelector('.ic').replaceWith(identicon(c.mint, 42));
    }
    el.querySelector('.mc').textContent = c.mcap ? c.mcap.toFixed(c.mcap < 100 ? 1 : 0) : '—';
    el.querySelector('.ag').textContent = ago(Date.now() - c.t);
    root.append(el);
  }
}
setInterval(() => { if (current === 'clean') drawClean(); else $('#nClean').textContent = live.list('clean').length || ''; }, 2000);

// saved scans (this browser only)
function drawSaved() {
  const l = recentScans(), root = $('#saved');
  $('#nSaved').textContent = l.length || '';
  if (!l.length) { root.innerHTML = '<div class="empty">No scans yet. Every coin you scan shows up here, in this browser only.<br><a class="btn p sm" href="#scan">Scan a coin</a></div>'; return; }
  root.innerHTML = `<div class="wrapx"><table><thead><tr><th>Coin</th><th>Gate</th><th>Kept out</th><th>Scanned</th><th></th></tr></thead><tbody>${l.map(s => `<tr data-m="${esc(s.mint)}">
    <td><b>${esc(s.name || 'Unnamed')}</b> <span class="mono dim">$${esc(s.symbol || '?')}</span><br><span class="mono dim" style="font-size:12px">${esc(short(s.mint, 6))}</span></td>
    <td>${s.verdict === 'clean' ? '<span class="chip ok">clean</span>' : `<span class="chip no">${s.refused} refused</span>`}</td>
    <td>${pct(s.blocked, 1)}</td><td>${ago(Date.now() - s.at)} ago</td>
    <td class="r"><a class="btn g sm" href="#scan/${encodeURIComponent(s.mint)}">Rescan</a> <button class="btn g sm" data-copy type="button">Copy CA</button> <button class="btn g sm" data-del type="button" aria-label="Remove">✕</button></td></tr>`).join('')}</tbody></table></div>`;
  root.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { forget(b.closest('tr').dataset.m); drawSaved(); });
  root.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copy(b.closest('tr').dataset.m, 'Contract address copied'));
}
$('#nSaved').textContent = recentScans().length || '';

config().then(c => {
  if (c && c.ca) { const el = $('#sideCa'); el.innerHTML = `<span class="ca"><b>$ASTRO</b><span>${esc(short(c.ca, 4))}</span><button type="button">COPY</button></span>`; el.querySelector('button').onclick = () => copy(c.ca, 'Contract address copied'); }
});
