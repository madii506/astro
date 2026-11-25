// The gate scan, in the browser: asks /api/scan to replay any Solana launch through Astro's rules, then draws the result.
import { esc, short, pct, dur, ago, identicon, copy, toast, solscan, store, isAddr } from './util.js';
import { icon } from './icons.js';

const STEPS = ['Finding the moment trading opened', 'Reading the first minute, buy by buy', 'Tracing who funded the early wallets', 'Checking what the dev did in the first day', 'Replaying it through the gate'];
const WHY = {
  block0: ['Launch block', 'Bought in the launch block. Astro keeps that block for the launch itself.'],
  bundle: ['Shared funder', 'Funded by the same wallet as an earlier buyer. One funder, one wallet.'],
  devfunded: ['Dev-funded', 'Funded by the dev. The dev already had the launch buy.'],
  repeat: ['Second buy', 'A second buy inside the first minute. One buy each.'],
  cap: ['Over 1%', 'Took more than 1% in one buy. Trimmed to 1%.'],
  devcap: ['Dev over 3%', 'Dev launch buy over 3%. Trimmed to 3%.'],
  devlock: ['Dev sell', 'Dev tokens are locked for 24 hours.'],
  prelaunch: ['Before launch', 'Held tokens before trading opened. On Astro the whole supply starts on the curve.'],
};
export const recentScans = () => store.get('astro:scans', []);
function remember(r) {
  const l = recentScans().filter(x => x.mint !== r.mint);
  l.unshift({ mint: r.mint, name: r.name, symbol: r.symbol, verdict: r.verdict, blocked: r.totals.blockedPct, refused: r.totals.refused, at: Date.now() });
  store.set('astro:scans', l.slice(0, 40));
}
export function forget(mint) { store.set('astro:scans', recentScans().filter(x => x.mint !== mint)); }
export const shareLink = mint => `${location.origin}/?scan=${mint}#scan`;

let current = null;
export async function runScan(mint, res, { onDone, scrollTo } = {}) {
  mint = String(mint || '').trim();
  if (!isAddr(mint)) { res.innerHTML = `<div class="res-err">That doesn't look like a Solana contract address. It should be 32 to 44 letters and numbers, like the one on the coin's page.</div>`; return; }
  if (current) current.abort();
  const ctl = new AbortController(); current = ctl;
  res.innerHTML = `<div class="res-load" aria-live="polite"><ol>${STEPS.map(s => `<li><i></i>${s}</li>`).join('')}</ol></div>`;
  if (scrollTo) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const lis = [...res.querySelectorAll('li')]; let k = 0;
  const tick = () => { lis.forEach((li, i) => { li.className = i < k ? 'ok' : i === k ? 'on' : ''; }); };
  tick(); const timer = setInterval(() => { if (k < lis.length - 1) { k++; tick(); } }, 1700);
  let r;
  try {
    const t = setTimeout(() => ctl.abort(), 65000);
    const resp = await fetch(`/api/scan?mint=${encodeURIComponent(mint)}`, { signal: ctl.signal });
    clearTimeout(t); r = await resp.json();
  } catch (e) {
    clearInterval(timer); if (ctl !== current) return;
    res.innerHTML = `<div class="res-err">${e.name === 'AbortError' ? 'The scan took too long. Solana can be slow for busy coins: try again in a moment.' : 'Could not reach the scanner. Check your connection and try again.'}</div>`; return;
  }
  clearInterval(timer); if (ctl !== current) return;
  if (!r || !r.ok) { res.innerHTML = `<div class="res-err">${esc((r && r.error) || 'The scan failed. Try again in a moment.')}</div>`; return; }
  lis.forEach(li => (li.className = 'ok'));
  await new Promise(z => setTimeout(z, 260));
  remember(r); render(r, res); onDone && onDone(r);
}

