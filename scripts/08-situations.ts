/** Step 8: detect situations for every company and store them. Prints the three reference stories. */
import { db, logRun } from "../src/lib/db";
import { nowIso } from "../src/lib/http";
import { detectSituations, SITUATION_BY_KEY } from "../src/lib/situations";
import { PROFILE_BY_KEY } from "../src/lib/profiles";
import { situationStory } from "../src/lib/situations";

const d = db();
d.exec(`CREATE TABLE IF NOT EXISTS situations (
  id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id), key TEXT NOT NULL, headline TEXT, opened_at TEXT, window_ends TEXT, confidence TEXT, facts_json TEXT, buyers_json TEXT, system TEXT, as_of TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(company_id, key, as_of));
CREATE INDEX IF NOT EXISTS idx_sit_key ON situations(key);`);
const started = nowIso();
const asOf = ((d.prepare("SELECT max(taken_at) t FROM snapshots").get() as { t: string | null }).t || nowIso()).slice(0, 10);
const cos = d.prepare("SELECT id,name,slug,ats_vendor,hris_vendor,employees FROM companies").all() as { id: number; name: string; slug: string; ats_vendor: string | null; hris_vendor: string | null; employees: number | null }[];
const jobsQ = d.prepare("SELECT title,location,url,bucket,posted_text,posted_at FROM job_posts WHERE company_id=? AND bucket IS NOT NULL");
const sigQ = d.prepare("SELECT type,observed_at,title,source_url,payload_json FROM signals WHERE company_id=?");
const snapQ = d.prepare("SELECT tools_json,countries_json FROM snapshots WHERE company_id=? ORDER BY id DESC LIMIT 1");
const ins = d.prepare("INSERT OR REPLACE INTO situations (company_id,key,headline,opened_at,window_ends,confidence,facts_json,buyers_json,system,as_of) VALUES (?,?,?,?,?,?,?,?,?,?)");
const counts: Record<string, Record<string, number>> = {};
const tx = d.transaction(() => {
  d.prepare("DELETE FROM situations WHERE as_of=?").run(asOf);
  for (const co of cos) {
    const sn = snapQ.get(co.id) as { tools_json: string; countries_json: string } | undefined;
    const sits = detectSituations(co, jobsQ.all(co.id) as never[], sigQ.all(co.id) as never[], sn ? { tools: JSON.parse(sn.tools_json || "{}"), countries: JSON.parse(sn.countries_json || "{}") } : null, asOf);
    for (const s of sits) { ins.run(co.id, s.key, s.headline, s.openedAt, s.windowEnds, s.confidence, JSON.stringify(s.facts), JSON.stringify(s.buyers), s.system || null, asOf); ((counts[s.key] ||= {})[s.confidence] = (counts[s.key][s.confidence] || 0) + 1); }
  }
});
tx();
console.log("as of", asOf);
for (const [k, c] of Object.entries(counts)) console.log(`${SITUATION_BY_KEY[k].name}: ${Object.entries(c).map(([cf, n]) => `${cf} ${n}`).join(", ")}`);
for (const slug of ["chewy", "kyndryl-holdings", "ecolab"]) {
  const co = cos.find((c) => c.slug === slug)!;
  const sn = snapQ.get(co.id) as { tools_json: string; countries_json: string } | undefined;
  const sits = detectSituations(co, jobsQ.all(co.id) as never[], sigQ.all(co.id) as never[], sn ? { tools: JSON.parse(sn.tools_json || "{}"), countries: JSON.parse(sn.countries_json || "{}") } : null, asOf);
  console.log(`\n=== ${co.name}`);
  for (const s of sits) {
    const st = situationStory(s, co, PROFILE_BY_KEY[s.key === "systems_project" ? "payroll" : s.key === "recruiting_build" || s.key === "new_leader" ? "ats" : "hris"]);
    console.log(`[${s.key} · ${s.confidence} · opened ${s.openedAt} · ${st.window}] ${s.headline}`);
    for (const f of s.facts) console.log(`   - ${f.date || "undated"}: ${f.text}`);
    console.log(`   means: ${st.means}`); console.log(`   who: ${st.who.join(", ")}`); console.log(`   first line: ${st.firstLine}`);
  }
}
logRun("08-situations", started, true, JSON.stringify(counts));
