/**
 * Step 1: Universe. Pull the current Fortune 500 list (embedded JSON on fortune.com),
 * resolve a domain for each company (Clearbit autocomplete + HQ dataset fallback),
 * and load the companies table.
 */
import fs from "node:fs";
import path from "node:path";
import { db, slugify, logRun } from "../src/lib/db";
import { fetchText, fetchJson, nowIso, sleep } from "../src/lib/http";

const RAW = path.join(process.cwd(), "data", "raw");
const FORTUNE_URL = "https://fortune.com/ranking/fortune500/";
const HQ_CSV = "https://raw.githubusercontent.com/Appsilon/shiny.fluent/main/inst/examples/demo/Fortune_500_Corporate_Headquarters.csv";

interface FortuneItem {
  rank: number; name: string; permalink: string; data: Record<string, string>;
}

function num(v: string | undefined): number | null {
  if (!v) return null;
  const c = v.replace(/[$,%\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  const n = Number(c);
  return Number.isFinite(n) ? n : null;
}

async function loadFortune(): Promise<FortuneItem[]> {
  const cache = path.join(RAW, "fortune500.html");
  let html: string;
  if (fs.existsSync(cache)) html = fs.readFileSync(cache, "utf8");
  else {
    const r = await fetchText(FORTUNE_URL, { timeoutMs: 30000 });
    if (!r.ok) throw new Error("fortune fetch failed " + r.status);
    html = r.text;
    fs.writeFileSync(cache, html);
  }
  // Full list is embedded as plain JSON objects: {"data":{...},"name":"X","order":N,"rank":N,"slug":"/company/x/"}
  const re = /\{"data":(\{[^{}]*\}),"name":"((?:[^"\\]|\\.)*)","order":\d+,"rank":(\d+),"slug":"([^"]*)"\}/g;
  const out = new Map<number, FortuneItem>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const rank = Number(m[3]);
    if (rank < 1 || rank > 500 || out.has(rank)) continue;
    let data: Record<string, string> = {};
    try { data = JSON.parse(m[1]); } catch { /* ignore */ }
    const name = JSON.parse('"' + m[2] + '"');
    out.set(rank, { rank, name, permalink: "https://fortune.com" + m[4], data });
  }
  const items = [...out.values()].sort((a, b) => a.rank - b.rank);
  fs.writeFileSync(path.join(RAW, "fortune500-2026.json"), JSON.stringify(items, null, 1));
  return items;
}

function normName(s: string): string {
  return s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(/\b(inc|corp|corporation|co|company|holdings|holding|group|plc|ltd|llc|the|cos|companies|international|intl)\b/g, " ").replace(/\s+/g, " ").trim();
}

async function loadHqCsv(): Promise<Map<string, { website: string; employees: number | null }>> {
  const cache = path.join(RAW, "f500_hq.csv");
  if (!fs.existsSync(cache)) {
    const r = await fetchText(HQ_CSV, { timeoutMs: 30000 });
    if (r.ok) fs.writeFileSync(cache, r.text);
  }
  const map = new Map<string, { website: string; employees: number | null }>();
  if (!fs.existsSync(cache)) return map;
  const lines = fs.readFileSync(cache, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",");
  const iName = header.indexOf("NAME"), iWeb = header.indexOf("WEBSITE"), iEmp = header.indexOf("EMPLOYEES");
  for (const line of lines.slice(1)) {
    const cols = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')) || [];
    const name = cols[iName]; if (!name) continue;
    map.set(normName(name), { website: (cols[iWeb] || "").toLowerCase(), employees: num(cols[iEmp]) });
  }
  return map;
}

function domainFromUrl(u: string): string | null {
  try { const h = new URL(u.startsWith("http") ? u : "https://" + u).hostname.toLowerCase(); return h.replace(/^www\./, ""); } catch { return null; }
}

