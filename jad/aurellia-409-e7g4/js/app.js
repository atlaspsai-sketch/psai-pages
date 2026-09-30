const DATA = JSON.parse(document.getElementById('unit-data').textContent);
const FX = DATA.fx.aedPerGbp;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmtAed = (n) => 'AED ' + Math.round(n).toLocaleString('en-GB');
const fmtGbp = (n) => '£' + Math.round(n).toLocaleString('en-GB');
const aedToGbp = (n) => n / FX;

/* ---------- payment steps ---------- */
const PRICE = DATA.price.sellingAed;
const steps = (() => {
  const s = DATA.schedule;
  const out = [];
  const booking = s.slice(0, 3);
  out.push({ when: 'Today · reservation', phase: 'Reserve', aed: booking.reduce((a, r) => a + r.aed, 0), pct: 20, lines: booking, stage: 0 });
  s.slice(3).forEach((r) => {
    const isCompletion = r.phase === 'completion';
    const pct = isCompletion ? 26 : (r.phase === 'post' ? 2 : 1);
    out.push({
      when: r.when,
      phase: isCompletion ? 'Keys · completion' : (r.phase === 'post' ? 'Monthly 2% · after moving in' : 'Monthly 1% · under construction'),
      aed: r.aed, pct, lines: [r],
    });
  });
  let cum = 0; let cumPct = 0;
  const total = out.reduce((a, x) => a + x.aed, 0);
  out.forEach((x, i) => {
    cum += x.aed; cumPct += x.pct;
    x.paid = cum; x.left = total - cum; x.pctPaid = cumPct;
    x.build = Math.min(1, i / 17);
    x.index = i;
  });
  return out;
})();
const TOTAL_AED = steps[steps.length - 1].paid;

/* ---------- opening particles ---------- */
const hero = document.getElementById('top');
const opening = document.getElementById('opening');
const heroViewerEl = document.getElementById('viewer-hero');
let openingDone = false;

function finishOpening() {
  if (openingDone) return;
  openingDone = true;
  hero.classList.add('is-ready');
  buildHero();
  setTimeout(() => { opening.remove(); }, 1400);
}

