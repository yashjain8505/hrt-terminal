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
  const scored = rows.map((r) => ({ ...r, score: scoreSignal(profile, r.type, r.strength, r.payload_json) })).filter((r) => r.score > 0);
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
  return rows.map((r) => ({ ...r, score: scoreSignal(profile, r.type, r.strength, r.payload_json) })).sort((a, b) => b.score - a.score || b.observed_at.localeCompare(a.observed_at));
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
  const sig = d.prepare("SELECT company_id, type, strength, payload_json FROM signals").all() as { company_id: number; type: string; strength: number; payload_json: string | null }[];
  const scoreBy: Record<number, { score: number; top: string | null; topScore: number }> = {};
  for (const s of sig) {
    const sc = scoreSignal(profile, s.type, s.strength, s.payload_json);
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

// ---------------- Globe / timeline / matrix / campaign data ----------------
import { SIGNAL_GROUP } from "./profiles";
import { parsePostedText } from "./playbook";
import { execDomain } from "./classify";
import { COUNTRY_LATLNG } from "./geo";

export interface GlobePoint { slug: string; name: string; rank: number; lat: number; lng: number; score: number; group: string; ats: string | null; open_roles: number | null; hq: string; top: string; sector: string | null }
export interface GlobeArc { slug: string; name: string; startLat: number; startLng: number; endLat: number; endLng: number; country: string; count: number }
export interface GlobeEvent { id: number; slug: string; name: string; lat: number; lng: number; date: string; type: string; group: string; title: string; score: number; strength: number; url: string | null }

export function getGlobeData(profile: Profile) {
  const d = db();
  const cos = d.prepare("SELECT id,slug,name,rank,lat,lng,ats_vendor,open_roles,hq_city,hq_state,sector FROM companies WHERE lat IS NOT NULL").all() as { id: number; slug: string; name: string; rank: number; lat: number; lng: number; ats_vendor: string | null; open_roles: number | null; hq_city: string | null; hq_state: string | null; sector: string | null }[];
  const sigs = d.prepare("SELECT id,company_id,type,strength,observed_at,title,source_url,payload_json FROM signals").all() as { id: number; company_id: number; type: string; strength: number; observed_at: string; title: string; source_url: string | null; payload_json: string | null }[];
  const agg: Record<number, { score: number; top: string; topScore: number; groupScore: Record<string, number> }> = {};
  for (const s of sigs) {
    const sc = scoreSignal(profile, s.type, s.strength, s.payload_json);
    const a = (agg[s.company_id] ||= { score: 0, top: "", topScore: 0, groupScore: {} });
    a.score += sc; if (sc > a.topScore) { a.topScore = sc; a.top = s.type; }
    const g = SIGNAL_GROUP[s.type] || "STACK"; a.groupScore[g] = (a.groupScore[g] || 0) + sc;
  }
  const byId = new Map(cos.map((c) => [c.id, c]));
  const points: GlobePoint[] = cos.map((c) => {
    const a = agg[c.id];
    const risk = sigs.some((s) => s.company_id === c.id && s.type.startsWith("risk."));
    const group = risk ? "RISK" : a ? (Object.entries(a.groupScore).sort((x, y) => y[1] - x[1])[0]?.[0] || "STACK") : "NONE";
    return { slug: c.slug, name: c.name, rank: c.rank, lat: c.lat, lng: c.lng, score: Math.round((a?.score || 0) * 10) / 10, group, ats: c.ats_vendor, open_roles: c.open_roles, hq: [c.hq_city, c.hq_state].filter(Boolean).join(", "), top: a?.top || "", sector: c.sector };
  });
  // arcs: top accounts' international hiring
  const snaps = d.prepare("SELECT s.company_id, s.countries_json FROM snapshots s WHERE s.id IN (SELECT max(id) FROM snapshots GROUP BY company_id)").all() as { company_id: number; countries_json: string }[];
  const arcs: GlobeArc[] = [];
  const idBySlug = new Map(cos.map((c) => [c.slug, c.id]));
  const topIds = new Set([...points].sort((a, b) => b.score - a.score).slice(0, 120).map((p) => idBySlug.get(p.slug)!));
  for (const s of snaps) {
    if (!topIds.has(s.company_id)) continue;
    const c = byId.get(s.company_id); if (!c) continue;
    const countries: Record<string, number> = JSON.parse(s.countries_json || "{}");
    const top = Object.entries(countries).filter(([k]) => k.length === 2 && k !== "US" && COUNTRY_LATLNG[k]).sort((a, b) => b[1] - a[1]).slice(0, 4);
    for (const [k, n] of top) { const ll = COUNTRY_LATLNG[k]; arcs.push({ slug: c.slug, name: c.name, startLat: c.lat, startLng: c.lng, endLat: ll[0], endLng: ll[1], country: k, count: n }); }
  }
  // events: dated signals (filings, WARN) + dated HR postings
  const events: GlobeEvent[] = [];
  const cutoff = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  for (const s of sigs) {
    if (s.type.startsWith("hiring.") || s.type.startsWith("stack.") || s.type.startsWith("fortune.")) continue;
    if (s.observed_at < cutoff) continue;
    const c = byId.get(s.company_id); if (!c) continue;
    events.push({ id: s.id, slug: c.slug, name: c.name, lat: c.lat, lng: c.lng, date: s.observed_at.slice(0, 10), type: s.type, group: SIGNAL_GROUP[s.type] || "FILINGS", title: s.title, score: scoreSignal(profile, s.type, s.strength, s.payload_json), strength: s.strength, url: s.source_url });
  }
  const jobs = d.prepare("SELECT j.id, j.company_id, j.title, j.url, j.bucket, j.posted_text, j.posted_at FROM job_posts j WHERE j.bucket IN ('people_exec','hr_leader','hris','payroll','recruiting','comp_benefits','learning','wfm','engagement','hr_generalist')").all() as { id: number; company_id: number; title: string; url: string | null; bucket: string; posted_text: string | null; posted_at: string | null }[];
  const bucketType: Record<string, string> = { people_exec: "hiring.people_exec_open", hr_leader: "hiring.hr_leader_open", hris: "hiring.hris_open", payroll: "hiring.payroll_open", recruiting: "hiring.recruiting_open", comp_benefits: "hiring.comp_benefits_open", learning: "hiring.learning_open", wfm: "hiring.wfm_open", engagement: "hiring.engagement_open", hr_generalist: "hiring.hr_generalist_open" };
  for (const j of jobs) {
    const date = j.posted_at && /^\d{4}-\d{2}-\d{2}/.test(j.posted_at) ? j.posted_at.slice(0, 10) : parsePostedText(j.posted_text);
    if (!date || date < cutoff) continue;
    const c = byId.get(j.company_id); if (!c) continue;
    const type = bucketType[j.bucket];
    const strength = j.bucket === "people_exec" ? 5 : j.bucket === "hr_leader" ? 4 : j.bucket === "hris" ? 3 : 2;
    events.push({ id: 1000000 + j.id, slug: c.slug, name: c.name, lat: c.lat, lng: c.lng, date, type, group: "HIRING", title: `Role opened: ${j.title}`, score: scoreSignal(profile, type, strength, JSON.stringify({ domain: execDomain(j.title) })), strength, url: j.url });
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || b.score - a.score);
  // keep the feed relevant to the profile and bounded: best-scoring events, capped per day
  const perDay: Record<string, number> = {};
  const feed = events.filter((e) => e.score >= 1.5).sort((a, b) => b.score - a.score).filter((e) => { perDay[e.date] = (perDay[e.date] || 0) + 1; return perDay[e.date] <= 12; }).sort((a, b) => a.date.localeCompare(b.date) || b.score - a.score);
  return { points, arcs, events: feed };
}

export function getTimeline(profile: Profile) {
  const { events } = getGlobeData(profile);
  return events.filter((e) => e.score > 0);
}

export function getMatrix(profile: Profile, axis: "ats_vendor" | "hris_vendor" = "ats_vendor") {
  const d = db();
  const rows = d.prepare(`SELECT c.id, c.slug, c.name, c.sector, c.${axis} vendor, c.open_roles FROM companies c WHERE c.${axis} IS NOT NULL`).all() as { id: number; slug: string; name: string; sector: string | null; vendor: string; open_roles: number | null }[];
  const sig = d.prepare("SELECT company_id, type, strength, payload_json FROM signals").all() as { company_id: number; type: string; strength: number; payload_json: string | null }[];
  const score: Record<number, number> = {};
  for (const s of sig) score[s.company_id] = (score[s.company_id] || 0) + scoreSignal(profile, s.type, s.strength, s.payload_json);
  const cells: Record<string, Record<string, { n: number; roles: number; score: number; cos: { slug: string; name: string; score: number }[] }>> = {};
  const vendors: Record<string, number> = {}; const sectors: Record<string, number> = {};
  for (const r of rows) {
    const sec = r.sector || "Other";
    vendors[r.vendor] = (vendors[r.vendor] || 0) + 1; sectors[sec] = (sectors[sec] || 0) + 1;
    const cell = ((cells[r.vendor] ||= {})[sec] ||= { n: 0, roles: 0, score: 0, cos: [] });
    cell.n++; cell.roles += r.open_roles || 0; cell.score += score[r.id] || 0; cell.cos.push({ slug: r.slug, name: r.name, score: Math.round((score[r.id] || 0) * 10) / 10 });
  }
  for (const v of Object.values(cells)) for (const c of Object.values(v)) c.cos.sort((a, b) => b.score - a.score);
  return { cells, vendors: Object.entries(vendors).sort((a, b) => b[1] - a[1]).map(([k]) => k), sectors: Object.entries(sectors).sort((a, b) => b[1] - a[1]).map(([k]) => k) };
}

export interface CampaignRow { id: number; slug: string; name: string; rank: number; domain: string | null; sector: string | null; hq_state: string | null; employees: number | null; ats_vendor: string | null; hris_vendor: string | null; open_roles: number | null; score: number; top: (SignalRow & { score: number })[] }

export function getCampaign(profile: Profile, f: { vendor?: string; sector?: string; minRoles?: number; type?: string; state?: string; limit?: number }): CampaignRow[] {
  const d = db();
  const where: string[] = ["1=1"]; const params: unknown[] = [];
  if (f.vendor) { where.push("(c.ats_vendor=? OR c.hris_vendor=?)"); params.push(f.vendor, f.vendor); }
  if (f.sector) { where.push("c.sector=?"); params.push(f.sector); }
  if (f.state) { where.push("c.hq_state=?"); params.push(f.state); }
  if (f.minRoles) { where.push("c.open_roles>=?"); params.push(f.minRoles); }
  if (f.type) { where.push("EXISTS (SELECT 1 FROM signals s WHERE s.company_id=c.id AND s.type=?)"); params.push(f.type); }
  const cos = d.prepare(`SELECT c.id,c.slug,c.name,c.rank,c.domain,c.sector,c.hq_state,c.employees,c.ats_vendor,c.hris_vendor,c.open_roles FROM companies c WHERE ${where.join(" AND ")}`).all(...params) as Omit<CampaignRow, "score" | "top">[];
  const out: CampaignRow[] = cos.map((c) => {
    const sigs = getCompanySignals(c.id, profile);
    return { ...c, score: Math.round(sigs.reduce((a, s) => a + s.score, 0) * 10) / 10, top: sigs.slice(0, 3) };
  });
  out.sort((a, b) => b.score - a.score || a.rank - b.rank);
  return out.slice(0, f.limit ?? 200);
}

export function getSectors(): string[] {
  return (db().prepare("SELECT sector, count(*) n FROM companies GROUP BY sector ORDER BY n DESC").all() as { sector: string }[]).map((r) => r.sector).filter(Boolean);
}
export function getStates(): string[] {
  return (db().prepare("SELECT hq_state, count(*) n FROM companies GROUP BY hq_state ORDER BY n DESC").all() as { hq_state: string }[]).map((r) => r.hq_state).filter(Boolean);
}
