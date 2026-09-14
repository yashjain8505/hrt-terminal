/** Re-bucket stored postings with the current classifier (no network). */
import { db } from "../src/lib/db";
import { classifyTitle } from "../src/lib/classify";
const d = db();
const rows = d.prepare("SELECT id, title, bucket, search_term FROM job_posts").all() as { id: number; title: string; bucket: string | null; search_term: string | null }[];
const upd = d.prepare("UPDATE job_posts SET bucket=? WHERE id=?");
let changed = 0;
const tx = d.transaction(() => { for (const r of rows) { let b = classifyTitle(r.title); if (!b && r.search_term === "facet:hr") b = "hr_generalist"; if (b !== r.bucket) { upd.run(b, r.id); changed++; } } });
tx();
console.log(`reclassified ${rows.length} postings, changed ${changed}`);
console.log(d.prepare("SELECT bucket, count(*) n FROM job_posts GROUP BY bucket ORDER BY n DESC").all());
console.log(d.prepare("SELECT c.name, j.title FROM job_posts j JOIN companies c ON c.id=j.company_id WHERE j.bucket='people_exec'").all());
