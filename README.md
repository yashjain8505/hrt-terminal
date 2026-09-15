# HRT · HR buying situations

**Which companies are in a buying situation for HR software right now, with the proof, and the list to sequence.**

HRT watches public job boards, SEC filings, layoff notices and the news for every company in its universe. When a company enters one of the situations below, HRT names it, shows the dated facts, says who to talk to, writes the first line, and lets you download the list for your sequencer.

Universe today: the 2026 Fortune 500 (498 companies). Mid-market is next.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The data ships in the repo, so nothing else is needed.

## How to use it

1. **Pick what you sell** (top right). Twelve offer profiles. The same facts re-rank and the wording changes for your product.
2. **Pick your book** (top right, "All 498"). Paste the domains of the accounts you own. Everything narrows to them, including the CSV.
3. **Read the wire** (left). Every account entering a situation, newest last, replaying. Space pauses. Click one to open it. The globe follows.
4. **Pick a situation** (right, the tiles). The list under it is every account in that situation, newest first, with the fact that proves it and who to talk to.
5. **Open an account.** The story: what is happening, the facts with links, the window, who to talk to, your angle against what they run, people movement in the last 90 days, and a first line to copy.
6. **Download CSV.** Every account in the situation (and your book) with headline, two facts with URLs, three contact titles, what it means, and the first line. Import into Outreach, Salesloft, Apollo or Clay and add the people there.

## The situations

| Situation | Fires on | Window |
|---|---|---|
| New HR leader arriving or just arrived | Appointment in the news or an 8-K (named), an HR-leader posting that came off the board, a VP+ HR role posted, or an HR leader leaving | 45–120 days |
| HR systems project underway | HRIS / Workday / SuccessFactors / payroll-systems roles posted; legacy systems still named in job posts | 120 days |
| Building or scaling the recruiting team | Two or more dated recruiting roles, or recruiting-ops roles | 60 days |
| Consolidating after an acquisition | 8-K item 2.01, a completed deal in the news, HR M&A / integration roles | 120 days |
| Cutting costs after layoffs | WARN notice of 50+ people, 8-K item 2.05, layoffs in the news | 60 days |
| Expanding to new countries | First postings in a new country between snapshots | 90 days |
| Funded, HR forming, thresholds, hourly surge | Not yet: need funding feeds, the mid-market universe, headcount estimates | — |

Every situation carries a confidence: **high** = two or more dated facts, or a named, sourced appointment; **medium** = one dated fact. Undated facts never make a headline.

## People movement

Built from three free sources, corroborated and deduplicated by person and role:

- **Appointments and departures in the news.** Google News RSS, no key. The headline's grammar decides who is hiring: "Kroger taps McDonald's veteran as chief people officer" is an arrival at Kroger and a departure from McDonald's. Multiple articles about one move merge into one record with all sources.
- **SEC 8-K item 5.02.** The filing text is parsed for "appointed X as TITLE effective DATE" and departures. Official, dated, named. HR officers rarely appear (they are seldom "named executive officers"), so most 8-K moves are other officers and are shown as context.
- **The job board.** An HR posting that was on the board last snapshot and is gone now was filled or withdrawn. New postings since last snapshot. Only counted where we read the board in full.

LinkedIn profiles are not read. That data lives inside LinkedIn or with paid resellers. Sales Navigator's job-change alerts on saved leads are the legitimate individual-level source; HRT is the company-level version.

## Data sources (all free, no keys)

| Source | Used for |
|---|---|
| fortune.com ranking page | universe: rank, sector, HQ, employees, revenue |
| Company careers sites and job boards (Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Phenom, Amazon) | ATS / HRIS detection, open roles, HR-function postings with dates, tools named in job descriptions |
| SEC `company_tickers.json`, `data.sec.gov/submissions`, EDGAR archives | 8-K items 5.02 / 2.05 / 2.01, and the 5.02 text for named officer moves |
| California EDD WARN workbook | layoff notices |
| Google News RSS | HR-leader appointments and departures, layoffs, completed acquisitions |

## Refresh the data

```bash
npm run refresh      # weekly: boards, SEC, WARN, news, diffs, moves, signals, situations (~30 min)
npm run pipeline     # full rebuild including universe and ATS detection (~60 min)
```

A GitHub Actions workflow (`.github/workflows/refresh.yml`) runs the refresh and commits the database. It is manual-trigger only until it has run clean a few times; then add a schedule.

Snapshots are kept (`job_history`), so every refresh sharpens the diff signals: roles filled, roles opened, hiring velocity, new countries.

## Layout

```
public/room/        the app: index.html, room.js (UI), hrt-lib.js (situations, scoring, playbook; built from src/lib)
src/app/route.ts    serves the room at /
src/app/api/data    live JSON bundle from SQLite
src/app/api/export  CSV for a situation (+ profile, + book)
src/lib/            situations.ts (rules), moves.ts (8-K parser), playbook.ts (buyers, angles, questions), classify.ts, vendors.ts, pullers.ts
scripts/            pipeline steps 01–13
artifacts/          publishable copies (npm run artifacts)
data/terminal.db    the database, committed
```

## Known limits

- One universe (Fortune 500). Mid-market discovery through public boards is the next build.
- 139 companies run iCIMS, SuccessFactors, Oracle or Taleo, which are detected but not read yet.
- WARN is California only.
- Workday dates older than 30 days are approximate and are excluded from dated facts.
- No people data by design: titles and LinkedIn search links only. Add people in your sequencer.
