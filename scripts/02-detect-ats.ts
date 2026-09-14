/**
 * Step 2: For each company, find the careers site and the ATS / HRIS behind it.
 * Hops: homepage -> careers page(s) -> a jobs/search page -> one job page (via sitemap or links).
 * Records careers_url, ats_vendor, hris_vendor, stack_json, ats_config (pullable board config).
 */

import { db, logRun } from "../src/lib/db";
import { fetchText, nowIso, pLimit } from "../src/lib/http";
import { VENDORS, detectVendors, extractBoardConfig, phenomBody, CUSTOM_ADAPTERS } from "../src/lib/vendors";
import { fetchJson } from "../src/lib/http";

const HRIS_KEYS = new Set(VENDORS.filter((v) => v.category === "hris").map((v) => v.key));
const ATS_KEYS = new Set(VENDORS.filter((v) => v.category === "ats").map((v) => v.key));
const LIMIT = Number(process.env.LIMIT || 0);
const ONLY = process.env.ONLY; // slug filter for debugging
const CONC = Number(process.env.CONC || 8);

interface Company { id: number; name: string; slug: string; domain: string | null; }

function absUrl(href: string, base: string): string | null {
  try { return new URL(href, base).toString(); } catch { return null; }
}

function extractLinks(html: string, base: string, re: RegExp, max = 6): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const a = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = a.exec(html)) && out.length < max) {
    const href = m[1], text = m[2].replace(/<[^>]+>/g, " ");
    if (!re.test(href) && !re.test(text)) continue;
    const u = absUrl(href, base); if (!u || !/^https?:/.test(u)) continue;
    if (/\.(pdf|jpg|png|svg|css|js)(\?|$)/i.test(u)) continue;
    const k = u.replace(/[#?].*$/, "").replace(/\/$/, "");
    if (seen.has(k)) continue; seen.add(k); out.push(u);
  }
  return out;
}

const CAREERS_RE = /career|\bjobs?\b|join[-_ ]?(us|our|the)|work[-_ ]?(with|for|at)[-_ ]?us|employment|opportunit|talent|hiring|openings/i;
const SEARCH_RE = /search|jobs|openings|opportunit|positions|find[-_ ]?(a[-_ ]?)?job|explore|browse|view[-_ ]?(all|jobs)|apply/i;
const JOBPAGE_RE = /\/job\/|\/jobs\/[^/]+\/[^/]+|\/job-details|\/job_details|\/jobdetails|\/careers?\/[^/]+\/\d+|\/position\/|\/req\d*\//i;

async function detect(c: Company) {
  const d = db();
  if (!c.domain) {
    d.prepare("UPDATE companies SET detect_status='no_domain', updated_at=datetime('now') WHERE id=?").run(c.id);
    return { status: "no_domain" };
  }
  const stack = new Set<string>();
  let pull: ReturnType<typeof extractBoardConfig> = null;
  let careersUrl: string | null = null;
  let fetches = 0;
  const visited = new Set<string>();
  const notes: string[] = [];

  async function visit(url: string): Promise<string | null> {
    const key = url.replace(/[#?].*$/, "").replace(/\/$/, "").toLowerCase();
    if (visited.has(key) || fetches >= 9) return null;
    visited.add(key); fetches++;
    const r = await fetchText(url, { timeoutMs: 12000 });
    if (!r.ok || !r.text) { notes.push(`${r.status} ${url}`); return null; }
    for (const v of detectVendors(r.text, r.url)) stack.add(v);
    const cfg = extractBoardConfig(r.text, r.url);
    if (cfg && !pull) pull = cfg;
    else if (cfg && pull && pull.vendor === "workday" && !pull.config.site && cfg.config.site) pull = cfg;
    return r.text ? r.text : null;
  }

  // Hop 0: homepage
  const home = await fetchText(`https://${c.domain}/`, { timeoutMs: 12000 });
  let homeHtml = "";
  let homeUrl = `https://${c.domain}/`;
  fetches++;
  if (home.ok) { homeHtml = home.text; homeUrl = home.url; for (const v of detectVendors(homeHtml, homeUrl)) stack.add(v); const cfg = extractBoardConfig(homeHtml, homeUrl); if (cfg) pull = cfg; }
  else notes.push(`home ${home.status}`);

  // Hop 1: careers candidates
  const found = homeHtml ? extractLinks(homeHtml, homeUrl, CAREERS_RE, 4) : [];
  const guesses = [`https://careers.${c.domain}/`, `https://jobs.${c.domain}/`, `https://${c.domain}/careers`, `https://${c.domain}/careers/`, `https://www.${c.domain}/careers`, `https://${c.domain}/jobs`];
  const candidates = [...found, ...guesses];
  let careersHtml: string | null = null;
  for (const u of candidates) {
    if (pull && (pull.vendor !== "workday" || pull.config.site)) break;
    if (fetches >= 7) break;
    const html = await visit(u);
    if (html && !careersHtml && (CAREERS_RE.test(u) || /career|job/i.test(html.slice(0, 4000)))) { careersHtml = html; careersUrl = u; }
  }
  // Hop 2: from careers page, follow a search/jobs link, then a job page
  if (careersHtml && careersUrl && !(pull && (pull.vendor !== "workday" || pull.config.site))) {
    const finalCareers = careersUrl;
    const searchLinks = extractLinks(careersHtml, finalCareers, SEARCH_RE, 3);
    for (const u of searchLinks) {
      if (pull && (pull.vendor !== "workday" || pull.config.site)) break;
      const html = await visit(u);
      if (html) {
        const jobLinks = extractLinks(html, u, JOBPAGE_RE, 1);
        if (jobLinks[0]) await visit(jobLinks[0]);
      }
    }
    // Sitemap trick (Phenom / Radancy sites expose job URLs in sitemap.xml)
    if (!(pull && (pull.vendor !== "workday" || pull.config.site)) && fetches < 9) {
      try {
        const origin = new URL(finalCareers).origin;
        const sm = await fetchText(`${origin}/sitemap.xml`, { timeoutMs: 10000 }); fetches++;
        if (sm.ok) {
          const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
          const jobLoc = locs.find((l) => JOBPAGE_RE.test(l)) || locs.find((l) => /job/i.test(l) && l !== finalCareers);
          if (jobLoc) {
            if (/sitemap.*\.xml$/i.test(jobLoc)) {
              const sm2 = await fetchText(jobLoc, { timeoutMs: 10000 }); fetches++;
              const l2 = [...(sm2.text || "").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).find((l) => JOBPAGE_RE.test(l));
              if (l2) await visit(l2);
            } else await visit(jobLoc);
          }
        }
      } catch { /* ignore */ }
    }
  }

  // Custom adapters for big custom sites
  if (CUSTOM_ADAPTERS[c.domain] && !(pull && (pull.vendor !== "workday" || pull.config.site))) {
    pull = { vendor: "custom", config: { adapter: CUSTOM_ADAPTERS[c.domain].key }, boardUrl: careersUrl || `https://${c.domain}/` };
    stack.add("custom");
  }
  // Phenom probe: try the widgets API on any careers-ish origin we touched
  if (!(pull && (pull.vendor !== "workday" || pull.config.site))) {
    const origins = new Set<string>();
    for (const u of [careersUrl, ...visited].filter(Boolean) as string[]) { try { const o = new URL(u.startsWith("http") ? u : "https://" + u).origin; if (o !== `https://${c.domain}` && o !== `https://www.${c.domain}`) origins.add(o); } catch { /* */ } }
    if (careersUrl) { try { origins.add(new URL(careersUrl).origin); } catch { /* */ } }
    for (const origin of [...origins].slice(0, 3)) {
      const r = await fetchJson<{ refineSearch?: { totalHits?: number; data?: { jobs?: { applyUrl?: string }[] } } }>(`${origin}/widgets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(phenomBody("", 0, 3)), timeoutMs: 15000 });
      const rs = r.data?.refineSearch;
      if (r.ok && rs && typeof rs.totalHits === "number") {
        stack.add("phenom");
        const apply = rs.data?.jobs?.map((j) => j.applyUrl || "").join("\n") || "";
        const under = extractBoardConfig(apply, "");
        if (under) { stack.add(under.vendor); }
        if (under && under.vendor === "workday" && under.config.site) pull = { ...under, config: { ...under.config, phenom_origin: origin } };
        else pull = { vendor: "phenom", config: { origin, total: String(rs.totalHits) }, boardUrl: `${origin}/us/en/search-results` };
        if (!careersUrl) careersUrl = origin + "/";
        notes.push(`phenom ok ${origin} hits=${rs.totalHits}`);
        break;
      }
    }
  }

  // Validate Workday site
  if (pull && pull.vendor === "workday" && pull.config.site) {
    const chk = await fetchText(`https://${pull.config.host}/${pull.config.site}`, { timeoutMs: 10000 });
    if (!chk.ok) { notes.push(`workday site check ${chk.status}`); pull = { ...pull, config: { ...pull.config, site: "" } }; }
  }

  // Decide vendors
  const stackArr = [...stack];
  let ats: string | null = pull?.vendor || null;
  if (!ats) ats = stackArr.find((k) => ATS_KEYS.has(k)) || stackArr.find((k) => HRIS_KEYS.has(k)) || null;
  const hris = stackArr.find((k) => HRIS_KEYS.has(k)) || null;
  const pullable = !!pull && (pull.vendor !== "workday" || !!pull.config.site);
  const status = pullable ? "pullable" : ats ? "detected" : careersUrl ? "careers_only" : homeHtml ? "none" : "unreachable";
  d.prepare(`UPDATE companies SET careers_url=?, ats_vendor=?, ats_board_url=?, ats_config=?, hris_vendor=?, stack_json=?, detect_status=?, detect_note=?, updated_at=datetime('now') WHERE id=?`)
    .run(careersUrl, ats, pull?.boardUrl || null, pullable ? JSON.stringify({ vendor: pull!.vendor, ...pull!.config }) : (pull ? JSON.stringify({ vendor: pull.vendor, ...pull.config, incomplete: true }) : null), hris, JSON.stringify(stackArr), status, notes.join("; ").slice(0, 500), c.id);
  return { status, ats, stack: stackArr, pull };
}

async function main() {
  const started = nowIso();
  const d = db();
  let rows = d.prepare("SELECT id,name,slug,domain FROM companies ORDER BY rank").all() as Company[];
  if (ONLY) rows = rows.filter((r) => r.slug === ONLY || r.slug.includes(ONLY));
  if (LIMIT) rows = rows.slice(0, LIMIT);
  const limit = pLimit(CONC);
  const counts: Record<string, number> = {};
  let done = 0;
  await Promise.all(rows.map((c) => limit(async () => {
    const r = await detect(c).catch((e) => ({ status: "error:" + String(e).slice(0, 60) }));
    counts[r.status] = (counts[r.status] || 0) + 1;
    done++;
    if (done % 25 === 0 || rows.length <= 30) console.log(`${done}/${rows.length} ${c.name} -> ${r.status} ${("ats" in r && r.ats) || ""} ${("stack" in r && r.stack ? r.stack.join(",") : "")}`);
  })));
  const note = JSON.stringify(counts);
  console.log("DONE", note);
  logRun("02-detect-ats", started, true, note);
}
main().catch((e) => { console.error(e); process.exit(1); });
