/* Astro world: one three.js scene behind the whole site. Wallet-voxels rush in from the dark; the early ones (snipers) hit the
   gate and bounce off in a coral flash; everyone else arrives together and snaps into the astro wordmark. Voxel rockets,
   planets, moons and sparkles float around it with real depth of field. Scrolling scatters the wordmark into the field;
   the last section pulls it back together. */
import * as THREE from '/vendor/three.module.min.js';

const C = { peach: new THREE.Color('#ff9c76'), cream: new THREE.Color('#ffd8c3'), deep: new THREE.Color('#f07f5c'), coral: new THREE.Color('#ff4d3d'), bg: new THREE.Color('#141315') };
const R = r => { const a = []; for (let i = -r; i <= r; i++) a.push(i); return a; };
// shapes in (x right, y up, z toward camera) cells
function sphere(r, dents = []) {
  const out = [];
  for (const x of R(r)) for (const y of R(r)) for (const z of R(r)) {
    if (x * x + y * y + z * z > r * r + 0.5) continue;
    if (dents.some(([a, b, c, rr]) => (x - a) ** 2 + (y - b) ** 2 + (z - c) ** 2 < rr * rr)) continue;
    const s = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => (x + a) ** 2 + (y + b) ** 2 + (z + c) ** 2 > r * r + 0.5);
    if (s || dents.length) out.push([x, y, z]);
  }
  return out;
}
const ring = (a, b) => { const o = []; for (const x of R(b)) for (const z of R(b)) { const d = x * x + z * z; if (d >= a * a && d <= b * b) o.push([x, 0, z]); } return o; };
function plus(L, t = 1) { const s = new Set(); for (const a of R(L)) for (const u of R(t)) for (const k of R(t)) { s.add(`${a},${u},${k}`); s.add(`${u},${a},${k}`); } return [...s].map(v => v.split(',').map(Number)); }
function sparkle(L) { const o = []; for (const x of R(L)) for (const y of R(L)) { const ax = Math.abs(x), ay = Math.abs(y); if ((ax <= 1 && ay <= L - 1.5 * ax) || (ay <= 1 && ax <= L - 1.5 * ay) || ax + ay <= 2) for (const z of R(1)) o.push([x, y, z]); } return o; }
function star(Ro, ri, n = 5) {
  const o = [];
  for (const x of R(Ro)) for (const y of R(Ro)) {
    const ang = Math.atan2(y, x), d = Math.hypot(x, y), seg = ((ang + Math.PI / 2) % (2 * Math.PI / n) + 2 * Math.PI / n) % (2 * Math.PI / n) / (2 * Math.PI / n);
    if (d <= ri + (Ro - ri) * Math.abs(1 - 2 * seg) ** 1.6 + 0.3) for (const z of R(1)) o.push([x, y, z]);
  }
  return o;
}
function rocket(H = 20, Rb = 3) {
  const body = [], win = [];
  for (let k = -2; k <= H; k++) {
    const rad = k < 0 ? 1.8 : k <= 13 ? Rb : Rb * (1 - (k - 13) / (H - 12)) ** 0.8;
    for (const i of R(Rb + 4)) for (const j of R(Rb + 4)) {
      const d = Math.hypot(i, j), fin = k >= 0 && k <= 5 && (i === 0 || j === 0) && d <= Rb + (5 - k) * 0.7 + 1.2;
      if (d <= rad + 0.35 || fin) {
        if (Math.abs(i) <= 1 && j === Rb && k >= 9 && k <= 11) win.push([i, k, j]); else body.push([i, k, j]);
      }
    }
  }
  return { body, win };
}

