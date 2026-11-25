// Astro landing page: intro, smooth scroll, the world behind the page, and every working part in front of it.
import { $, $$, esc, copy, toast, config, scramble, short } from './util.js';
import { paintIcons } from './icons.js';
import { mountScanner } from './scan.js';
import { mountGate } from './gate.js';

const html = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 720px), (pointer: coarse)').matches;
let lenis = null, world = null;

// ---------- smooth scroll ----------
if (!reduced && window.Lenis) {
  lenis = new window.Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.3 });
  const raf = t => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
}
function go(sel, offset = -72) {
  const el = typeof sel === 'string' ? $(sel) : sel; if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset, duration: 1.4 }); else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return;
  const h = a.getAttribute('href'); if (h.length < 2 || !$(h)) return;
  e.preventDefault(); closeSheet(); go(h); history.replaceState(null, '', h);
});

// ---------- intro ----------
function lock(on) { html.style.overflow = on ? 'hidden' : ''; if (lenis) on ? lenis.stop() : lenis.start(); }
let introDone = false;
function endIntro() {
  if (introDone) return; introDone = true;
  html.classList.remove('intro'); lock(false);
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(t => removeEventListener(t, skipIntro, { capture: true }));
  const q = new URLSearchParams(location.search).get('scan');
  if (q) setTimeout(() => { go('#scan'); scanner.run(q); }, 400);
  else if (location.hash && $(location.hash)) setTimeout(() => go(location.hash), 300);
}
function skipIntro(e) { if (e && e.type === 'keydown' && ['Tab', 'Shift', 'Alt', 'Control', 'Meta'].includes(e.key)) return; world && world.skip(); endIntro(); }
lock(true);
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(t => addEventListener(t, skipIntro, { capture: true, passive: true }));
$('#skip').onclick = skipIntro;
setTimeout(endIntro, 5200);                        // backstop: the page never stays locked

async function startWorld() {
  const test = document.createElement('canvas');
  let gl = false; try { gl = !!test.getContext('webgl2'); } catch { gl = false; }
  if (!gl) { html.classList.add('nogl'); return endIntro(); }
  try {
    const { createWorld } = await import('./world.js?v=1');
    world = await createWorld($('#world'), { mobile, reduced });
  } catch (err) { console.warn('world', err); html.classList.add('nogl'); return endIntro(); }
  window.astroWorld = world;
  world.onAssembled(() => setTimeout(endIntro, 150));
  world.start(); onScroll();
}
document.fonts.load('700 100px Pixelify').finally(startWorld);

// ---------- scroll: world, veil, nav, rail ----------
const veil = $('#veil'), nav = $('#nav'), rail = $('#rail'), lift = $('#liftoff');
function onScroll() {
  const vh = innerHeight, heroP = scrollY / vh;
  const lr = lift.getBoundingClientRect(), endP = Math.min(1, Math.max(0, 1 - lr.top / vh));
  const out = Math.min(1, heroP / 0.85);
  if (world) {
    world.setScroll(Math.min(1, heroP) * (1 - endP));
    world.setScatter(out * (1 - Math.min(1, endP * 1.15)));
    world.setQuality(heroP > 1.2 && endP < 0.15 ? 'low' : 'high');
  }
  veil.style.opacity = (Math.min(1, Math.max(0, (heroP - 0.2) / 0.7)) * 0.84 * (1 - endP * 0.92)).toFixed(3);
  nav.classList.toggle('solid', scrollY > 30);
  rail.classList.toggle('show', heroP > 0.85 && endP < 0.6);
}
addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); onScroll();

