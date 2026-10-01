/* DCF explorer UI. Reads the form, runs DCFModel, renders the table, bar chart and sensitivity grid. */
(function () {
  'use strict';

  var M = window.DCFModel;
  var form = document.getElementById('inputs');
  if (!M || !form) return;

  var PERCENT = ['g1', 'g5', 'margin', 'tax', 'da', 'capex', 'nwc', 'wacc', 'tg'];
  var LABELS = {
    revenue0: 'Base-year revenue', g1: 'Year 1 growth', g5: 'Year 5 growth', margin: 'EBIT margin', tax: 'Tax rate',
    da: 'Depreciation and amortisation', capex: 'Capital expenditure', nwc: 'Working capital investment',
    wacc: 'Discount rate', tg: 'Terminal growth', netDebt: 'Net debt', shares: 'Shares outstanding'
  };

  var $ = function (id) { return document.getElementById(id); };
  var gbp1 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var gbp2 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var pct1 = function (x) { return (x * 100).toFixed(1) + '%'; };
  var m1 = function (x) { return (x < 0 ? '(' + gbp1.format(-x) + ')' : gbp1.format(x)); };
  var pound1 = function (x) { return (x < 0 ? '-£' : '£') + gbp1.format(Math.abs(x)) + 'm'; };
  var pound2 = function (x) { return (x < 0 ? '-£' : '£') + gbp2.format(Math.abs(x)); };

  /* ----- inputs ----- */
  function setForm(values) {
    Object.keys(M.DEFAULTS).forEach(function (k) {
      var v = values[k];
      $(k).value = PERCENT.indexOf(k) >= 0 ? +(v * 100).toFixed(4) : v;
    });
  }

  function readForm() {
    var out = {}, bad = [];
    Object.keys(M.DEFAULTS).forEach(function (k) {
      var el = $(k), raw = el.value.trim(), n = raw === '' ? NaN : Number(raw);
      var ok = isFinite(n);
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok) { bad.push(LABELS[k]); return; }
      out[k] = PERCENT.indexOf(k) >= 0 ? n / 100 : n;
    });
    return { values: out, bad: bad };
  }

  /* ----- rendering ----- */
  function showError(msg) {
    $('error').textContent = msg;
    $('error').hidden = !msg;
    $('answer-body').hidden = !!msg;
    $('results').hidden = !!msg;
  }

  function renderTable(r) {
    var head = '<tr><th scope="col">£ million</th>' +
      r.rows.map(function (x) { return '<th scope="col">Year ' + x.year + '</th>'; }).join('') + '</tr>';
    function row(label, key, opts) {
      opts = opts || {};
      var cells = r.rows.map(function (x) {
        var v = opts.fn ? opts.fn(x) : x[key];
        var txt = opts.fmt ? opts.fmt(v) : m1(v);
        return '<td' + (v < 0 && !opts.fmt ? ' class="neg"' : '') + '>' + txt + '</td>';
      }).join('');
      return '<tr' + (opts.total ? ' class="total"' : '') + '><th scope="row">' + label + '</th>' + cells + '</tr>';
    }
    var body = [
      row('Revenue growth', null, { fn: function (x) { return x.growth; }, fmt: pct1 }),
      row('Revenue', 'revenue'),
      row('EBIT', 'ebit'),
      row('Tax-adjusted EBIT', 'nopat'),
      row('Plus depreciation and amortisation', 'da'),
      row('Less capital expenditure', null, { fn: function (x) { return -x.capex; } }),
      row('Less working capital investment', null, { fn: function (x) { return -x.dNWC; } }),
      row('Free cash flow', 'fcf', { total: true }),
      row('Discount factor', null, { fn: function (x) { return x.df; }, fmt: function (v) { return v.toFixed(3); } }),
      row('Present value', 'pv')
    ].join('');
    $('fcf-table').querySelector('thead').innerHTML = head;
    $('fcf-table').querySelector('tbody').innerHTML = body;
  }

  function renderBars(r) {
    var svg = $('bars'), W = 640, H = 250, left = 44, right = 12, top = 24, bottom = 36;
    var vals = r.rows.map(function (x) { return x.fcf; });
    var max = Math.max.apply(null, vals.concat([0])), min = Math.min.apply(null, vals.concat([0]));
    var span = (max - min) || 1;
    var plotH = H - top - bottom, plotW = W - left - right;
    var y = function (v) { return top + (max - v) / span * plotH; };
    var bw = plotW / vals.length;
    var parts = ['<line class="axis" x1="' + left + '" x2="' + (W - right) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>'];
    vals.forEach(function (v, i) {
      var x = left + i * bw + bw * 0.2, w = bw * 0.6;
      var y0 = y(0), y1 = y(v), top1 = Math.min(y0, y1), h = Math.max(Math.abs(y1 - y0), 1);
      var tip = 'Year ' + (i + 1) + ': free cash flow ' + pound1(v) + ', present value ' + pound1(r.rows[i].pv);
      parts.push('<rect class="bar' + (v < 0 ? ' neg' : '') + '" data-tip="' + tip + '" x="' + x.toFixed(1) + '" y="' + top1.toFixed(1) +
        '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3"/>');
      parts.push('<text x="' + (x + w / 2).toFixed(1) + '" y="' + (v >= 0 ? top1 - 6 : top1 + h + 14).toFixed(1) + '" text-anchor="middle">' + gbp1.format(v) + '</text>');
      parts.push('<text x="' + (x + w / 2).toFixed(1) + '" y="' + (H - 12) + '" text-anchor="middle">Year ' + (i + 1) + '</text>');
    });
    parts.push('<text x="' + left + '" y="14" text-anchor="start">£ million</text>');
    svg.innerHTML = parts.join('');
    $('bars-desc').textContent = 'Free cash flow goes from ' + pound1(vals[0]) + ' in Year 1 to ' + pound1(vals[vals.length - 1]) + ' in Year 5.';
  }

  function renderHeat(r) {
    var s = M.sensitivity(r.inputs, 0.005, 2);
    var flat = [].concat.apply([], s.cells).filter(function (v) { return v !== null; });
    var lo = Math.min.apply(null, flat), hi = Math.max.apply(null, flat), span = (hi - lo) || 1;
    var head = '<tr><th></th><th scope="col" colspan="' + s.tgs.length + '">Terminal growth</th></tr><tr><th scope="col">WACC</th>' +
      s.tgs.map(function (g) { return '<th scope="col">' + pct1(g) + '</th>'; }).join('') + '</tr>';
    var body = s.cells.map(function (rowVals, ri) {
      return '<tr><th scope="row">' + pct1(s.waccs[ri]) + '</th>' + rowVals.map(function (v, ci) {
        var base = ri === s.baseRow && ci === s.baseCol;
        if (v === null) return '<td class="na" title="Not defined: WACC must be higher than terminal growth">n/a</td>';
        var t = (v - lo) / span;
        var tip = 'WACC ' + pct1(s.waccs[ri]) + ', terminal growth ' + pct1(s.tgs[ci]) + ': ' + pound2(v) + ' per share';
        return '<td class="' + (base ? 'base' : '') + '" data-tip="' + tip + '" data-hi="' + (t > 0.55) + '" style="--t:' + t.toFixed(3) + '">' + gbp2.format(v) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    $('heat').querySelector('thead').innerHTML = head;
    $('heat').querySelector('tbody').innerHTML = body;
    var spread = (hi - lo) / r.perShare;
    $('heat-note').textContent = 'Across this grid, value per share ranges from ' + pound2(lo) + ' to ' + pound2(hi) +
      ', a spread of ' + Math.round(spread * 100) + '% of your current case. Steps are 0.5 percentage points.';
  }

  function render() {
    var read = readForm();
    if (read.bad.length) { showError('Enter a number for: ' + read.bad.join(', ') + '.'); return; }
    var r = M.run(read.values);
    if (r.error) {
      showError(r.error);
      $('wacc').setAttribute('aria-invalid', 'true'); $('tg').setAttribute('aria-invalid', 'true');
      return;
    }
    showError('');
    $('per-share').innerHTML = pound2(r.perShare) + '<small>per share</small>';
    var sub = 'Equity value of ' + pound1(r.equity) + ' on ' + gbp1.format(r.inputs.shares) + ' million shares.';
    if (r.tvShare > 0.7) sub += ' ' + Math.round(r.tvShare * 100) + '% of enterprise value sits in the terminal value, so small changes to WACC or terminal growth move the answer a lot.';
    $('answer-sub').textContent = sub;
    $('kpi-ev').textContent = pound1(r.ev);
    $('kpi-equity').textContent = pound1(r.equity);
    $('kpi-tvshare').textContent = isFinite(r.tvShare) ? Math.round(r.tvShare * 100) + '%' : 'n/a';
    $('kpi-multiple').textContent = isFinite(r.impliedTvMultiple) ? r.impliedTvMultiple.toFixed(1) + 'x' : 'n/a';
    renderTable(r); renderBars(r); renderHeat(r);
  }

  /* ----- tooltip (delegated; works for bars and heat cells) ----- */
  var tip = $('tip');
  function place(e) {
    var x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = (e.clientY + 18) + 'px';
  }
  document.addEventListener('pointermove', function (e) {
    var t = e.target.closest ? e.target.closest('[data-tip]') : null;
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.getAttribute('data-tip');
    tip.hidden = false; place(e);
  });
  document.addEventListener('pointerleave', function () { tip.hidden = true; });

  /* ----- wiring ----- */
  form.addEventListener('input', render);
  $('reset').addEventListener('click', function () { setForm(M.DEFAULTS); render(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  setForm(M.DEFAULTS);
  render();
})();
