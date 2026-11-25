// The live gate: listens to every new pump.fun launch through PumpPortal's public websocket and checks each coin, as it
// trades, against the rules you can see from outside the chain. Nothing here is simulated: if the feed is down, it says so.
import { safe, identicon, ago, pct, esc, countTo } from './util.js';

const WS = 'wss://pumpportal.fun/api/data';
const SUPPLY = 1e9;                         // every pump.fun coin has one billion tokens
const WATCH = 180000;                       // follow each new coin's trades for three minutes

export class LiveGate extends EventTarget {
  constructor() {
    super();
    this.coins = new Map(); this.order = []; this.state = 'idle'; this.retry = 0; this.since = Date.now();
    this.stats = { seen: 0, rush: 0, devcap: 0, devsold: 0, flagged: 0 };
  }
  connect() {
    this.state = 'connecting'; this.emit('status');
    let ws; try { ws = new WebSocket(WS); } catch { return this.fail(); }
    this.ws = ws;
    const giveUp = setTimeout(() => { if (ws.readyState !== 1) { try { ws.close(); } catch { /* */ } } }, 9000);
    ws.onopen = () => {
      clearTimeout(giveUp); this.retry = 0; this.state = 'live'; this.emit('status');
      ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
      const open = [...this.coins.values()].filter(c => !c.closed).map(c => c.mint);
      if (open.length) ws.send(JSON.stringify({ method: 'subscribeTokenTrade', keys: open }));
    };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (!m || typeof m !== 'object') return;
      if (m.txType === 'create') this.create(m); else if (m.txType === 'buy' || m.txType === 'sell') this.trade(m);
    };
    ws.onclose = () => { clearTimeout(giveUp); if (this.ws !== ws) return; this.state = this.retry > 5 ? 'offline' : 'reconnecting'; this.emit('status'); this.again(); };
    ws.onerror = () => { };
  }
  fail() { this.state = 'offline'; this.emit('status'); this.again(); }
  again() { clearTimeout(this.rt); if (this.retry > 5) { this.state = 'offline'; this.emit('status'); return; } this.rt = setTimeout(() => this.connect(), Math.min(20000, 1500 * 2 ** this.retry++)); }
  reconnect() { this.retry = 0; clearTimeout(this.rt); const w = this.ws; this.ws = null; try { w && w.close(); } catch { /* */ } this.connect(); }
  create(m) {
    if (typeof m.mint !== 'string' || this.coins.has(m.mint)) return;
    const c = {
      mint: m.mint, name: safe(m.name) || 'Unnamed', symbol: safe(m.symbol) || '???', venue: safe(m.pool) || 'pump', creator: m.traderPublicKey, t: Date.now(),
      devPct: Math.max(0, (Number(m.initialBuy) || 0) / SUPPLY * 100), mcap: Number(m.marketCapSol) || 0, v0: Number(m.vTokensInBondingCurve) || 0,
      buys: 0, sells: 0, first: true, rushPct: 0, unseenPct: 0, rush: false, wallets: new Map(), over: new Set(), repeat: new Set(), devSold: false, devSoldAt: 0, closed: false,
    };
    this.coins.set(c.mint, c); this.order.unshift(c.mint);
    this.stats.seen++; if (c.devPct > 3) { this.stats.devcap++; this.stats.flagged++; }
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ method: 'subscribeTokenTrade', keys: [c.mint] }));
    setTimeout(() => this.close(c.mint), WATCH);
    while (this.order.length > 400) { const k = this.order.pop(); this.coins.delete(k); }
    this.emit('coin', c); this.emit('stats');
  }
  close(mint) {
    const c = this.coins.get(mint); if (c) c.closed = true;
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ method: 'unsubscribeTokenTrade', keys: [mint] }));
    if (c) this.emit('update', c);
  }
  trade(m) {
    const c = this.coins.get(m.mint); if (!c || c.closed) return;
    const dt = Date.now() - c.t, tok = Math.max(0, Number(m.tokenAmount) || 0), p = (tok / SUPPLY) * 100, was = this.flagged(c);
    if (c.first) {                       // tokens that left the curve before our subscription caught up: bought in the first block or two
      c.first = false;
      const v = Number(m.vTokensInBondingCurve) || 0, before = m.txType === 'buy' ? v + tok : v - tok;
      if (c.v0 > 0 && before > 0 && c.v0 - before > SUPPLY * 0.0005) c.unseenPct = ((c.v0 - before) / SUPPLY) * 100;
    }
    c.mcap = Number(m.marketCapSol) || c.mcap;
    if (m.txType === 'buy') {
      c.buys++;
      if (m.traderPublicKey !== c.creator && dt < 60000) {
        const w = c.wallets.get(m.traderPublicKey) || { n: 0, p: 0 }; w.n++; w.p += p; c.wallets.set(m.traderPublicKey, w);
        if (w.n > 1) c.repeat.add(m.traderPublicKey);
        if (p > 1) c.over.add(m.traderPublicKey);
      }
      if (dt < 2500) c.rushPct += p;
    } else {
      c.sells++;
      if (m.traderPublicKey === c.creator && !c.devSold) { c.devSold = true; c.devSoldAt = dt; this.stats.devsold++; }
    }
    const rush = c.unseenPct + c.rushPct >= 1;
    if (rush && !c.rush) { c.rush = true; this.stats.rush++; }
    if (!was && this.flagged(c)) this.stats.flagged++;
    this.emit('update', c); this.emit('stats');
  }
  flagged(c) { return c.devPct > 3 || c.rush || c.over.size > 0 || c.repeat.size > 0 || c.devSold; }
  flags(c) {
    const f = [];
    if (c.devPct > 3) f.push(`dev bought ${pct(c.devPct, 1)} at launch`);
    if (c.rush) f.push(`${pct(c.unseenPct + c.rushPct, 1)} bought in the first seconds`);
    if (c.over.size) f.push(`${c.over.size} wallet${c.over.size > 1 ? 's' : ''} over 1%`);
    if (c.repeat.size) f.push(`${c.repeat.size} bought twice`);
    if (c.devSold) f.push(`dev sold at ${Math.round(c.devSoldAt / 1000)}s`);
    return f;
  }
  verdict(c) { if (this.flagged(c)) return 'flagged'; return Date.now() - c.t < 20000 ? 'watching' : 'clean'; }
  list(filter = 'all') {
    const all = this.order.map(k => this.coins.get(k)).filter(Boolean);
    if (filter === 'all') return all;
    if (filter === 'flagged') return all.filter(c => this.flagged(c));
    return all.filter(c => this.verdict(c) === 'clean');
  }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
}

