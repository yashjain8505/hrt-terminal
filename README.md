# HRT · HR Signals Terminal (v0)

A Bloomberg-style terminal for people who sell HR, hiring, recruiting and payroll software into the Fortune 500.

Every row on the tape is one public fact about one Fortune 500 company: an open HR-function role, the ATS or HRIS its careers site runs on, an 8-K officer change, a WARN layoff notice. Pick what you sell (one of 12 offer profiles) and the same facts re-rank, with a "why now" line written for your offer and a draft first-touch message per account.

**v0 = one snapshot of all 498 companies on the 2026 Fortune 500 list.** The data ships in the repo (`data/terminal.db`), so the terminal runs locally with no API keys and no pipeline run.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Keys: `⌘K` or `/` opens the command line (type a company, a ticker, or a command such as `TAPE`, `UNIV`, `PROF`, `RUN`, or a profile code like `PAYROLL`). `F1`–`F9` jump between screens.

## Screens

| Screen | What it is |
|---|---|
| `/` **TAPE** | All signals across the universe, ranked for your offer profile. Filter by group (HIRING / STACK / FILINGS / RISK / LIST), strength, or free text. |
| `/a/<slug>` **ACCOUNT** | One company: Fortune facts, HR stack evidence, ranked signals with why-now, open HR-function roles, hiring footprint (states, countries, worker types), 8-K filings, WARN notices, and a draft outreach message. |
| `/u` **UNIV** | All 498 companies as a sortable table: ATS, HRIS, detection status, open roles, HR roles, signal count, profile score. |
| `/p` **PROF** | Choose the offer profile (12 categories in 4 families). |
| `/run` **RUN** | What the pipeline found, coverage percentages, and the known blind spots. |

## Data sources (all public, no keys)

| Source | What we take | Step |
|---|---|---|
| fortune.com ranking page (embedded JSON) | rank, sector, industry, HQ, employees, revenue, profit, market value, list flags | `01-universe` |
| Clearbit autocomplete + hand-checked overrides | company domain | `01-universe`, `01b` |
| Company websites | careers URL, ATS / HRIS / career-site vendor detection by host and asset patterns; Phenom career sites also reveal the underlying Workday tenant through apply links | `02-detect-ats` |
| Job boards with open JSON APIs: Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Phenom, plus an Amazon adapter | open-role totals, facets (countries, worker types), HR-function postings via keyword search and the Workday "Human Resources" job-family facet, tool mentions in job descriptions | `03-snapshot` |
| SEC `company_tickers.json` + `data.sec.gov/submissions` | CIK match, 8-K filings in the last 365 days with item codes (5.02 officer change, 2.05 restructuring, 2.01 acquisition) | `04-sec` |
| California EDD WARN workbook | layoff notices matched to Fortune 500 names | `05-warn` |

`06-signals` turns all of it into typed signals with a 1–5 strength and a dedupe key. `src/lib/profiles.ts` holds the 12 offer profiles and their per-signal weights; `src/lib/whynow.ts` holds the why-now templates; `src/lib/outreach.ts` drafts the message.

## Re-run the pipeline

```bash
npm run pipeline          # everything, ~25 min, writes data/terminal.db
npm run p:snapshot        # just re-pull job boards
```

Steps accept `LIMIT=30` (first N companies), `ONLY=<slug>` (one company) and `CONC=<n>` (parallelism).

## What v0 does not do yet

- **Change over time.** Everything here is one snapshot. Velocity, new states, ATS switches and "new since last week" start with the second run (the schema keeps every snapshot).
- **Pull iCIMS, SuccessFactors, Oracle, Taleo boards.** They are detected (status `detected`) but each needs its own adapter.
- **Read big custom career sites** (Apple, Microsoft, Google, Walmart). Amazon has an adapter.
- **Read 8-K text** to tell a CHRO change from any other officer change.
- **WARN outside California**, Form 5500 (benefits) and H-1B LCA (immigration) feeds, so the BENEFIT and GLOBAL profiles run on partial data.
- Contact data, CRM sync, sending anything. Out of scope on purpose.

## Layout

```
scripts/        pipeline steps 01–06 (tsx)
src/lib/        db.ts (SQLite schema), vendors.ts, classify.ts, pullers.ts, profiles.ts, whynow.ts, outreach.ts, queries.ts
src/app/        Next.js app router screens
src/components/ terminal chrome (header, function keys, ticker, command palette)
data/           terminal.db (shipped), raw/ (cached downloads), domain-overrides.json
```

Stack: Next.js 16, React 19, Tailwind 4, better-sqlite3. No external services at runtime.