// ---------- headlines rise in word by word ----------
function splitWords(el) {
  let i = 0;
  const walk = node => {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 3) {
        const f = document.createDocumentFragment();
        for (const part of ch.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { f.append(' '); continue; }
          const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--w', i++); s.textContent = part; f.append(s);
        }
        ch.replaceWith(f);
      } else if (ch.nodeType === 1) walk(ch);
    }
  };
  walk(el);
}
if (!reduced) $$('main .h2').forEach(splitWords);
if (!reduced && !mobile) $$('.btn.p').forEach(b => {
  b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${((e.clientX - r.left) / r.width - 0.5) * 8}px, ${((e.clientY - r.top) / r.height - 0.5) * 6 - 2}px)`; });
  b.addEventListener('pointerleave', () => { b.style.transform = ''; });
});

// ---------- sections: reveal, rail, nav state ----------
const rvObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); rvObs.unobserve(e.target); } }), { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
$$('.rv').forEach(el => rvObs.observe(el));
const sweep = () => $$('.rv:not(.vis)').forEach(el => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add('vis'); });
addEventListener('hashchange', () => setTimeout(sweep, 900));
const ids = ['trench', 'gate', 'rules', 'chain', 'scan', 'plan', 'faq', 'liftoff'];
const railLinks = $$('#rail a'), navLinks = $$('.nav-links a[href^="#"]'), secs = ids.map(id => $('#' + id));
let curSec = -2;
function spy() {
  let cur = -1; secs.forEach((el, i) => { if (el.getBoundingClientRect().top < innerHeight * 0.45) cur = i; });
  if (cur === curSec) return; curSec = cur;
  railLinks.forEach((a, i) => { a.classList.toggle('on', i === cur); a.classList.toggle('done', i < cur); });
  navLinks.forEach(a => a.classList.toggle('on', cur >= 0 && a.getAttribute('href') === '#' + ids[cur]));
}
addEventListener('scroll', spy, { passive: true }); spy();
const kickObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const b = e.target.querySelector('b'); if (b && !reduced) scramble(b, 650); kickObs.unobserve(e.target); } }), { threshold: 0.6 });
$$('.kick').forEach(k => kickObs.observe(k));

// ---------- menu sheet ----------
const sheet = $('#sheet');
function closeSheet() { sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true'); }
$('#burger').onclick = () => { sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false'); };
$('#sheetX').onclick = closeSheet;
sheet.addEventListener('click', e => { if (e.target.closest('a')) closeSheet(); });

// ---------- scan ----------
if (innerWidth < 520) $('#heroInput').placeholder = 'Paste any token';
const scanner = mountScanner({ form: $('#scanForm'), input: $('#scanInput'), res: $('#scanRes'), paste: $('#scanPaste'), recent: $('#scanTry') });
$('#heroScan').addEventListener('submit', e => {
  e.preventDefault(); const v = $('#heroInput').value.trim();
  if (!v) { $('#heroInput').focus(); toast('Paste a token\'s contract address first'); return; }
  go('#scan'); setTimeout(() => scanner.run(v), 380);
});
$('#heroPaste').onclick = async () => { try { const t = (await navigator.clipboard.readText()).trim(); if (t) { $('#heroInput').value = t; $('#heroScan').requestSubmit(); } } catch { $('#heroInput').focus(); toast('Paste with Ctrl/⌘ + V'); } };

// ---------- the gate replay ----------
document.fonts.ready.then(() => mountGate({ pin: $('#gatePin'), canvas: $('#gateCv'), steps: $$('.gate-step'), bars: $$('#gateBar b'), hud: $('#gateHud') }));

// ---------- icons, rule cards ----------
paintIcons();
$$('.rule-card').forEach(card => {
  card.addEventListener('pointermove', e => {
    const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.style.setProperty('--mx', `${x * 100}%`); card.style.setProperty('--my', `${y * 100}%`);
    if (!reduced && !mobile) card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 5}deg) rotateY(${(x - 0.5) * 6}deg) translateY(-4px)`;
  });
  card.addEventListener('pointerleave', () => { card.style.transform = ''; });
});

