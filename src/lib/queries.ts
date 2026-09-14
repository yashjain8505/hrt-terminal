import "server-only";
import { db } from "./db";
import { PROFILE_BY_KEY, DEFAULT_PROFILE, scoreSignal, type Profile } from "./profiles";
import type { SignalRow } from "./whynow";

export interface CompanyRow {
  id: number; rank: number; name: string; slug: string; domain: string | null; website: string | null; sector: string | null; industry: string | null;
  hq_city: string | null; hq_state: string | null; employees: number | null; revenue_m: number | null; revenue_change_pct: number | null; profit_m: number | null; market_value_m: number | null;
  rank_change: number | null; newcomer: number; jobs_growth: number; founder_ceo: number; female_ceo: number; fortune_url: string | null; cik: string | null; ticker: string | null;
  careers_url: string | null; ats_vendor: string | null; ats_board_url: string | null; ats_config: string | null; hris_vendor: string | null; stack_json: string | null; detect_status: string | null; detect_note: string | null;
  open_roles: number | null; snapshot_at: string | null;
}

export type TapeRow = SignalRow & { score: number; company_name: string; company_slug: string; rank: number; sector: string | null; hq_state: string | null; ats_vendor: string | null };

export function getProfile(key: string | undefined | null): Profile {
  return PROFILE_BY_KEY[key || ""] || PROFILE_BY_KEY[DEFAULT_PROFILE];
}

export function getTape(profile: Profile, opts: { group?: string; type?: string; limit?: number; q?: string; minStrength?: number } = {}): TapeRow[] {
  const d = db();
  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  if (opts.type) { where.push("s.type = ?"); params.push(opts.type); }
  else if (opts.group) { where.push("s.type LIKE ?"); params.push(groupPrefix(opts.group)); }
  if (opts.minStrength) { where.push("s.strength >= ?"); params.push(opts.minStrength); }
  if (opts.q) { where.push("(c.name LIKE ? OR s.title LIKE ?)"); params.push(`%${opts.q}%`, `%${opts.q}%`); }
  const rows = d.prepare(`SELECT s.*, c.name company_name, c.slug company_slug, c.rank, c.sector, c.hq_state, c.ats_vendor FROM signals s JOIN companies c ON c.id=s.company_id WHERE ${where.join(" AND ")}`).all(...params) as (SignalRow & { company_name: string; company_slug: string; rank: number; sector: string | null; hq_state: string | null; ats_vendor: string | null })[];
  const scored = rows.map((r) => ({ ...r, score: scoreSignal(profile, r.type, r.strength) })).filter((r) => r.score > 0);
  scored.sort((a, b) => b.score - a.score || b.observed_at.localeCompare(a.observed_at) || a.rank - b.rank);
  return scored.slice(0, opts.limit ?? 400);
}

function groupPrefix(group: string): string {
  switch (group.toUpperCase()) {
    case "HIRING": return "hiring.%";
    case "STACK": return "stack.%";
    case "FILINGS": return "exec.%";
    case "CORP": return "corp.%";
    case "RISK": return "risk.%";
    case "LIST": return "fortune.%";
    default: return "%";
  }
}

export function getCompany(slug: string): CompanyRow | null {
  return (db().prepare("SELECT * FROM companies WHERE slug=?").get(slug) as CompanyRow | undefined) || null;
}

export function getCompanySignals(companyId: number, profile: Profile): (SignalRow & { score: number })[] {
  const rows = db().prepare("SELECT * FROM signals WHERE company_id=? ORDER BY observed_at DESC").all(companyId) as SignalRow[];
  return rows.map((r) => ({ ...r, score: scoreSignal(profile, r.type, r.strength) })).sort((a, b) => b.score - a.score || b.observed_at.localeCompare(a.observed_at));
}

export function getCompanyJobs(companyId: number) {
  return db().prepare("SELECT id,title,location,state,country,remote,posted_text,posted_at,url,bucket,search_term FROM job_posts WHERE company_id=? ORDER BY CASE WHEN bucket IS NULL THEN 1 ELSE 0 END, bucket, title").all(companyId) as { id: number; title: string; location: string | null; state: string | null; country: string | null; remote: number; posted_text: string | null; posted_at: string | null; url: string | null; bucket: string | null; search_term: string | null }[];
}

export function getSnapshot(companyId: number) {
  return (db().prepare("SELECT * FROM snapshots WHERE company_id=? ORDER BY id DESC LIMIT 1").get(companyId) as { taken_at: string; ats_vendor: string; open_roles: number | null; counts_json: string; states_json: string; countries_json: string; tools_json: string; facets_json: string; note: string } | undefined) || null;
}

export function getFilings(companyId: number) {
  return db().prepare("SELECT form,filed_at,items,url FROM sec_filings WHERE company_id=? ORDER BY filed_at DESC LIMIT 40").all(companyId) as { form: string; filed_at: string; items: string; url: string }[];
}

export function getWarn(companyId: number) {
  return db().prepare("SELECT state,company_name_raw,notice_date,effective_date,employees,location,source_url FROM warn_notices WHERE company_id=? ORDER BY notice_date DESC").all(companyId) as { state: string; company_name_raw: string; notice_date: string; effective_date: string | null; employees: number | null; location: string; source_url: string }[];
}

export interface UniverseRow extends CompanyRow { signals: number; hr_roles: number; score: number; top_type: string | null }

