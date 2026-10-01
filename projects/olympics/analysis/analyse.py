"""Recompute every number quoted on the Olympics page from the CSVs in ../data.

Run:  python3 analysis/analyse.py      (writes data/model_results.json)
Needs: pandas, numpy, statsmodels.  The Poisson fit is cross-checked against a hand-written IRLS.
"""
import json, os
import numpy as np, pandas as pd, statsmodels.api as sm

HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, '..', 'data')
HOST = {2008: 'CHN', 2012: 'GBR', 2016: 'BRA'}

m = pd.read_csv(os.path.join(D, 'world_bank_medals.csv'), encoding='latin-1')
w = pd.read_csv(os.path.join(D, 'world_bank_medal_winners.csv'), encoding='latin-1')
e = pd.read_csv(os.path.join(D, 'eu_spend_sports_recreation.csv'), encoding='latin-1')
m = m.rename(columns={'Total Population (millions)': 'pop_m', 'GDP (billions $)': 'gdp_bn', 'Total': 'medals'})
m['lgdp'] = np.log(m.gdp_bn); m['lpop'] = np.log(m['SP.POP.TOTL'])
m['host'] = [int(HOST.get(y) == c) for y, c in zip(m.Year, m.economy)]

R = {'rows': int(len(m)), 'winner_rows': int(len(w)), 'medals_by_year': {int(y): int(v) for y, v in m.groupby('Year').medals.sum().items()}}
R['corr'] = {
    'lgdp_medals': round(m.lgdp.corr(m.medals), 2), 'lpop_medals': round(m.lpop.corr(m.medals), 2),
    'lgdp_lpop': round(m.lgdp.corr(m.lpop), 2),
    'africa': round(m[m.Continent == 'Africa'].lgdp.corr(m[m.Continent == 'Africa'].medals), 2),
    'europe': round(m[m.Continent == 'Europe'].lgdp.corr(m[m.Continent == 'Europe'].medals), 2),
}
small = m[m.gdp_bn < 10]
R['small'] = {'entries': int(len(small)), 'with_medal': int((small.medals > 0).sum()),
              'winners': [f'{r.Country} {r.Year}' for r in small[small.medals > 0].itertuples()]}
g16 = m[m.Year == 2016]
R['gdp2016'] = {'max': [g16.loc[g16.gdp_bn.idxmax(), 'Country'], float(g16.gdp_bn.max())],
                'min': [g16.loc[g16.gdp_bn.idxmin(), 'Country'], float(g16.gdp_bn.min())]}
pick = lambda c, y: m[(m.economy == c) & (m.Year == y)].iloc[0]
R['cases2016'] = {c: {'medals': int(pick(c, 2016).medals), 'pop_m': float(pick(c, 2016).pop_m)}
                  for c in ['CHN', 'IND', 'NGA', 'KEN', 'ETH', 'ZAF']}
# people per medal ranking (winners only, as in Figure 3)
rk = {}
for y in (2008, 2012, 2016):
    t = w[w.Year == y].copy(); t['ppm'] = t['People per medal'].astype(float)
    t = t.sort_values('ppm'); rk[y] = [[r.Country, int(r.ppm)] for r in t.head(3).itertuples()]
R['people_per_medal_top3'] = rk
# Figure 4
e['spend'] = e['Average spend']; R['eu'] = {'n': int(len(e)), 'corr': round(e.spend.corr(e['Total Medals']), 2)}
for c in ['Luxembourg', 'Iceland', 'United Kingdom']:
    r = e[e.Country == c]
    if len(r): R['eu'][c] = [float(r.spend.iloc[0]), int(r['Total Medals'].iloc[0])]

# ---- Poisson model
X = pd.DataFrame({'const': 1.0, 'lgdp': m.lgdp, 'lpop': m.lpop, 'y2012': (m.Year == 2012) * 1.0, 'y2016': (m.Year == 2016) * 1.0, 'host': m.host * 1.0})
y = m.medals.astype(float)
fit = sm.GLM(y, X, family=sm.families.Poisson()).fit(cov_type='HC1')
def irls(X, y, it=100):
    X = X.values; b = np.zeros(X.shape[1]); b[0] = np.log(y.mean())
    for _ in range(it):
        mu = np.exp(X @ b); z = X @ b + (y.values - mu) / mu
        nb = np.linalg.solve(X.T @ (X * mu[:, None]), X.T @ (mu * z))
        if np.max(abs(nb - b)) < 1e-12: b = nb; break
        b = nb
    return b
b_hand = irls(X, y); assert np.allclose(b_hand, fit.params.values, atol=1e-6), (b_hand, fit.params.values)
ci = fit.conf_int()
R['model'] = {'spec': 'Poisson GLM, medals ~ log GDP + log population + 2012 + 2016 + host, robust (HC1) SEs',
              'n': int(fit.nobs), 'cross_checked_with_hand_IRLS': True,
              'coef': {k: {'b': round(float(fit.params[k]), 3), 'se': round(float(fit.bse[k]), 3), 'lo': round(float(ci.loc[k, 0]), 3), 'hi': round(float(ci.loc[k, 1]), 3), 'p': float(fit.pvalues[k])} for k in X.columns},
              'host_multiplier': round(float(np.exp(fit.params['host'])), 2),
              'pseudo_r2_deviance': round(float(1 - fit.deviance / fit.null_deviance), 2)}
# also the simple models, so the page can say what population adds
f1 = sm.GLM(y, X[['const', 'lgdp', 'y2012', 'y2016']], family=sm.families.Poisson()).fit(cov_type='HC1')
R['model']['gdp_only_elasticity'] = round(float(f1.params['lgdp']), 3)
R['model']['gdp_only_pseudo_r2'] = round(float(1 - f1.deviance / f1.null_deviance), 2)

m['expected'] = fit.fittedvalues.round(2); m['diff'] = (m.medals - m.expected).round(1)
big = m[m.expected >= 1]
R['over'] = [[r.Country, int(r.Year), int(r.medals), float(r.expected)] for r in big.sort_values('diff', ascending=False).head(10).itertuples()]
R['under'] = [[r.Country, int(r.Year), int(r.medals), float(r.expected)] for r in big.sort_values('diff').head(10).itertuples()]
R['explorer'] = [[r.Country, int(r.Year), r.Continent, round(float(r.gdp_bn), 1), round(float(r.pop_m), 2), int(r.medals), float(r.expected)] for r in m.sort_values(['Country', 'Year']).itertuples()]
json.dump(R, open(os.path.join(D, 'model_results.json'), 'w'), separators=(',', ':'))
S = {k: v for k, v in R.items() if k != 'explorer'}
print(json.dumps(S, indent=1))
