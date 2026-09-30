'use strict';

(function () {
  var MAPBOX_TOKEN = 'pk.eyJ1IjoiYXRsYXM1MzUiLCJhIjoiY211bnZjemVoMDRieTJ3cGNpaGFhMndpNCJ9.pM9z7AiNwLqCttyND8m8Mw';
  var MAPBOX_VERSION = 'v3.13.0';
  var SITE = [55.2169868, 25.0427675];
  var STADIUM = [55.2189, 25.0464];

  var story = document.getElementById('story');
  var mapEl = document.getElementById('map');
  var beats = Array.prototype.slice.call(story.querySelectorAll('.beat'));
  var exploreBtn = document.getElementById('explore');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Location story ---------- */

  function goStatic() {
    story.classList.add('is-static');
    story.classList.remove('is-exploring');
    beats.forEach(function (b) { b.classList.add('is-on'); });
  }

  function hasWebgl() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  // Camera keyframes: [lon, lat], zoom, pitch, bearing
  var narrow = window.innerWidth < 700;
  var KEYS = [
    { c: [22, 40], z: narrow ? 0.75 : 1.45, p: 0, b: 0 },
    { c: [55.235, 25.10], z: narrow ? 9.2 : 9.4, p: 0, b: 0 },
    { c: [55.222, 25.040], z: narrow ? 12.8 : 13.1, p: 25, b: 0 },
    { c: narrow ? [55.2176, 25.0438] : SITE, z: narrow ? 15.9 : 16.3, p: 55, b: -25 },
  ];
  // Progress segments: [from, to, keyA, keyB]
  var SEGS = [
    [0.00, 0.10, 0, 0],
    [0.10, 0.34, 0, 1],
    [0.34, 0.42, 1, 1],
    [0.42, 0.62, 1, 2],
    [0.62, 0.70, 2, 2],
    [0.70, 0.92, 2, 3],
    [0.92, 1.00, 3, 3],
  ];
  // Beat text visibility windows in progress
  var BEAT_WIN = [[0, 0.16], [0.30, 0.48], [0.58, 0.74], [0.86, 1.01]];

  var LANDMARKS = [
    { name: 'Palm Jumeirah', c: [55.138, 25.118], win: [0.24, 0.55] },
    { name: 'Downtown · Burj Khalifa', c: [55.2744, 25.1972], win: [0.24, 0.55] },
    { name: 'Dubai Marina', c: [55.140, 25.080], win: [0.24, 0.55] },
    { name: 'DXB airport', c: [55.365, 25.253], win: [0.24, 0.55] },
    { name: 'Al Maktoum · DWC airport', c: [55.161, 24.896], win: [0.24, 0.55] },
    { name: 'Dubai Sports City', c: [55.222, 25.040], win: [0.32, 0.60], cls: 'mk--district' },
    { name: 'Dubai International Cricket Stadium', c: STADIUM, win: [0.62, 1.01] },
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function cameraAt(p) {
    var seg = SEGS[SEGS.length - 1];
    for (var i = 0; i < SEGS.length; i++) {
      if (p <= SEGS[i][1]) { seg = SEGS[i]; break; }
    }
    var A = KEYS[seg[2]], B = KEYS[seg[3]];
    var t = seg[1] === seg[0] ? 0 : ease(clamp((p - seg[0]) / (seg[1] - seg[0]), 0, 1));
    return {
      center: [lerp(A.c[0], B.c[0], t), lerp(A.c[1], B.c[1], t)],
      zoom: lerp(A.z, B.z, t),
      pitch: lerp(A.p, B.p, t),
      bearing: lerp(A.b, B.b, t),
    };
  }

  function progress() {
    var rect = story.getBoundingClientRect();
    var range = story.offsetHeight - window.innerHeight;
    return range <= 0 ? 1 : clamp(-rect.top / range, 0, 1);
  }

  function showBeats(p) {
    beats.forEach(function (b, i) {
      var w = BEAT_WIN[i];
      b.classList.toggle('is-on', p >= w[0] && p < w[1]);
    });
  }

  function loadMapbox(cb, fail) {
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://api.mapbox.com/mapbox-gl-js/' + MAPBOX_VERSION + '/mapbox-gl.css';
    document.head.appendChild(css);
    var s = document.createElement('script');
    s.src = 'https://api.mapbox.com/mapbox-gl-js/' + MAPBOX_VERSION + '/mapbox-gl.js';
    s.async = true;
    s.onload = cb;
    s.onerror = fail;
    document.head.appendChild(s);
  }

  function startStory() {
    var map;
    var loaded = false;
    var exploring = false;
    var markers = [];
    var lastP = -1;
    var idle = 0;
    var lastT = 0;
    var inView = true;

    try {
      window.mapboxgl.accessToken = MAPBOX_TOKEN;
      map = new window.mapboxgl.Map({
        container: mapEl,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        projection: 'globe',
        center: KEYS[0].c,
        zoom: KEYS[0].z,
        pitch: 0,
        bearing: 0,
        interactive: false,
        cooperativeGestures: true,
        attributionControl: true,
        logoPosition: 'bottom-left',
        fadeDuration: 150,
        maxPitch: 70,
        preserveDrawingBuffer: /[?&]qa=1/.test(window.location.search),
      });
    } catch (e) { goStatic(); return; }

    map.on('error', function (e) {
      var st = e && e.error && e.error.status;
      if (!loaded && (st === 401 || st === 403 || st === 404)) goStatic();
    });

    map.on('style.load', function () {
      map.setFog({
        color: 'rgb(200, 214, 226)',
        'high-color': 'rgb(70, 110, 160)',
        'horizon-blend': 0.03,
        'space-color': 'rgb(11, 18, 32)',
        'star-intensity': 0.5,
      });
    });

    map.on('load', function () {
      loaded = true;
      LANDMARKS.forEach(function (l) {
        var el = document.createElement('div');
        el.className = 'mk ' + (l.cls || 'mk--landmark');
        el.innerHTML = '<span class="mk__in">' + (l.cls ? '' : '<span class="mk__dot"></span>') + '<span class="mk__lab"></span></span>';
        el.querySelector('.mk__lab').textContent = l.name;
        var m = new window.mapboxgl.Marker({ element: el, anchor: 'top-left' }).setLngLat(l.c).addTo(map);
        markers.push({ el: el, win: l.win, marker: m });
      });
      var site = document.createElement('div');
      site.className = 'mk mk--site';
      site.innerHTML = '<span class="mk__in">' +
        '<svg class="mk__pin" viewBox="0 0 26 36" aria-hidden="true"><path d="M13 1C6.4 1 1 6.3 1 12.9 1 21.5 13 35 13 35s12-13.5 12-22.1C25 6.3 19.6 1 13 1z" fill="#F5F4EF" stroke="#202A30" stroke-width="1.5"/><circle cx="13" cy="13" r="4" fill="#456577"/></svg>' +
        '<span class="mk__lab">AUREL1A Residence · site</span></span>';
      new window.mapboxgl.Marker({ element: site, anchor: 'top-left' }).setLngLat(SITE).addTo(map);
      markers.push({ el: site, win: [0.74, 1.01] });
      exploreBtn.hidden = false;
      lastP = -1;
      frame(0);
    });
    window.__story = {
      map: map,
      progress: progress,
      isLoaded: function () { return loaded; },
      pause: function () { inView = false; },
      resume: function () { inView = true; lastT = 0; window.requestAnimationFrame(frame); },
    };

    function setMarkers(p) {
      markers.forEach(function (m) {
        m.el.classList.toggle('is-on', exploring ? p >= 0.6 : (p >= m.win[0] && p < m.win[1]));
      });
    }

    function frame(now) {
      if (!inView) return;
      var p = progress();
      var dt = lastT ? Math.min((now - lastT) / 1000, 0.1) : 0;
      lastT = now;
      if (p < 0.10 && !exploring) idle += dt * 1.6;
      if (exploring && p < 0.9) stopExploring();
      if (!exploring) {
        var moved = p !== lastP || p < 0.10;
        if (moved) {
          var cam = cameraAt(p);
          var w = 1 - clamp(p / 0.10, 0, 1);
          cam.center = [cam.center[0] - idle * w, cam.center[1]];
          map.jumpTo(cam);
        }
      }
      if (p !== lastP) { showBeats(p); setMarkers(p); lastP = p; }
      window.requestAnimationFrame(frame);
    }

    function startExploring() {
      exploring = true;
      story.classList.add('is-exploring');
      exploreBtn.classList.add('is-on');
      exploreBtn.textContent = 'Exploring: pinch or drag the map';
      map.dragPan.enable();
      map.scrollZoom.enable();
      map.touchZoomRotate.enable();
      map.doubleClickZoom.enable();
      map.keyboard.enable();
      map.dragRotate.enable();
      setMarkers(progress());
    }
    function stopExploring() {
      exploring = false;
      story.classList.remove('is-exploring');
      exploreBtn.classList.remove('is-on');
      exploreBtn.textContent = 'Explore the map';
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.touchZoomRotate.disable();
      map.doubleClickZoom.disable();
      map.keyboard.disable();
      map.dragRotate.disable();
    }
    exploreBtn.addEventListener('click', function () {
      if (exploring) stopExploring(); else startExploring();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var was = inView;
        inView = entries[0].isIntersecting;
        if (inView && !was && loaded) { lastT = 0; window.requestAnimationFrame(frame); }
      }, { threshold: 0 }).observe(story);
    }

    showBeats(progress());
  }

  if (reduced || !hasWebgl()) {
    goStatic();
  } else {
    showBeats(progress());
    window.addEventListener('scroll', function onScroll() {
      if (story.classList.contains('is-static')) return;
      showBeats(progress());
    }, { passive: true });
    loadMapbox(startStory, goStatic);
  }

  /* ---------- Floor plan hotspots ---------- */

  var readout = document.getElementById('plan-readout');
  var hotspots = Array.prototype.slice.call(document.querySelectorAll('.hs'));
  var rooms = Array.prototype.slice.call(document.querySelectorAll('.rooms li'));
  hotspots.forEach(function (h, i) {
    h.addEventListener('click', function () {
      var on = h.classList.contains('is-on');
      hotspots.forEach(function (x) { x.classList.remove('is-on'); });
      rooms.forEach(function (x) { x.classList.remove('is-on'); });
      if (on) {
        readout.textContent = 'Balcony is at the bottom of the plan, facing south-east.';
        return;
      }
      h.classList.add('is-on');
      if (rooms[i]) rooms[i].classList.add('is-on');
      readout.textContent = h.dataset.room + ': ' + h.dataset.dim + ' (' + h.dataset.area + ')';
    });
  });

  /* ---------- Unit 409 visualisations (manifest-driven) ---------- */

  var VIS_NOTE = 'Visualisation of unit 409, based on the official floor plan · furniture and view illustrative.';
  var visuals = document.getElementById('unit-visuals');
  var visualsList = document.getElementById('unit-visuals-list');
  var lb = document.getElementById('lightbox');
  var lbImg = document.getElementById('lb-img');
  var lbCap = document.getElementById('lb-cap');

  function openLightbox(src, alt, caption) {
    if (!lb || typeof lb.showModal !== 'function') return;
    lbImg.src = src;
    lbImg.alt = alt;
    lbCap.textContent = caption;
    document.body.classList.add('lb-open');
    lb.showModal();
  }
  function closeLightbox() {
    if (lb && lb.open) lb.close();
  }
  if (lb) {
    lb.addEventListener('click', closeLightbox);
    lb.addEventListener('close', function () { document.body.classList.remove('lb-open'); lbImg.src = ''; });
    document.getElementById('lb-close').addEventListener('click', closeLightbox);
  }

  if (window.fetch) {
    fetch('img/unit409-manifest.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (items) {
        if (!Array.isArray(items)) return;
        var count = 0;
        items.forEach(function (it, i) {
          var file = typeof it === 'string' ? it : it.file;
          if (!file) return;
          var small = (typeof it === 'object' && it.file720) ? it.file720 : file;
          var label = (typeof it === 'object' && (it.label || it.caption)) ? (it.label || it.caption) : file.replace(/^unit409-/, '').replace(/\.webp$/, '').replace(/-/g, ' ');
          var fig = document.createElement('figure');
          if (i === 0) fig.className = 'is-lead';
          else if (i === 1) fig.className = 'is-wide';
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'shot';
          btn.setAttribute('aria-label', 'Open full screen: ' + label);
          var img = document.createElement('img');
          img.src = 'img/' + small;
          if (small !== file) {
            img.srcset = 'img/' + small + ' 720w, img/' + file + ' 1400w';
            img.sizes = i < 2 ? '(min-width: 900px) 1088px, 100vw' : '(min-width: 900px) 528px, 100vw';
          }
          img.loading = i === 0 ? 'eager' : 'lazy';
          img.decoding = 'async';
          img.alt = 'Visualisation of unit 409: ' + label;
          btn.appendChild(img);
          btn.addEventListener('click', function () { openLightbox('img/' + file, img.alt, label + '. ' + VIS_NOTE); });
          var fc = document.createElement('figcaption');
          var strong = document.createElement('strong');
          strong.textContent = label + '. ';
          fc.appendChild(strong);
          fc.appendChild(document.createTextNode(VIS_NOTE));
          fig.appendChild(btn);
          fig.appendChild(fc);
          visualsList.appendChild(fig);
          count++;
        });
        if (count) visuals.hidden = false;
      })
      .catch(function () {});
  }

  /* ---------- Currency toggle ---------- */

  var pay = document.getElementById('payments');
  var toggles = Array.prototype.slice.call(pay.querySelectorAll('.pay__toggle button'));
  toggles.forEach(function (b) {
    b.addEventListener('click', function () {
      toggles.forEach(function (x) { x.classList.remove('is-on'); x.setAttribute('aria-pressed', 'false'); });
      b.classList.add('is-on');
      b.setAttribute('aria-pressed', 'true');
      pay.classList.toggle('aed-first', b.dataset.cur === 'aed');
    });
  });

  /* ---------- Mobile bottom bar ---------- */

  var bar = document.getElementById('bar');
  var page = document.querySelector('.page');
  var contact = document.getElementById('contact');
  var offer = document.getElementById('offer');
  if (bar) {
    bar.hidden = false;
    page.classList.add('has-bar');
    var updateBar = function () {
      var vh = window.innerHeight;
      var pastOffer = offer.getBoundingClientRect().top < vh * 0.6;
      var atContact = contact.getBoundingClientRect().top < vh * 0.85;
      bar.classList.toggle('is-on', pastOffer && !atContact);
    };
    window.addEventListener('scroll', updateBar, { passive: true });
    window.addEventListener('resize', updateBar);
    updateBar();
  }
})();
