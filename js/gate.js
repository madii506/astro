// The gate, replayed: six scroll-driven scenes of one Astro launch, drawn as pixel art. Scroll position picks the scene
// and how far into it we are, so every frame can be reached by scrolling back and forth.
const COL = { peach: '#ffc0a0', peach2: '#ff9c76', cream: '#ffe4d4', coral: '#ff6a58', mint: '#9fe2bf', amber: '#ffcf86', dim: 'rgba(255,210,190,.09)', dim2: 'rgba(255,210,190,.2)' };
const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const eio = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eout = t => 1 - Math.pow(1 - t, 3);
const ein = t => t * t;

export function mountGate({ pin, canvas, steps, bars, hud }) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, U = 8, OX = 0, OY = 0, dpr = 1, pS = 0, visible = false, tau = 0, last = performance.now();
  function size() {
    dpr = Math.min(2, devicePixelRatio || 1); const r = canvas.getBoundingClientRect(); W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    U = Math.max(3, Math.floor(Math.min(W / 66, H / 47) * 2) / 2); OX = Math.round((W - 64 * U) / 2); OY = Math.round((H - 44 * U) / 2 + U * 1.2);
  }
  const sq = (x, y, s, col, a = 1) => {
    if (a <= 0.01) return; ctx.globalAlpha = Math.min(1, a); const ps = Math.max(2, Math.round(s * U)), px = Math.round(OX + x * U - ps / 2), py = Math.round(OY + y * U - ps / 2);
    ctx.fillStyle = col; ctx.fillRect(px, py, ps, ps);
    const e = Math.max(1, Math.round(ps / 7)); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(px, py + ps - e, ps, e); ctx.fillRect(px + ps - e, py, e, ps);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(px, py, ps - e, e); ctx.globalAlpha = 1;
  };
  const glow = (x, y, r, col, a) => { if (a <= 0.01) return; const g = ctx.createRadialGradient(OX + x * U, OY + y * U, 0, OX + x * U, OY + y * U, r * U); g.addColorStop(0, col); g.addColorStop(1, 'transparent'); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(OX + (x - r) * U, OY + (y - r) * U, r * 2 * U, r * 2 * U); ctx.globalAlpha = 1; };
  const dots = (x1, y1, x2, y2, col, a = 1) => { const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 0.9); for (let i = 0; i <= n; i++) sq(lerp(x1, x2, i / n), lerp(y1, y2, i / n), 0.35, col, a); };
  const label = (x, y, text, col, a = 1) => {
    if (a <= 0.01) return; ctx.globalAlpha = a; ctx.font = `700 ${Math.max(10, Math.round(U * 1.35))}px Pixelify, monospace`;
    const w = ctx.measureText(text).width, px = Math.round(OX + x * U - w / 2), py = Math.round(OY + y * U);
    ctx.fillStyle = 'rgba(20,19,21,.88)'; ctx.fillRect(px - U, py - U * 1.45, w + U * 2, U * 2.2);
    ctx.fillStyle = col; ctx.fillRect(px - U, py - U * 1.45, Math.max(2, U * 0.35), U * 2.2);
    ctx.fillText(text, px, py + U * 0.3); ctx.globalAlpha = 1;
  };
  const mono = (x, y, text, col, a = 1, align = 'center') => { ctx.globalAlpha = a; ctx.font = `500 ${Math.max(9, Math.round(U * 1.05))}px JBM, monospace`; ctx.textAlign = align; ctx.fillStyle = col; ctx.fillText(text, OX + x * U, OY + y * U); ctx.textAlign = 'left'; ctx.globalAlpha = 1; };
  const GATE_X = 33, LANES = [12, 16, 20, 24, 28, 32, 36];

  // the coin's supply: 100 cells, 1% each
  const cell = i => [44.6 + (i % 10) * 1.9, 35 - Math.floor(i / 10) * 2.55];
  function tower(p) {
    const s = Math.floor(p), k = p - s, base = s > 0 ? 1 : cl(k / 0.4);
    for (let i = 0; i < 100; i++) { const [x, y] = cell(i), a = cl(base * 100 - i * 0.6); sq(x, y, 1.5, COL.dim2, a * 0.8); }
    const lit = [];
    const on = (i, col, at) => lit.push([i, col, at]);
    const after = (st, kk) => (s > st ? 1 : s === st ? cl((k - kk) / 0.06) : 0);
    for (let i = 0; i < 3; i++) on(i, COL.peach2, after(0, 0.74 + i * 0.03));
    on(3, COL.mint, after(2, 0.62));
    for (let j = 0; j < 12; j++) on(4 + j, COL.cream, after(3, 0.2 + j * 0.05));
    on(16, COL.amber, after(3, 0.86));
    if (s === 5) for (let i = 17; i < 17 + Math.round(58 * cl((k - 0.25) / 0.7)); i++) on(i, i % 3 ? COL.cream : COL.peach, 1);
    for (const [i, col, a] of lit) { if (a <= 0) continue; const [x, y] = cell(i); sq(x, y, 1.5 * (0.6 + 0.4 * eout(a)), col, a); }
    mono(53.2, 40.6, '100% OF SUPPLY · 1 CELL = 1%', 'rgba(255,210,190,.38)', base);
  }
  function gate(open, flashes) {
    for (let y = 8; y <= 37; y += 2.2) {
      const up = y < 22.5, dy = open * (up ? -1 : 1) * (8 + Math.abs(y - 22.5) * 0.4), a = 1 - open * 0.75;
      sq(GATE_X, y + dy, 1.9, '#4a3b39', a); sq(GATE_X, y + dy, 1.1, COL.peach, a * 0.9);
    }
    glow(GATE_X, 22.5, 14, 'rgba(255,170,130,.14)', 1 - open);
    for (const [y, col, a] of flashes) { glow(GATE_X, y, 7, col, a * 0.9); sq(GATE_X, y, 2.6, col, a); }
    mono(GATE_X, 41, open > 0.5 ? 'GATE · OPEN' : 'THE GATE', 'rgba(255,210,190,.38)');
  }
  const flashAt = (k, at, y, col, w = 0.05) => [y, col, cl(1 - Math.abs(k - at) / w)];

  function scene(p) {
    const s = Math.min(5, Math.floor(p)), k = p - s, fl = [];
    ctx.clearRect(0, 0, W, H);
    for (let x = 0; x <= 64; x += 4) for (let y = 4; y <= 40; y += 4) sq(x, y, 0.22, 'rgba(255,210,190,.10)');
    tower(p);
    // the dev: walks in at launch, parks by the curve, tries to leave in scene 4
    let devX = 39.5, devY = 22, devA = 1, lock = 0;
    if (s === 0) { devX = k < 0.62 ? lerp(-4, GATE_X, eio(cl(k / 0.62))) : lerp(GATE_X, 39.5, eout(cl((k - 0.62) / 0.14))); devA = cl(k / 0.08); fl.push(flashAt(k, 0.62, devY, COL.mint)); }
    if (s === 4) {
      if (k < 0.36) devX = lerp(39.5, 35.4, eio(cl((k - 0.08) / 0.28)));
      else if (k < 0.7) { devX = 35.4 + Math.sin(tau * 38) * 0.25 * cl((0.66 - k) * 8); lock = cl((k - 0.36) / 0.06); }
      else { devX = lerp(35.4, 39.5, eout(cl((k - 0.7) / 0.2))); lock = 1 - cl((k - 0.86) / 0.1); }
      fl.push(flashAt(k, 0.4, devY, COL.coral, 0.08));
    }
    if (s >= 0) {
      sq(devX, devY, 2.8, COL.peach2, devA);
      for (let i = 0; i < 3; i++) if (s === 4 || (s === 0 && k > 0.62)) sq(devX + 1.9 + i * 0.95, devY - 1.9, 0.75, COL.peach2, devA * (s === 4 ? 1 : cl((k - 0.74) / 0.1)));
      if (s <= 1 || s === 4) mono(devX, devY + 3.4, 'DEV', COL.peach2, devA * 0.9);
      if (lock > 0) {                                        // a pixel padlock over the dev
        const lx = devX, ly = devY - 4.2; ctx.globalAlpha = lock;
        for (const [dx, dy] of [[-0.9, -1.2], [-0.9, -0.6], [0.9, -1.2], [0.9, -0.6], [-0.45, -1.7], [0, -1.7], [0.45, -1.7]]) sq(lx + dx, ly + dy, 0.55, COL.cream, lock);
        sq(lx, ly + 0.6, 2.4, COL.cream, lock); sq(lx, ly + 0.6, 0.6, '#2a2427', lock); ctx.globalAlpha = 1;
      }
    }
    if (s === 0) { label(GATE_X, 5, 'BLOCK 0 · THE LAUNCH', COL.peach, cl((k - 0.1) / 0.1)); label(53.5, 8.4, 'DEV BUY · CAPPED AT 3%', COL.peach2, cl((k - 0.8) / 0.1)); }
    if (s === 1) {                                           // snipers race into block 0 and bounce
      LANES.forEach((y, i) => {
        const hit = 0.24 + i * 0.045, t0 = hit - 0.2;
        if (k < t0) return;
        if (k < hit) { const t = ein(cl((k - t0) / 0.2)), x = lerp(-6, GATE_X - 1.6, t); for (let j = 1; j <= 3; j++) sq(x - j * 1.3, y, 1.6 - j * 0.3, COL.coral, 0.5 - j * 0.12); sq(x, y, 1.8, COL.coral); }
        else { const t = cl((k - hit) / 0.36); sq(lerp(GATE_X - 1.6, GATE_X - 22, eout(t)), y - Math.sin(t * Math.PI) * 4, 1.8, COL.coral, 1 - t); }
        fl.push(flashAt(k, hit, y, COL.coral, 0.04));
      });
      label(GATE_X, 5, 'SAME BLOCK · REFUSED', COL.coral, cl((k - 0.3) / 0.08));
    }
    if (s === 2) {                                           // one funder, eight wallets, one gets in
      const fx = 5, fy = 9, fa = cl(k / 0.1); sq(fx, fy, 3.4, COL.coral, fa); mono(fx, fy + 3.6, 'FUNDER', COL.coral, fa * 0.8);
      for (let i = 0; i < 8; i++) {
        const y0 = 14 + i * 3, app = cl((k - 0.04 - i * 0.02) / 0.08), go = eio(cl((k - 0.24 - i * 0.012) / 0.3));
        let x = lerp(13, GATE_X - 1.6, go), y = y0, a = app, col = COL.cream;
        if (i === 0 && k > 0.55) { x = lerp(GATE_X - 1.6, 43, eout(cl((k - 0.55) / 0.12))); a = 1 - cl((k - 0.64) / 0.04); col = COL.mint; }
        if (i > 0 && k > 0.56 + i * 0.012) { const t = cl((k - 0.56 - i * 0.012) / 0.3); x = lerp(GATE_X - 1.6, GATE_X - 16, eout(t)); y = y0 - Math.sin(t * Math.PI) * 2.5; a = 1 - t; col = COL.coral; }
        const la = (k > 0.56 ? 0.85 : 0.35) * app * (i === 0 && k > 0.6 ? 0 : 1) * (i > 0 && k > 0.56 ? 1 - cl((k - 0.7) / 0.2) : 1);
        dots(fx + 1.8, fy, x - 0.8, y, k > 0.56 ? COL.coral : COL.dim2, la);
        sq(x, y, 1.7, col, a);
        if (i > 0) fl.push(flashAt(k, 0.56 + i * 0.012, y0, COL.coral, 0.03)); else fl.push(flashAt(k, 0.55, y0, COL.mint, 0.04));
      }
      label(GATE_X, 5, 'ONE FUNDER · 1 OF 8 GETS IN', COL.coral, cl((k - 0.58) / 0.08));
    }
    if (s === 3) {                                           // the first minute: one buy each, 1% max
      for (let j = 0; j < 12; j++) {
        const st = 0.02 + j * 0.05, y = 12 + ((j * 7) % 25), t = cl((k - st) / 0.16);
        if (k < st || t >= 1) continue;
        const x = t < 0.75 ? lerp(-3, GATE_X, eio(t / 0.75)) : lerp(GATE_X, 43, (t - 0.75) / 0.25);
        sq(x, y, 1.6, COL.cream, t < 0.9 ? 1 : (1 - t) * 10);
        if (Math.abs(x - GATE_X) < 1.2) fl.push([y, COL.mint, 0.7]);
      }
      if (k > 0.5 && k < 0.78) {                             // a wallet tries a second buy
        const t = cl((k - 0.5) / 0.26), x = t < 0.45 ? lerp(40, GATE_X + 1.6, eio(t / 0.45)) : lerp(GATE_X + 1.6, 41, eout((t - 0.45) / 0.55));
        sq(x, 18, 1.6, t < 0.45 ? COL.cream : COL.coral, 1 - cl((t - 0.7) / 0.3)); fl.push(flashAt(k, 0.5 + 0.26 * 0.45, 18, COL.coral, 0.03));
      }
      if (k > 0.62) {                                        // a whale, trimmed to 1%
        const t = cl((k - 0.62) / 0.26), x = t < 0.55 ? lerp(-5, GATE_X - 2.5, eio(t / 0.55)) : lerp(GATE_X - 2.5, 43.5, (t - 0.55) / 0.45);
        const sz = t < 0.55 ? 4.6 : lerp(4.6, 1.6, eout(cl((t - 0.55) / 0.12)));
        sq(x, 30, sz, COL.amber, 1 - cl((t - 0.92) / 0.08)); fl.push(flashAt(k, 0.62 + 0.26 * 0.55, 30, COL.amber, 0.04));
      }
      label(GATE_X, 5, k < 0.6 ? 'ONE BUY EACH' : 'MAX 1% EACH', k < 0.6 ? COL.mint : COL.amber, cl((k - 0.08) / 0.08));
    }
    if (s === 4) {
      label(GATE_X, 5, 'DEV LOCKED · 24H', COL.coral, cl((k - 0.36) / 0.06));
      const left = 86400 - 61 - Math.floor(tau) % 60; mono(GATE_X, 9.4, `${String(Math.floor(left / 3600)).padStart(2, '0')}:${String(Math.floor(left % 3600 / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`, COL.coral, cl((k - 0.4) / 0.06));
    }
    let open = 0;
    if (s === 5) {
      open = eio(cl(k / 0.3));
      for (let i = 0; i < 22; i++) {
        const dir = i % 4 === 3 ? -1 : 1, sp = 5 + (i * 37) % 7, ph = (i * 13.7) % 60, y = 11 + ((i * 11) % 26);
        let x = ((tau * sp + ph) % 52); x = dir > 0 ? x - 6 : 46 - x;
        sq(x, y, 1.4, i % 3 ? COL.cream : COL.peach, cl((k - 0.25) / 0.15) * (x > 42 ? 1 - (x - 42) / 4 : 1));
      }
      label(GATE_X, 5, 'OPEN · SAME RULES FOR EVERYONE', COL.mint, cl((k - 0.3) / 0.1));
    }
    gate(open, fl);
    return { s, k };
  }

  let wanted = 0;
  function measure() {
    const r = pin.getBoundingClientRect(), span = r.height - innerHeight;
    wanted = cl(-r.top / Math.max(1, span)) * 5.999;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible || document.hidden) return;
    tau += dt; measure();
    if (Math.abs(wanted - pS) > 0.9) pS = wanted - Math.sign(wanted - pS) * 0.12;   // a big jump (a nav click) lands near the target instead of fast-forwarding
    pS += (wanted - pS) * Math.min(1, dt * 7);
    const { s, k } = scene(pS);
    steps.forEach((el, i) => el.classList.toggle('on', i === s));
    bars.forEach((b, i) => { b.style.transform = `scaleX(${i < s ? 1 : i === s ? k : 0})`; });
    if (hud) hud.innerHTML = s === 0 ? 'block <b>0</b>' : s === 1 ? 'block <b>0</b> · snipers' : s === 2 ? 'block <b>1</b>' : s === 3 ? `block <b>${2 + Math.round(k * 148)}</b> · ${Math.round(k * 60)}s` : s === 4 ? 'block <b>151</b> · 1m' : 'trading <b>open</b>';
  }
  size(); addEventListener('resize', size);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; last = performance.now(); if (visible) size(); }, { rootMargin: '100px' }).observe(pin);
  requestAnimationFrame(frame);
  return { size, render: p => { size(); pS = p; return scene(p); } };
}
