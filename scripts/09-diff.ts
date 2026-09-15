/**
 * Step 9: diff the latest two snapshots per company → dated change events.
 * job_history keeps every snapshot's HR-bucket postings so roles can be seen opening and closing.
 * "Role filled" is only trusted where the previous list was exhaustive (Greenhouse / Lever / Ashby /
 * SmartRecruiters boards, and Workday's HR job-family facet pull); keyword-search samples are not diffed.
 */
import Database from "better-sqlite3";
import { db, logRun } from "../src/lib/db";
import { nowIso } from "../src/lib/http";

const d = db();
d.exec(`CREATE TABLE IF NOT EXISTS job_history (
  id INTEGER PRIMARY KEY, as_of TEXT NOT NULL, company_id INTEGER NOT NULL, external_id TEXT, title TEXT NOT NULL, location TEXT, url TEXT, bucket TEXT, search_term TEXT, posted_text TEXT, posted_at TEXT,
  UNIQUE(as_of, company_id, external_id, title));
CREATE INDEX IF NOT EXISTS idx_jh ON job_history(company_id, as_of);`);

const started = nowIso();
const IMPORT_PREV = process.env.IMPORT_PREV; // path to an older terminal.db whose job_posts become history for its snapshot date
if (IMPORT_PREV) {
  const p = new Database(IMPORT_PREV, { readonly: true });
  const asOf = (p.prepare("SELECT max(taken_at) t FROM snapshots").get() as { t: string }).t.slice(0, 10);
  const rows = p.prepare("SELECT company_id, external_id, title, location, url, bucket, search_term, posted_text, posted_at FROM job_posts WHERE bucket IS NOT NULL").all() as Record<string, unknown>[];
  const ins = d.prepare("INSERT OR IGNORE INTO job_history (as_of, company_id, external_id, title, location, url, bucket, search_term, posted_text, posted_at) VALUES (?,?,?,?,?,?,?,?,?,?)");
  const tx = d.transaction(() => { for (const r of rows) ins.run(asOf, r.company_id, r.external_id, r.title, r.location, r.url, r.bucket, r.search_term, r.posted_text, r.posted_at); });
  tx();
  console.log(`imported ${rows.length} postings as history for ${asOf}`);
}
// Always record the current postings under the latest snapshot date
const cur = (d.prepare("SELECT max(taken_at) t FROM snapshots").get() as { t: string }).t.slice(0, 10);
{
  const rows = d.prepare("SELECT company_id, external_id, title, location, url, bucket, search_term, posted_text, posted_at FROM job_posts WHERE bucket IS NOT NULL").all() as Record<string, unknown>[];
  const ins = d.prepare("INSERT OR IGNORE INTO job_history (as_of, company_id, external_id, title, location, url, bucket, search_term, posted_text, posted_at) VALUES (?,?,?,?,?,?,?,?,?,?)");
  const tx = d.transaction(() => { for (const r of rows) ins.run(cur, r.company_id, r.external_id, r.title, r.location, r.url, r.bucket, r.search_term, r.posted_text, r.posted_at); });
  tx();
}
const dates = (d.prepare("SELECT DISTINCT as_of FROM job_history ORDER BY as_of").all() as { as_of: string }[]).map((r) => r.as_of);
if (dates.length < 2) { console.log("need two snapshot dates, have", dates); process.exit(0); }
const [prev, now] = dates.slice(-2);
console.log(`diffing ${prev} → ${now}`);
const sig = d.prepare(`INSERT INTO signals (company_id, type, strength, observed_at, source, source_url, title, summary, payload_json, dedupe_key) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(dedupe_key) DO UPDATE SET strength=excluded.strength, title=excluded.title, summary=excluded.summary, payload_json=excluded.payload_json`);
const cos = d.prepare("SELECT id, name, ats_vendor FROM companies").all() as { id: number; name: string; ats_vendor: string | null }[];
const snapPair = d.prepare("SELECT taken_at, open_roles, states_json, countries_json, ats_vendor FROM snapshots WHERE company_id=? ORDER BY id DESC LIMIT 2");
const hist = d.prepare("SELECT external_id, title, location, url, bucket, search_term FROM job_history WHERE company_id=? AND as_of=? AND bucket IS NOT NULL");
const EXHAUSTIVE = new Set(["greenhouse", "lever", "ashby", "smartrecruiters"]);
const W: Record<string, number> = { people_exec: 5, hr_leader: 4, hris: 3, payroll: 2, recruiting: 2, comp_benefits: 2, learning: 2, hr_generalist: 2, engagement: 2, wfm: 2 };
let filled = 0, opened = 0, velocity = 0, locs = 0, switched = 0;
const tx = d.transaction(() => {
  for (const c of cos) {
    const snaps = snapPair.all(c.id) as { taken_at: string; open_roles: number | null; states_json: string; countries_json: string; ats_vendor: string }[];
    const before = hist.all(c.id, prev) as { external_id: string | null; title: string; location: string | null; url: string | null; bucket: string; search_term: string | null }[];
    const after = hist.all(c.id, now) as typeof before;
    if (!before.length && !after.length) continue;
    const key = (j: { external_id: string | null; title: string }) => (j.external_id || j.title).toLowerCase() + "|" + j.title.toLowerCase();
    const bset = new Map(before.map((j) => [key(j), j])), aset = new Map(after.map((j) => [key(j), j]));
    const trusted = (j: { search_term: string | null }) => EXHAUSTIVE.has(snaps[0]?.ats_vendor || c.ats_vendor || "") || j.search_term === "facet:hr";
    for (const [k, j] of bset) if (!aset.has(k) && trusted(j)) {
      sig.run(c.id, "hiring.role_filled", W[j.bucket] || 2, now, snaps[0]?.ats_vendor || "board", j.url, `Filled or closed: ${j.title}`, `${c.name}'s "${j.title}" posting (${j.bucket.replace(/_/g, " ")}) came off the board between ${prev} and ${now}: hired, or withdrawn.`, JSON.stringify({ title: j.title, bucket: j.bucket, location: j.location, seen_until: prev }), `${c.id}:hiring.role_filled:${k.slice(0, 80)}:${now}`); filled++;
    }
    for (const [k, j] of aset) if (!bset.has(k) && (trusted(j) || j.bucket === "people_exec" || j.bucket === "hr_leader" || j.bucket === "hris")) {
      sig.run(c.id, "hiring.role_opened", W[j.bucket] || 2, now, snaps[0]?.ats_vendor || "board", j.url, `New posting: ${j.title}`, `${c.name} posted "${j.title}" (${j.bucket.replace(/_/g, " ")}) since ${prev}.`, JSON.stringify({ title: j.title, bucket: j.bucket, location: j.location, first_seen: now }), `${c.id}:hiring.role_opened:${k.slice(0, 80)}:${now}`); opened++;
    }
    if (snaps.length === 2 && snaps[0].open_roles != null && snaps[1].open_roles != null && snaps[1].open_roles >= 20) {
      const delta = (snaps[0].open_roles - snaps[1].open_roles) / snaps[1].open_roles;
      if (Math.abs(delta) >= 0.3) { sig.run(c.id, "hiring.velocity", 3, now, snaps[0].ats_vendor, null, `Open roles ${delta > 0 ? "up" : "down"} ${Math.round(Math.abs(delta) * 100)}%`, `${c.name}'s open roles went from ${snaps[1].open_roles} to ${snaps[0].open_roles} between ${prev} and ${now}.`, JSON.stringify({ from: snaps[1].open_roles, to: snaps[0].open_roles, pct: Math.round(delta * 100) }), `${c.id}:hiring.velocity:${now}`); velocity++; }
      const ps = Object.keys(JSON.parse(snaps[1].states_json || "{}")), cs = Object.keys(JSON.parse(snaps[0].states_json || "{}"));
      const pc = Object.keys(JSON.parse(snaps[1].countries_json || "{}")), cc = Object.keys(JSON.parse(snaps[0].countries_json || "{}"));
      const exhaustive = EXHAUSTIVE.has(snaps[0].ats_vendor || "");
      const newStates = exhaustive ? cs.filter((s) => !ps.includes(s)) : [], newCountries = cc.filter((s) => !pc.includes(s) && s.length === 2);
      if ((exhaustive ? ps.length : pc.length) && (newStates.length || newCountries.length)) { sig.run(c.id, "hiring.new_location", newCountries.length ? 4 : 3, now, snaps[0].ats_vendor, null, `First postings in ${[...newCountries.map((x) => ({ US: "the United States", CA: "Canada", MX: "Mexico", BR: "Brazil", GB: "the United Kingdom", IE: "Ireland", FR: "France", DE: "Germany", NL: "the Netherlands", ES: "Spain", IT: "Italy", CH: "Switzerland", PL: "Poland", SE: "Sweden", FI: "Finland", IL: "Israel", IN: "India", CN: "China", JP: "Japan", KR: "South Korea", SG: "Singapore", PH: "the Philippines", AU: "Australia", CR: "Costa Rica", CL: "Chile", AR: "Argentina", CO: "Colombia" } as Record<string, string>)[x] || x), ...newStates].slice(0, 4).join(", ")}`, `${c.name} started posting in ${[...newCountries.map((x) => "country " + x), ...newStates.map((x) => "state " + x)].slice(0, 5).join(", ")} since ${prev}.`, JSON.stringify({ states: newStates, countries: newCountries }), `${c.id}:hiring.new_location:${now}`); locs++; }
      if (snaps[0].ats_vendor && snaps[1].ats_vendor && snaps[0].ats_vendor !== snaps[1].ats_vendor) { sig.run(c.id, "stack.ats_changed", 5, now, "board", null, `Job board moved from ${snaps[1].ats_vendor} to ${snaps[0].ats_vendor}`, `${c.name}'s careers site switched systems between ${prev} and ${now}.`, JSON.stringify({ from: snaps[1].ats_vendor, to: snaps[0].ats_vendor }), `${c.id}:stack.ats_changed:${now}`); switched++; }
    }
  }
});
tx();
const note = `prev=${prev} now=${now} filled=${filled} opened=${opened} velocity=${velocity} new_location=${locs} ats_changed=${switched}`;
console.log("DONE", note);
logRun("09-diff", started, true, note);