function render(r, res) {
  const T = r.totals, D = r.dev, rules = r.rules, clean = r.verdict === 'clean', unsure = r.verdict === 'unsure';   // unsure: nothing to stop, but not every first-minute transaction was read
  const name = esc(r.name || 'Unnamed coin'), sym = esc(r.symbol || '???');
  const flagged = new Map();
  for (const x of r.timeline) if (x.action !== 'pass' && x.side === 'buy' && x.owner !== r.creator) { const f = flagged.get(x.owner) || { owner: x.owner, why: x.why, action: x.action, pct: 0, t: x.t, slot: x.slot }; f.pct += x.pct; flagged.set(x.owner, f); }
  const fl = [...(rules.prelaunch || []).map(w => ({ owner: w.owner, why: 'prelaunch', action: 'refuse', pct: w.pct, t: 0, slot: -1 })), ...[...flagged.values()].sort((a, b) => a.slot - b.slot || a.t - b.t)];
  const devLine = D.overCap ? `Held ${pct(D.launchPct)} when trading opened. Astro caps the dev at 3%.` : `Held ${pct(D.launchPct)} when trading opened, under the 3% cap.`;
  const moveLine = D.moves.length ? `Sold or moved ${pct(D.movedPct)} in the first day, first at ${dur(D.moves[0].t)}.` : 'No sells or transfers in the first day.';
  const R = (cls, ic, t, d, v) => `<div class="rrow ${cls}"><span class="ic">${ic}</span><div><div class="t">${t}</div><div class="d">${d}</div></div><span class="v">${v}</span></div>`;
  const b0 = rules.block0.length, pre = (rules.prelaunch || []).length, rep = rules.repeat.length, ov = rules.over.length, cl = rules.clusters.filter(c => c.kind !== 'payer' || c.wallets.length > 1);
  const bundled = r.timeline.filter(x => x.why === 'bundle' || x.why === 'devfunded').length;
  res.innerHTML = `<div class="res-card">
    <div class="res-top">
      <div class="res-img"></div>
      <div style="min-width:0"><div class="res-name">${name} <small>$${sym}</small></div>
        <div class="res-sub"><a href="${solscan('token', r.mint)}" target="_blank" rel="noopener">${short(r.mint, 5)} ↗</a><span>launched ${r.launch.time ? ago(Date.now() - r.launch.time * 1000) + ' ago' : 'at an unknown time'}</span><span>${esc(r.venue || 'Solana')}${r.venue === 'pump.fun' ? (r.graduated ? ' · graduated' : ' · on the curve') : ''}</span>${r.creator ? `<a href="${solscan('account', r.creator)}" target="_blank" rel="noopener">dev ${short(r.creator)} ↗</a>` : ''}</div></div>
      <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn g sm" data-a="link">Copy link</button><a class="btn g sm" data-a="x" target="_blank" rel="noopener">Share on X</a></div>
    </div>
    <div class="verdict ${clean ? 'clean' : unsure ? 'unsure' : ''}">
      <h3>${esc(r.headline)}</h3>
      <div class="big">${unsure ? `<b>${r.read.read}/${r.read.early}</b><span>first-minute transactions read</span>` : `<b>${clean ? '0%' : pct(T.blockedPct, 1)}</b><span>${clean ? 'nothing to keep out' : 'of the supply the gate keeps out'}</span>`}</div>
    </div>
    <div class="res-stats">
      <div><b>${T.refused}</b><span>buys refused</span></div>
      <div><b>${T.trimmed}</b><span>buys trimmed to the cap</span></div>
      <div><b>${T.wallets}</b><span>wallets stopped</span></div>
      <div><b>${pct(D.launchPct, 1)}</b><span>dev held at launch</span></div>
      <div><b>${T.fresh}</b><span>brand-new wallets among the first buyers</span></div>
    </div>
    <div class="res-body">
      <div class="res-left">
        <p class="res-h"><span>The first minute, buy by buy</span><span>${T.buys} buys · ${T.buyers} wallets</span></p>
        <div class="tl"><canvas></canvas></div>
        <div class="tl-key"><span><i style="background:var(--coral)"></i>refused</span><span><i style="background:var(--amber)"></i>trimmed</span><span><i style="background:var(--cream)"></i>passed</span><span><i style="background:var(--peach2)"></i>dev</span><span><i style="background:#6b6265"></i>sells</span></div>
        <div class="wl">${fl.length ? `<p class="res-h"><span>Wallets the gate stops</span><span>${fl.length}</span></p><div class="scroll"><table><thead><tr><th>Wallet</th><th>Why</th><th>Bought</th><th>When</th></tr></thead><tbody>
          ${fl.map(f => `<tr><td class="addr"><a href="${solscan('account', f.owner)}" target="_blank" rel="noopener">${short(f.owner, 5)}</a></td><td><span class="chip ${f.action === 'trim' ? 'trim' : 'no'}" title="${esc(WHY[f.why][1])}">${WHY[f.why][0]}</span></td><td>${pct(f.pct)}</td><td>${f.slot === -1 ? 'before' : f.slot === 0 ? 'block 0' : `${f.t}s`}</td></tr>`).join('')}
          </tbody></table></div>` : `<p class="res-h"><span>Wallets the gate stops</span><span>none</span></p><p style="margin:0;font-size:14.5px">${unsure ? 'Every first-minute buyer Astro read would have got in.' : 'Every first-minute buyer would have got in.'}</p>`}</div>
      </div>
      <div class="res-right">
        <p class="res-h"><span>The five rules</span></p>
        <div class="rlist">
          ${R(b0 || pre ? 'bad' : 'good', '1', 'The launch block is for the launch', [pre ? `${pre} wallet${pre > 1 ? 's' : ''} held ${pct(rules.prelaunch.reduce((a, w) => a + w.pct, 0))} before trading opened.` : '', b0 ? `${b0} wallet${b0 > 1 ? 's' : ''} bought in the launch block, together ${pct(rules.block0.reduce((a, w) => a + w.pct, 0))} of supply.` : ''].filter(Boolean).join(' ') || 'Nobody but the dev bought in the launch block.', b0 || pre ? `✕ ${b0 + pre}` : '✓')}
          ${R(rep || ov ? (rep ? 'bad' : 'trim') : 'good', '2', 'One buy each, 1% max', rep || ov ? `${rep ? `${rep} wallet${rep > 1 ? 's' : ''} bought twice` : ''}${rep && ov ? ', ' : ''}${ov ? `${ov} buy${ov > 1 ? 's' : ''} over 1%` : ''} in the first minute.` : 'Every wallet bought once, and none took over 1%.', rep || ov ? `✕ ${rep + ov}` : '✓')}
          ${R(bundled ? 'bad' : 'good', '3', 'No common funder', bundled ? `${cl.length} group${cl.length > 1 ? 's' : ''} of wallets shared a funder; ${bundled} of their buys are refused.` : `No shared funders among the first ${Math.min(T.buyers, 22)} buyers we traced.`, bundled ? `✕ ${bundled}` : '✓')}
          ${R(D.overCap ? 'trim' : 'good', '4', 'Dev buy capped at 3%', devLine, D.overCap ? pct(D.launchPct, 1) : '✓')}
          ${R(D.moves.length ? 'bad' : 'good', '5', 'Dev locked for 24 hours', moveLine, D.moves.length ? '✕' : '✓')}
        </div>
        ${cl.length ? `<p class="res-h" style="margin-top:24px"><span>Who funded whom</span></p><div class="clusters">${cl.map(c => `<div class="cluster"><div class="ct"><span>${c.kind === 'dev' ? 'Funded by the dev' : c.kind === 'payer' ? 'One wallet paid for these buys' : 'One wallet funded these buyers'}</span><span>${c.wallets.length} wallets · ${pct(c.pct)}</span></div>
          <div class="cd">${c.kind === 'payer' ? 'signer' : 'funder'} <a href="${solscan('account', c.via)}" target="_blank" rel="noopener">${short(c.via, 6)}</a></div>${graph(c)}</div>`).join('')}</div>` : ''}
      </div>
    </div>
    <div class="res-foot"><span>Read ${r.read.read} of ${r.read.early} first-minute transactions in ${(r.read.ms / 1000).toFixed(1)}s from Solana${r.read.partial ? (r.read.read < r.read.early ? ' · the rest went unread, so these numbers are a minimum' : ' · Solana was slow, so the funding and dev checks are incomplete') : ''}. Not financial advice.</span>
      <span class="acts"><a class="btn g sm" href="${solscan('tx', r.launch.sig)}" target="_blank" rel="noopener">Launch tx ↗</a></span></div>
  </div>`;
  const img = res.querySelector('.res-img');
  if (r.image) { const im = new Image(); im.alt = ''; im.referrerPolicy = 'no-referrer'; im.onload = () => { img.textContent = ''; img.append(im); }; im.onerror = () => { }; im.src = r.image; }
  img.append(identicon(r.mint, 72));
  res.querySelector('[data-a="link"]').onclick = () => copy(shareLink(r.mint), 'Link copied');
  const verb = clean ? 'passed the Astro gate clean' : unsure ? `showed nothing for the Astro gate to stop in the ${r.read.read} first-minute transactions read` : `would have been stopped at the Astro gate: ${r.headline.replace(/^The gate would have /, '').replace(/\.$/, '')}`;
  res.querySelector('[data-a="x"]').href = `https://x.com/intent/tweet?text=${encodeURIComponent(`I ran $${r.symbol || 'this coin'} through the gate. It ${verb}.\n\n${shareLink(r.mint)}`)}`;
  timeline(res.querySelector('.tl canvas'), r);
}

