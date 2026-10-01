// Run with: node tests/dcf-model.test.js
const assert = require('assert');
const M = require('../assets/js/dcf-model.js');

const close = (a, b, tol = 1e-9, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg || ''} got ${a}, expected ${b}`);

// 1. Independent hand calculation of the default case (written separately from the model code).
{
  let rev = 500, pvSum = 0, fcf5 = 0;
  const g = [0.08, 0.07, 0.06, 0.05, 0.04];
  g.forEach((gr, idx) => {
    const prev = rev; rev = prev * (1 + gr);
    const f = rev * 0.15 * 0.75 + rev * 0.04 - rev * 0.05 - 0.10 * (rev - prev);
    pvSum += f / Math.pow(1.09, idx + 1); fcf5 = f;
  });
  const tv = fcf5 * 1.02 / (0.09 - 0.02);
  const ev = pvSum + tv / Math.pow(1.09, 5);
  const r = M.run({});
  close(r.ev, ev, 1e-12, 'EV');
  close(r.perShare, (ev - 100) / 100, 1e-12, 'per share');
  close(r.sumPV, pvSum, 1e-12, 'sum PV');
}

// 2. Structural identities
{
  const r = M.run({});
  close(r.ev, r.sumPV + r.pvTV, 1e-12, 'EV = PV(FCF) + PV(TV)');
  close(r.equity, r.ev - r.inputs.netDebt, 1e-12, 'equity bridge');
  close(r.rows[0].growth, 0.08, 1e-12); close(r.rows[4].growth, 0.04, 1e-12); close(r.rows[2].growth, 0.06, 1e-12);
  assert.ok(r.tvShare > 0 && r.tvShare < 1, 'TV share in (0,1)');
}

// 3. Directional behaviour
{
  const base = M.run({}).perShare;
  assert.ok(M.run({ wacc: 0.10 }).perShare < base, 'higher WACC lowers value');
  assert.ok(M.run({ tg: 0.03 }).perShare > base, 'higher terminal growth raises value');
  assert.ok(M.run({ margin: 0.18 }).perShare > base, 'higher margin raises value');
  assert.ok(M.run({ netDebt: 200 }).perShare < base, 'more debt lowers equity value');
}

// 4. Zero-growth, zero-capex check against a closed form: constant FCF perpetuity
{
  const r = M.run({ g1: 0, g5: 0, tg: 0, da: 0.05, capex: 0.05, nwc: 0, margin: 0.2, tax: 0.25, wacc: 0.10, netDebt: 0, shares: 1, revenue0: 100 });
  // FCF = 100 * 0.2 * 0.75 = 15 every year; EV = 15 / 0.10 = 150
  close(r.ev, 150, 1e-12, 'perpetuity EV');
}

// 5. Invalid input is reported, not computed
{
  assert.ok(M.run({ wacc: 0.02, tg: 0.03 }).error, 'WACC <= g is an error');
  assert.ok(M.run({ shares: 0 }).error, 'zero shares is an error');
}

// 6. Sensitivity grid: centre cell equals the base case; invalid combos are null; monotone along each axis
{
  const s = M.sensitivity({}, 0.005, 2);
  close(s.cells[2][2], M.run({}).perShare, 1e-12, 'centre cell');
  assert.strictEqual(s.cells.length, 5); assert.strictEqual(s.cells[0].length, 5);
  for (let r = 0; r < 5; r++) for (let c = 1; c < 5; c++) assert.ok(s.cells[r][c] > s.cells[r][c - 1], 'value rises with terminal growth');
  for (let c = 0; c < 5; c++) for (let r = 1; r < 5; r++) assert.ok(s.cells[r][c] < s.cells[r - 1][c], 'value falls with WACC');
  const tight = M.sensitivity({ wacc: 0.03, tg: 0.025 }, 0.005, 2);
  assert.ok(tight.cells.some(row => row.some(v => v === null)), 'impossible cells are null');
}

console.log('All DCF model tests passed.');
const r = M.run({});
console.log(JSON.stringify({ ev: +r.ev.toFixed(2), equity: +r.equity.toFixed(2), perShare: +r.perShare.toFixed(3), tvShare: +r.tvShare.toFixed(3), tvMultiple: +r.impliedTvMultiple.toFixed(2) }));
