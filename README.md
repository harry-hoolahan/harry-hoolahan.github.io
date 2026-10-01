# harry-hoolahan.github.io

Source for [harry-hoolahan.github.io](https://harry-hoolahan.github.io/), my personal site: background, a DCF explorer, an Olympics study and data science coursework.

Plain HTML, CSS and JavaScript. There is no build step: push to `main` and GitHub Pages serves it.

## Layout

| Path | What it holds |
| --- | --- |
| `index.html` | Home page: experience, selected work, qualifications |
| `projects/dcf/` | Interactive five-year DCF model with a sensitivity grid |
| `projects/olympics/` | Economics and Olympic medals study: chart specs in `charts/`, data in `data/` |
| `coursework/` | Vega-Lite charts from a 2021 data science course, one folder per course week |
| `notebooks/` | Colab notebook that downloads annual financial statements from Alpha Vantage |
| `assets/` | Shared CSS and JavaScript, including the DCF calculation in `assets/js/dcf-model.js` |
| `tests/` | Automated tests for the DCF calculation |
| `data_science_*.html` | Redirects from the original page addresses |

## Run it locally

```
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Charts need a local server because browsers block `fetch` on `file://` URLs.

## Test the DCF model

```
node tests/dcf-model.test.js
```

The tests compare the model with a separate hand calculation, check that the pieces add up, check a case with a known closed-form answer, and check that invalid inputs are rejected.

## Secrets

API keys must never be committed. The notebook asks for an Alpha Vantage key when you run it. `.gitignore` excludes `.env` files.

## Notes on the content

- The DCF explorer uses a fictional company and illustrative inputs. It is a teaching model, not investment advice.
- Nothing on the site uses client information or speaks for my employer.