const STATUS = {
  idle: ['off', 'Starting the feed…'], connecting: ['off', 'Connecting to the live feed…'], live: ['on', 'Live'],
  reconnecting: ['off', 'Reconnecting…'], offline: ['off', 'The live feed is not answering right now.'],
};
export function statusText(g) { return STATUS[g.state] || STATUS.idle; }

// ---------- the tape: an endless queue of real launches ----------
export function mountTape(g, track, dot) {
  let x = 0, last = performance.now(), items = [], idle = true;
  const chip = c => { const v = g.verdict(c); return v === 'flagged' ? '<span class="chip no">flagged</span>' : v === 'clean' ? '<span class="chip ok">clean</span>' : '<span class="chip mute">watching</span>'; };
  const make = c => {
    const el = document.createElement('span'); el.className = 'tape-item'; el.dataset.m = c.mint;
    el.append(identicon(c.mint, 20)); el.insertAdjacentHTML('beforeend', `<span class="sym">$${esc(c.symbol)}</span><span class="dev">dev ${pct(c.devPct, 1)}</span>${chip(c)}`);
    return el;
  };
  const refresh = c => { const el = track.querySelector(`[data-m="${c.mint}"]`); if (el) el.lastElementChild.outerHTML = chip(c); };
  g.addEventListener('coin', e => {
    if (idle) { track.innerHTML = ''; idle = false; }
    const el = make(e.detail); track.append(el); items.push(el);
    while (items.length > 40) { const o = items.shift(); if (track.firstChild === o) { x += o.offsetWidth + 34; } o.remove(); }
  });
  g.addEventListener('update', e => refresh(e.detail));
  g.addEventListener('status', () => {
    const [s, t] = statusText(g); dot.className = 'dot' + (s === 'on' ? '' : ' off');
    if (idle) track.innerHTML = `<span class="tape-empty">${esc(g.state === 'live' ? 'Listening for the next launch…' : t)}</span>`;
  });
  const spd = 42;
  (function run(now) {
    requestAnimationFrame(run);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (idle || document.hidden) return;
    const w = track.scrollWidth, view = track.parentElement.clientWidth;
    if (w + x > view * 0.92) x -= spd * dt;              // keep moving while there is more to show
    const f = track.firstElementChild;
    if (f && x + f.offsetLeft + f.offsetWidth < 0 && items.length > 6) { x += f.offsetWidth + 34; items.shift(); f.remove(); }
    track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
  })(performance.now());
}

// ---------- counters ----------
export function mountCounters(g, root, dot, note) {
  const set = () => { for (const el of root.querySelectorAll('[data-k]')) { if (!g.stats.seen && g.state !== 'live') { el.textContent = '—'; el.dataset.v = 0; } else countTo(el, g.stats[el.dataset.k] || 0, 700); } };
  let pending = false;
  g.addEventListener('stats', () => { if (pending) return; pending = true; setTimeout(() => { pending = false; set(); }, 250); });
  const st = () => {
    const [s, t] = statusText(g); dot.className = 'dot' + (s === 'on' ? '' : ' off');
    note.innerHTML = g.state === 'live' ? 'Live: counting real new launches since you opened this page.'
      : g.state === 'offline' ? `${esc(t)} <button class="retry" type="button">Retry ↻</button>` : esc(t);
    const b = note.querySelector('.retry'); if (b) b.onclick = () => g.reconnect();
  };
  g.addEventListener('status', () => { st(); set(); }); st(); set();
}

