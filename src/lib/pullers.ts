/**
 * Board pullers. Each returns a normalized snapshot: total open roles, HR-relevant postings,
 * location facets, tool mentions. One-shot (v0): no history diffing yet.
 */
import { fetchJson } from "./http";
import { classifyTitle, parseLocation, HR_SEARCH_TERMS, type Bucket } from "./classify";
import { JD_TOOLS, WORKDAY_TOOL_SEARCHES, phenomBody } from "./vendors";

export interface Posting {
  external_id: string;
  title: string;
  location: string;
  url: string;
  posted_text?: string;
  posted_at?: string;
  bucket: Bucket | null;
  search_term?: string;
  description?: string;
}

export interface Snapshot {
  vendor: string;
  total: number | null;
  postings: Posting[];           // HR-relevant postings (bucket != null) + small sample of others
  states: Record<string, number>;
  countries: Record<string, number>;
  tools: Record<string, number>;
  facets: Record<string, { label: string; count: number }[]>;
  note: string;
}

type J = Record<string, unknown>;

const COUNTRY_MAP: Record<string, string> = {
  "united states of america": "US", "united states": "US", "usa": "US", "canada": "CA", "india": "IN", "united kingdom": "GB", "mexico": "MX", "germany": "DE", "ireland": "IE", "poland": "PL", "philippines": "PH", "singapore": "SG", "china": "CN", "japan": "JP", "australia": "AU", "brazil": "BR", "france": "FR", "netherlands": "NL", "spain": "ES", "costa rica": "CR", "israel": "IL", "italy": "IT", "switzerland": "CH", "belgium": "BE", "sweden": "SE", "argentina": "AR", "colombia": "CO", "chile": "CL", "malaysia": "MY", "thailand": "TH", "vietnam": "VN", "south korea": "KR", "korea, republic of": "KR", "taiwan": "TW", "hong kong": "HK", "united arab emirates": "AE", "saudi arabia": "SA", "south africa": "ZA", "new zealand": "NZ", "czech republic": "CZ", "czechia": "CZ", "hungary": "HU", "romania": "RO", "portugal": "PT", "austria": "AT", "denmark": "DK", "norway": "NO", "finland": "FI", "turkey": "TR", "egypt": "EG", "nigeria": "NG", "kenya": "KE", "indonesia": "ID", "pakistan": "PK", "puerto rico": "PR", "peru": "PE", "guatemala": "GT", "panama": "PA", "dominican republic": "DO",
};
function countryCode(desc: string): string {
  const k = desc.trim().toLowerCase();
  return COUNTRY_MAP[k] || (k.length === 2 ? k.toUpperCase() : desc.trim());
}

function toolsFromText(text: string, acc: Record<string, number>) {
  if (!text) return;
  const plain = text.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
  for (const t of JD_TOOLS) if (t.pattern.test(plain)) acc[t.key] = (acc[t.key] || 0) + 1;
}

function addLoc(loc: string, states: Record<string, number>, countries: Record<string, number>) {
  const p = parseLocation(loc);
  if (p.state) states[p.state] = (states[p.state] || 0) + 1;
  if (p.country) countries[p.country] = (countries[p.country] || 0) + 1;
}

function empty(vendor: string): Snapshot {
  return { vendor, total: null, postings: [], states: {}, countries: {}, tools: {}, facets: {}, note: "" };
}

/** Keep all HR-bucket postings; keep a small sample of other titles for the account page. */
function finalize(snap: Snapshot, all: Posting[], sampleOthers = 12): Snapshot {
  const seen = new Set<string>();
  const hr: Posting[] = [], others: Posting[] = [];
  for (const p of all) {
    const k = (p.external_id || p.url || p.title) + "|" + p.title;
    if (seen.has(k)) continue; seen.add(k);
    if (p.bucket) hr.push(p); else if (others.length < sampleOthers) others.push(p);
  }
  snap.postings = [...hr, ...others];
  return snap;
}

