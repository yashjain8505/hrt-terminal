/** Apply hand-checked domain overrides (data/domain-overrides.json) on top of automated resolution. */
import fs from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";

const overrides: Record<string, string> = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "domain-overrides.json"), "utf8"));
const d = db();
const upd = d.prepare("UPDATE companies SET domain=?, website=?, updated_at=datetime('now') WHERE name=?");
let n = 0;
for (const [name, domain] of Object.entries(overrides)) {
  const r = upd.run(domain, "https://" + domain, name);
  if (r.changes) n++; else console.warn("no match for override:", name);
}
const nulls = d.prepare("SELECT rank,name FROM companies WHERE domain IS NULL ORDER BY rank").all() as { rank: number; name: string }[];
console.log(`applied ${n} overrides; still null: ${nulls.length}`, nulls);
const ranks = new Set((d.prepare("SELECT rank FROM companies").all() as { rank: number }[]).map((r) => r.rank));
const missing = []; for (let i = 1; i <= 500; i++) if (!ranks.has(i)) missing.push(i);
console.log("missing ranks:", missing);
