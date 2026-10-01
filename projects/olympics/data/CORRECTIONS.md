# Data corrections

An independent medal table was rebuilt from the TidyTuesday athlete-level Olympic history file (unique year, event, medal and country) and compared with `world_bank_medals.csv`. Four rows were clearly wrong and are corrected in both CSVs. GDP per medal and People per medal were recalculated for each corrected row.

| Country | Games | Was (G/S/B, total) | Now (G/S/B, total) |
|---|---|---|---|
| Germany | 2012 | 0/0/0, 0 | 11/19/14, 44 |
| France | 2012 | 0/0/0, 0 | 11/11/13, 35 |
| Brazil | 2016 | 0/0/0, 0 | 7/6/6, 19 |
| Iran | 2012 | 11/20/13, 44 | 4/5/3, 12 |

`world_bank_medal_winners.csv` also gains the Germany 2012, France 2012 and Brazil 2016 rows, which were missing.

## Left alone

- Small differences in how a few medals were reallocated after doping disqualifications.
- 84 medals won by Cuba, North Korea, Chinese Taipei, Venezuela and the Independent Olympic Athletes. The World Bank has no PPP GDP series for them, so they cannot be in a GDP analysis.

## Reproduce

`python3 projects/olympics/analysis/analyse.py` recomputes every number on the page and writes `model_results.json`.