// ---------------- Workday ----------------
export async function pullWorkday(cfg: { tenant: string; wd: string; site: string; host: string }): Promise<Snapshot> {
  const snap = empty("workday");
  const url = `https://${cfg.host}/wday/cxs/${cfg.tenant}/${cfg.site}/jobs`;
  const post = (searchText: string, limit: number, offset: number) =>
    fetchJson<J>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appliedFacets: {}, limit, offset, searchText }), timeoutMs: 20000 });
  const base = await post("", 20, 0);
  if (!base.ok || !base.data) { snap.note = `baseline ${base.status}`; return snap; }
  snap.total = Number(base.data.total ?? 0);
  // Flatten nested facets (locationMainGroup contains facets as values)
  const rawFacets = (base.data.facets as J[]) || [];
  const facets: J[] = [];
  for (const f of rawFacets) {
    const vals = (f.values as J[]) || [];
    if (vals.length && vals[0].facetParameter) facets.push(...vals); else facets.push(f);
  }
  const hrFacet: { param: string; ids: string[]; labels: { label: string; count: number }[] } = { param: "", ids: [], labels: [] };
  for (const f of facets) {
    const key = String(f.facetParameter || "");
    const vals = ((f.values as J[]) || []).map((v) => ({ label: String(v.descriptor || ""), count: Number(v.count || 0), id: String(v.id || "") })).filter((v) => v.label);
    if (!vals.length) continue;
    if (/locationCountry|locationHierarchy1$/i.test(key)) {
      for (const v of vals) { const cc = countryCode(v.label); if (cc.length === 2) snap.countries[cc] = (snap.countries[cc] || 0) + v.count; }
    }
    if (/locationRegionStateProvince|locationState/i.test(key)) for (const v of vals) { const p = parseLocation(v.label); if (p.state) snap.states[p.state] = (snap.states[p.state] || 0) + v.count; }
    if (/jobFamilyGroup|jobFamily$|jobCategory|jobFunction/i.test(key) && !hrFacet.param) {
      const hr = vals.filter((v) => /human resources?|people|^hr\b|\bhr\b|talent|recruit/i.test(v.label) && !/sales|engineering|customer/i.test(v.label));
      if (hr.length) { hrFacet.param = key; hrFacet.ids = hr.map((v) => v.id).filter(Boolean); hrFacet.labels = hr.map((v) => ({ label: v.label, count: v.count })); }
    }
    if (/timeType|workerSubType|jobFamilyGroup|locationCountry|locationHierarchy1$|locationHierarchy2$|locationRegionStateProvince|locations$|jobFamily$|remoteType|jobCategory|jobFunction/i.test(key)) snap.facets[key] = vals.slice(0, 25).map((v) => ({ label: v.label, count: v.count }));
  }
  if (hrFacet.labels.length) snap.facets.hrFamily = hrFacet.labels;
  // Fallback: derive states / countries from the "locations" (Sites) facet
  if (snap.facets.locations) for (const v of snap.facets.locations) {
    const p = parseLocation(v.label);
    if (!Object.keys(snap.states).length || true) { if (p.state) snap.states[p.state] = (snap.states[p.state] || 0) + v.count; }
    if (!Object.keys(snap.countries).length) { const first = v.label.split(",")[0]; const cc = countryCode(first); if (cc.length === 2) snap.countries[cc] = (snap.countries[cc] || 0) + v.count; }
  }
  const all: Posting[] = [];
  const mk = (j: J, term: string): Posting => {
    const title = String(j.title || "");
    const bullet = (j.bulletFields as string[]) || [];
    return { external_id: bullet[0] || String(j.externalPath || ""), title, location: String(j.locationsText || ""), url: `https://${cfg.host}/${cfg.site}${String(j.externalPath || "")}`, posted_text: String(j.postedOn || ""), bucket: classifyTitle(title), search_term: term };
  };
  for (const j of (base.data.jobPostings as J[]) || []) all.push(mk(j, ""));
  // Precise pull: every job in the HR job family (up to 100)
  if (hrFacet.param && hrFacet.ids.length) {
    for (let offset = 0; offset < 100; offset += 20) {
      const r = await fetchJson<J>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appliedFacets: { [hrFacet.param]: hrFacet.ids }, limit: 20, offset, searchText: "" }), timeoutMs: 20000 });
      if (!r.ok || !r.data) break;
      const jobs = (r.data.jobPostings as J[]) || [];
      for (const j of jobs) { const p = mk(j, "facet:hr"); if (!p.bucket) p.bucket = "hr_generalist"; all.push(p); }
      if (jobs.length < 20) break;
    }
  }
  for (const term of HR_SEARCH_TERMS) {
    let offset = 0, pages = 0;
    while (pages < 3) {
      const r = await post(term, 20, offset);
      if (!r.ok || !r.data) break;
      const jobs = (r.data.jobPostings as J[]) || [];
      const ps = jobs.map((j) => mk(j, term));
      all.push(...ps);
      const hrHits = ps.filter((p) => p.bucket).length;
      pages++; offset += 20;
      if (jobs.length < 20 || hrHits < 8) break; // stop paging when HR density drops
    }
  }
  for (const t of WORKDAY_TOOL_SEARCHES) {
    const r = await post(t.term, 1, 0);
    if (r.ok && r.data) { const n = Number(r.data.total || 0); if (n > 0) snap.tools[t.key] = n; }
  }
  if (!Object.keys(snap.states).length) for (const p of all) addLoc(p.location, snap.states, {});
  return finalize(snap, all);
}

