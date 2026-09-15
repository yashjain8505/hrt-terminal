# HRT · HR Signals Terminal (v0)

A Bloomberg-style terminal for people who sell HR, hiring, recruiting and payroll software into the Fortune 500.

Every row on the tape is one public fact about one Fortune 500 company: an open HR-function role, the ATS or HRIS its careers site runs on, an 8-K officer change, a WARN layoff notice. Pick what you sell (one of 12 offer profiles) and the same facts re-rank, with a "why now" line written for your offer and a draft first-touch message per account.

**v0 = one snapshot of all 498 companies on the 2026 Fortune 500 list.** The data ships in the repo (`data/terminal.db`), so the terminal runs locally with no API keys and no pipeline run.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Keys: `⌘K` or `/` opens the command line (type a company, a ticker, or a command such as `TAPE`, `GLOBE`, `CARDS`, `CAMPAIGN`, `MATRIX`, `TIMELINE`, `PROF`, or a profile code like `PAYROLL`). `F1`–`F10` jump between screens.

## The five sales artifacts

The raw tape is a firehose. These five screens turn it into things a rep can act on. All of them re-rank for the chosen offer profile.

| Key | Screen | Question it answers |
|---|---|---|
| F6 | `/globe` **GLOBE** | What is happening across the Fortune 500 right now? HQs on a globe coloured by what is going on, arcs to the countries each company hires in, and a feed replaying 180 days of dated events (exec roles opened, 8-Ks, layoffs). |
| F7 | `/cards` **BATTLECARDS** | I am about to call this account. What do I say? One printable card per account: top triggers with proof URLs, incumbent stack with the angle against it, buyer titles to search for, an opening line, discovery questions, risk flags. |
| F8 | `/campaign` **CAMPAIGN** | Who do I put in a sequence this week? Pick a segment (incumbent vendor × sector × state × hiring volume × trigger), get the ranked list with hooks and buyer titles, a 3-touch sequence template, and a CSV export for Outreach / Salesloft / Apollo. |
| F9 | `/matrix` **MATRIX** | Where is my displacement territory? ATS or HRIS vendor × sector heatmap (accounts, open roles, or profile score). Click a cell to build that campaign. |
| F10 | `/timeline` **TIMELINE** | What changed this week? Dated triggers in swimlanes over 90/180/365 days, plus "this week: act now" and "last week: follow up" tables. |

The knowledge behind them lives in `src/lib/playbook.ts` (buyer titles per profile, displacement angles per incumbent vendor, discovery questions per trigger) and is meant to be edited.

## Other screens

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

`08-situations` turns signals into **situations** (`src/lib/situations.ts`): what the company is doing in HR terms, proven by dated facts, with a window and buyer titles. `09-diff` compares the latest two snapshots (job_history keeps every snapshot's HR postings) and emits role filled / role opened / velocity / new country events. `12-news` reads Google News RSS (no key) for HR-leader appointments and departures, layoffs and acquisitions, attributing each headline to the hiring company by its syntax.

`07-geo` adds HQ coordinates (exact from the headquarters dataset, else city table, else state centroid) for the globe.

`06-signals` turns all of it into typed signals with a 1–5 strength and a dedupe key. `src/lib/profiles.ts` holds the 12 offer profiles and their per-signal weights; `src/lib/whynow.ts` holds the why-now templates; `src/lib/outreach.ts` drafts the message.

## Re-run the pipeline

```bash
npm run pipeline          # everything, ~25 min, writes data/terminal.db
npm run p:snapshot        # just re-pull job boards
```

Steps accept `LIMIT=30` (first N companies), `ONLY=<slug>` (one company) and `CONC=<n>` (parallelism).

## People movement (the "who just moved" signal)

Free sources only, corroborated:
- **Appointment in the news**: Google News RSS sweeps for "names / appoints / joins as" plus CHRO, Chief People Officer, VP People, Head of Talent, Head of Total Rewards; per-company queries for the same. The headline's syntax decides who is hiring ("Kroger taps McDonald's veteran…" = arrival at Kroger, departure from McDonald's).
- **Role filled**: an HR-leader posting that was on the board last snapshot and is gone this snapshot (only where we read the board in full).
- **Role opened**: new HR postings since the last snapshot.
Shown on the account story as "People movement · last 60 days" and used by the "New HR leader" situation ("just got a new leader: <name>").

LinkedIn profile changes are not read. That data is only available inside LinkedIn or from paid resellers; the two free signals above approximate it at leadership level.

## What v0 does not do yet

- **Change over time.** Everything here is one snapshot. Velocity, new states, ATS switches and "new since last week" start with the second run (the schema keeps every snapshot).
- **Pull iCIMS, SuccessFactors, Oracle, Taleo boards.** They are detected (status `detected`) but each needs its own adapter.
- **Read big custom career sites** (Apple, Microsoft, Google, Walmart). Amazon has an adapter.
- **Read 8-K text** to tell a CHRO change from any other officer change.
- **WARN outside California**, Form 5500 (benefits) and H-1B LCA (immigration) feeds, so the BENEFIT and GLOBAL profiles run on partial data.
- Workday only says "Posted 30+ Days Ago" for older roles, so on the timeline those all land on the same day. Dates sharpen on the second run.
- Contact data, CRM sync, sending anything. Out of scope on purpose. The CSV export is built to be uploaded into the tool that does.

## Layout

```
scripts/        pipeline steps 01–06 (tsx)
src/lib/        db.ts (SQLite schema), vendors.ts, classify.ts, pullers.ts, profiles.ts, whynow.ts, outreach.ts, queries.ts
src/app/        Next.js app router screens
src/components/ terminal chrome (header, function keys, ticker, command palette)
data/           terminal.db (shipped), raw/ (cached downloads), domain-overrides.json
```

Stack: Next.js 16, React 19, Tailwind 4, better-sqlite3, react-globe.gl (three.js). No external services at runtime; globe textures are served from `public/globe`.
