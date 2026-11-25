// Docs: scroll spy for both navs, a heading list for the right rail, the live API "try it" box, and the menu sheet.
import { $, $$, esc, isAddr } from './util.js';

const secs = $$('.art section[id]'), dnav = $$('#dnav a'), toc = $('#dtoc');
const heads = $$('.art section[id] > h2, .art h3[id]');
for (const h of heads) {
  const id = h.id || h.parentElement.id, a = document.createElement('a');
  a.href = '#' + id; a.textContent = h.textContent.replace(/^Rule \d · /, ''); if (h.tagName === 'H3') a.style.paddingLeft = '12px';
  toc.append(a);
}
const tocLinks = $$('#dtoc a');
function spy() {
  let cur = secs[0].id;
  for (const s of secs) if (s.getBoundingClientRect().top < 140) cur = s.id;
  dnav.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + cur));
  let h = null; for (const el of heads) if (el.getBoundingClientRect().top < 160) h = el.id || el.parentElement.id;
  tocLinks.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + (h || cur)));
}
addEventListener('scroll', spy, { passive: true }); spy();

// try the real endpoint
const go = $('#tryGo'), inp = $('#tryMint'), out = $('#tryOut');
go.onclick = async () => {
  const m = inp.value.trim(); out.hidden = false;
  if (!isAddr(m)) { out.textContent = '{ "ok": false, "error": "Paste a token contract address first." }'; return; }
  out.textContent = 'Reading Solana…'; go.disabled = true;
  try {
    const r = await fetch(`/api/scan?mint=${encodeURIComponent(m)}`), j = await r.json();
    if (Array.isArray(j.timeline) && j.timeline.length > 6) j.timeline = [...j.timeline.slice(0, 6), `… ${j.timeline.length - 6} more events`];
    out.innerHTML = esc(JSON.stringify(j, null, 2));
  } catch { out.textContent = '{ "ok": false, "error": "Could not reach the API." }'; }
  go.disabled = false;
};
inp.addEventListener('keydown', e => { if (e.key === 'Enter') go.click(); });

const sheet = $('#sheet');
$('#burger').onclick = () => { sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false'); };
$('#sheetX').onclick = () => { sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true'); };