function runOpening(outline) {
  const ctx = opening.getContext('2d');
  if (!ctx || REDUCED) { finishOpening(); return; }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = hero.clientWidth; const H = hero.clientHeight;
  opening.width = W * dpr; opening.height = H * dpr;
  ctx.scale(dpr, dpr);
  const vr = heroViewerEl.getBoundingClientRect();
  const hr = hero.getBoundingClientRect();
  const box = { x: vr.left - hr.left, y: vr.top - hr.top, w: vr.width, h: vr.height };
  const N = W < 700 ? 900 : 1600;
  const pts = [];
  const xs = outline.map((p) => p[0]); const zs = outline.map((p) => p[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minZ = Math.min(...zs); const maxZ = Math.max(...zs);
  const scale = Math.min(box.w * 0.78 / (maxX - minX), box.h * 0.78 / (maxZ - minZ));
  const ox = box.x + box.w / 2 - ((maxX + minX) / 2 - minX) * scale - minX * scale;
  const oz = box.y + box.h / 2 + ((maxZ + minZ) / 2) * scale;
  const toScreen = (x, z) => [ox + x * scale, oz - z * scale];
  const targets = [];
  const perim = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]; const b = outline[(i + 1) % outline.length];
    perim.push([a, b, Math.hypot(b[0] - a[0], b[1] - a[1])]);
  }
  const total = perim.reduce((s, e) => s + e[2], 0);
  const count = Math.floor(N * 0.55);
  perim.forEach(([a, b, len]) => {
    const k = Math.max(2, Math.round(count * len / total));
    for (let i = 0; i < k; i++) {
      const t = i / k;
      targets.push(toScreen(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t));
    }
  });
  for (let i = 0; i < N; i++) {
    const tgt = i < targets.length ? targets[i] : null;
    pts.push({ x: Math.random() * W, y: H * 0.35 + Math.random() * H * 0.75, ph: Math.random() * Math.PI * 2, tgt, sx: Math.random() * W, sy: Math.random() * H });
  }
  const t0 = performance.now();
  const DUR = { wave: 1300, form: 1300, hold: 500 };
  let raf = 0;
  const draw = (now) => {
    const t = now - t0;
    ctx.clearRect(0, 0, W, H);
    const form = Math.min(1, Math.max(0, (t - DUR.wave) / DUR.form));
    const e = 1 - Math.pow(1 - form, 3);
    const fade = t > DUR.wave + DUR.form + DUR.hold ? Math.min(1, (t - DUR.wave - DUR.form - DUR.hold) / 700) : 0;
    for (const p of pts) {
      const wave = Math.sin(p.x * 0.012 + t * 0.0011 + p.ph) * 0.5 + Math.sin(p.y * 0.02 - t * 0.0008) * 0.5;
      const wx = p.x + Math.sin(t * 0.0006 + p.ph) * 14;
      const wy = p.y + wave * 26;
      let x = wx; let y = wy; let r = 0.6 + (wave + 1) * 1.1; let a = 0.25 + (wave + 1) * 0.3;
      if (p.tgt) {
        x = wx + (p.tgt[0] - wx) * e;
        y = wy + (p.tgt[1] - wy) * e;
        r = r * (1 - e) + 1.3 * e;
        a = a * (1 - e) + 0.95 * e;
      } else {
        a *= (1 - e * 0.85);
      }
      a *= (1 - fade);
      if (a < 0.01) continue;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${p.tgt ? '242,190,133' : '217,155,95'},${a.toFixed(3)})`;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (t > DUR.wave + DUR.form + DUR.hold - 150 && !openingDone) finishOpening();
    if (fade < 1 && !stopped) raf = requestAnimationFrame(draw);
  };
  let stopped = false;
  raf = requestAnimationFrame(draw);
  const skip = () => { stopped = true; cancelAnimationFrame(raf); finishOpening(); };
  window.addEventListener('scroll', skip, { once: true, passive: true });
  hero.addEventListener('pointerdown', skip, { once: true });
  setTimeout(() => { if (!openingDone) skip(); }, 5200);
}

/* ---------- 3D ---------- */
const tmViewerEl = document.getElementById('viewer-tm');
let heroViewer = null; let tmViewer = null;
let stageFallbackAvailable = true;

function setupFallbackImg(el) {
  const img = el.querySelector('.viewer__fallback img');
  img.addEventListener('error', () => {
    if (img.dataset.stageSrc) stageFallbackAvailable = false;
    img.src = img.dataset.fallback;
    img.removeAttribute('data-stage-src');
  }, { once: true });
}
function showFallback(el) {
  const img = el.querySelector('.viewer__fallback img');
  if (!img.getAttribute('src')) img.src = img.dataset.src;
  el.classList.add('is-fallback');
  if (el === tmViewerEl && typeof renderStep === 'function') renderStep(Number(scrub.value), true);
}
setupFallbackImg(heroViewerEl);
setupFallbackImg(tmViewerEl);


let unitReady = null; let mod3d = null; let heroBuilt = false;
function buildHero() {
  if (heroBuilt || !unitReady || !openingDone || !mod3d) return;
  heroBuilt = true;
  try {
    heroViewer = new mod3d.UnitViewer(heroViewerEl, unitReady, { intro: true, autorotate: true, reduced: REDUCED });
  } catch (e) {
    showFallback(heroViewerEl);
  }
  wireRooms(heroViewerEl, heroViewer);
  wireCompass(heroViewerEl, heroViewer, unitReady.north);
}

async function init3d() {
  try {
    mod3d = await import('./unit3d.js');
  } catch (e) {
    runOpening(null);
    showFallback(heroViewerEl); showFallback(tmViewerEl);
    return;
  }
  if (!mod3d.hasWebGL()) {
    runOpening(mod3d.PLAN.outline);
    showFallback(heroViewerEl); showFallback(tmViewerEl);
    return;
  }
  runOpening(mod3d.PLAN.outline);
  try {
    unitReady = await mod3d.loadUnit();
  } catch (e) {
    showFallback(heroViewerEl); showFallback(tmViewerEl);
    return;
  }
  buildHero();
  const startTm = () => {
    if (tmViewer) return;
    try {
      tmViewer = new mod3d.UnitViewer(tmViewerEl, unitReady, { autorotate: false, reduced: REDUCED, cloneMaterials: true });
      tmViewer.setBuild(steps[Number(scrub.value)].build);
    } catch (e) {
      showFallback(tmViewerEl);
    }
  };
  const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { startTm(); io.disconnect(); } }, { rootMargin: '600px 0px' });
  io.observe(tmViewerEl);
}

function wireRooms(el, viewer) {
  const dim = el.querySelector('[data-dim]');
  const buttons = el.querySelectorAll('[data-room]');
  buttons.forEach((b) => {
    b.addEventListener('click', () => {
      const pressed = b.getAttribute('aria-pressed') === 'true';
      buttons.forEach((x) => x.setAttribute('aria-pressed', 'false'));
      if (pressed) {
        if (viewer) viewer.goHome();
        dim.textContent = '';
        return;
      }
      b.setAttribute('aria-pressed', 'true');
      const r = viewer ? viewer.goToRoom(b.dataset.room) : null;
      if (r && r.w_mm) {
        const wm = (r.w_mm / 1000).toFixed(2); const dm = (r.d_mm / 1000).toFixed(2);
        const wf = (r.w_mm / 304.8).toFixed(1); const df = (r.d_mm / 304.8).toFixed(1);
        dim.innerHTML = `<b>${r.label}</b> · ${wm} × ${dm} m · ${wf} × ${df} ft`;
      } else if (r) {
        dim.innerHTML = `<b>${r.label}</b>`;
      }
    });
  });
}

function wireCompass(el, viewer, north) {
  const rose = el.querySelector('[data-rose]');
  if (!rose || !viewer) return;
  // At azimuth 0 the plan's -Z is screen-up; north sits `north` degrees clockwise from it, and orbiting by az turns the plan az degrees clockwise on screen.
  const apply = (az) => { rose.style.transform = `rotate(${(north + az * 180 / Math.PI).toFixed(1)}deg)`; };
  viewer.onAzimuth(apply);
  apply(viewer.controls.getAzimuthalAngle());
}

/* ---------- time machine ---------- */
const scrub = document.getElementById('scrub');
const tm = (k) => document.querySelector(`[data-tm="${k}"]`);
const marks = document.querySelectorAll('[data-marks] li');
let cur = 'gbp';
const shown = { paid: 0, now: 0, left: 0 };
let tweenRaf = 0;

function pair(aed) {
  const g = fmtGbp(aedToGbp(aed)); const a = fmtAed(aed);
  return cur === 'gbp' ? [g, a] : [a, g];
}
function paint(vals) {
  const [p1, p2] = pair(vals.paid); tm('paid1').textContent = p1; tm('paid2').textContent = p2;
  const [n1, n2] = pair(vals.now); tm('now1').textContent = n1; tm('now2').textContent = n2;
  const [l1, l2] = pair(vals.left); tm('left1').textContent = l1; tm('left2').textContent = l2;
}
function renderStep(i, instant) {
  const s = steps[i];
  tm('when').textContent = s.when;
  tm('phase').textContent = s.phase;
  tm('pct').textContent = s.pctPaid + '%';
  tm('bar').style.setProperty('--p', s.pctPaid + '%');
  tm('fill').style.setProperty('--p', (i / (steps.length - 1) * 100) + '%');
  const lines = tm('lines');
  if (s.lines.length > 1) {
    lines.innerHTML = s.lines.map((r) => `<div><span>${r.label}</span><span>${cur === 'gbp' ? fmtGbp(aedToGbp(r.aed)) + ' · ' + fmtAed(r.aed) : fmtAed(r.aed) + ' · ' + fmtGbp(aedToGbp(r.aed))}</span></div>`).join('');
  } else if (i === 17) {
    lines.innerHTML = `<div><span>62% of the price paid by now</span><span>${cur === 'gbp' ? fmtGbp(aedToGbp(s.paid)) : fmtAed(s.paid)} incl. fees</span></div><div><span>Registered in your name · keys in hand</span><span>Mar 2028</span></div>`;
  } else if (i === steps.length - 1) {
    lines.innerHTML = `<div><span>Fully paid · nothing left to pay</span><span>Oct 2029</span></div>`;
  } else {
    lines.innerHTML = '';
  }
  marks.forEach((m) => {
    const p = Number(m.dataset.pos);
    let on = false;
    if (p === 0) on = i === 0;
    else if (p === 1) on = i >= 1 && i <= 16;
    else if (p === 17) on = i === 17;
    else if (p === 18) on = i >= 18 && i < steps.length - 1;
    else if (p === 36) on = i === steps.length - 1;
    m.classList.toggle('is-on', on);
  });
  const target = { paid: s.paid, now: s.aed, left: s.left };
  cancelAnimationFrame(tweenRaf);
  if (instant || REDUCED) { Object.assign(shown, target); paint(shown); }
  else {
    const from = { ...shown }; const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 260); const e = 1 - Math.pow(1 - k, 3);
      shown.paid = from.paid + (target.paid - from.paid) * e;
      shown.now = from.now + (target.now - from.now) * e;
      shown.left = from.left + (target.left - from.left) * e;
      paint(shown);
      if (k < 1) tweenRaf = requestAnimationFrame(step);
    };
    tweenRaf = requestAnimationFrame(step);
  }
  if (tmViewer) tmViewer.setBuild(s.build);
  const fb = tmViewerEl.querySelector('.viewer__fallback img');
  if (tmViewerEl.classList.contains('is-fallback') && stageFallbackAvailable && fb.dataset.stageSrc) {
    const n = Math.max(1, Math.min(6, Math.ceil(s.build * 6)));
    fb.src = fb.dataset.stageSrc.replace('{n}', n);
  }
}
scrub.max = String(steps.length - 1);
scrub.addEventListener('input', () => renderStep(Number(scrub.value), false));
marks.forEach((m) => m.querySelector('button').addEventListener('click', () => { scrub.value = m.dataset.pos; renderStep(Number(m.dataset.pos), false); }));
document.querySelectorAll('[data-cur]').forEach((b) => b.addEventListener('click', () => {
  cur = b.dataset.cur;
  document.querySelectorAll('[data-cur]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  renderStep(Number(scrub.value), true);
}));
renderStep(0, true);

/* ---------- reveals ---------- */
const rv = document.querySelectorAll('.rv');
const rio = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
rv.forEach((el) => rio.observe(el));

/* ---------- sticky CTA ---------- */
const bar = document.querySelector('[data-cta-bar]');
const signoff = document.getElementById('jad');
let heroOut = false; let signoffIn = false;
const barIo = new IntersectionObserver((en) => {
  en.forEach((e) => {
    if (e.target === hero) heroOut = !e.isIntersecting;
    if (e.target === signoff) signoffIn = e.isIntersecting && e.intersectionRatio > 0.35;
  });
  bar.classList.toggle('is-on', heroOut && !signoffIn);
}, { threshold: [0, 0.35, 0.6] });
barIo.observe(hero); barIo.observe(signoff);

/* ---------- lightbox ---------- */
const lb = document.querySelector('[data-lightbox]');
const lbImg = lb.querySelector('[data-lightbox-img]');
const lbCap = lb.querySelector('[data-lightbox-cap]');
let lbItems = []; let lbIndex = 0;
function showLb(i) {
  lbIndex = (i + lbItems.length) % lbItems.length;
  const it = lbItems[lbIndex];
  lbImg.src = it.full; lbImg.alt = it.alt; lbCap.textContent = it.cap;
}
document.querySelectorAll('[data-gallery]').forEach((g) => {
  const items = [...g.querySelectorAll('figure')].map((f) => ({ full: f.querySelector('button').dataset.full, alt: f.querySelector('img').alt, cap: f.querySelector('figcaption').textContent }));
  g.querySelectorAll('button').forEach((b, i) => b.addEventListener('click', () => { lbItems = items; showLb(i); if (typeof lb.showModal === 'function') lb.showModal(); }));
});
lb.querySelector('[data-lightbox-close]').addEventListener('click', () => lb.close());
lb.querySelector('[data-lightbox-prev]').addEventListener('click', () => showLb(lbIndex - 1));
lb.querySelector('[data-lightbox-next]').addEventListener('click', () => showLb(lbIndex + 1));
lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
let sx = 0;
lb.addEventListener('pointerdown', (e) => { sx = e.clientX; });
lb.addEventListener('pointerup', (e) => { const dx = e.clientX - sx; if (Math.abs(dx) > 50) showLb(lbIndex + (dx < 0 ? 1 : -1)); });

init3d();

window.__unit409 = { steps, TOTAL_AED, freeze() { [heroViewer, tmViewer].forEach((v) => { if (v) v.autorotate = false; }); }, viewers() { return { hero: heroViewer, tm: tmViewer }; } };
