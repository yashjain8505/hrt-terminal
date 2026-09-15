import "server-only";
import fs from "node:fs";
import { db, DB_PATH } from "./db";
import { parsePostedText } from "./playbook";

export interface Bundle { meta: Record<string, unknown>; companies: Record<string, unknown>[]; signals: Record<string, unknown>[]; jobs: Record<string, unknown>[]; snapshots: Record<number, unknown>; warn: unknown[]; moves: Record<string, unknown>[] }

let cache: { mtime: number; bundle: Bundle } | null = null;

/** Everything the room needs, computed from SQLite. Cached until the DB file changes. */
export function buildBundle(): Bundle {
  const mtime = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).mtimeMs : 0;
  if (cache && cache.mtime === mtime) return cache.bundle;
  const d = db();
  const companies = d.prepare("SELECT id,rank,name,slug,domain,sector,industry,hq_city,hq_state,employees,revenue_m,revenue_change_pct,profit_m,market_value_m,rank_change,newcomer,jobs_growth,cik,ticker,careers_url,ats_vendor,ats_board_url,hris_vendor,stack_json,detect_status,open_roles,lat,lng FROM companies ORDER BY rank").all() as Record<string, unknown>[];
  const signals = d.prepare("SELECT id,company_id,type,strength,observed_at,source,source_url,title,summary,payload_json FROM signals").all() as Record<string, unknown>[];
  const jobsRaw = d.prepare("SELECT id,company_id,title,location,state,country,posted_text,posted_at,url,bucket FROM job_posts WHERE bucket IS NOT NULL").all() as { id: number; company_id: number; title: string; location: string | null; state: string | null; country: string | null; posted_text: string | null; posted_at: string | null; url: string | null; bucket: string }[];
  const jobs = jobsRaw.map((j) => ({ ...j, date: j.posted_at && /^\d{4}-\d{2}-\d{2}/.test(j.posted_at) ? j.posted_at.slice(0, 10) : parsePostedText(j.posted_text), approx: /\d+\+/.test(j.posted_text || "") ? 1 : 0 }));
  const snaps = d.prepare("SELECT company_id, taken_at, ats_vendor, open_roles, counts_json, states_json, countries_json, tools_json, facets_json FROM snapshots WHERE id IN (SELECT max(id) FROM snapshots GROUP BY company_id)").all() as Record<string, unknown>[];
  const snapshots: Record<number, unknown> = {};
  for (const s of snaps) { const f = JSON.parse(String(s.facets_json || "{}")); snapshots[Number(s.company_id)] = { taken_at: s.taken_at, vendor: s.ats_vendor, open_roles: s.open_roles, counts: JSON.parse(String(s.counts_json || "{}")), states: JSON.parse(String(s.states_json || "{}")), countries: JSON.parse(String(s.countries_json || "{}")), tools: JSON.parse(String(s.tools_json || "{}")), workerSubType: f.workerSubType || null, hrFamily: f.hrFamily || null }; }
  const warn = d.prepare("SELECT company_id,state,company_name_raw,notice_date,employees,location FROM warn_notices WHERE company_id IS NOT NULL").all();
  const hasMoves = (d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='moves'").get() as unknown) != null;
  const moves = hasMoves ? d.prepare("SELECT company_id, kind, person, role, hr, date, source_kind, source_url, title, confidence, sources_json FROM moves").all() as Record<string, unknown>[] : [];
  const one = <T,>(sql: string) => d.prepare(sql).get() as T;
  const lastSnap = one<{ t: string | null }>("SELECT max(taken_at) t FROM snapshots").t;
  const meta = { generated: (lastSnap || new Date().toISOString()).slice(0, 10), snapshot_at: lastSnap, companies: companies.length, signals: signals.length, hrJobs: jobs.length, boards: snaps.length, filings: one<{ n: number }>("SELECT count(*) n FROM sec_filings").n, moves: moves.length, runs: d.prepare("SELECT step, finished_at, ok, note FROM run_log ORDER BY id DESC LIMIT 12").all() };
  const bundle: Bundle = { meta, companies, signals, jobs, snapshots, warn, moves };
  cache = { mtime, bundle };
  return bundle;
}
