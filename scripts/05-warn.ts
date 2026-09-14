/**
 * Step 5: WARN notices. v0 = California EDD workbook (updated twice weekly). Other states are
 * dashboards or PDFs and are left for a later feed. Matched to companies by normalized name.
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { db, logRun } from "../src/lib/db";
import { nowIso } from "../src/lib/http";

const CA_URL = "https://edd.ca.gov/siteassets/files/jobs_and_training/warn/warn_report1.xlsx";
const RAW = path.join(process.cwd(), "data", "raw");

function normName(s: string): string {
  return s.toLowerCase().replace(/\(.*?\)/g, " ").replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(/\b(inc|corp|corporation|co|company|holdings|holding|group|plc|ltd|llc|the|cos|companies|international|intl|dba|usa|us|of|america|north)\b/g, " ").replace(/\s+/g, " ").trim();
}

async function main() {
  const started = nowIso();
  const d = db();
  const file = path.join(RAW, "warn_ca.xlsx");
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 30000);
  const res = await fetch(CA_URL, { headers: { "User-Agent": "Mozilla/5.0" }, signal: ctrl.signal }).catch(() => null);
  clearTimeout(t);
  if (res && res.ok) fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  if (!fs.existsSync(file)) throw new Error("CA WARN download failed");
  const wb = XLSX.readFile(file);
  const sheetName = wb.SheetNames.find((n) => /detailed warn/i.test(n)) || wb.SheetNames[2];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, raw: true }) as unknown[][];
  const headerIdx = rows.findIndex((r) => r.some((c) => /company/i.test(String(c || ""))));
  const header = (rows[headerIdx] || []).map((c) => String(c || "").replace(/\s+/g, " ").trim().toLowerCase());
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const iCounty = col(/county/), iNotice = col(/notice date/), iEff = col(/effective/), iCo = col(/^company/), iEmp = col(/employees/), iAddr = col(/address/);
  const companies = d.prepare("SELECT id,name FROM companies").all() as { id: number; name: string }[];
  const byNorm = new Map(companies.map((c) => [normName(c.name), c.id]));
  const ins = d.prepare("INSERT OR IGNORE INTO warn_notices (company_id, state, company_name_raw, notice_date, effective_date, employees, location, source_url) VALUES (?,?,?,?,?,?,?,?)");
  const toDate = (v: unknown): string | null => {
    if (v == null || v === "") return null;
    if (typeof v === "number") { const dt = XLSX.SSF.parse_date_code(v); return dt ? `${dt.y}-${String(dt.m).padStart(2, "0")}-${String(dt.d).padStart(2, "0")}` : null; }
    const m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : String(v);
  };
  let total = 0, matched = 0;
  for (const r of rows.slice(headerIdx + 1)) {
    const co = String(r[iCo] || "").trim(); if (!co) continue;
    total++;
    const nn = normName(co);
    let cid: number | null = byNorm.get(nn) ?? null;
    if (!cid) { for (const [k, id] of byNorm) { if (k.length >= 5 && (nn.startsWith(k + " ") || nn === k)) { cid = id; break; } } }
    if (cid) matched++;
    ins.run(cid, "CA", co, toDate(r[iNotice]), toDate(r[iEff]), Number(r[iEmp] || 0) || null, `${r[iCounty] || ""}${iAddr >= 0 && r[iAddr] ? " | " + r[iAddr] : ""}`.trim(), CA_URL);
  }
  const note = `ca_rows=${total} matched_to_f500=${matched}`;
  console.log("DONE", note);
  logRun("05-warn", started, true, note);
}
main().catch((e) => { console.error(e); process.exit(1); });
