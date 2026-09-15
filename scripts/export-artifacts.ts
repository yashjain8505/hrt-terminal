/** Export the terminal's data as a browser bundle for the published artifacts. */
import fs from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";
import { parsePostedText } from "../src/lib/playbook";

const OUT = path.join(process.cwd(), "artifacts");
fs.mkdirSync(OUT, { recursive: true });
const d = db();
const companies = d.prepare("SELECT id,rank,name,slug,domain,sector,industry,hq_city,hq_state,employees,revenue_m,revenue_change_pct,profit_m,market_value_m,rank_change,newcomer,jobs_growth,cik,ticker,careers_url,ats_vendor,ats_board_url,hris_vendor,stack_json,detect_status,open_roles,lat,lng FROM companies ORDER BY rank").all() as Record<string, unknown>[];
const signals = d.prepare("SELECT id,company_id,type,strength,observed_at,source,source_url,title,summary,payload_json FROM signals").all() as Record<string, unknown>[];
const jobsRaw = d.prepare("SELECT id,company_id,title,location,state,country,posted_text,posted_at,url,bucket FROM job_posts WHERE bucket IS NOT NULL").all() as { id: number; company_id: number; title: string; location: string | null; state: string | null; country: string | null; posted_text: string | null; posted_at: string | null; url: string | null; bucket: string }[];
const jobs = jobsRaw.map((j) => ({ ...j, date: j.posted_at && /^\d{4}-\d{2}-\d{2}/.test(j.posted_at) ? j.posted_at.slice(0, 10) : parsePostedText(j.posted_text), approx: /\d+\+/.test(j.posted_text || "") ? 1 : 0 }));
const snaps = d.prepare("SELECT company_id, taken_at, ats_vendor, open_roles, counts_json, states_json, countries_json, tools_json, facets_json FROM snapshots WHERE id IN (SELECT max(id) FROM snapshots GROUP BY company_id)").all() as Record<string, unknown>[];
const snapshots: Record<number, unknown> = {};
for (const s of snaps) {
  const f = JSON.parse(String(s.facets_json || "{}"));
  snapshots[Number(s.company_id)] = { taken_at: s.taken_at, vendor: s.ats_vendor, open_roles: s.open_roles, counts: JSON.parse(String(s.counts_json || "{}")), states: JSON.parse(String(s.states_json || "{}")), countries: JSON.parse(String(s.countries_json || "{}")), tools: JSON.parse(String(s.tools_json || "{}")), workerSubType: f.workerSubType || null, hrFamily: f.hrFamily || null };
}
const warn = d.prepare("SELECT company_id,state,company_name_raw,notice_date,employees,location FROM warn_notices WHERE company_id IS NOT NULL").all();
const meta = { generated: new Date().toISOString().slice(0, 10), companies: companies.length, signals: signals.length, hrJobs: jobs.length, boards: snaps.length, filings: (d.prepare("SELECT count(*) n FROM sec_filings").get() as { n: number }).n };
const payload = { meta, companies, signals, jobs, snapshots, warn };
fs.writeFileSync(path.join(OUT, "data.js"), "window.HRT = " + JSON.stringify(payload) + ";\n");
fs.copyFileSync(path.join(process.cwd(), "public", "globe", "earth-night.jpg"), path.join(OUT, "earth-night.jpg"));
console.log("wrote artifacts/data.js", (fs.statSync(path.join(OUT, "data.js")).size / 1024).toFixed(0), "KB", meta);
