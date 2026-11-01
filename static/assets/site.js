// Небольшие улучшения для страниц: вкладки, фильтр статей, переключатель языка.
// Без JavaScript всё содержимое остаётся видимым.
(function () {
  'use strict';

  // Вкладки: [data-tabs] → ссылки [data-tab] и разделы [data-panel]
  document.querySelectorAll('[data-tabs]').forEach(function (root) {
    var controls = root.querySelectorAll('[data-tab]');
    var panels = root.querySelectorAll('[data-panel]');
    var fallback = root.getAttribute('data-default') || (controls[0] && controls[0].getAttribute('data-tab'));

    function show(id, remember) {
      var found = false;
      panels.forEach(function (p) {
        var on = p.getAttribute('data-panel') === id;
        p.hidden = !on;
        if (on) found = true;
      });
      if (!found) return false;
      controls.forEach(function (c) {
        c.setAttribute('aria-current', c.getAttribute('data-tab') === id ? 'true' : 'false');
      });
      if (remember && window.history && history.replaceState) history.replaceState(null, '', '#' + id);
      return true;
    }

    controls.forEach(function (c) {
      c.addEventListener('click', function (e) {
        e.preventDefault();
        show(c.getAttribute('data-tab'), true);
      });
    });

    function fromHash() {
      var hash = decodeURIComponent(location.hash.replace('#', ''));
      return hash && show(hash, false);
    }
    if (!fromHash()) show(fallback, false);
    window.addEventListener('hashchange', fromHash);
  });

  // Фильтр: [data-filter-root] → кнопки [data-filter] и элементы [data-cat]
  document.querySelectorAll('[data-filter-root]').forEach(function (root) {
    var chips = root.querySelectorAll('[data-filter]');
    var items = root.querySelectorAll('[data-cat]');
    var empty = root.querySelector('[data-filter-empty]');
    var bar = root.querySelector('[data-filter-bar]');
    if (bar) bar.hidden = false;

    function apply(cat) {
      var shown = 0;
      items.forEach(function (it) {
        var on = cat === '*' || it.getAttribute('data-cat') === cat;
        it.hidden = !on;
        if (on) shown++;
      });
      chips.forEach(function (c) {
        c.setAttribute('aria-pressed', c.getAttribute('data-filter') === cat ? 'true' : 'false');
      });
      if (empty) empty.hidden = shown !== 0 || items.length === 0;
    }

    chips.forEach(function (c) {
      c.addEventListener('click', function () { apply(c.getAttribute('data-filter')); });
    });
    apply('*');
  });

  // Переключатель языка сохраняет открытую вкладку (#quarter, #certificates и т. п.)
  document.querySelectorAll('.lang a').forEach(function (a) {
    a.addEventListener('click', function () {
      if (location.hash) a.href = a.href.split('#')[0] + location.hash;
    });
  });

  // ───────── Эффекты (включаются и выключаются в админке: «Анимации и звук») ─────────
  var root = document.documentElement;
  var fxAttr = root.getAttribute('data-fx');
  var fx = (fxAttr === null ? 'wheel sound press' : fxAttr).split(/\s+/);
  var reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function fxOn(name) { return fx.indexOf(name) !== -1; }
  function memory(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* хранилище недоступно — просто не запоминаем */ }
    return null;
  }

  // 1. «Барабан»: чем дальше блок от центра экрана, тем сильнее он повёрнут и сужен.
  //    Верх и низ страницы остаются ровными — первый экран всегда выглядит аккуратно.
  if (fxOn('wheel') && !reduceMotion && window.requestAnimationFrame) (function () {
    var main = document.getElementById('main');
    if (!main) return;
    var MAX_ANGLE = 32;      // наибольший наклон, градусы
    var MIN_SCALE = 0.9;     // насколько сужается блок у края экрана
    var MIN_OPACITY = 0.5;   // насколько бледнеет блок у края экрана
    var FLAT = 0.2;          // ровная зона в центре экрана (доля от половины высоты)
    var BLOCK = /^(block|flex|grid|list-item|table|flow-root|inline-block|inline-flex|inline-grid)$/;
    var items = [], vh = 0, docMax = 0, frameQueued = false, measureQueued = false;

    function ownText(el) {
      for (var n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return true;
      }
      return false;
    }
    // Делим страницу на блоки не выше ~40% экрана: высокие разделы разбираем на части
    function collect(el, out, limit) {
      for (var i = 0; i < el.children.length; i++) {
        var c = el.children[i];
        if (/^(SCRIPT|STYLE|TEMPLATE|BR)$/.test(c.tagName)) continue;
        var d = getComputedStyle(c).display;
        if (d === 'contents') { collect(c, out, limit); continue; }
        if (!BLOCK.test(d)) continue;
        var h = c.getBoundingClientRect().height;
        if (!h) continue;
        var leaf = /^(TABLE|svg|IMG|FIGURE|PRE)$/.test(c.tagName) || !c.children.length || ownText(c);
        if (h > limit && !leaf) {
          var before = out.length;
          collect(c, out, limit);
          if (out.length === before) out.push(c);
        } else {
          out.push(c);
        }
      }
    }

    function measure() {
      measureQueued = false;
      vh = window.innerHeight || root.clientHeight;
      root.classList.add('fx-measure');
      var found = [];
      collect(main, found, vh * 0.4);
      var footer = document.querySelector('.site-footer');
      if (footer) found.push(footer);
      var sy = window.pageYOffset;
      var next = found.map(function (el) {
        var r = el.getBoundingClientRect();
        return { el: el, c: r.top + sy + r.height / 2, h: r.height, on: false };
      });
      root.classList.remove('fx-measure');
      items.forEach(function (it) {
        if (found.indexOf(it.el) === -1) {
          it.el.style.transform = '';
          it.el.style.opacity = '';
          it.el.removeAttribute('data-wheel');
        }
      });
      next.forEach(function (it) {
        it.on = !!it.el.style.transform;
        it.el.setAttribute('data-wheel', '');
      });
      items = next;
      docMax = Math.max(0, root.scrollHeight - vh);
      update();
    }

    function update() {
      frameQueued = false;
      var sy = window.pageYOffset, half = vh / 2;
      var shortPage = docMax < vh * 0.25;
      var persp = Math.round(Math.max(700, vh * 1.1));
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var rel = it.c - sy - half;
        if (Math.abs(rel) - it.h / 2 > vh * 0.9) continue; // далеко за экраном
        var a = 0;
        if (!shortPage) {
          var t = rel / half;
          var lo = (it.c - half) / half;            // положение блока, когда страница в самом верху
          var hi = (it.c - docMax - half) / half;   // положение блока, когда страница в самом низу
          if (lo < 0) t -= lo; else if (hi > 0) t -= hi;
          var x = Math.min(1, Math.max(0, (Math.abs(t) - FLAT) / (1 - FLAT)));
          a = (t < 0 ? -1 : 1) * x * x * (3 - 2 * x);
          a *= Math.min(1, (vh * 0.5) / it.h); // высокие блоки наклоняем меньше
        }
        if (Math.abs(a) < 0.003) {
          if (it.on) { it.el.style.transform = ''; it.el.style.opacity = ''; it.on = false; }
          continue;
        }
        var k = Math.abs(a);
        it.el.style.transform = 'perspective(' + persp + 'px) rotateX(' + (-a * MAX_ANGLE).toFixed(2) + 'deg) scale(' + (1 - (1 - MIN_SCALE) * k).toFixed(4) + ')';
        it.el.style.opacity = (1 - (1 - MIN_OPACITY) * k).toFixed(3);
        it.on = true;
      }
    }

    function onScroll() { if (!frameQueued) { frameQueued = true; requestAnimationFrame(update); } }
    function remeasure() { if (!measureQueued) { measureQueued = true; requestAnimationFrame(measure); } }

    root.classList.add('fx-wheel');
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', remeasure);
    window.addEventListener('load', remeasure);
    window.addEventListener('hashchange', remeasure);
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-tab], [data-filter]')) remeasure();
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    if (window.ResizeObserver) new ResizeObserver(remeasure).observe(main);
    measure();
  })();

  // 2. Нажатие: кнопки вдавливаются и пружинят обратно
  var PRESS = '.btn, .chip, .tile, .nav a, .lang a, .brand, .sound, .more, .socials a, .section-link, .summary-link, .season-link, .note-link, .shot';
  if (fxOn('press') && !reduceMotion) (function () {
    root.classList.add('fx-press');
    var current = null, since = 0, timer = 0;
    function down(el) { current = el; since = Date.now(); el.classList.add('is-pressed'); }
    function up(instant) {
      clearTimeout(timer);
      if (!current) return;
      var el = current;
      current = null;
      setTimeout(function () { el.classList.remove('is-pressed'); }, instant ? 0 : Math.max(0, 110 - (Date.now() - since)));
    }
    document.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || !e.target.closest) return;
      var el = e.target.closest(PRESS);
      if (!el) return;
      up(true);
      if (e.pointerType === 'touch') {
        // на телефоне ждём чуть-чуть: вдруг это не нажатие, а прокрутка
        current = el; since = Date.now();
        timer = setTimeout(function () { if (current === el) el.classList.add('is-pressed'); }, 70);
      } else {
        down(el);
      }
    });
    document.addEventListener('pointerup', function () {
      if (current && !current.classList.contains('is-pressed')) down(current);
      up(false);
    });
    document.addEventListener('pointercancel', function () { up(true); });
    document.addEventListener('dragstart', function () { up(true); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var el = document.activeElement && document.activeElement.closest && document.activeElement.closest(PRESS);
      if (el && !current) down(el);
    });
    document.addEventListener('keyup', function () { up(false); });
  })();

  // 3. Щелчок: короткий мягкий звук, синтезируется в браузере (без файлов)
  if (fxOn('sound')) (function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    var toggle = document.querySelector('.sound');
    if (!AC) { if (toggle) toggle.remove(); return; }
    var enabled = memory('fx-sound') !== 'off';
    var ctx = null, noise = null, lastPointer = '';
    var TARGET = 'a[href], button, summary, [role="button"], [role="tab"]';

    function context() {
      if (!ctx) {
        try { ctx = new AC(); } catch (e) { return null; }
        var len = Math.floor(ctx.sampleRate * 0.03);
        noise = ctx.createBuffer(1, len, ctx.sampleRate);
        var data = noise.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
      return ctx;
    }
    function synth(kind) {
      var t = ctx.currentTime + 0.002;
      var release = kind === 'up';
      var out = ctx.createGain();
      out.gain.value = release ? 0.45 : 0.9;
      out.connect(ctx.destination);
      // щелчок механизма — короткий отфильтрованный шум
      var src = ctx.createBufferSource();
      src.buffer = noise;
      var band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = release ? 5200 : 3400;
      band.Q.value = 1.2;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.0015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (release ? 0.018 : 0.026));
      src.connect(band); band.connect(g); g.connect(out);
      src.start(t); src.stop(t + 0.04);
      // «тело» звука — очень короткий тон с понижением
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(release ? 1700 : 1150, t);
      osc.frequency.exponentialRampToValueAtTime(release ? 1100 : 480, t + 0.035);
      var og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(release ? 0.05 : 0.11, t + 0.002);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      osc.connect(og); og.connect(out);
      osc.start(t); osc.stop(t + 0.06);
    }
    function play(kind, force) {
      if ((!enabled && !force) || !context()) return;
      if (ctx.state === 'running') { synth(kind); return; }
      var p = ctx.resume && ctx.resume();
      if (p && p.then) p.then(function () { if (ctx.state === 'running') synth(kind); }, function () {});
    }

    // мышь: щелчок при нажатии и тихий «отпуск»; телефон: щелчок при касании (не при прокрутке)
    document.addEventListener('pointerdown', function (e) {
      lastPointer = e.pointerType || 'mouse';
      if (lastPointer === 'touch' || e.button !== 0 || !e.target.closest || !e.target.closest(TARGET)) return;
      play('down');
    }, true);
    document.addEventListener('pointerup', function (e) {
      if (lastPointer === 'touch' || e.button !== 0 || !e.target.closest || !e.target.closest(TARGET)) return;
      play('up');
    }, true);
    document.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest(TARGET) || e.target.closest('.sound')) return;
      if (e.detail === 0 || lastPointer === 'touch') play('down');
    }, true);

    if (toggle) {
      var paint = function () { toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false'); };
      paint();
      toggle.hidden = false;
      toggle.addEventListener('click', function () {
        enabled = !enabled;
        memory('fx-sound', enabled ? 'on' : 'off');
        paint();
        if (enabled) play('down', true);
      });
    }
  })();
})();
