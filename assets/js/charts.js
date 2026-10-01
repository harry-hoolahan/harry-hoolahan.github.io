/* Lazy chart loader for Vega-Lite specs.
 *
 * Usage: <div class="frame" data-chart="path/to/spec.json"></div>
 * Add data-click="Load chart (6 MB)" to wait for a click first (for big data files).
 * Spec paths, and any relative data URLs inside specs, resolve against the page URL.
 * Add data-size="fit" to draw the plot as wide as its container (data-height sets the plot height).
 * Only width and height are changed; marks, encodings, data and filters stay as authored.
 */
(function () {
  'use strict';

  var OPTIONS = { actions: { export: true, source: false, compiled: false, editor: false }, renderer: 'svg' };

  function setState(el, state) { el.setAttribute('data-state', state); }

  function failed(el) {
    setState(el, 'error');
    el.textContent = 'This chart could not load. Check your connection and reload the page.';
  }

  function load(el) {
    if (el.getAttribute('data-state') === 'loading' || el.getAttribute('data-state') === 'done') return;
    if (typeof window.vegaEmbed !== 'function') { failed(el); return; }
    el.textContent = '';
    setState(el, 'loading');
    var path = el.getAttribute('data-chart');
    var source = el.getAttribute('data-size') === 'fit' ? fitted(el, path) : Promise.resolve(path);
    source
      .then(function (spec) { return window.vegaEmbed(el, spec, OPTIONS); })
      .then(function () { setState(el, 'done'); })
      .catch(function () { failed(el); });
  }

  /* Fetch the spec and set its plot size from the container. Returns a promise of the spec object. */
  function fitted(el, path) {
    return fetch(path).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (spec) {
      var cs = window.getComputedStyle(el);
      var avail = (el.clientWidth || 600) - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      /* 'fit' makes width and height the whole chart, axes and legend included, so it cannot overflow. */
      spec.autosize = { type: 'fit', contains: 'padding' };
      spec.width = Math.max(240, Math.round(avail));
      spec.height = +el.getAttribute('data-height') || Math.round(Math.min(480, Math.max(260, spec.width * 0.55)));
      return spec;
    });
  }

  function init() {
    var frames = Array.prototype.slice.call(document.querySelectorAll('[data-chart]'));
    var observer = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { observer.unobserve(e.target); load(e.target); } });
    }, { rootMargin: '300px 0px' }) : null;

    frames.forEach(function (el) {
      var clickLabel = el.getAttribute('data-click');
      if (clickLabel) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'btn quiet chart-load'; b.textContent = clickLabel;
        b.addEventListener('click', function () { load(el); });
        el.appendChild(b);
        setState(el, 'idle');
      } else if (observer) {
        setState(el, 'idle'); observer.observe(el);
      } else {
        load(el);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