// ---------- the board ----------
export function mountBoard(g, root, { rows = 12, onScan } = {}) {
  let filter = 'all';
  root.innerHTML = `
    <div class="board-top"><div class="board-status"><span class="dot off"></span><span class="bs">Connecting…</span></div>
      <div class="tabs" role="tablist"><button class="on" data-f="all" role="tab">All</button><button data-f="flagged" role="tab">Flagged</button><button data-f="clean" role="tab">Clean</button></div></div>
    <div class="brow head"><span></span><span>Coin</span><span class="x0">Dev buy</span><span class="x1">First secs</span><span class="x2">Over 1%</span><span class="x3">Bought twice</span><span class="x4">Gate</span><span></span></div>
    <div class="board-body"></div>
    <div class="board-foot"><span class="bf"></span><span>Watched for 3 minutes after launch · tap a coin for the on-chain scan</span></div>`;
  const body = root.querySelector('.board-body'), bs = root.querySelector('.bs'), dot = root.querySelector('.board-status .dot'), bf = root.querySelector('.bf');
  const verdict = c => { const v = g.verdict(c); if (v === 'flagged') { const n = g.flags(c).length; return `<span class="chip no" title="${esc(g.flags(c).join(' · '))}">flagged ${n}</span>`; } return v === 'clean' ? '<span class="chip ok">clean</span>' : '<span class="chip mute">watching</span>'; };
  const row = c => {
    const el = document.createElement('div'); el.className = 'brow'; el.dataset.m = c.mint;
    el.append(identicon(c.mint, 34));
    el.insertAdjacentHTML('beforeend', `<div class="nm"><b>${esc(c.name)}</b><span>$${esc(c.symbol)} · ${esc(c.venue)} · <i class="age" data-t="${c.t}">${ago(Date.now() - c.t)}</i></span></div>
      <span class="c x0 ${c.devPct > 3 ? 'hot' : ''}">${pct(c.devPct, 1)}</span><span class="c x1"></span><span class="c x2"></span><span class="c x3"></span><span class="x4"></span>
      <button class="btn g sm go" type="button">Scan <span class="ar">→</span></button>`);
    fill(el, c); el.querySelector('.go').onclick = () => onScan && onScan(c.mint); return el;
  };
  const fill = (el, c) => {
    const r = c.unseenPct + c.rushPct, q = (s, v, cls) => { const e = el.querySelector(s); e.textContent = v; e.className = e.className.replace(/ (hot|warm)/g, '') + (cls ? ' ' + cls : ''); };
    q('.x1', r > 0 ? pct(r, 1) : '0%', r >= 1 ? 'hot' : r > 0 ? 'warm' : '');
    q('.x2', String(c.over.size), c.over.size ? 'hot' : '');
    q('.x3', String(c.repeat.size), c.repeat.size ? 'hot' : '');
    el.querySelector('.x4').innerHTML = verdict(c);
  };
  const draw = () => {
    const list = g.list(filter).slice(0, rows);
    if (!list.length) {
      body.innerHTML = g.state === 'offline'
        ? '<div class="board-empty">The live feed is not answering right now. The scan still works: paste any token above.<br><button class="btn g sm retry" type="button">Retry the feed ↻</button></div>'
        : `<div class="board-empty">${filter === 'all' ? 'Waiting for the next launch…' : filter === 'flagged' ? 'No flagged launches yet. Give it a minute.' : 'No clean launches yet. A coin needs 20 quiet seconds to count as clean.'}</div>`;
      const b = body.querySelector('.retry'); if (b) b.onclick = () => g.reconnect(); return;
    }
    const keep = new Map([...body.querySelectorAll('.brow')].map(e => [e.dataset.m, e]));
    body.textContent = '';
    for (const c of list) { const e = keep.get(c.mint) || row(c); if (!keep.has(c.mint)) e.classList.add('new'); body.append(e); }
  };
  root.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { root.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b)); filter = b.dataset.f; draw(); });
  let queued = false; const later = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; draw(); }); };
  g.addEventListener('coin', later);
  g.addEventListener('update', e => { const el = body.querySelector(`[data-m="${e.detail.mint}"]`); if (el) fill(el, e.detail); if (filter !== 'all') later(); });
  const st = () => { const [s, t] = statusText(g); dot.className = 'dot' + (s === 'on' ? '' : ' off'); bs.textContent = g.state === 'live' ? 'Live' : t; draw(); };
  g.addEventListener('status', st);
  g.addEventListener('stats', () => { bf.textContent = `${g.stats.seen.toLocaleString('en-US')} launches seen · ${g.stats.flagged.toLocaleString('en-US')} flagged`; });
  setInterval(() => { for (const a of body.querySelectorAll('.age')) a.textContent = ago(Date.now() - Number(a.dataset.t)); if (filter === 'clean') later(); for (const el of body.querySelectorAll('.brow[data-m]')) { const c = g.coins.get(el.dataset.m); if (c) el.querySelector('.x4').innerHTML = verdict(c); } }, 1000);
  st();
  return { setFilter(f) { const b = root.querySelector(`.tabs [data-f="${f}"]`); if (b) b.click(); } };
}
