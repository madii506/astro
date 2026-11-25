// Launch card: a 1200x675 PNG of a coin with the five rules it launches under. Drawn in the browser; the image never leaves it.
import { $, toast } from './util.js';

const RULES = ['Launch block: launch only', 'One buy each · 1% max', 'No shared funders', 'Dev buy capped at 3%', 'Dev locked for 24h'];
function rr(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function wrap(x, text, max) { const words = text.split(/\s+/); const lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }

export function mountCard() {
  const cv = $('#cardCv'), x = cv.getContext('2d'), drop = $('#drop'), file = $('#file'), dcv = $('#dropCv'), dx = dcv.getContext('2d');
  const fName = $('#fName'), fTicker = $('#fTicker'), fLine = $('#fLine'), fPixel = $('#fPixel');
  let img = null;
  dx.fillStyle = '#211e22'; dx.fillRect(0, 0, 112, 112); dx.fillStyle = '#5f575a'; dx.font = '700 40px Pixelify, monospace'; dx.textAlign = 'center'; dx.fillText('+', 56, 70);
  async function load(f) {
    if (!f || !/^image\//.test(f.type)) return toast('That file is not an image');
    if (f.size > 10e6) return toast('Pick an image under 10 MB');
    try {
      const bmp = await createImageBitmap(f), s = 600, c = document.createElement('canvas'); c.width = c.height = s;
      const k = Math.max(s / bmp.width, s / bmp.height), cx = c.getContext('2d');
      cx.drawImage(bmp, (s - bmp.width * k) / 2, (s - bmp.height * k) / 2, bmp.width * k, bmp.height * k);
      img = c; dx.clearRect(0, 0, 112, 112); dx.drawImage(c, 0, 0, 112, 112); draw();
    } catch { toast('Could not read that image'); }
  }
  drop.addEventListener('click', e => { e.preventDefault(); file.click(); });
  file.addEventListener('change', () => load(file.files[0]));
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); load(e.dataTransfer.files[0]); });
  fTicker.addEventListener('input', () => { const v = fTicker.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10); if (v !== fTicker.value) fTicker.value = v; });
  [fName, fTicker, fLine].forEach(i => i.addEventListener('input', draw)); fPixel.addEventListener('change', draw);

  function draw() {
    const W = 1200, H = 675, name = fName.value.trim() || 'Your coin', tk = fTicker.value.trim() || 'TICKER', line = fLine.value.trim() || 'One line about your coin goes here.';
    const ph = { name: !fName.value.trim(), tk: !fTicker.value.trim(), line: !fLine.value.trim() };   // empty fields draw as dim placeholders
    x.save(); x.fillStyle = '#141315'; x.fillRect(0, 0, W, H);
    const g = x.createRadialGradient(820, 260, 40, 820, 260, 760); g.addColorStop(0, 'rgba(255,170,130,.12)'); g.addColorStop(1, 'rgba(20,19,21,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,210,190,.07)'; for (let gx = 30; gx < W; gx += 30) for (let gy = 30; gy < H; gy += 30) x.fillRect(gx, gy, 2, 2);
    // soft voxels in the corners, like the banner
    const blob = (X, Y, S, c, b) => { x.save(); x.filter = `blur(${b}px)`; x.fillStyle = c; rr(x, X, Y, S, S, S * 0.18); x.fill(); x.restore(); };
    blob(1080, -40, 170, 'rgba(255,156,118,.55)', 16); blob(-60, 560, 150, 'rgba(255,216,195,.4)', 14); blob(1110, 540, 90, 'rgba(255,192,160,.5)', 8);
    // the coin image, framed
    const IX = 80, IY = 118, IS = 340;
    x.save(); x.shadowColor = 'rgba(255,150,110,.45)'; x.shadowBlur = 40; rr(x, IX - 6, IY - 6, IS + 12, IS + 12, 34); x.fillStyle = '#ffc0a0'; x.fill(); x.restore();
    x.save(); rr(x, IX, IY, IS, IS, 28); x.clip(); x.fillStyle = '#231f22'; x.fillRect(IX, IY, IS, IS);
    if (img) {
      if (fPixel.checked) { const t = document.createElement('canvas'); t.width = t.height = 56; t.getContext('2d').drawImage(img, 0, 0, 56, 56); x.imageSmoothingEnabled = false; x.drawImage(t, IX, IY, IS, IS); x.imageSmoothingEnabled = true; }
      else x.drawImage(img, IX, IY, IS, IS);
    } else {                                                    // no image yet: a mirrored pixel mark from the ticker
      let h = hash(tk); const cs = IS / 9, pal = ['#ffc0a0', '#ff9c76', '#ffe4d4', '#f07f5c'];
      x.fillStyle = pal[h % 4];
      for (let r = 0; r < 7; r++) for (let q = 0; q < 4; q++) { if ((hash(tk + r + ':' + q) >> 3) & 1) { x.fillRect(IX + cs * (1 + q), IY + cs * (1 + r), cs, cs); x.fillRect(IX + cs * (7 - q), IY + cs * (1 + r), cs, cs); } }
    }
    x.restore();
    // text
    x.textBaseline = 'alphabetic';
    x.save(); x.font = '700 96px Pixelify, monospace'; x.fillStyle = ph.tk ? 'rgba(255,192,160,.28)' : '#ffc0a0'; x.shadowColor = 'rgba(255,150,110,.5)'; x.shadowBlur = ph.tk ? 0 : 30;
    let tsz = 96; while (x.measureText('$' + tk).width > 600 && tsz > 48) { tsz -= 4; x.font = `700 ${tsz}px Pixelify, monospace`; }
    x.fillText('$' + tk, 490, 208); x.restore();
    x.font = '600 34px Inter, sans-serif'; x.fillStyle = ph.name ? 'rgba(245,238,233,.25)' : '#f5eee9'; x.fillText(name.slice(0, 32), 492, 262);
    x.font = '400 22px Inter, sans-serif'; x.fillStyle = ph.line ? 'rgba(185,175,171,.3)' : '#b9afab'; wrap(x, line, 600).slice(0, 2).forEach((l, i) => x.fillText(l, 492, 306 + i * 32));
    // rules
    x.font = '600 17px Inter, sans-serif';
    let px = 492, py = 392;
    RULES.forEach(r => {
      const w = x.measureText(r).width + 58; if (px + w > 1130) { px = 492; py += 56; }
      rr(x, px, py, w, 42, 12); x.fillStyle = 'rgba(255,192,160,.07)'; x.fill(); x.strokeStyle = 'rgba(255,192,160,.22)'; x.lineWidth = 1.2; x.stroke();
      x.fillStyle = '#9fe2bf'; x.fillRect(px + 16, py + 15, 12, 12); x.fillStyle = '#141315'; x.fillRect(px + 19, py + 20, 3, 3); x.fillRect(px + 22, py + 18, 3, 3);
      x.fillStyle = '#e9e0db'; x.fillText(r, px + 40, py + 27); px += w + 12;
    });
    // mark and stamp
    x.save(); x.font = '700 44px Pixelify, monospace'; x.fillStyle = '#ffc0a0'; x.shadowColor = 'rgba(255,150,110,.45)'; x.shadowBlur = 22; x.textAlign = 'right'; x.fillText('astro', 1118, 92); x.restore();
    x.save(); x.translate(1030, 132); x.rotate(-0.07); x.strokeStyle = '#ff9c76'; x.lineWidth = 3; x.strokeRect(-4, -26, 96, 38); x.font = '700 18px Pixelify, monospace'; x.fillStyle = '#ff9c76'; x.fillText('FAIR START', 4, 0); x.restore();
    x.font = '500 15px JBM, monospace'; x.fillStyle = '#6d6467'; x.fillText('Every buy goes through the gate.', 80, 618);
    x.restore();
    const t = `$${tk} launches on Astro, the fair launchpad with its own chain.\n\nOne block for the launch. One buy each in the first minute. No shared funders. The dev waits a day.`;
    $('#cardX').href = `https://x.com/intent/tweet?text=${encodeURIComponent(t)}`;
  }
  $('#cardSave').addEventListener('click', () => {
    cv.toBlob(b => { if (!b) return toast('Could not make the PNG'); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `astro-${(fTicker.value || 'card').toLowerCase()}.png`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); toast('Card saved'); }, 'image/png');
  });
  Promise.all([document.fonts.load('700 40px Pixelify'), document.fonts.load('600 20px Inter'), document.fonts.load('500 15px JBM')]).finally(draw);
  return { draw };
}
