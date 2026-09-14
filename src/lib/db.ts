import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

export const DB_PATH =
  process.env.HRT_DB_PATH || path.join(process.cwd(), "data", "terminal.db");

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");
  migrate(_db);
  return _db;
}

export function migrate(d: Database.Database) {
  d.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY,
    rank INTEGER,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT,
    website TEXT,
    sector TEXT,
    industry TEXT,
    hq_city TEXT,
    hq_state TEXT,
    employees INTEGER,
    revenue_m REAL,
    revenue_change_pct REAL,
    profit_m REAL,
    market_value_m REAL,
    rank_change INTEGER,
    newcomer INTEGER DEFAULT 0,
    jobs_growth INTEGER DEFAULT 0,
    founder_ceo INTEGER DEFAULT 0,
    female_ceo INTEGER DEFAULT 0,
    fortune_url TEXT,
    cik TEXT,
    ticker TEXT,
    careers_url TEXT,
    ats_vendor TEXT,
    ats_board_url TEXT,
    ats_config TEXT,
    hris_vendor TEXT,
    stack_json TEXT,
    detect_status TEXT,
    detect_note TEXT,
    open_roles INTEGER,
    snapshot_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_companies_rank ON companies(rank);
  CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);

  CREATE TABLE IF NOT EXISTS job_posts (
    id INTEGER PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    external_id TEXT,
    title TEXT NOT NULL,
    location TEXT,
    state TEXT,
    country TEXT,
    remote INTEGER DEFAULT 0,
    posted_text TEXT,
    posted_at TEXT,
    url TEXT,
    bucket TEXT,
    search_term TEXT,
    first_seen TEXT DEFAULT (datetime('now')),
    UNIQUE(company_id, external_id, title)
  );
  CREATE INDEX IF NOT EXISTS idx_jobs_company ON job_posts(company_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_bucket ON job_posts(bucket);

  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    taken_at TEXT DEFAULT (datetime('now')),
    ats_vendor TEXT,
    open_roles INTEGER,
    counts_json TEXT,
    states_json TEXT,
    countries_json TEXT,
    tools_json TEXT,
    facets_json TEXT,
    note TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_snap_company ON snapshots(company_id);

  CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    type TEXT NOT NULL,
    strength INTEGER NOT NULL,
    observed_at TEXT NOT NULL,
    source TEXT,
    source_url TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    payload_json TEXT,
    dedupe_key TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_signals_company ON signals(company_id);
  CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(type);
  CREATE INDEX IF NOT EXISTS idx_signals_observed ON signals(observed_at);

  CREATE TABLE IF NOT EXISTS sec_filings (
    id INTEGER PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    form TEXT,
    filed_at TEXT,
    items TEXT,
    accession TEXT,
    primary_doc TEXT,
    url TEXT,
    UNIQUE(company_id, accession)
  );

  CREATE TABLE IF NOT EXISTS warn_notices (
    id INTEGER PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    state TEXT,
    company_name_raw TEXT,
    notice_date TEXT,
    effective_date TEXT,
    employees INTEGER,
    location TEXT,
    source_url TEXT,
    UNIQUE(state, company_name_raw, notice_date, location)
  );

  CREATE TABLE IF NOT EXISTS run_log (
    id INTEGER PRIMARY KEY,
    step TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    ok INTEGER,
    note TEXT
  );
  `);
}

export function logRun(step: string, startedAt: string, ok: boolean, note: string) {
  db()
    .prepare(
      "INSERT INTO run_log(step, started_at, finished_at, ok, note) VALUES (?,?,datetime('now'),?,?)"
    )
    .run(step, startedAt, ok ? 1 : 0, note);
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