export function getUniverse(profile: Profile, opts: { sort?: string; dir?: string; q?: string; status?: string; vendor?: string } = {}): UniverseRow[] {
  const d = db();
  const rows = d.prepare(`SELECT c.*, (SELECT count(*) FROM signals s WHERE s.company_id=c.id) signals, (SELECT count(*) FROM job_posts j WHERE j.company_id=c.id AND j.bucket IS NOT NULL) hr_roles FROM companies c ORDER BY c.rank`).all() as (CompanyRow & { signals: number; hr_roles: number })[];
  const sig = d.prepare("SELECT company_id, type, strength FROM signals").all() as { company_id: number; type: string; strength: number }[];
  const scoreBy: Record<number, { score: number; top: string | null; topScore: number }> = {};
  for (const s of sig) {
    const sc = scoreSignal(profile, s.type, s.strength);
    const e = (scoreBy[s.company_id] ||= { score: 0, top: null, topScore: 0 });
    e.score += sc; if (sc > e.topScore) { e.topScore = sc; e.top = s.type; }
  }
  let out: UniverseRow[] = rows.map((r) => ({ ...r, score: Math.round((scoreBy[r.id]?.score || 0) * 10) / 10, top_type: scoreBy[r.id]?.top || null }));
  if (opts.q) { const q = opts.q.toLowerCase(); out = out.filter((r) => r.name.toLowerCase().includes(q) || (r.domain || "").includes(q) || (r.sector || "").toLowerCase().includes(q) || (r.hq_state || "").toLowerCase().includes(q)); }
  if (opts.status) out = out.filter((r) => r.detect_status === opts.status);
  if (opts.vendor) out = out.filter((r) => r.ats_vendor === opts.vendor || r.hris_vendor === opts.vendor);
  const sort = opts.sort || "score";
  const dir = opts.dir === "asc" ? 1 : -1;
  out.sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sort], bv = (b as unknown as Record<string, unknown>)[sort];
    if (av == null && bv == null) return a.rank - b.rank; if (av == null) return 1; if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir || a.rank - b.rank;
    return String(av).localeCompare(String(bv)) * dir || a.rank - b.rank;
  });
  return out;
}

export function getStats() {
  const d = db();
  const one = <T,>(sql: string) => d.prepare(sql).get() as T;
  const all = <T,>(sql: string) => d.prepare(sql).all() as T[];
  return {
    companies: one<{ n: number }>("SELECT count(*) n FROM companies").n,
    detect: all<{ detect_status: string; n: number }>("SELECT detect_status, count(*) n FROM companies GROUP BY detect_status ORDER BY n DESC"),
    ats: all<{ ats_vendor: string; n: number }>("SELECT ats_vendor, count(*) n FROM companies WHERE ats_vendor IS NOT NULL GROUP BY ats_vendor ORDER BY n DESC"),
    hris: all<{ hris_vendor: string; n: number }>("SELECT hris_vendor, count(*) n FROM companies WHERE hris_vendor IS NOT NULL GROUP BY hris_vendor ORDER BY n DESC"),
    openRoles: one<{ n: number | null }>("SELECT sum(open_roles) n FROM companies").n || 0,
    withRoles: one<{ n: number }>("SELECT count(*) n FROM companies WHERE open_roles IS NOT NULL").n,
    hrJobs: one<{ n: number }>("SELECT count(*) n FROM job_posts WHERE bucket IS NOT NULL").n,
    signals: one<{ n: number }>("SELECT count(*) n FROM signals").n,
    byType: all<{ type: string; n: number }>("SELECT type, count(*) n FROM signals GROUP BY type ORDER BY n DESC"),
    bySector: all<{ sector: string; companies: number; signals: number }>("SELECT c.sector, count(DISTINCT c.id) companies, count(s.id) signals FROM companies c LEFT JOIN signals s ON s.company_id=c.id GROUP BY c.sector ORDER BY signals DESC"),
    filings: one<{ n: number }>("SELECT count(*) n FROM sec_filings").n,
    warn: one<{ n: number }>("SELECT count(*) n FROM warn_notices WHERE company_id IS NOT NULL").n,
    runs: all<{ step: string; started_at: string; finished_at: string; ok: number; note: string }>("SELECT step, started_at, finished_at, ok, note FROM run_log ORDER BY id DESC LIMIT 20"),
    lastSnapshot: one<{ t: string | null }>("SELECT max(taken_at) t FROM snapshots").t,
    byState: all<{ hq_state: string; n: number }>("SELECT hq_state, count(*) n FROM companies GROUP BY hq_state ORDER BY n DESC LIMIT 12"),
  };
}

export function searchCompanies(q: string, limit = 12) {
  const like = `%${q}%`;
  return db().prepare("SELECT slug, name, rank, sector, ats_vendor, domain FROM companies WHERE name LIKE ? OR domain LIKE ? OR ticker LIKE ? ORDER BY CASE WHEN name LIKE ? THEN 0 ELSE 1 END, rank LIMIT ?").all(like, like, like, `${q}%`, limit) as { slug: string; name: string; rank: number; sector: string | null; ats_vendor: string | null; domain: string | null }[];
}

export function topMovers(profile: Profile, limit = 12) {
  return getUniverse(profile, { sort: "score" }).slice(0, limit);
}

export function tickerItems(profile: Profile, limit = 40) {
  return getTape(profile, { limit, minStrength: 3 });
}