async function clearbit(name: string): Promise<string | null> {
  const r = await fetchJson<{ name: string; domain: string }[]>(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(name)}`, { timeoutMs: 8000 });
  if (!r.ok || !r.data || !r.data.length) return null;
  const nn = normName(name);
  const exact = r.data.find((d) => normName(d.name) === nn);
  return (exact || r.data[0]).domain.toLowerCase();
}

async function main() {
  const started = nowIso();
  const items = await loadFortune();
  console.log(`fortune items: ${items.length}`);
  if (items.length < 450) throw new Error("Fortune parse looks incomplete");
  const hq = await loadHqCsv();
  console.log(`hq rows: ${hq.size}`);
  const d = db();
  const ins = d.prepare(`INSERT INTO companies (rank,name,slug,domain,website,sector,industry,hq_city,hq_state,employees,revenue_m,revenue_change_pct,profit_m,market_value_m,rank_change,newcomer,jobs_growth,founder_ceo,female_ceo,fortune_url)
    VALUES (@rank,@name,@slug,@domain,@website,@sector,@industry,@hq_city,@hq_state,@employees,@revenue_m,@revenue_change_pct,@profit_m,@market_value_m,@rank_change,@newcomer,@jobs_growth,@founder_ceo,@female_ceo,@fortune_url)
    ON CONFLICT(slug) DO UPDATE SET rank=excluded.rank, domain=COALESCE(companies.domain, excluded.domain), website=COALESCE(companies.website, excluded.website), sector=excluded.sector, industry=excluded.industry, hq_city=excluded.hq_city, hq_state=excluded.hq_state, employees=excluded.employees, revenue_m=excluded.revenue_m, revenue_change_pct=excluded.revenue_change_pct, profit_m=excluded.profit_m, market_value_m=excluded.market_value_m, rank_change=excluded.rank_change, newcomer=excluded.newcomer, jobs_growth=excluded.jobs_growth, founder_ceo=excluded.founder_ceo, female_ceo=excluded.female_ceo, fortune_url=excluded.fortune_url, updated_at=datetime('now')`);
  let resolvedCb = 0, resolvedHq = 0, unresolved = 0;
  for (const it of items) {
    const dt = it.data;
    const nn = normName(it.name);
    const hqRow = hq.get(nn) || [...hq.entries()].find(([k]) => k === nn || (k.length > 4 && (nn.startsWith(k) || k.startsWith(nn))))?.[1];
    let domain: string | null = null;
    let website: string | null = null;
    const cb = await clearbit(it.name).catch(() => null);
    await sleep(120);
    if (cb) { domain = cb; website = "https://" + cb; resolvedCb++; }
    else if (hqRow?.website) { domain = domainFromUrl(hqRow.website); website = hqRow.website; resolvedHq++; }
    else unresolved++;
    ins.run({
      rank: it.rank, name: it.name, slug: slugify(it.name), domain, website,
      sector: dt["Sector"] || null, industry: dt["Industry"] || null,
      hq_city: dt["Headquarters City"] || null, hq_state: dt["State"] || null,
      employees: num(dt["Employees"]) ?? hqRow?.employees ?? null,
      revenue_m: num(dt["Revenues ($M)"]), revenue_change_pct: num(dt["Revenue Percent Change"]),
      profit_m: num(dt["Profits ($M)"]), market_value_m: num(dt["Market Value ($M)"]),
      rank_change: num(dt["Change in Rank (500 only)"]),
      newcomer: dt["Newcomer to the Fortune 500"] === "yes" ? 1 : 0,
      jobs_growth: dt["Growth in Jobs"] === "yes" ? 1 : 0,
      founder_ceo: dt["Founder is CEO"] === "yes" ? 1 : 0,
      female_ceo: dt["Female CEO"] === "yes" ? 1 : 0,
      fortune_url: it.permalink,
    });
    if (it.rank % 50 === 0) console.log(`  ${it.rank} ${it.name} -> ${domain}`);
  }
  const note = `items=${items.length} clearbit=${resolvedCb} hqcsv=${resolvedHq} unresolved=${unresolved}`;
  console.log(note);
  logRun("01-universe", started, true, note);
}

main().catch((e) => { console.error(e); logRun("01-universe", nowIso(), false, String(e)); process.exit(1); });
