/** Step 3: Pull job boards for every pullable company; store postings + snapshot. */
import { db, logRun } from "../src/lib/db";
import { nowIso, pLimit } from "../src/lib/http";
import { pullBoard } from "../src/lib/pullers";

const LIMIT = Number(process.env.LIMIT || 0);
const ONLY = process.env.ONLY;
const CONC = Number(process.env.CONC || 6);

async function main() {
  const started = nowIso();
  const d = db();
  d.exec(`CREATE TABLE IF NOT EXISTS job_history (id INTEGER PRIMARY KEY, as_of TEXT NOT NULL, company_id INTEGER NOT NULL, external_id TEXT, title TEXT NOT NULL, location TEXT, url TEXT, bucket TEXT, search_term TEXT, posted_text TEXT, posted_at TEXT, UNIQUE(as_of, company_id, external_id, title)); CREATE INDEX IF NOT EXISTS idx_jh ON job_history(company_id, as_of);`);
  let rows = d.prepare("SELECT id,name,slug,ats_config FROM companies WHERE detect_status='pullable' ORDER BY rank").all() as { id: number; name: string; slug: string; ats_config: string }[];
  if (ONLY) rows = rows.filter((r) => r.slug.includes(ONLY));
  if (LIMIT) rows = rows.slice(0, LIMIT);
  const insJob = d.prepare(`INSERT OR IGNORE INTO job_posts (company_id, external_id, title, location, state, country, remote, posted_text, posted_at, url, bucket, search_term) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insSnap = d.prepare(`INSERT INTO snapshots (company_id, ats_vendor, open_roles, counts_json, states_json, countries_json, tools_json, facets_json, note) VALUES (?,?,?,?,?,?,?,?,?)`);
  const updCo = d.prepare(`UPDATE companies SET open_roles=?, snapshot_at=datetime('now'), updated_at=datetime('now') WHERE id=?`);
  const limit = pLimit(CONC);
  let ok = 0, fail = 0, done = 0;
  await Promise.all(rows.map((c) => limit(async () => {
    const cfg = JSON.parse(c.ats_config || "{}");
    const snap = await pullBoard(cfg).catch((e) => ({ vendor: cfg.vendor, total: null, postings: [], states: {}, countries: {}, tools: {}, facets: {}, note: "error " + String(e).slice(0, 100) }));
    const counts: Record<string, number> = {};
    for (const p of snap.postings) if (p.bucket) counts[p.bucket] = (counts[p.bucket] || 0) + 1;
    const { parseLocation } = await import("../src/lib/classify");
    const tx = d.transaction(() => {
      const prevAsOf = (d.prepare("SELECT max(taken_at) t FROM snapshots WHERE company_id=?").get(c.id) as { t: string | null }).t;
      if (prevAsOf) d.prepare(`INSERT OR IGNORE INTO job_history (as_of, company_id, external_id, title, location, url, bucket, search_term, posted_text, posted_at)
        SELECT ?, company_id, external_id, title, location, url, bucket, search_term, posted_text, posted_at FROM job_posts WHERE company_id=? AND bucket IS NOT NULL`).run(prevAsOf.slice(0, 10), c.id);
      d.prepare("DELETE FROM job_posts WHERE company_id=?").run(c.id);
      for (const p of snap.postings) {
        const loc = parseLocation(p.location);
        insJob.run(c.id, p.external_id || null, p.title, p.location || null, loc.state, loc.country, loc.remote ? 1 : 0, p.posted_text || null, p.posted_at || null, p.url || null, p.bucket, p.search_term || null);
      }
      insSnap.run(c.id, snap.vendor, snap.total, JSON.stringify(counts), JSON.stringify(snap.states), JSON.stringify(snap.countries), JSON.stringify(snap.tools), JSON.stringify(snap.facets), snap.note);
      if (snap.total != null) updCo.run(snap.total, c.id);
    });
    tx();
    if (snap.total != null) ok++; else fail++;
    done++;
    if (done % 20 === 0 || rows.length <= 20) console.log(`${done}/${rows.length} ${c.name} [${snap.vendor}] total=${snap.total} hr=${snap.postings.filter((p) => p.bucket).length} tools=${Object.keys(snap.tools).length} ${snap.note}`);
  })));
  const note = `pullable=${rows.length} ok=${ok} fail=${fail}`;
  console.log("DONE", note);
  logRun("03-snapshot", started, true, note);
}
main().catch((e) => { console.error(e); process.exit(1); });