function graph(c) {
  const n = Math.min(c.wallets.length, 10), w = 300, h = 64, fx = 18, fy = h / 2;
  let s = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><rect x="${fx - 7}" y="${fy - 7}" width="14" height="14" fill="#ff6a58"/>`;
  for (let i = 0; i < n; i++) { const x = 110 + (i % 5) * 38, y = 14 + Math.floor(i / 5) * 36; s += `<path d="M${fx + 7} ${fy} C 70 ${fy}, 70 ${y}, ${x - 5} ${y}" stroke="rgba(255,106,88,.45)" fill="none"/><rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="${c.first === c.wallets[i] ? '#9fe2bf' : '#ffc0a0'}"/>`; }
  if (c.wallets.length > n) s += `<text x="${w - 4}" y="${h - 6}" text-anchor="end" fill="#968b8e" font-size="11" font-family="JBM, monospace">+${c.wallets.length - n}</text>`;
  return s + '</svg>';
}

// a pixel chart of the first minute: block 0 on the left, time across, size up, sells hang below the line
function timeline(cv, r) {
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth || 600, H = cv.clientHeight || 210;
  cv.width = W * dpr; cv.height = H * dpr; const x = cv.getContext('2d'); x.scale(dpr, dpr);
  const L = 54, base = H * 0.66, maxT = 61, X = (e) => (e.slot === 0 ? 26 : L + (Math.min(e.t, maxT) / maxT) * (W - L - 14));
  const col = e => e.side === 'sell' ? '#6b6265' : e.owner === r.creator ? '#ff9c76' : e.action === 'refuse' ? '#ff6a58' : e.action === 'trim' ? '#ffcf86' : '#ffe4d4';
  const sz = e => Math.max(5, Math.min(18, 5 + Math.sqrt(e.pct) * 7));
  const items = r.timeline.map((e, i) => ({ e, i, x: X(e), s: sz(e), c: col(e) }));
  const stack = new Map();
  for (const it of items) { const key = Math.round(it.x / 7); const n = stack.get(key + (it.e.side)) || 0; stack.set(key + (it.e.side), n + 1); it.y = it.e.side === 'buy' ? base - 8 - n * 9 - it.s : base + 8 + n * 9; }
  const t0 = performance.now();
  const draw = now => {
    const k = Math.min(1, (now - t0) / 1100);
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,106,88,.06)'; x.fillRect(8, 8, 36, H - 16);
    x.fillStyle = '#5f575a'; x.font = '500 10px JBM, monospace'; x.fillText('BLOCK 0', 9, H - 12);
    x.fillStyle = 'rgba(255,210,190,.14)'; x.fillRect(L, base, W - L - 10, 1);
    for (const s of [0, 15, 30, 45, 60]) { const px = L + (s / maxT) * (W - L - 14); x.fillStyle = 'rgba(255,210,190,.1)'; x.fillRect(px, base - 3, 1, 6); x.fillStyle = '#5f575a'; x.fillText(`${s}s`, px - 6, H - 12); }
    for (const it of items) {
      const kk = Math.max(0, Math.min(1, k * 1.6 - (it.i / items.length) * 0.6)); if (!kk) continue;
      const drop = (1 - kk) * 26 * (it.e.side === 'buy' ? -1 : 1);
      x.globalAlpha = kk; x.fillStyle = it.c; x.fillRect(Math.round(it.x - it.s / 2), Math.round(it.y + drop), Math.round(it.s), Math.round(it.s));
      if (it.e.action === 'refuse' && it.e.side === 'buy') { x.fillStyle = '#141315'; x.fillRect(Math.round(it.x - 1), Math.round(it.y + drop + 2), 2, Math.max(1, Math.round(it.s - 4))); }
    }
    x.globalAlpha = 1;
    if (k < 1) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}

const CHECKS = [['block', 'Launch block', 'Who bought in the block trading opened, and who held tokens before it.'], ['slice', 'First minute', 'Second buys, and single buys over 1% of the supply.'], ['funder', 'Funders', 'Which early wallets got their SOL from the same place.'], ['cap', 'Dev buy', 'How much the creator took at launch.'], ['lock', "Dev's first day", "Every sell or transfer out of the creator's wallet."]];
export function emptyState(res) {
  res.innerHTML = `<div class="res-empty"><div class="re-grid">${CHECKS.map(([i, t, d]) => `<div class="re-item"><div class="ico">${icon(i)}</div><b>${t}</b><span>${d}</span></div>`).join('')}</div>
    <p>Everything is read live from Solana when you scan. Nothing is stored except your own list of scans, in this browser.</p></div>`;
}

// wire a form + input + result box together; deep links (?scan=) run on load
export function mountScanner({ form, input, res, paste, recent, live }) {
  if (!res.children.length) emptyState(res);
  form.addEventListener('submit', e => { e.preventDefault(); runScan(input.value, res, { onDone: showRecent }); });
  if (paste) paste.onclick = async () => { try { const t = (await navigator.clipboard.readText()).trim(); if (t) { input.value = t; runScan(t, res, { onDone: showRecent }); } } catch { input.focus(); toast('Paste with Ctrl/⌘ + V'); } };
  function showRecent() {
    if (!recent) return;
    const mine = recentScans().slice(0, 3), fresh = live ? live.list('all').filter(c => Date.now() - c.t > 30000).slice(0, 3) : [];
    const btn = (m, label) => `<button type="button" data-m="${esc(m)}">${label}</button>`;
    const parts = [];
    if (fresh.length) parts.push(`<span>Just launched:</span>${fresh.map(c => btn(c.mint, `$${esc(c.symbol)}`)).join('')}`);
    if (mine.length) parts.push(`<span>Your scans:</span>${mine.map(s => btn(s.mint, `$${esc(s.symbol || short(s.mint))}`)).join('')}`);
    recent.innerHTML = parts.join('<span style="width:12px"></span>');
    recent.querySelectorAll('button').forEach(b => (b.onclick = () => { input.value = b.dataset.m; runScan(b.dataset.m, res, { onDone: showRecent }); }));
  }
  showRecent();
  if (live) { let t = 0; live.addEventListener('coin', () => { if (Date.now() - t > 15000) { t = Date.now(); setTimeout(showRecent, 31000); } }); }
  return { run: (m, o) => { input.value = m; return runScan(m, res, { onDone: showRecent, ...o }); }, showRecent };
}