// ---------------- Greenhouse ----------------
export async function pullGreenhouse(cfg: { token: string }): Promise<Snapshot> {
  const snap = empty("greenhouse");
  const r = await fetchJson<J>(`https://boards-api.greenhouse.io/v1/boards/${cfg.token}/jobs?content=true`, { timeoutMs: 30000 });
  if (!r.ok || !r.data) { snap.note = `jobs ${r.status}`; return snap; }
  const jobs = (r.data.jobs as J[]) || [];
  snap.total = jobs.length;
  const all: Posting[] = [];
  for (const j of jobs) {
    const title = String(j.title || "");
    const loc = String(((j.location as J) || {}).name || "");
    addLoc(loc, snap.states, snap.countries);
    const content = String(j.content || "");
    toolsFromText(content.replace(/&lt;/g, "<").replace(/&gt;/g, ">"), snap.tools);
    all.push({ external_id: String(j.id || ""), title, location: loc, url: String(j.absolute_url || ""), posted_at: String(j.updated_at || "").slice(0, 10), bucket: classifyTitle(title) });
  }
  return finalize(snap, all);
}

// ---------------- Lever ----------------
export async function pullLever(cfg: { site: string }): Promise<Snapshot> {
  const snap = empty("lever");
  const r = await fetchJson<J[]>(`https://api.lever.co/v0/postings/${cfg.site}?mode=json`, { timeoutMs: 30000 });
  if (!r.ok || !r.data) { snap.note = `postings ${r.status}`; return snap; }
  snap.total = r.data.length;
  const all: Posting[] = [];
  for (const j of r.data) {
    const title = String(j.text || "");
    const cats = (j.categories as J) || {};
    const loc = String(cats.location || "") + (cats.allLocations ? ", " + (cats.allLocations as string[]).join(", ") : "");
    addLoc(String(cats.location || ""), snap.states, snap.countries);
    toolsFromText(String(j.descriptionPlain || "") + " " + JSON.stringify(j.lists || ""), snap.tools);
    all.push({ external_id: String(j.id || ""), title, location: loc, url: String(j.hostedUrl || ""), posted_at: j.createdAt ? new Date(Number(j.createdAt)).toISOString().slice(0, 10) : undefined, bucket: classifyTitle(title) });
  }
  return finalize(snap, all);
}

