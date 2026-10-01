/* Checks that numbers quoted on the Olympics page match projects/olympics/data/model_results.json.
 * Run: node tests/olympics-page.test.js   (after python3 projects/olympics/analysis/analyse.py) */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const dir = path.join(__dirname, '..', 'projects', 'olympics');
const R = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'model_results.json'), 'utf8'));
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8').replace(/<[^>]+>/g, ' ').replace(/&minus;/g, '−');
const has = (t, why) => assert(html.includes(t), 'page is missing "' + t + '" (' + why + ')');
const sgn = (x) => (x < 0 ? '−' : '') + Math.abs(x);
let n = 0; const check = (t, why) => { has(t, why); n++; };

const medals = Object.values(R.medals_by_year).reduce((a, b) => a + b, 0);
check(medals.toLocaleString('en-GB'), 'total medals'); check(String(R.rows), 'rows');
check('correlation between the log of GDP and medals won is ' + R.corr.lgdp_medals.toFixed(2), 'gdp corr');
check('Africa'.length ? 'African countries (' + R.corr.africa.toFixed(2) + ')' : '', 'africa corr');
check('Europe (' + R.corr.europe.toFixed(2) + ')', 'europe corr');
check('correlation is ' + R.corr.lpop_medals.toFixed(2), 'pop corr');
check('correlation of ' + R.corr.lgdp_lpop.toFixed(2), 'gdp-pop corr');
check(R.small.entries + ' country entries had GDP below $10 billion and only ' + 'five'.replace('five', R.small.with_medal === 5 ? 'five' : '?'), 'small economies');
check('(' + sgn(R.eu.corr.toFixed(2) * 1) + ')'.replace('-', '−'), 'eu corr');
const c = R.model.coef;
const t = (k, d) => sgn(c[k].b.toFixed(d) * 1).replace(/^(−?)(\d)/, '$1$2');
['lgdp', 'lpop', 'host', 'y2012', 'y2016'].forEach((k) => {
  check(sgn(c[k].b.toFixed(3) * 1), k + ' coefficient'); check(c[k].se.toFixed(3), k + ' se');
  check(sgn(c[k].lo.toFixed(3) * 1) + ' to ' + sgn(c[k].hi.toFixed(3) * 1), k + ' interval');
});
check('elasticity 1.10', 'elasticity'); assert.strictEqual(c.lgdp.b.toFixed(2), '1.10');
check('about 11% more', '10% GDP effect'); assert(Math.abs(Math.pow(1.1, c.lgdp.b) - 1.11) < 0.005);
check('about ' + R.model.host_multiplier.toFixed(1) + ' times', 'host multiplier');
check('explains ' + Math.round(R.model.gdp_only_pseudo_r2 * 100) + '% of deviance', 'gdp-only R2');
check('elasticity of ' + R.model.gdp_only_elasticity.toFixed(2), 'gdp-only elasticity');
check('<dd>' .length ? Math.round(R.model.pseudo_r2_deviance * 100) + '%' : '', 'pseudo R2');
[R.over, R.under].forEach((list) => list.slice(0, 5).forEach(([name, yr, won, exp]) => {
  const row = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' ' + yr + '\\s+' + won + '\\s+' + exp.toFixed(1).replace('.', '\\.'));
  assert(row.test(html), 'table row mismatch: ' + name + ' ' + yr); n++;
}));
for (const [k, v] of Object.entries(R.cases2016)) { if (k === 'CHN') { check(v.medals + ' medals at Rio', 'china'); } }
check('€' + R.eu['Luxembourg'][0], 'lux'); check('€' + R.eu['Iceland'][0], 'iceland'); check('€' + R.eu['United Kingdom'][0], 'uk');
console.log('olympics page: ' + n + ' numeric claims match model_results.json');
