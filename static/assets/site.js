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
})();
