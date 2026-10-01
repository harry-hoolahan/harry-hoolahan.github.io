/*
 * Five-year discounted cash flow model.
 * Pure functions, no DOM access, so the same file runs in the browser and in Node tests.
 *
 * Conventions (kept deliberately simple and stated on the page):
 *  - Cash flows arrive at the end of each year (no mid-year convention).
 *  - Revenue growth moves in a straight line from the Year 1 rate to the Year 5 rate.
 *  - Working-capital investment = nwc % x change in revenue.
 *  - Terminal value = Year 5 free cash flow x (1 + g) / (WACC - g), discounted from Year 5.
 */
(function (root) {
  'use strict';

  var YEARS = 5;

  var DEFAULTS = {
    revenue0: 500,   // base-year revenue, GBP m
    g1: 0.08,        // Year 1 revenue growth
    g5: 0.04,        // Year 5 revenue growth
    margin: 0.15,    // EBIT margin
    tax: 0.25,       // cash tax rate on EBIT
    da: 0.04,        // depreciation and amortisation, % of revenue
    capex: 0.05,     // capital expenditure, % of revenue
    nwc: 0.10,       // working capital investment, % of change in revenue
    wacc: 0.09,      // discount rate
    tg: 0.02,        // terminal growth rate
    netDebt: 100,    // GBP m
    shares: 100      // millions
  };

  function validate(i) {
    if (!(i.shares > 0)) return 'Shares outstanding must be greater than zero.';
    if (!(i.revenue0 > 0)) return 'Base revenue must be greater than zero.';
    if (!(i.wacc > i.tg)) {
      return 'WACC must be higher than terminal growth. Lower the growth rate or raise WACC.';
    }
    if (i.wacc <= -1) return 'WACC must be above -100%.';
    return null;
  }

  function run(inputs) {
    var i = Object.assign({}, DEFAULTS, inputs);
    var error = validate(i);
    if (error) return { error: error, inputs: i };

    var rows = [];
    var prevRev = i.revenue0;
    var sumPV = 0;
    for (var t = 1; t <= YEARS; t++) {
      var growth = i.g1 + (i.g5 - i.g1) * (t - 1) / (YEARS - 1);
      var revenue = prevRev * (1 + growth);
      var ebit = revenue * i.margin;
      var nopat = ebit * (1 - i.tax);
      var da = revenue * i.da;
      var capex = revenue * i.capex;
      var dNWC = (revenue - prevRev) * i.nwc;
      var fcf = nopat + da - capex - dNWC;
      var df = 1 / Math.pow(1 + i.wacc, t);
      var pv = fcf * df;
      sumPV += pv;
      rows.push({
        year: t, growth: growth, revenue: revenue, ebit: ebit, nopat: nopat,
        da: da, capex: capex, dNWC: dNWC, fcf: fcf, df: df, pv: pv
      });
      prevRev = revenue;
    }

    var last = rows[YEARS - 1];
    var tv = last.fcf * (1 + i.tg) / (i.wacc - i.tg);
    var pvTV = tv * last.df;
    var ev = sumPV + pvTV;
    var equity = ev - i.netDebt;
    var ebitda5 = last.ebit + last.da;

    return {
      error: null,
      inputs: i,
      rows: rows,
      sumPV: sumPV,
      tv: tv,
      pvTV: pvTV,
      ev: ev,
      equity: equity,
      perShare: equity / i.shares,
      tvShare: ev !== 0 ? pvTV / ev : NaN,
      impliedTvMultiple: ebitda5 > 0 ? tv / ebitda5 : NaN   // terminal value / Year 5 EBITDA
    };
  }

  /* Value per share across a grid of WACC and terminal growth. Steps are absolute (e.g. 0.005 = 0.5pp). */
  function sensitivity(inputs, step, size) {
    var i = Object.assign({}, DEFAULTS, inputs);
    step = step || 0.005;
    size = size || 2; // size 2 gives a 5 x 5 grid
    var waccs = [], tgs = [], k;
    for (k = -size; k <= size; k++) { waccs.push(i.wacc + k * step); tgs.push(i.tg + k * step); }
    var cells = waccs.map(function (w) {
      return tgs.map(function (g) {
        var r = run(Object.assign({}, i, { wacc: w, tg: g }));
        return r.error ? null : r.perShare;
      });
    });
    return { waccs: waccs, tgs: tgs, cells: cells, baseRow: size, baseCol: size };
  }

  var api = { DEFAULTS: DEFAULTS, YEARS: YEARS, run: run, sensitivity: sensitivity };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DCFModel = api;
})(typeof window !== 'undefined' ? window : this);