// ---------------- Ashby ----------------
export async function pullAshby(cfg: { name: string }): Promise<Snapshot> {
  const snap = empty("ashby");
  const r = await fetchJson<J>(`https://api.ashbyhq.com/posting-api/job-board/${cfg.name}?includeCompensation=true`, { timeoutMs: 30000 });
  if (!r.ok || !r.data) { snap.note = `board ${r.status}`; return snap; }
  const jobs = (r.data.jobs as J[]) || [];
  snap.total = jobs.length;
  const all: Posting[] = [];
  for (const j of jobs) {
    const title = String(j.title || "");
    const loc = String(j.location || "");
    addLoc(loc, snap.states, snap.countries);
    toolsFromText(String(j.descriptionHtml || j.descriptionPlain || ""), snap.tools);
    all.push({ external_id: String(j.id || ""), title, location: loc, url: String(j.jobUrl || ""), posted_at: String(j.publishedAt || "").slice(0, 10), bucket: classifyTitle(title) });
  }
  return finalize(snap, all);
}

// ---------------- SmartRecruiters ----------------
export async function pullSmartRecruiters(cfg: { company: string }): Promise<Snapshot> {
  const snap = empty("smartrecruiters");
  const all: Posting[] = [];
  let offset = 0, total = 0;
  for (let page = 0; page < 10; page++) {
    const r = await fetchJson<J>(`https://api.smartrecruiters.com/v1/companies/${cfg.company}/postings?limit=100&offset=${offset}`, { timeoutMs: 20000 });
    if (!r.ok || !r.data) { if (page === 0) snap.note = `postings ${r.status}`; break; }
    total = Number(r.data.totalFound || 0);
    const content = (r.data.content as J[]) || [];
    for (const j of content) {
      const title = String(j.name || "");
      const l = (j.location as J) || {};
      const loc = [l.city, l.region, l.country].filter(Boolean).join(", ");
      addLoc(loc, snap.states, snap.countries);
      all.push({ external_id: String(j.id || ""), title, location: loc, url: `https://jobs.smartrecruiters.com/${cfg.company}/${j.id}`, posted_at: String(j.releasedDate || "").slice(0, 10), bucket: classifyTitle(title) });
    }
    offset += 100;
    if (content.length < 100 || offset >= total) break;
  }
  snap.total = total;
  return finalize(snap, all);
}

