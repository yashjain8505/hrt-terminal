/**
 * Step 6: Derive signals from everything collected. Idempotent (dedupe_key).
 * One-shot v0: "open" signals describe the current state; diff-based signals come with run #2.
 */
import { db, logRun } from "../src/lib/db";
import { nowIso } from "../src/lib/http";
import { VENDOR_BY_KEY, JD_TOOLS } from "../src/lib/vendors";
import type { Bucket } from "../src/lib/classify";

const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

interface Co { id: number; name: string; rank: number; employees: number | null; ats_vendor: string | null; hris_vendor: string | null; stack_json: string | null; open_roles: number | null; newcomer: number; jobs_growth: number; rank_change: number | null; careers_url: string | null; ats_board_url: string | null; detect_status: string | null; }
interface Snap { company_id: number; open_roles: number | null; counts_json: string; states_json: string; countries_json: string; tools_json: string; facets_json: string; ats_vendor: string; }
interface Job { title: string; url: string | null; bucket: Bucket; location: string | null; }

function main() {
  const started = nowIso();
  const d = db();
  const ins = d.prepare(`INSERT INTO signals (company_id, type, strength, observed_at, source, source_url, title, summary, payload_json, dedupe_key)
    VALUES (@company_id,@type,@strength,@observed_at,@source,@source_url,@title,@summary,@payload_json,@dedupe_key)
    ON CONFLICT(dedupe_key) DO UPDATE SET strength=excluded.strength, title=excluded.title, summary=excluded.summary, payload_json=excluded.payload_json, source_url=excluded.source_url`);
  const companies = d.prepare("SELECT id,name,rank,employees,ats_vendor,hris_vendor,stack_json,open_roles,newcomer,jobs_growth,rank_change,careers_url,ats_board_url,detect_status FROM companies").all() as Co[];
  const snapStmt = d.prepare("SELECT * FROM snapshots WHERE company_id=? ORDER BY id DESC LIMIT 1");
  const jobsStmt = d.prepare("SELECT title,url,bucket,location FROM job_posts WHERE company_id=? AND bucket IS NOT NULL");
  const filingsStmt = d.prepare("SELECT form,filed_at,items,url FROM sec_filings WHERE company_id=? AND filed_at>=? ORDER BY filed_at DESC");
  const warnStmt = d.prepare("SELECT state,notice_date,effective_date,employees,location,source_url FROM warn_notices WHERE company_id=? ORDER BY notice_date DESC");
  let n = 0;
  const emit = (row: { company_id: number; type: string; strength: number; observed_at: string; source: string; source_url: string | null; title: string; summary: string; payload: Record<string, unknown>; key: string }) => {
    ins.run({ company_id: row.company_id, type: row.type, strength: Math.max(1, Math.min(5, row.strength)), observed_at: row.observed_at, source: row.source, source_url: row.source_url, title: row.title, summary: row.summary, payload_json: JSON.stringify(row.payload), dedupe_key: `${row.company_id}:${row.type}:${row.key}` });
    n++;
  };
  const countStrength = (c: number, lo = 1, mid = 3, hi = 6) => (c >= hi ? 4 : c >= mid ? 3 : c >= lo ? 2 : 1);

  const tx = d.transaction(() => {
    // hiring.* and stack.* signals are fully derived from the current snapshot; rebuild them
    d.prepare("DELETE FROM signals WHERE type LIKE 'hiring.%' OR type LIKE 'stack.%'").run();
    for (const c of companies) {
      const stack: string[] = c.stack_json ? JSON.parse(c.stack_json) : [];
      // ---- stack signals
      const atsKeys = stack.filter((k) => VENDOR_BY_KEY[k]?.category === "ats" || (VENDOR_BY_KEY[k]?.category === "hris"));
      const primaryAts = c.ats_vendor && VENDOR_BY_KEY[c.ats_vendor] ? c.ats_vendor : atsKeys[0];
      if (primaryAts && VENDOR_BY_KEY[primaryAts]) {
        const v = VENDOR_BY_KEY[primaryAts];
        emit({ company_id: c.id, type: v.category === "hris" ? "stack.hris_detected" : "stack.ats_detected", strength: 2, observed_at: today, source: "careers site", source_url: c.ats_board_url || c.careers_url, title: `${v.category === "hris" ? "HRIS/ATS" : "ATS"}: ${v.name}`, summary: `${c.name}'s job board runs on ${v.name}.`, payload: { vendor: v.name, key: v.key, category: v.category }, key: v.key });
        if (v.category === "hris") emit({ company_id: c.id, type: "stack.ats_detected", strength: 2, observed_at: today, source: "careers site", source_url: c.ats_board_url || c.careers_url, title: `ATS: ${v.name} Recruiting`, summary: `${c.name} recruits through ${v.name}'s recruiting module.`, payload: { vendor: v.name, key: v.key, category: "ats" }, key: v.key });
      }
      for (const k of stack) {
        const v = VENDOR_BY_KEY[k]; if (!v) continue;
        if (k === primaryAts) continue;
        if (v.category === "hris") emit({ company_id: c.id, type: "stack.hris_detected", strength: 2, observed_at: today, source: "careers site", source_url: c.careers_url, title: `HRIS: ${v.name}`, summary: `${v.name} assets or links found on ${c.name}'s careers site.`, payload: { vendor: v.name, key: v.key, category: v.category }, key: v.key });
        else if (v.category === "ats") emit({ company_id: c.id, type: "stack.ats_detected", strength: 1, observed_at: today, source: "careers site", source_url: c.careers_url, title: `ATS (secondary): ${v.name}`, summary: `${v.name} links found on ${c.name}'s careers site (possibly a division or legacy board).`, payload: { vendor: v.name, key: v.key, category: v.category }, key: v.key });
        else emit({ company_id: c.id, type: "stack.tool_detected", strength: 2, observed_at: today, source: "careers site", source_url: c.careers_url, title: `${v.category === "crm" ? "Career-site / CRM" : "HR tool"}: ${v.name}`, summary: `${c.name}'s careers site loads ${v.name}.`, payload: { vendor: v.name, key: v.key, category: v.category }, key: v.key });
      }
      // ---- hiring signals from snapshot + jobs
      const snap = snapStmt.get(c.id) as Snap | undefined;
      if (snap) {
        const jobs = jobsStmt.all(c.id) as Job[];
        const byBucket: Record<string, Job[]> = {};
        for (const j of jobs) (byBucket[j.bucket] ||= []).push(j);
        const bucketType: Record<Bucket, string> = { people_exec: "hiring.people_exec_open", hr_leader: "hiring.hr_leader_open", recruiting: "hiring.recruiting_open", hris: "hiring.hris_open", payroll: "hiring.payroll_open", comp_benefits: "hiring.comp_benefits_open", learning: "hiring.learning_open", hr_generalist: "hiring.hr_generalist_open", engagement: "hiring.engagement_open", wfm: "hiring.wfm_open" };
        for (const [b, list] of Object.entries(byBucket)) {
          const type = bucketType[b as Bucket]; if (!type) continue;
          if (b === "people_exec") {
            for (const j of list.slice(0, 3)) emit({ company_id: c.id, type, strength: 5, observed_at: today, source: snap.ats_vendor, source_url: j.url, title: `Hiring: ${j.title}`, summary: `${c.name} has an open ${j.title} role${j.location ? " (" + j.location + ")" : ""}.`, payload: { title: j.title, location: j.location, url: j.url }, key: j.title.toLowerCase().slice(0, 60) });
          } else if (b === "hr_leader") {
            for (const j of list.slice(0, 3)) emit({ company_id: c.id, type, strength: 4, observed_at: today, source: snap.ats_vendor, source_url: j.url, title: `Hiring: ${j.title}`, summary: `${c.name} is hiring a ${j.title}${j.location ? " in " + j.location : ""}.`, payload: { title: j.title, location: j.location, url: j.url }, key: j.title.toLowerCase().slice(0, 60) });
          } else {
            const st = b === "hris" ? countStrength(list.length, 1, 2, 4) + 1 : countStrength(list.length);
            emit({ company_id: c.id, type, strength: st, observed_at: today, source: snap.ats_vendor, source_url: list[0].url, title: `${list.length} open ${b.replace(/_/g, " ")} role${list.length === 1 ? "" : "s"}`, summary: `${c.name} has ${list.length} open ${b.replace(/_/g, " ")} role${list.length === 1 ? "" : "s"}: ${list.slice(0, 3).map((j) => j.title).join("; ")}.`, payload: { count: list.length, titles: list.slice(0, 5).map((j) => j.title), urls: list.slice(0, 5).map((j) => j.url) }, key: "open" });
          }
        }
        const total = snap.open_roles ?? c.open_roles;
        if (total != null && total > 0) {
          const st = total >= 5000 ? 4 : total >= 1500 ? 3 : total >= 300 ? 2 : 1;
          emit({ company_id: c.id, type: "hiring.volume", strength: st, observed_at: today, source: snap.ats_vendor, source_url: c.ats_board_url, title: `${total.toLocaleString()} open roles`, summary: `${c.name} lists ${total.toLocaleString()} open roles on its ${snap.ats_vendor} board.`, payload: { open_roles: total }, key: "volume" });
        }
        const countries: Record<string, number> = JSON.parse(snap.countries_json || "{}");
        const cc = Object.keys(countries).filter((k) => k.length === 2);
        if (cc.length >= 2) {
          const top = Object.entries(countries).filter(([k]) => k.length === 2 && k !== "US").sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`);
          emit({ company_id: c.id, type: "hiring.intl_footprint", strength: cc.length >= 15 ? 4 : cc.length >= 6 ? 3 : 2, observed_at: today, source: snap.ats_vendor, source_url: c.ats_board_url, title: `Hiring in ${cc.length} countries`, summary: `${c.name} has open roles in ${cc.length} countries (top non-US: ${top.slice(0, 4).join(", ")}).`, payload: { countries: cc.length, top }, key: "intl" });
        }
        const facets: Record<string, { label: string; count: number }[]> = JSON.parse(snap.facets_json || "{}");
        const wst = facets.workerSubType;
        if (wst && wst.length) {
          const tot = wst.reduce((a, v) => a + v.count, 0);
          const nonReg = wst.filter((v) => /intern|contingent|temp|fixed|seasonal|contract/i.test(v.label)).reduce((a, v) => a + v.count, 0);
          const pct = tot ? Math.round((100 * nonReg) / tot) : 0;
          if (pct >= 15) emit({ company_id: c.id, type: "hiring.contingent_share", strength: pct >= 40 ? 3 : 2, observed_at: today, source: snap.ats_vendor, source_url: c.ats_board_url, title: `${pct}% contingent / intern / fixed-term postings`, summary: `${pct}% of ${c.name}'s postings are non-regular worker types.`, payload: { pct, breakdown: wst }, key: "contingent" });
        }
        const tools: Record<string, number> = JSON.parse(snap.tools_json || "{}");
        const named = Object.entries(tools).filter(([k, v]) => v > 0 && k !== "indeed" && k !== "linkedin_recruiter").sort((a, b) => b[1] - a[1]);
        if (named.length) {
          const labels = named.map(([k, v]) => `${JD_TOOLS.find((t) => t.key === k)?.name || k} (${v})`);
          emit({ company_id: c.id, type: "stack.tool_mentioned", strength: named.length >= 4 ? 3 : 2, observed_at: today, source: snap.ats_vendor, source_url: c.ats_board_url, title: `Job posts name ${labels.slice(0, 3).join(", ")}${named.length > 3 ? " +" + (named.length - 3) : ""}`, summary: `${c.name}'s job descriptions mention: ${labels.join(", ")}.`, payload: { tools: labels, raw: tools }, key: "tools" });
        }
      }
      // ---- SEC filings (last 180 days)
      const filings = filingsStmt.all(c.id, daysAgo(180)) as { form: string; filed_at: string; items: string; url: string }[];
      const seen502 = new Set<string>();
      for (const f of filings) {
        const items = f.items.split(",").map((s) => s.trim());
        if (items.includes("5.02") && seen502.size < 2 && !seen502.has(f.filed_at)) {
          seen502.add(f.filed_at);
          const age = (Date.now() - new Date(f.filed_at).getTime()) / 86400000;
          emit({ company_id: c.id, type: "exec.officer_change", strength: age < 45 ? 3 : 2, observed_at: f.filed_at, source: "SEC 8-K", source_url: f.url, title: `8-K Item 5.02: officer departure / appointment`, summary: `${c.name} reported a change in directors or officers on ${f.filed_at}.`, payload: { filed_at: f.filed_at, items: f.items }, key: f.filed_at });
        }
        if (items.includes("2.05")) emit({ company_id: c.id, type: "risk.restructuring", strength: 3, observed_at: f.filed_at, source: "SEC 8-K", source_url: f.url, title: `8-K Item 2.05: exit or disposal costs`, summary: `${c.name} disclosed restructuring / exit costs on ${f.filed_at}.`, payload: { filed_at: f.filed_at, items: f.items }, key: f.filed_at });
        if (items.includes("2.01")) emit({ company_id: c.id, type: "corp.acquisition", strength: 3, observed_at: f.filed_at, source: "SEC 8-K", source_url: f.url, title: `8-K Item 2.01: acquisition or disposition completed`, summary: `${c.name} completed an acquisition or disposition (filed ${f.filed_at}).`, payload: { filed_at: f.filed_at, items: f.items }, key: f.filed_at });
      }
      // ---- WARN
      const warns = warnStmt.all(c.id) as { state: string; notice_date: string; effective_date: string; employees: number; location: string; source_url: string }[];
      const byDate: Record<string, typeof warns> = {};
      for (const w of warns) (byDate[w.notice_date] ||= []).push(w);
      for (const [dt, list] of Object.entries(byDate)) {
        const emp = list.reduce((a, w) => a + (w.employees || 0), 0);
        emit({ company_id: c.id, type: "risk.warn_notice", strength: emp >= 250 ? 4 : emp >= 50 ? 3 : 2, observed_at: dt, source: "CA EDD WARN", source_url: list[0].source_url, title: `WARN notice: ${emp} employees (${list[0].state})`, summary: `${c.name} filed WARN notice(s) in ${list[0].state} on ${dt} covering ${emp} employees at ${list.length} location${list.length === 1 ? "" : "s"}.`, payload: { state: list[0].state, notice_date: dt, employees: emp, locations: list.map((w) => w.location) }, key: dt });
      }
      // ---- Fortune list facts
      if (c.newcomer) emit({ company_id: c.id, type: "fortune.newcomer", strength: 2, observed_at: today, source: "Fortune 500 2026", source_url: null, title: "New to the Fortune 500", summary: `${c.name} entered the Fortune 500 this year at #${c.rank}.`, payload: { rank: c.rank }, key: "2026" });
      if (c.jobs_growth) emit({ company_id: c.id, type: "fortune.jobs_growth", strength: 2, observed_at: today, source: "Fortune 500 2026", source_url: null, title: "Headcount grew year over year", summary: `Fortune reports ${c.name} grew jobs last year (employees: ${c.employees?.toLocaleString() || "n/a"}).`, payload: { employees: c.employees }, key: "2026" });
      if (c.rank_change != null && c.rank_change >= 25) emit({ company_id: c.id, type: "fortune.rank_gain", strength: c.rank_change >= 75 ? 3 : 2, observed_at: today, source: "Fortune 500 2026", source_url: null, title: `Climbed ${c.rank_change} places`, summary: `${c.name} moved up ${c.rank_change} places to #${c.rank}.`, payload: { change: c.rank_change, rank: c.rank }, key: "2026" });
    }
  });
  tx();
  const byType = d.prepare("SELECT type, count(*) n FROM signals GROUP BY type ORDER BY n DESC").all();
  console.log(byType);
  const note = `signals_upserted=${n} total=${(d.prepare("SELECT count(*) n FROM signals").get() as { n: number }).n}`;
  console.log("DONE", note);
  logRun("06-signals", started, true, note);
}
main();