// ---------- architecture: packets through the gate ----------
(function arch() {
  const svg = $('#arch'); if (!svg) return;
  const N = (x, y, w, h, t, s, hot) => `<g class="node${hot ? ' hot' : ''}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/><text x="${x + 16}" y="${y + 28}">${t}</text><text class="s" x="${x + 16}" y="${y + 48}">${s}</text></g>`;
  const P = (id, d) => `<path class="wire" id="${id}" d="${d}"/>`;
  svg.innerHTML = P('w1', 'M130 150 L210 150') + P('w2', 'M360 140 C 390 140, 390 72, 420 72') + P('w3', 'M490 104 L490 172') + P('w4', 'M140 352 L220 352') + P('w5', 'M350 352 L430 352') + P('w6', 'M495 320 L495 236') + P('wb', 'M210 162 C 170 200, 120 200, 70 182')
    + N(10, 118, 120, 64, 'Wallets', 'buy and sell') + N(210, 104, 150, 92, 'The gate', '5 rules, every tx', true) + N(420, 40, 136, 64, 'Sequencer', '1 block/400ms') + N(420, 172, 136, 64, 'Blocks', 'all public')
    + N(10, 320, 130, 64, 'Solana', '$ASTRO token') + N(220, 320, 130, 64, 'Vault', 'one for one') + N(430, 320, 126, 64, 'Astro', 'native ASTRO')
    + `<text x="285" y="228" text-anchor="middle" font-family="JBM, monospace" font-size="11" fill="#ff6a58">refused: never reaches a block</text>` + '<g id="pk"></g>';
  const g = svg.querySelector('#pk'), path = id => svg.querySelector('#' + id);
  const routes = [['w1', 'w2', 'w3'], ['w1', 'w2', 'w3'], ['w1', 'w2', 'w3'], ['w1', 'wb'], ['w4', 'w5', 'w6']];
  const dots = Array.from({ length: 9 }, (_, i) => { const c = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); c.setAttribute('width', 8); c.setAttribute('height', 8); g.append(c); return { c, r: routes[i % routes.length], t: -i * 0.42 }; });
  let vis = false, last = performance.now();
  new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(svg);
  (function run(now) {
    requestAnimationFrame(run); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!vis || document.hidden) return;
    for (const d of dots) {
      d.t += dt * 0.55; if (d.t < 0) { d.c.setAttribute('opacity', 0); continue; }
      const seg = Math.floor(d.t), k = d.t - seg;
      if (seg >= d.r.length) { d.t = -Math.random() * 1.2; continue; }
      const p = path(d.r[seg]), L = p.getTotalLength(), pt = p.getPointAtLength(L * k);
      d.c.setAttribute('x', pt.x - 4); d.c.setAttribute('y', pt.y - 4); d.c.setAttribute('opacity', 1);
      d.c.setAttribute('class', d.r[seg] === 'wb' ? 'pk bad' : 'pk');
    }
  })(performance.now());
})();

// ---------- flight plan line ----------
const planList = $('#planList'), planFill = $('#planFill');
addEventListener('scroll', () => {
  const r = planList.getBoundingClientRect(), k = Math.min(1, Math.max(0, (innerHeight * 0.6 - r.top) / r.height));
  planFill.style.height = `${k * (r.height - 20)}px`;
}, { passive: true });

// ---------- FAQ: animated open/close ----------
$$('.qa').forEach(d => {
  const s = d.querySelector('summary'), a = d.querySelector('.ans');
  s.addEventListener('click', e => {
    e.preventDefault(); if (reduced) { d.open = !d.open; return; }
    if (d.open) { const h = a.scrollHeight; a.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 320, easing: 'cubic-bezier(.2,.7,.1,1)' }).onfinish = () => { d.open = false; }; }
    else { d.open = true; const h = a.scrollHeight; a.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.7,.1,1)' }); }
  });
});

// ---------- contract address and X, once they exist ----------
config().then(c => {
  if (c && c.ca) {
    const el = $('#heroCa'); el.innerHTML = `<span class="ca"><b>$ASTRO</b><span>${esc(short(c.ca, 6))}</span><button type="button">COPY</button></span>`;
    el.querySelector('button').onclick = () => copy(c.ca, 'Contract address copied');
  }
  if (c && c.x) { const x = $('#xLink'); x.href = c.x; x.hidden = false; }
});
