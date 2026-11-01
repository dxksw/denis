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

  // 1. «Барабан»: страница лежит на поверхности цилиндра.
  //    Центр экрана ровный, выше и ниже страница плавно загибается дугой.
  //    Текст режется на строки, поэтому изгиб гладкий, а не кусками.
  //    Вверху и внизу страницы всё ровно — первый экран выглядит аккуратно.
  if (fxOn('wheel') && !reduceMotion && window.requestAnimationFrame) (function () {
    var main = document.getElementById('main');
    if (!main) return;
    // Сила изгиба выбирается в админке: [наклон у края экрана, ровная полоса в центре, бледность края]
    var LEVELS = {
      subtle: [12, 0.18, 0.88],   // едва заметно
      light:  [20, 0.15, 0.75],   // слегка (по умолчанию)
      medium: [35, 0.12, 0.5],    // средне
      strong: [56, 0.1, 0.3]      // сильно
    };
    var level = LEVELS[root.getAttribute('data-fx-strength')] || LEVELS.light;
    var EDGE = level[0] * Math.PI / 180;
    var BAND = level[1];
    var MIN_OPACITY = level[2];
    var BLOCK = /^(block|flex|grid|list-item|table|flow-root|inline-block|inline-flex|inline-grid)$/;
    var WHOLE = 'a, button, summary, label, input, select, textarea, details, [role="button"], [role="tab"], li, table, svg, img, video, iframe, canvas, pre, .scroll-x, .ornament';
    var facets = [], splits = [];
    var vh = 0, vw = 0, P = 0, R = 0, horizon = 0, docMax = 0, splitWidth = 0;
    var frameQueued = false, measureQueued = false, forceSplit = false, noSplit = false;

    function translated() { return /translated-/.test(root.className); }

    // ---------- строки ----------
    function wrapWords(el) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      var texts = [];
      while (walker.nextNode()) texts.push(walker.currentNode);
      texts.forEach(function (t) {
        if (!/\S/.test(t.nodeValue)) return;
        var frag = document.createDocumentFragment();
        t.nodeValue.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          var w = document.createElement('span');
          w.className = 'wd';
          w.textContent = part;
          frag.appendChild(w);
        });
        t.parentNode.replaceChild(frag, t);
      });
    }
    function unwrap(node) {
      while (node.firstChild) node.parentNode.insertBefore(node.firstChild, node);
      node.parentNode.removeChild(node);
    }
    function splitLines(el, lineHeight) {
      var html = el.innerHTML;
      wrapWords(el);
      var words = el.querySelectorAll('span.wd');
      var starts = [], lastTop = null, ok = words.length > 1;
      for (var i = 0; ok && i < words.length; i++) {
        var rects = words[i].getClientRects();
        if (rects.length > 1) { ok = false; break; }
        if (!rects.length) continue;
        if (lastTop === null || rects[0].top > lastTop + lineHeight * 0.5) { starts.push(words[i]); lastTop = rects[0].top; }
      }
      if (!ok || starts.length < 2) { el.innerHTML = html; return false; }
      var range = document.createRange(), lines = [];
      for (var k = 1; k < starts.length; k++) {
        range.setStart(el, 0);
        range.setEndBefore(starts[k]);
        lines.push(range.extractContents());
      }
      range.selectNodeContents(el);
      lines.push(range.extractContents());
      lines.forEach(function (frag) {
        var ln = document.createElement('span');
        ln.className = 'ln';
        ln.appendChild(frag);
        el.appendChild(ln);
      });
      Array.prototype.slice.call(el.querySelectorAll('span.wd')).forEach(unwrap);
      // пустые «осколки» ссылок и выделений на стыке строк
      Array.prototype.slice.call(el.querySelectorAll('.ln *')).forEach(function (n) {
        if (n.parentNode && !/^(IMG|BR|svg|SVG|INPUT)$/.test(n.tagName) && !n.textContent && !n.querySelector('img, svg, br')) n.parentNode.removeChild(n);
      });
      el.normalize();
      splits.push({ el: el, html: html });
      return true;
    }
    function restoreLines() {
      splits.forEach(function (s) { s.el.innerHTML = s.html; });
      splits = [];
    }

    // ---------- из чего состоит барабан ----------
    function painted(cs) {
      if (cs.backgroundImage !== 'none' || cs.boxShadow !== 'none') return 2;
      var bg = cs.backgroundColor;
      if (bg && bg !== 'transparent' && !/,\s*0\)$/.test(bg)) return 2;
      var sides = 0;
      ['Top', 'Right', 'Bottom', 'Left'].forEach(function (s) {
        if (parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none') sides++;
      });
      return sides >= 3 ? 2 : sides ? 1 : 0;
    }
    function pseudo(el) {
      var b = getComputedStyle(el, '::before').content, a = getComputedStyle(el, '::after').content;
      return (b && b !== 'none' && b !== 'normal') || (a && a !== 'none' && a !== 'normal');
    }
    function blockChildren(el) {
      for (var c = el.firstElementChild; c; c = c.nextElementSibling) {
        var d = getComputedStyle(c).display;
        if (d !== 'none' && (BLOCK.test(d) || d === 'contents')) return true;
      }
      return false;
    }
    function ownText(el) {
      for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return true;
      return false;
    }
    function collect(el, out) {
      for (var c = el.firstElementChild; c; c = c.nextElementSibling) {
        if (/^(SCRIPT|STYLE|TEMPLATE|BR|NOSCRIPT)$/.test(c.tagName)) continue;
        var cs = getComputedStyle(c);
        if (cs.display === 'none') continue;
        if (cs.display === 'contents') { collect(c, out); continue; }
        if (!BLOCK.test(cs.display)) continue;
        var h = c.getBoundingClientRect().height;
        if (!h) continue;
        var paint = painted(cs);
        if (paint === 2 || (paint === 1 && h <= vh * 0.35) || c.matches(WHOLE) || pseudo(c) || cs.position === 'fixed' || cs.position === 'sticky') { out.push(c); continue; }
        if (!blockChildren(c)) {
          var lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
          if (!noSplit && h > lh * 1.6 && splitLines(c, lh)) {
            for (var l = c.firstElementChild; l; l = l.nextElementSibling) out.push(l);
          } else {
            out.push(c);
          }
          continue;
        }
        if (ownText(c)) { out.push(c); continue; }
        collect(c, out);
      }
    }

    // ---------- замер ----------
    function measure() {
      measureQueued = false;
      vh = window.innerHeight || root.clientHeight;
      vw = root.clientWidth;
      var half = vh / 2, rest = half - BAND * vh;
      P = Math.max(600, vh * 1.1);
      var den = P * Math.sin(EDGE) - rest * (1 - Math.cos(EDGE));
      R = den > 0 ? rest * P / den : rest / EDGE;
      horizon = Math.acos(R / (P + R));
      if (translated() && !noSplit) { noSplit = true; forceSplit = true; }
      root.classList.add('fx-measure');
      if (forceSplit || (splits.length && vw !== splitWidth)) restoreLines();
      forceSplit = false;
      splitWidth = vw;

      var found = [];
      var bar = document.querySelector('.topbar'), head = document.querySelector('.site-header'), foot = document.querySelector('.site-footer');
      if (bar) found.push(bar);
      if (head) found.push(head);
      collect(main, found);
      if (foot) found.push(foot);

      var sy = window.pageYOffset;
      var old = facets;
      facets = found.map(function (el) {
        var r = el.getBoundingClientRect();
        return { el: el, top: r.top + sy, h: r.height, left: r.left, on: false };
      });
      root.classList.remove('fx-measure');
      old.forEach(function (f) {
        if (found.indexOf(f.el) === -1 && f.el.isConnected) {
          f.el.style.transform = f.el.style.opacity = f.el.style.visibility = '';
          f.el.removeAttribute('data-facet');
        }
      });
      facets.forEach(function (f) {
        f.on = !!f.el.style.transform;
        f.el.setAttribute('data-facet', '');
      });
      docMax = Math.max(0, root.scrollHeight - vh);
      update();
    }

    // ---------- кадр ----------
    function reset(f) {
      if (!f.on) return;
      f.el.style.transform = f.el.style.opacity = f.el.style.visibility = '';
      f.on = false;
    }
    function update() {
      frameQueued = false;
      var s = window.pageYOffset, half = vh / 2, band = BAND * vh, rest = half - band;
      var upper = Math.min(rest, s);                     // линия изгиба сверху (на экране)
      var lower = vh - Math.min(rest, docMax - s);       // линия изгиба снизу
      var reach = R * horizon + rest + vh * 0.1;
      var cx = vw / 2;
      for (var i = 0; i < facets.length; i++) {
        var f = facets[i];
        var yc = f.top + f.h / 2 - s;
        if (Math.abs(yc - half) - f.h / 2 > reach) { reset(f); continue; }
        var d = yc < upper ? upper - yc : yc > lower ? yc - lower : 0;
        if (d <= 0) { reset(f); continue; }
        var phi = d / R;
        if (phi >= horizon) {
          if (f.el.style.visibility !== 'hidden') { f.el.style.visibility = 'hidden'; f.on = true; }
          continue;
        }
        var up = yc < upper;
        var Y = up ? upper - R * Math.sin(phi) : lower + R * Math.sin(phi);
        var Z = -R * (1 - Math.cos(phi));
        var tilt = (up ? phi : -phi) * Math.min(1, (vh * 0.6) / f.h);
        var ox = cx - f.left, oy = half - (yc - f.h / 2);
        f.el.style.transform =
          'translate(' + ox.toFixed(1) + 'px,' + oy.toFixed(1) + 'px) perspective(' + P.toFixed(0) + 'px) ' +
          'translate3d(0,' + (Y - half).toFixed(2) + 'px,' + Z.toFixed(2) + 'px) rotateX(' + tilt.toFixed(4) + 'rad) ' +
          'translate(' + (-ox).toFixed(1) + 'px,' + (-f.h / 2).toFixed(1) + 'px)';
        var k = Math.min(1, phi / EDGE);
        f.el.style.opacity = (1 - (1 - MIN_OPACITY) * k * k).toFixed(3);
        f.el.style.visibility = '';
        f.on = true;
      }
    }

    // ---------- гладкая прокрутка колесом и тачпадом ----------
    // Страница едет плавно, а барабан пересчитывается в том же кадре — без рывков.
    var target = 0, current = 0, gliding = false, lastTime = 0;
    function glide(now) {
      var dt = Math.max(1, Math.min(48, now - lastTime));
      lastTime = now;
      current += (target - current) * (1 - Math.exp(-dt / 70));
      if (Math.abs(target - current) < 0.5) current = target;
      window.scrollTo(0, current);
      update();
      if (current !== target) requestAnimationFrame(glide);
      else gliding = false;
    }
    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      var dy = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? vh * 0.9 : 1);
      if (!dy) return;
      e.preventDefault();
      if (!gliding) { current = target = window.pageYOffset; }
      target = Math.max(0, Math.min(docMax, target + dy));
      if (!gliding) { gliding = true; lastTime = performance.now(); requestAnimationFrame(glide); }
    }, { passive: false });

    function onScroll() {
      if (gliding) return;
      if (!frameQueued) { frameQueued = true; requestAnimationFrame(update); }
    }
    function remeasure() { if (!measureQueued) { measureQueued = true; requestAnimationFrame(measure); } }

    root.classList.add('fx-wheel');
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', remeasure);
    window.addEventListener('load', remeasure);
    window.addEventListener('hashchange', remeasure);
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-tab], [data-filter]')) remeasure();
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { forceSplit = true; remeasure(); });
    if (window.ResizeObserver) new ResizeObserver(remeasure).observe(main);
    // Если браузер переводит страницу — возвращаем абзацы целиком, чтобы перевод был по предложениям
    if (window.MutationObserver) new MutationObserver(function () { if (translated() && !noSplit) remeasure(); })
      .observe(root, { attributes: true, attributeFilter: ['class'] });
    measure();
  })();

  // 2–3. Нажатие и щелчок для любой ссылки и кнопки.
  //      Если ссылка ведёт на другую страницу, переход чуть ждёт (≈0,2 с),
  //      чтобы щелчок успел прозвучать, а кнопка — вдавиться и пружинисто вернуться.
  var CLICKABLE = 'a[href], button, summary, [role="button"], [role="tab"]';
  var MIN_PRESS = 100;     // сколько кнопка минимум остаётся вдавленной, мс
  var SPRING_HOLD = 110;   // сколько видно возвращение перед переходом, мс
  var MAX_WAIT = 380;      // дольше этого переход никогда не задерживается, мс
  var pressOn = fxOn('press') && !reduceMotion;
  var holdUntil = 0;

  var sound = (function () {
    var toggle = document.querySelector('.sound');
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!fxOn('sound') || !AC) { if (toggle) toggle.remove(); return null; }
    var enabled = memory('fx-sound') !== 'off';
    var ctx = null, noise = null, endsAt = 0, resuming = false;

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
      endsAt = Math.max(endsAt, t + 0.06);
    }
    function play(kind, force) {
      if ((!enabled && !force) || !context()) return;
      if (ctx.state === 'running') { synth(kind); return; }
      var p = ctx.resume && ctx.resume();
      if (p && p.then) {
        resuming = true;
        p.then(function () { resuming = false; if (ctx.state === 'running') synth(kind); },
               function () { resuming = false; });
      }
    }
    // Звук ещё звучит (или аудио только запускается) — со страницы пока не уходим
    function busy() {
      if (!ctx) return false;
      if (resuming) return true;
      if (ctx.state !== 'running') return false;
      var latency = ctx.outputLatency || ctx.baseLatency || 0.02;
      return ctx.currentTime < endsAt + latency;
    }

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
    return { play: play, busy: busy };
  })();

  if (pressOn) root.classList.add('fx-press');

  var pressed = null, pressedAt = 0, touchTimer = 0, pointerType = 'mouse', sounded = false;

  function pressDown(el) {
    pressedAt = Date.now();
    holdUntil = Math.max(holdUntil, pressedAt + MIN_PRESS + SPRING_HOLD);
    if (!pressOn) return;
    el.classList.toggle('is-inline', getComputedStyle(el).display === 'inline');
    el.classList.add('is-pressed');
  }
  function pressUp(el, instant) {
    var wait = instant ? 0 : Math.max(0, MIN_PRESS - (Date.now() - pressedAt));
    if (!instant) holdUntil = Math.max(holdUntil, Date.now() + wait + SPRING_HOLD);
    setTimeout(function () { el.classList.remove('is-pressed'); }, wait);
  }
  function cancel() {
    clearTimeout(touchTimer);
    if (pressed) { pressUp(pressed, true); pressed = null; }
  }

  document.addEventListener('pointerdown', function (e) {
    pointerType = e.pointerType || 'mouse';
    if (e.button !== 0 || !e.target.closest) return;
    var el = e.target.closest(CLICKABLE);
    if (!el) return;
    cancel();
    pressed = el;
    sounded = false;
    if (pointerType === 'touch') {
      // на телефоне ждём чуть-чуть: вдруг это не нажатие, а прокрутка
      touchTimer = setTimeout(function () { if (pressed === el) pressDown(el); }, 70);
    } else {
      pressDown(el);
      if (sound) { sound.play('down'); sounded = true; }
    }
  }, true);

  document.addEventListener('pointerup', function (e) {
    clearTimeout(touchTimer);
    var el = pressed;
    if (!el) return;
    pressed = null;
    if (!el.classList.contains('is-pressed')) pressDown(el);
    if (sound && pointerType !== 'touch' && e.target.closest && e.target.closest(CLICKABLE) === el) sound.play('up');
    pressUp(el, false);
  }, true);

  document.addEventListener('pointercancel', cancel, true);
  document.addEventListener('dragstart', cancel, true);

  // Клавиатура: Enter или пробел на ссылке или кнопке
  document.addEventListener('keydown', function (e) {
    if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat) return;
    var el = document.activeElement && document.activeElement.closest && document.activeElement.closest(CLICKABLE);
    if (el && !pressed) { pressed = el; pressDown(el); }
  });
  document.addEventListener('keyup', function () {
    if (pressed) { pressUp(pressed, false); pressed = null; }
  });

  // Телефон и клавиатура: щелчок звучит в момент нажатия (а не при прокрутке)
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest(CLICKABLE);
    if (!el) return;
    if (sound && !sounded && !el.closest('.sound')) sound.play('down');
    sounded = false;
  }, true);

  // Переход на другую страницу — после щелчка и анимации
  document.addEventListener('click', function (e) {
    if ((!pressOn && !sound) || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (!/^https?:$/.test(url.protocol)) return;
    if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search && url.hash) return;
    e.preventDefault();
    var started = Date.now();
    (function go() {
      var waiting = Date.now() < holdUntil || (sound && sound.busy());
      if (waiting && Date.now() - started < MAX_WAIT) { setTimeout(go, 16); return; }
      location.href = a.href;
    })();
  });

  // Возврат кнопкой «Назад»: убираем «застрявшее» нажатие
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    holdUntil = 0;
    document.querySelectorAll('.is-pressed').forEach(function (el) { el.classList.remove('is-pressed'); });
  });
})();