// ---------------- Phenom ----------------
export async function pullPhenom(cfg: { origin: string }): Promise<Snapshot> {
  const snap = empty("phenom");
  const post = (keywords: string, from: number, size: number) =>
    fetchJson<J>(`${cfg.origin}/widgets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(phenomBody(keywords, from, size)), timeoutMs: 20000 });
  const base = await post("", 0, 20);
  const rs0 = (base.data?.refineSearch as J) || null;
  if (!base.ok || !rs0) { snap.note = `baseline ${base.status}`; return snap; }
  snap.total = Number(rs0.totalHits || 0);
  const data0 = (rs0.data as J) || {};
  // facets: data.facets? Phenom returns counts in "data" under fields like "country", "state", "category"
  for (const key of ["country", "state", "category"]) {
    const v = data0[key];
    if (Array.isArray(v)) {
      const vals = v.map((x: J) => { const [label, count] = Object.entries(x)[0] || ["", 0]; return { label: String(label), count: Number(count) }; }).filter((x) => x.label);
      if (vals.length) snap.facets[key] = vals.slice(0, 25);
      if (key === "country") for (const x of vals) snap.countries[countryCode(x.label)] = (snap.countries[countryCode(x.label)] || 0) + x.count;
      if (key === "state") for (const x of vals) { const p = parseLocation(x.label); if (p.state) snap.states[p.state] = (snap.states[p.state] || 0) + x.count; }
    }
  }
  const all: Posting[] = [];
  const mk = (j: J, term: string): Posting => {
    const title = String(j.title || "");
    return { external_id: String(j.jobId || j.reqId || ""), title, location: String(j.cityStateCountry || j.location || ""), url: String(j.applyUrl || `${cfg.origin}/us/en/job/${j.jobSeqNo || j.jobId}`), posted_at: String(j.postedDate || "").slice(0, 10), bucket: classifyTitle(title), search_term: term };
  };
  for (const j of ((data0.jobs as J[]) || [])) all.push(mk(j, ""));
  for (const term of HR_SEARCH_TERMS) {
    let from = 0, pages = 0;
    while (pages < 3) {
      const r = await post(term, from, 20);
      const rs = (r.data?.refineSearch as J) || null;
      if (!r.ok || !rs) break;
      const jobs = (((rs.data as J) || {}).jobs as J[]) || [];
      const ps = jobs.map((j) => mk(j, term));
      all.push(...ps);
      pages++; from += 20;
      if (jobs.length < 20 || ps.filter((p) => p.bucket).length < 8) break;
    }
  }
  for (const t of WORKDAY_TOOL_SEARCHES) {
    const r = await post(t.term, 0, 1);
    const rs = (r.data?.refineSearch as J) || null;
    if (rs) { const n = Number(rs.totalHits || 0); if (n > 0) snap.tools[t.key] = n; }
  }
  if (!Object.keys(snap.states).length) for (const p of all) addLoc(p.location, snap.states, snap.countries);
  return finalize(snap, all);
}

// ---------------- Amazon (custom) ----------------
export async function pullAmazon(): Promise<Snapshot> {
  const snap = empty("custom");
  const get = (q: string, limit: number, offset = 0) => fetchJson<J>(`https://www.amazon.jobs/en/search.json?base_query=${encodeURIComponent(q)}&loc_query=&result_limit=${limit}&offset=${offset}&sort=recent`, { timeoutMs: 20000 });
  const base = await get("", 20);
  if (!base.ok || !base.data) { snap.note = `baseline ${base.status}`; return snap; }
  snap.total = Number(base.data.hits || 0);
  const all: Posting[] = [];
  const mk = (j: J, term: string): Posting => {
    const title = String(j.title || "");
    const loc = String(j.location || j.normalized_location || "");
    addLoc(loc, snap.states, snap.countries);
    return { external_id: String(j.id_icims || j.id || ""), title, location: loc, url: "https://www.amazon.jobs" + String(j.job_path || ""), posted_at: String(j.posted_date || ""), bucket: classifyTitle(title), search_term: term };
  };
  for (const j of ((base.data.jobs as J[]) || [])) all.push(mk(j, ""));
  for (const term of HR_SEARCH_TERMS) {
    let offset = 0, pages = 0;
    while (pages < 3) {
      const r = await get(term, 20, offset);
      if (!r.ok || !r.data) break;
      const jobs = (r.data.jobs as J[]) || [];
      const ps = jobs.map((j) => mk(j, term));
      all.push(...ps);
      pages++; offset += 20;
      if (jobs.length < 20 || ps.filter((p) => p.bucket).length < 8) break;
    }
  }
  for (const t of WORKDAY_TOOL_SEARCHES) {
    const r = await get(t.term, 1);
    if (r.ok && r.data) { const n = Number(r.data.hits || 0); if (n > 0) snap.tools[t.key] = n; }
  }
  return finalize(snap, all);
}

export async function pullBoard(cfg: Record<string, string>): Promise<Snapshot> {
  switch (cfg.vendor) {
    case "workday": return pullWorkday(cfg as { tenant: string; wd: string; site: string; host: string });
    case "greenhouse": return pullGreenhouse(cfg as { token: string });
    case "lever": return pullLever(cfg as { site: string });
    case "ashby": return pullAshby(cfg as { name: string });
    case "smartrecruiters": return pullSmartRecruiters(cfg as { company: string });
    case "phenom": return pullPhenom(cfg as { origin: string });
    case "custom": if (cfg.adapter === "amazon") return pullAmazon(); return { ...empty("custom"), note: "unknown adapter" };
    default: return { ...empty(cfg.vendor || "?"), note: "no puller" };
  }
}
