/* Olympics page: section nav highlighting and the searchable country explorer.
 * Explorer rows come from data/model_results.json (written by analysis/analyse.py). */
(function () {
  'use strict';

  /* ----- section nav highlight ----- */
  var links = Array.prototype.slice.call(document.querySelectorAll('.subnav a'));
  var targets = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + e.target.id)); });
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    targets.forEach(function (t) { if (t) io.observe(t); });
  }

  /* ----- explorer ----- */
  var root = document.getElementById('explorer-tool');
  if (!root) return;
  var body = root.querySelector('tbody'), count = root.querySelector('.count');
  var q = root.querySelector('[name=q]'), yr = root.querySelector('[name=year]');
  var cols = ['Country', 'Year', 'Continent', 'GDP', 'Population', 'Medals', 'Expected', 'Difference'];
  var rows = [], sortKey = 5, sortDir = -1;
  var nf = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function draw() {
    var term = q.value.trim().toLowerCase(), y = yr.value;
    var list = rows.filter(function (r) { return (!y || String(r[1]) === y) && (!term || r[0].toLowerCase().indexOf(term) >= 0); });
    list.sort(function (a, b) {
      var x = a[sortKey], z = b[sortKey];
      return (typeof x === 'string' ? x.localeCompare(z) : x - z) * sortDir || a[0].localeCompare(b[0]);
    });
    body.innerHTML = list.map(function (r) {
      var d = r[5] - r[6], cls = d >= 5 ? 'over' : d <= -5 ? 'under' : '';
      return '<tr><th scope="row">' + esc(r[0]) + '</th><td>' + r[1] + '</td><td>' + esc(r[2]) + '</td><td>' + nf.format(r[3]) + '</td><td>' + nf.format(r[4]) +
        '</td><td>' + r[5] + '</td><td>' + nf.format(r[6]) + '</td><td class="' + cls + '">' + (d > 0 ? '+' : '') + nf.format(d) + '</td></tr>';
    }).join('');
    count.textContent = list.length + ' of ' + rows.length + ' country entries';
  }

  rows = null;
  fetch('data/model_results.json').then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function (R) {
    rows = R.explorer.map(function (r) { return r.concat([r[5] - r[6]]); });
    draw();
  }).catch(function () { count.textContent = 'The explorer could not load its data. Reload the page to try again.'; rows = []; });

  q.addEventListener('input', function () { if (rows) draw(); });
  yr.addEventListener('change', function () { if (rows) draw(); });
  Array.prototype.forEach.call(root.querySelectorAll('thead th'), function (th, i) {
    th.querySelector('button').addEventListener('click', function () {
      sortDir = sortKey === i ? -sortDir : (i === 0 || i === 2 ? 1 : -1); sortKey = i;
      Array.prototype.forEach.call(root.querySelectorAll('thead th'), function (h, j) { h.setAttribute('aria-sort', j === i ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'); });
      if (rows) draw();
    });
  });
})();
