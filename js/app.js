// Astro app: scan, launch card, saved scans. Hash routes: #scan[/mint] #card #saved
import { $, $$, esc, short, ago, pct, copy, config } from './util.js';
import { icon } from './icons.js';
import { mountScanner, recentScans, forget } from './scan.js';
import { mountCard } from './card.js';

const VIEWS = ['scan', 'card', 'saved'];
$$('[data-i]').forEach(el => { el.innerHTML = icon('i-' + el.dataset.i); });
const scanner = mountScanner({ form: $('#scanForm'), input: $('#scanInput'), res: $('#scanRes'), paste: $('#scanPaste'), recent: $('#scanTry') });
mountCard();

function show(v) {
  $$('.view').forEach(el => el.classList.toggle('on', el.dataset.view === v));
  $$('.side a.it[data-v]').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  document.title = `Astro · ${{ scan: 'scan', card: 'launch card', saved: 'saved scans' }[v]}`;
  if (v === 'saved') drawSaved();
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

// saved scans (this browser only)
function drawSaved() {
  const l = recentScans(), root = $('#saved');
  $('#nSaved').textContent = l.length || '';
  if (!l.length) { root.innerHTML = '<div class="empty">No scans yet. Every coin you scan shows up here, in this browser only.<br><a class="btn p sm" href="#scan">Scan a coin</a></div>'; return; }
  root.innerHTML = `<div class="wrapx"><table><thead><tr><th>Coin</th><th>Gate</th><th>Kept out</th><th>Scanned</th><th></th></tr></thead><tbody>${l.map(s => `<tr data-m="${esc(s.mint)}">
    <td><b>${esc(s.name || 'Unnamed')}</b> <span class="mono dim">$${esc(s.symbol || '?')}</span><br><span class="mono dim" style="font-size:12px">${esc(short(s.mint, 6))}</span></td>
    <td>${s.verdict === 'clean' ? '<span class="chip ok">clean</span>' : s.verdict === 'unsure' ? '<span class="chip mute">clean so far</span>' : `<span class="chip no">${s.refused ? s.refused + ' refused' : 'flagged'}</span>`}</td>
    <td>${pct(s.blocked, 1)}</td><td>${ago(Date.now() - s.at)} ago</td>
    <td class="r"><a class="btn g sm" href="#scan/${encodeURIComponent(s.mint)}">Rescan</a> <button class="btn g sm" data-copy type="button">Copy CA</button> <button class="btn g sm" data-del type="button" aria-label="Remove">✕</button></td></tr>`).join('')}</tbody></table></div>`;
  root.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { forget(b.closest('tr').dataset.m); drawSaved(); });
  root.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copy(b.closest('tr').dataset.m, 'Contract address copied'));
}
$('#nSaved').textContent = recentScans().length || '';

config().then(c => {
  if (c && c.ca) { const el = $('#sideCa'); el.innerHTML = `<span class="ca"><b>$ASTRO</b><span>${esc(short(c.ca, 4))}</span><button type="button">COPY</button></span>`; el.querySelector('button').onclick = () => copy(c.ca, 'Contract address copied'); }
});