const EDGE_V = 'varying vec2 vEdge;\n';
function edgeMaterial(extra) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.66, metalness: 0, ...extra });
  m.onBeforeCompile = sh => {
    sh.vertexShader = EDGE_V + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vEdge = uv;');
    sh.fragmentShader = EDGE_V + sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
      float eg = max(abs(vEdge.x - .5), abs(vEdge.y - .5)) * 2.;
      gl_FragColor.rgb *= 1. - smoothstep(.74, 1., eg) * .34;`);
  };
  return m;
}

export async function createWorld(canvas, { mobile = false, reduced = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  const DPR = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.25);
  renderer.setPixelRatio(DPR); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene(); scene.background = C.bg.clone();
  const cam = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.5, 300); cam.position.set(0, 0, 28);
  scene.add(new THREE.HemisphereLight(0xfff0e6, 0x2a1d1c, 1.15));
  const key = new THREE.DirectionalLight(0xfff2e8, 2.4); key.position.set(-9, 11, 16); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd2bd, 1.5); rim.position.set(7, 5, -12); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xd9e0ff, 0.45); fill.position.set(10, -6, 8); scene.add(fill);
  const box = new THREE.BoxGeometry(1, 1, 1);

  // ---------- floating objects ----------
  const objects = [], static_ = edgeMaterial(), dmat = edgeMaterial({ color: 0x1b1517, roughness: 0.35 });
  function obj(cells, vs, pos, rot, col, spin = 0.05, winCells, alt = null, flat = false) {
    const g = new THREE.Group(); g.position.set(...pos); g.rotation.set(...rot);
    const make = (list, mat, colf) => {
      const m = new THREE.InstancedMesh(box, mat, list.length), M = new THREE.Matrix4(), c = new THREE.Color();
      list.forEach((p, i) => { M.makeScale(vs * 0.93, vs * 0.93, vs * 0.93); M.setPosition(p[0] * vs, p[1] * vs, p[2] * vs); m.setMatrixAt(i, M); if (colf) m.setColorAt(i, colf(p, c)); });
      g.add(m); return m;
    };
    make(cells, static_, (p, c) => c.copy(col).lerp(C.cream, Math.max(0, Math.min(1, 0.15 + p[1] * 0.03 + ((p[0] * 7 + p[2] * 3) % 5) * 0.03))));
    if (winCells) make(winCells, dmat);
    scene.add(g); objects.push({ g, spin, base: pos.slice(), alt, rot0: rot[1], wob: !!flat, ph: Math.random() * 6 }); return g;
  }
  const r1 = rocket(), r2 = rocket();
  const P = (x, y, z) => [x, y, z];
  obj(r1.body, 0.16, P(-10.8, 3.4, 0.5), [0.1, 0.5, -0.5], C.peach, 0.08, r1.win, P(-2.3, 5.6, 0.5));
  obj(sphere(6, [[4, 3, 4, 1.8], [-2, -3, 5, 1.4], [0, 2, 6, 1.1]]), 0.17, P(-12.6, -4.6, -1), [0.3, 0.2, 0.4], C.cream, 0.04, null, P(3.0, -1.3, -1));
  obj(star(7, 3), 0.16, P(7.2, 5.6, 0), [0.12, 0.2, 0.1], C.cream, 0.1, null, P(2.3, 6.9, 0), true);
  obj(plus(5), 0.16, P(9.6, -4.4, 0.5), [0.45, 0.6, 0.35], C.peach, 0.12, null, P(3.2, 4.1, 0.5), true);
  const pl = obj(sphere(5, [[3, 2, 4, 1.5]]), 0.15, P(12.4, 0.6, -0.5), [0.3, 0.1, 0.2], C.peach, 0.05, null, P(-2.6, -1.5, -0.5));
  const rg = obj(ring(7, 9), 0.15, P(12.4, 0.6, -0.5), [1.25, 0.15, -0.3], C.cream, 0); rg.userData.follow = pl;
  obj(sparkle(4), 0.14, P(-4.2, 7.4, -2), [0, 0, 0.2], C.cream, 0.15, null, P(-0.1, 8.3, -2), true);
  obj(sparkle(3), 0.14, P(6.4, -5.2, -3), [0, 0, -0.3], C.peach, 0.18, null, null, true);
  // near and far, for the depth of field
  obj(sphere(7, [[5, 3, 5, 2.2], [-3, -2, 6, 1.6]]), 0.42, P(-15.5, 7.5, 11), [0.35, 0.25, 0.2], C.peach, 0.03);
  const nr = obj(ring(10, 13), 0.42, P(-15.5, 7.5, 11), [1.5, 0.3, 0.25], C.cream, 0);
  obj(r2.body, 0.36, P(15.5, 6.5, 10), [0.2, -0.35, 0.7], C.peach, 0.05, r2.win);
  obj(sphere(6), 0.48, P(16.5, -7.8, 9), [0, 0, 0], C.cream, 0.02);
  obj(sphere(5), 0.36, P(-15, -9.5, 8), [0, 0, 0], C.peach, 0.02);
  if (!mobile) {
    obj(sphere(6, [[3, 3, 4, 2]]), 0.5, P(-26, 13, -40), [0.4, 0.2, 0], C.peach, 0.02);
    obj(plus(4), 0.5, P(30, -12, -45), [0.3, 0.5, 0.2], C.cream, 0.05);
    obj(star(6, 3), 0.45, P(22, 16, -38), [0.2, 0.3, 0.1], C.peach, 0.06);
  }
  // far away, out of focus: a few big soft shapes, no fine dust (small bright specks break up into speckles in the bokeh)
  if (!mobile) {
    obj(sphere(4), 0.6, P(-6, -16, -55), [0, 0, 0], C.peach, 0.02);
    obj(sparkle(4), 0.55, P(8, 19, -60), [0, 0, 0.4], C.cream, 0.05);
    obj(sphere(5, [[2, 2, 4, 1.6]]), 0.55, P(40, 3, -70), [0, 0, 0], C.cream, 0.02);
    obj(plus(3), 0.6, P(-40, -2, -62), [0.4, 0.3, 0.1], C.peach, 0.06);
  }
  // ---------- the wordmark, animated on the GPU ----------
  await document.fonts.load('700 120px Pixelify');
  const ROWS = mobile ? 15 : 21, CELL = 12;
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  cx.font = `700 ${ROWS * CELL * 1.22}px Pixelify`;
  const tm = cx.measureText('astro');
  const asc = Math.ceil(tm.actualBoundingBoxAscent), dsc = Math.ceil(tm.actualBoundingBoxDescent), tw = Math.ceil(tm.actualBoundingBoxRight + tm.actualBoundingBoxLeft);
  cv.width = Math.ceil(tw / CELL) * CELL + CELL * 2; cv.height = Math.ceil((asc + dsc) / CELL) * CELL + CELL * 2;
  cx.font = `700 ${ROWS * CELL * 1.22}px Pixelify`; cx.fillStyle = '#fff'; cx.textBaseline = 'alphabetic';
  cx.fillText('astro', CELL + tm.actualBoundingBoxLeft, CELL + asc);
  const data = cx.getImageData(0, 0, cv.width, cv.height).data, cols = cv.width / CELL, rows = cv.height / CELL;
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let sum = 0; for (let y = 0; y < CELL; y += 2) for (let x = 0; x < CELL; x += 2) sum += data[((r * CELL + y) * cv.width + c * CELL + x) * 4 + 3];
    if (sum / ((CELL / 2) * (CELL / 2)) > 128) for (let z = -1; z <= 1; z++) cells.push([c - cols / 2 + 0.5, rows / 2 - r - 0.5, z]);
  }
  const VS = 0.34, SN = reduced ? 0 : mobile ? 40 : 80, N = cells.length + SN;
  const wgeo = new THREE.InstancedBufferGeometry().copy(box); wgeo.instanceCount = N;
  const aStart = new Float32Array(N * 3), aTarget = new Float32Array(N * 3), aMisc = new Float32Array(N * 4), aCol = new Float32Array(N * 3);
  const wordW = cols * VS, wordH = rows * VS;
  cells.forEach((p, i) => {
    const t = [p[0] * VS, p[1] * VS, p[2] * VS];
    const a = Math.random() * Math.PI * 2, el = (Math.random() - 0.5) * 1.6, d = 34 + Math.random() * 40;
    aStart.set([Math.cos(a) * Math.cos(el) * d, Math.sin(el) * d * 0.7, -Math.abs(Math.sin(a)) * d * 0.6 - 10], i * 3);
    aTarget.set(t, i * 3);
    aMisc.set([0.75 + Math.random() * 0.42, 0, Math.random(), Math.random()], i * 4);
    const c = new THREE.Color().copy(C.deep).lerp(C.cream, Math.min(1, Math.max(0, 0.25 + (p[1] / rows) * 0.9 + (p[2] + 1) * 0.08 + (Math.random() - 0.5) * 0.12)));
    aCol.set([c.r, c.g, c.b], i * 3);
  });
  for (let k = 0; k < SN; k++) {                       // the snipers
    const i = cells.length + k, a = (k / SN) * Math.PI * 2 + Math.random() * 0.3;
    const hit = [Math.cos(a) * wordW * 0.62, Math.sin(a) * wordH * 0.95, 1 + Math.random() * 2];
    const far = 30 + Math.random() * 20;
    aStart.set([Math.cos(a) * far, Math.sin(a) * far * 0.6, 8 + Math.random() * 6], i * 3);
    aTarget.set(hit, i * 3);
    aMisc.set([0.05 + Math.random() * 0.55, 1, Math.random(), Math.random()], i * 4);
    aCol.set([C.coral.r, C.coral.g, C.coral.b], i * 3);
  }
  wgeo.setAttribute('aStart', new THREE.InstancedBufferAttribute(aStart, 3));
  wgeo.setAttribute('aTarget', new THREE.InstancedBufferAttribute(aTarget, 3));
  wgeo.setAttribute('aMisc', new THREE.InstancedBufferAttribute(aMisc, 4));
  wgeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(aCol, 3));
  const U = { uT: { value: reduced ? 9 : 0 }, uScatter: { value: 0 }, uTime: { value: 0 }, uVs: { value: VS }, uPulse: { value: 0 } };
  const wmat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 });
  wmat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = `attribute vec3 aStart; attribute vec3 aTarget; attribute vec4 aMisc; attribute vec3 aCol;
      uniform float uT; uniform float uScatter; uniform float uTime; uniform float uVs;
      varying float vFlash; varying vec3 vCol; varying vec2 vEdge;
      mat3 rotA(vec3 ax, float a){ float s = sin(a), c = cos(a), o = 1. - c;
        return mat3(o*ax.x*ax.x + c, o*ax.x*ax.y + ax.z*s, o*ax.z*ax.x - ax.y*s, o*ax.x*ax.y - ax.z*s, o*ax.y*ax.y + c, o*ax.y*ax.z + ax.x*s, o*ax.z*ax.x + ax.y*s, o*ax.y*ax.z - ax.x*s, o*ax.z*ax.z + c); }
      float eob(float x){ float c1 = 1.25, c3 = c1 + 1.; x -= 1.; return 1. + c3*x*x*x + c1*x*x; }
      ` + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `
        float dl = aMisc.x, kind = aMisc.y, r1 = aMisc.z, r2 = aMisc.w;
        vec3 apos; float sc = 1., spin = 0.; vFlash = 0.; vCol = aCol; vEdge = uv;
        if (kind < .5) {
          float p = clamp((uT - dl) / 1.05, 0., 1.);
          apos = mix(aStart, aTarget, eob(p));
          spin = (1. - p) * 9. * (r1 - .5);
          sc = smoothstep(0., .12, p);
          apos.y += sin(uTime * 1.5 + aTarget.x * .42 + aTarget.y * .3) * .03 * step(1., p);
          vec3 dir = normalize(vec3(r1 - .5, r2 - .5, fract(r1 * 7.31) - .25) + 1e-3);
          apos += dir * uScatter * (24. + 46. * r2) + vec3(0., 0., uScatter * 9. * (r1 - .3));
          spin += uScatter * 10. * (r2 - .5);
          sc *= 1. - smoothstep(.2, .9, uScatter) * (r1 < .07 ? .55 : 1.);         // most voxels leave; a few stay as stars
        } else {
          float p = clamp((uT - dl) / .95, 0., 1.);
          vec3 n = normalize(vec3(aTarget.xy, 2.));
          if (p < .42) { float q = p / .42; apos = mix(aStart, aTarget, q * q); }
          else { float q = (p - .42) / .58; vec3 o = normalize(reflect(normalize(aTarget - aStart), n) + vec3(r1 - .5, r2 - .5, .3) * .7);
                 apos = aTarget + o * (1. - (1. - q) * (1. - q)) * 18.; }
          vFlash = (exp(-abs(p - .42) * 16.) + .25) * step(.0001, p) * (1. - step(1., p));
          sc = (1. - smoothstep(.5, .98, p)) * step(.0001, p) * 1.7;
          spin = p * 14. * (r1 - .5);
        }
        mat3 RR = rotA(normalize(vec3(r1 - .3, r2 - .5, .5)), spin);
        vec3 objectNormal = RR * normal;
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed = RR * (position * uVs * .93 * sc) + apos;');
    sh.fragmentShader = `uniform float uPulse; varying float vFlash; varying vec3 vCol; varying vec2 vEdge;\n` + sh.fragmentShader
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * vCol, opacity );')
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        float eg = max(abs(vEdge.x - .5), abs(vEdge.y - .5)) * 2.;
        gl_FragColor.rgb *= 1. - smoothstep(.74, 1., eg) * .34;
        gl_FragColor.rgb += vec3(1., .42, .3) * vFlash * 3.2 + vCol * uPulse * .55;`);
  };
  const word = new THREE.Mesh(wgeo, wmat); word.frustumCulled = false;
  const wordGroup = new THREE.Group(); wordGroup.add(word); scene.add(wordGroup);

  // ---------- depth of field: scatter-as-gather bokeh (Gustafsson), skipped on phones ----------
  let portrait = false, rt = null, quad = null, dofScene = null, dofCam = null, useDof = !mobile;
  const dofU = { tColor: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2() }, uFocus: { value: 28 }, uK: { value: 45 }, uNear: { value: cam.near }, uFar: { value: cam.far }, uMax: { value: 15 } };
  function setupDof() {
    const w = Math.floor(innerWidth * DPR), h = Math.floor(innerHeight * DPR);
    if (rt) rt.dispose();
    rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType) });
    dofU.tColor.value = rt.texture; dofU.tDepth.value = rt.depthTexture; dofU.uRes.value.set(w, h); dofU.uMax.value = 15 * DPR;
    if (!quad) {
      dofScene = new THREE.Scene(); dofCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
        uniforms: dofU, depthTest: false, depthWrite: false,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
        fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D tColor, tDepth; uniform vec2 uRes; uniform float uFocus, uK, uNear, uFar, uMax;
          float lin(float d){ float z = d * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
          float coc(float z){ return clamp(abs(1. / uFocus - 1. / z) * uK, 0., 1.) * uMax; }
          void main(){
            float cz = lin(texture2D(tDepth, vUv).r), cs = coc(cz);
            vec3 col = texture2D(tColor, vUv).rgb; float tot = 1.;
            float rad = 1.6;
            for (int i = 0; i < 90; i++) {
              float ang = float(i) * 2.39996323;
              vec2 tc = vUv + vec2(cos(ang), sin(ang)) * rad / uRes;
              vec3 sc = texture2D(tColor, tc).rgb; float sz = lin(texture2D(tDepth, tc).r), ss = coc(sz);
              if (sz > cz) ss = clamp(ss, 0., cs * 2.);
              float m = smoothstep(rad - .5, rad + .5, ss);
              col += mix(col / tot, sc, m); tot += 1.;
              rad += 2.2 / rad; if (rad > uMax) break;
            }
            gl_FragColor = vec4(col / tot, 1.);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }));
      dofScene.add(quad);
    }
  }
  if (useDof) setupDof();
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
    const visW = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.position.z * cam.aspect;
    const s = Math.min(1.25, (visW * (cam.aspect < 0.9 ? 0.86 : 0.43)) / wordW); wordGroup.scale.setScalar(s);
    wordGroup.position.y = cam.aspect < 0.9 ? 1.6 : 0.9;
    portrait = cam.aspect < 0.9;                                 // tall screens get their own, tighter layout
    if (useDof) setupDof();
  }
  resize(); addEventListener('resize', resize);

  let frozen = null, mx = 0, my = 0, sx = 0, sy = 0, scroll = 0, scrollS = 0, scatter = 0, scatterS = 0, running = true, t0 = -1, time = 0, last = performance.now(), slowFrames = 0, assembledCb = null, fired = false, fps = 60, acc = 0;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  document.addEventListener('visibilitychange', () => { last = performance.now(); });
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || !running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    acc += dt; if (acc < 1 / fps - 0.002) return; const step = acc; acc = 0;
    time += step;
    if (t0 >= 0 && U.uT.value < 9 && frozen == null) U.uT.value = (now - t0) / 1000;
    if (frozen != null) U.uT.value = frozen;
    if (!fired && U.uT.value > 1.95) { fired = true; assembledCb && assembledCb(); }
    U.uTime.value = time; U.uPulse.value = Math.exp(-((U.uT.value - 2.05) ** 2) * 30);
    sx += (mx - sx) * 0.05; sy += (my - sy) * 0.05; scrollS += (scroll - scrollS) * 0.09; scatterS += (scatter - scatterS) * 0.08;
    U.uScatter.value = scatterS;
    const k = Math.min(1, scrollS);
    cam.position.set(sx * 1.4, -sy * 0.8 + k * 3.5, 28 - k * 7);
    cam.lookAt(sx * 0.3, k * 2.5, 0);
    wordGroup.rotation.y = sx * 0.16 * (1 - scatterS); wordGroup.rotation.x = sy * 0.08 * (1 - scatterS);
    for (const o of objects) {
      const f = o.g.userData.follow;
      if (f) { o.g.position.copy(f.position); o.g.scale.copy(f.scale); o.g.visible = f.visible; continue; }
      const b = portrait ? o.alt : o.base; o.g.visible = !!b; if (!b) continue;
      o.g.scale.setScalar(portrait ? 0.56 : 1);
      if (o.wob) o.g.rotation.y = o.rot0 + Math.sin(time * 0.45 + o.ph) * 0.5; else o.g.rotation.y += o.spin * step;
      o.g.position.y = b[1] + Math.sin(time * 0.6 + o.ph) * (portrait ? 0.15 : 0.35);
      o.g.position.x = b[0] * (1 + k * 0.5); o.g.position.z = b[2] + k * 4;
    }
    dofU.uFocus.value = cam.position.length() - k * 2;
    if (useDof && rt) {
      renderer.setRenderTarget(rt); renderer.render(scene, cam);            // linear HDR into the target
      renderer.setRenderTarget(null); renderer.render(dofScene, dofCam);    // bokeh, then tone mapping once
      if (step > 0.034 && fps === 60) { if (++slowFrames > 90) { useDof = false; } } else slowFrames = Math.max(0, slowFrames - 1);
    } else renderer.render(scene, cam);
  }
  requestAnimationFrame(frame);
  return {
    start() { if (t0 < 0 && U.uT.value < 9) t0 = performance.now(); if (reduced) { fired = true; assembledCb && assembledCb(); } },
    skip() { U.uT.value = 9; if (!fired) { fired = true; assembledCb && assembledCb(); } },
    onAssembled(cb) { assembledCb = cb; if (fired) cb(); },
    setScroll(p) { scroll = Math.max(0, p); },
    setScatter(s) { scatter = Math.max(0, Math.min(1, s)); },
    setQuality(q) { fps = q === 'low' ? 30 : 60; },
    setRunning(r) { running = r; last = performance.now(); },
    get dof() { return useDof; },
    freeze(t) { frozen = t; },                                    // dev only: hold the intro at time t (seconds)
  };
}
