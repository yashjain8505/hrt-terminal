/**
 * Situation engine. A situation names what a company is doing (in HR terms), proves it with dated
 * facts, carries a window, and says who to talk to. Pure logic: runs in Node (pipeline) and in the
 * browser (artifacts). v1 rules run on a single snapshot; diff-based rules land with run #2.
 */
import type { Profile, Family } from "./profiles";
import { buyerTitles, incumbentAngle, parsePostedText } from "./playbook";
import { execDomain, stateName } from "./classify";
import { COUNTRY_NAMES } from "./geo";

export type SituationKey = "new_leader" | "systems_project" | "recruiting_build" | "consolidation" | "cost_cutting" | "expansion" | "funded" | "hr_forming" | "threshold" | "hourly_surge";

export interface SituationMeta {
  key: SituationKey;
  name: string;
  short: string;
  windowDays: number;
  priority: 1 | 2 | 3;
  buyers: string[];
  means: Record<Family, string>;
  active: boolean; // false = needs data we do not have yet (diffs, mid-market, feeds)
  needs?: string;
}

export const SITUATIONS: SituationMeta[] = [
  { key: "new_leader", name: "New HR leader arriving or just arrived", short: "New HR leader", windowDays: 45, priority: 1, active: true,
    buyers: ["CHRO", "VP People", "Head of HR Operations"],
    means: { ta: "A new leader reviews the recruiting stack in their first quarter. Get in before the seat is filled, then again in week one.", corehr: "New people leaders inherit the HRIS and payroll decisions and usually reopen them. Be the option on the table on day one.", programs: "New leaders launch programmes to make their mark: engagement, performance, learning. Position as the first-90-days win.", global: "A new leader will look at how the company pays and hires abroad. Bring the country map." } },
  { key: "systems_project", name: "HR systems project underway", short: "Systems project", windowDays: 120, priority: 1, active: true,
    buyers: ["Head of HR Technology", "HRIS Lead", "VP HR Operations"],
    means: { ta: "Integrations and adjacent tools get approved while the core project is live. Sell the plug-in, not the rip-out.", corehr: "The narrow window where a core HR or payroll vendor gets evaluated. If they are implementing a competitor, sell around it: tax, time, absence, global.", programs: "Program platforms get bought once the core system settles. Ask when go-live is and book the quarter after.", global: "Multi-country payroll is decided during core-HR projects. Ask which countries are in scope." } },
  { key: "recruiting_build", name: "Building or scaling the recruiting team", short: "Recruiting build", windowDays: 60, priority: 1, active: true,
    buyers: ["Head of Talent Acquisition", "VP Talent Acquisition", "Recruiting Operations Lead"],
    means: { ta: "A growing recruiting team is a team feeling throughput pain. Pitch hires per recruiter, not features.", corehr: "Recruiting growth precedes headcount growth, which strains onboarding, HR ops and payroll next.", programs: "More hires means more onboarding and ramp. Sell the first-90-days experience.", global: "Ask where the new recruiters will hire. New countries follow." } },
  { key: "consolidation", name: "Consolidating after an acquisition", short: "Post-acquisition", windowDays: 120, priority: 1, active: true,
    buyers: ["VP HR Operations", "CHRO", "Head of HR M&A / Integration"],
    means: { ta: "Two career sites and two ATSs become one. The integration lead decides which survives.", corehr: "Two HRIS and two payrolls become one. The consolidation choice is being made now.", programs: "Culture and performance programmes get rebuilt across the combined company.", global: "Acquired entities bring new countries and payroll providers to consolidate." } },
  { key: "cost_cutting", name: "Cutting costs after layoffs or restructuring", short: "Cost cutting", windowDays: 60, priority: 2, active: true,
    buyers: ["CHRO", "VP HR Operations", "Head of Employee Relations"],
    means: { ta: "Not a growth pitch. Lead with cost per hire, vendor consolidation and doing more with fewer recruiters.", corehr: "Lead with consolidation and cost: fewer vendors, fewer manual processes, offboarding done cleanly.", programs: "Retention and engagement of the people who stay. Pitch the survivor problem.", global: "Consolidating providers across countries is the cost story." } },
  { key: "expansion", name: "Expanding to new countries, states or cities", short: "Expansion", windowDays: 90, priority: 2, active: true,
    buyers: ["VP People Operations", "Head of Global Payroll", "General Counsel (employment)"],
    means: { ta: "New locations mean new hiring channels and local recruiting.", corehr: "New states and countries mean new payroll, tax and compliance.", programs: "New sites need onboarding and manager enablement.", global: "First hires in a new country are the whole EOR and global payroll conversation." } },
  { key: "funded", name: "Just funded, IPO or fast growth", short: "Funded / growth", windowDays: 120, priority: 2, active: false, needs: "Form D / S-1 / news feeds",
    buyers: ["VP People", "Head of HR", "COO"],
    means: { ta: "Budget arrived and a hiring plan follows.", corehr: "Growth outgrows the first HR stack.", programs: "Scaling culture is on the board agenda after a raise.", global: "Funded companies open new countries fast." } },
  { key: "hr_forming", name: "HR function forming", short: "HR forming", windowDays: 90, priority: 3, active: false, needs: "mid-market universe",
    buyers: ["Founder / COO", "First HR hire"], means: { ta: "First recruiter hire.", corehr: "First HRIS and payroll decision.", programs: "First performance cycle.", global: "First international hire." } },
  { key: "threshold", name: "Compliance threshold crossed", short: "Threshold", windowDays: 180, priority: 3, active: false, needs: "headcount estimates",
    buyers: ["Head of HR", "Controller"], means: { ta: "", corehr: "50 / 100 / 500 employees change benefits, ACA and reporting obligations.", programs: "", global: "" } },
  { key: "hourly_surge", name: "Hourly or seasonal hiring surge", short: "Hourly surge", windowDays: 45, priority: 3, active: false, needs: "second snapshot (posting mix diff)",
    buyers: ["VP Operations", "Head of Workforce Management"], means: { ta: "High-volume hiring: screening and scheduling.", corehr: "Time, scheduling and payroll strain.", programs: "Frontline onboarding.", global: "" } },
];
export const SITUATION_BY_KEY: Record<string, SituationMeta> = Object.fromEntries(SITUATIONS.map((s) => [s.key, s]));

export interface Fact { date: string | null; text: string; url: string | null; kind: "role" | "filing" | "warn" | "jd" | "stack" | "list" }
export interface Situation {
  key: SituationKey;
  headline: string;
  openedAt: string | null;      // most recent dated trigger
  windowEnds: string | null;
  confidence: "high" | "medium" | "low";
  facts: Fact[];
  buyers: string[];
  system?: string | null;        // vendor named in the project, if any
}

export interface JobIn { title: string; location?: string | null; url?: string | null; bucket: string | null; posted_text?: string | null; posted_at?: string | null; date?: string | null; approx?: number | boolean }
export interface SignalIn { type: string; observed_at: string; title: string; source_url: string | null; payload_json: string | null }
export interface CompanyIn { name: string; ats_vendor?: string | null; hris_vendor?: string | null; employees?: number | null }
export interface SnapshotIn { tools?: Record<string, number>; countries?: Record<string, number> }

const SYSTEMS = [["workday", /workday/i], ["successfactors", /successfactors|sap hcm|sap hr/i], ["oraclehcm", /oracle (hcm|fusion|cloud hcm)|peoplesoft/i], ["adp", /\badp\b/i], ["ukg", /\bukg\b|kronos|ultipro/i], ["paylocity", /paylocity/i], ["paycom", /paycom/i], ["dayforce", /dayforce|ceridian/i], ["rippling", /rippling/i], ["gusto", /gusto/i], ["bamboohr", /bamboohr/i], ["greenhouse", /greenhouse/i], ["icims", /icims/i], ["lever", /\blever\b/i], ["ashby", /\bashby\b/i], ["servicenow", /servicenow/i]] as const;
const SYSTEM_NAME: Record<string, string> = { taleo: "Taleo", phenom: "Phenom", cornerstone: "Cornerstone", visier: "Visier", servicenow_hr: "ServiceNow HR", eightfold: "Eightfold", workday: "Workday", successfactors: "SuccessFactors", oraclehcm: "Oracle HCM", adp: "ADP", ukg: "UKG", paylocity: "Paylocity", paycom: "Paycom", dayforce: "Dayforce", rippling: "Rippling", gusto: "Gusto", bamboohr: "BambooHR", greenhouse: "Greenhouse", icims: "iCIMS", lever: "Lever", ashby: "Ashby", servicenow: "ServiceNow" };

function jobDate(j: JobIn, asOf: Date): { date: string | null; approx: boolean } {
  if (j.date !== undefined) return j.approx ? { date: null, approx: true } : { date: j.date || null, approx: false };
  if (j.posted_at && /^\d{4}-\d{2}-\d{2}/.test(j.posted_at)) return { date: j.posted_at.slice(0, 10), approx: false };
  const approx = /\d+\+/.test(j.posted_text || "");
  return { date: approx ? null : parsePostedText(j.posted_text || null, asOf), approx };
}
/** "USA - Minnesota - Saint Paul" -> "Saint Paul, Minnesota"; "7 Locations" stays; strips Workday site codes. */
export function shortLoc(loc: string | null | undefined): string {
  if (!loc) return "";
  if (/^\d+ locations?$/i.test(loc.trim())) return loc.trim().toLowerCase();
  const parts = loc.split(/\s[-–]\s|,\s*/).map((x) => x.replace(/\([^)]*\)/g, "").replace(/\b(default|wkl|remote)\b/gi, "").trim()).filter((x) => x && !/\d/.test(x) && !/^(usa?|united states of america|united states|no city|all cities|any city|default|multiple)$/i.test(x));
  if (!parts.length) return "";
  const countryFirst = /\s[-–]\s/.test(loc);
  const last2 = parts.slice(-2);
  return (countryFirst ? last2.reverse() : last2).join(", ");
}
const addDays = (d: string, n: number) => new Date(new Date(d).getTime() + n * 864e5).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 864e5);

function roleFact(j: JobIn, d: { date: string | null; approx: boolean }): Fact {
  const loc = shortLoc(j.location);
  return { date: d.date, text: `Posted ${j.title}${loc ? " · " + loc : ""}${d.approx ? " · more than 30 days ago" : ""}`, url: j.url || null, kind: "role" };
}
function newest(facts: Fact[]): string | null { return facts.reduce<string | null>((m, f) => (f.date && (!m || f.date > m) ? f.date : m), null); }
function conf(facts: Fact[], asOf: string, windowDays: number): "high" | "medium" | "low" {
  const dated = facts.filter((f) => f.date && daysBetween(f.date, asOf) <= windowDays);
  return dated.length >= 2 ? "high" : dated.length === 1 ? "medium" : "low";
}
function fn(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
const DOMAIN_WORD: Record<string, string> = { ta: "recruiting", payroll: "payroll", benefits: "benefits", comp: "compensation", learning: "learning and development", hris: "HR technology", wfm: "workforce management", dei: "culture", hr: "HR" };

/**
 * Detect situations for one company. asOf = snapshot date (YYYY-MM-DD).
 */
export function detectSituations(co: CompanyIn, jobs: JobIn[], signals: SignalIn[], snap: SnapshotIn | null, asOf: string): Situation[] {
  const asOfDate = new Date(asOf);
  const out: Situation[] = [];
  const jd = jobs.map((j) => ({ j, d: jobDate(j, asOfDate) }));
  const inWindow = (date: string | null, days: number) => !!date && daysBetween(date, asOf) <= days && daysBetween(date, asOf) >= -1;

  const isMA = (t: string) => /\b(m&a|mergers?|integration)\b/i.test(t) && !/talent acquisition/i.test(t) && /\b(hr|people|payroll|hris|human resources)\b/i.test(t) || /\bacquisitions?\b/i.test(t) && !/talent acquisition/i.test(t) && /\b(hr|people|payroll|hris|human resources)\b/i.test(t);
  const maTitles = new Set(jd.filter((x) => x.j.bucket && isMA(x.j.title)).map((x) => x.j.title));
  // 0. New HR leader CONFIRMED: appointment in the news, or an exec posting that came off the board
  {
    const meta = SITUATION_BY_KEY.new_leader;
    const appts = signals.filter((s) => s.type === "exec.hr_appointment" && inWindow(s.observed_at.slice(0, 10), 90));
    const filledExec = signals.filter((s) => s.type === "hiring.role_filled" && inWindow(s.observed_at.slice(0, 10), 90)).filter((s) => { const p = s.payload_json ? JSON.parse(s.payload_json) : {}; return p.bucket === "people_exec"; });
    if (appts.length || filledExec.length) {
      const facts: Fact[] = [
        ...appts.map((s) => { const p = s.payload_json ? JSON.parse(s.payload_json) : {}; return { date: s.observed_at.slice(0, 10), text: `${p.person ? p.person + " " : ""}${p.role ? "named " + String(p.role).replace(/^\w/, (c) => c.toUpperCase()) : "HR leadership appointment"} · ${s.title}`, url: s.source_url, kind: "filing" as const }; }),
        ...filledExec.map((s) => { const p = s.payload_json ? JSON.parse(s.payload_json) : {}; return { date: s.observed_at.slice(0, 10), text: `"${p.title}" posting came off the board (hired or withdrawn)`, url: s.source_url, kind: "role" as const }; }),
      ].slice(0, 4);
      const lead = appts[0] ? (appts[0].payload_json ? JSON.parse(appts[0].payload_json) : {}) : null;
      const dom = lead && lead.role ? (DOMAIN_WORD[execDomain(String(lead.role))] || "HR") : filledExec[0] ? (DOMAIN_WORD[execDomain(String(JSON.parse(filledExec[0].payload_json || "{}").title || ""))] || "HR") : "HR";
      const headline = lead ? `${co.name} just got a new ${dom} leader${lead.person ? ": " + lead.person : ""}` : `${co.name} appears to have just hired a ${dom} leader`;
      const openedAt = newest(facts);
      out.push({ key: "new_leader", headline, openedAt, windowEnds: openedAt ? addDays(openedAt, 90) : null, confidence: appts.some((a) => (a.payload_json ? JSON.parse(a.payload_json).confidence : "") === "high") || facts.length >= 2 ? "high" : "medium", facts, buyers: meta.buyers });
    }
  }
  // 1. New HR leader ARRIVING: VP+ / Head of / Chief roles posted (dated). Directors only count when two are dated.
  if (!out.some((s) => s.key === "new_leader")) {
    const meta = SITUATION_BY_KEY.new_leader;
    const roles = jd.filter((x) => (x.j.bucket === "people_exec" || x.j.bucket === "hr_leader") && !maTitles.has(x.j.title)).filter((x) => x.d.date ? inWindow(x.d.date, meta.windowDays) : true);
    const datedExec = roles.filter((x) => x.j.bucket === "people_exec" && x.d.date).sort((a, b) => (b.d.date! < a.d.date! ? -1 : 1));
    const datedDir = roles.filter((x) => x.j.bucket === "hr_leader" && x.d.date).sort((a, b) => (b.d.date! < a.d.date! ? -1 : 1));
    const undated = roles.filter((x) => !x.d.date);
    if (datedExec.length || datedDir.length >= 2) {
      const lead = (datedExec[0] || datedDir[0]).j;
      const ordered = [...datedExec, ...datedDir, ...undated].slice(0, 4);
      const facts = ordered.map((x) => roleFact(x.j, x.d));
      const dom = DOMAIN_WORD[execDomain(lead.title)] || "HR";
      const headline = datedExec.length ? `${co.name} is about to get a new ${dom} leader` : `${co.name} is adding ${dom} leadership`;
      const openedAt = newest(facts);
      out.push({ key: "new_leader", headline, openedAt, windowEnds: openedAt ? addDays(openedAt, meta.windowDays) : null, confidence: conf(facts, asOf, meta.windowDays), facts, buyers: meta.buyers });
    }
  }
  // 2. HR systems project
  {
    const meta = SITUATION_BY_KEY.systems_project;
    const sysRoles = jd.filter((x) => x.j.bucket === "hris" || (x.j.bucket === "payroll" && SYSTEMS.some(([, re]) => re.test(x.j.title))) || /\b(implementation|migration|go-live|rollout|roll-out|integration)\b/i.test(x.j.title) && /\b(hr|hris|hcm|payroll|people|workday|successfactors)\b/i.test(x.j.title));
    const recent = sysRoles.filter((x) => x.d.date ? inWindow(x.d.date, meta.windowDays) : true);
    if (recent.some((x) => x.d.date)) {
      const named: Record<string, number> = {};
      for (const x of recent.filter((x) => x.d.date)) for (const [k, re] of SYSTEMS) if (re.test(x.j.title)) named[k] = (named[k] || 0) + 1;
      const system = Object.entries(named).sort((a, b) => b[1] - a[1]).map(([k]) => k).find((k) => !co.name.toLowerCase().includes(SYSTEM_NAME[k].toLowerCase())) || null;
      const payrollNamed = recent.filter((x) => x.d.date && x.j.bucket === "payroll" && system && SYSTEMS.find(([k]) => k === system)![1].test(x.j.title)).length;
      const facts = recent.sort((a, b) => (b.d.date || "") < (a.d.date || "") ? -1 : 1).slice(0, 4).map((x) => roleFact(x.j, x.d));
      const tools = snap?.tools || {};
      const legacy = Object.entries(tools).filter(([k, n]) => n > 0 && k !== system && k !== "servicenow_hr" && k !== "linkedin_recruiter" && k !== "indeed").sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (legacy.length) facts.push({ date: null, text: `Job posts still name ${legacy.map(([k, n]) => `${SYSTEM_NAME[k] || k} (${n})`).join(", ")}, so the old system is still running`, url: null, kind: "jd" });
      const headline = system && payrollNamed ? `${co.name} is moving payroll onto ${SYSTEM_NAME[system]}` : system ? `${co.name} is working on ${SYSTEM_NAME[system]}` : `${co.name} has an HR systems project underway`;
      const openedAt = newest(facts);
      out.push({ key: "systems_project", headline, openedAt, windowEnds: openedAt ? addDays(openedAt, meta.windowDays) : null, confidence: conf(facts, asOf, meta.windowDays), facts, buyers: meta.buyers, system: system ? SYSTEM_NAME[system] : null });
    }
  }
  // 3. Recruiting build
  {
    const meta = SITUATION_BY_KEY.recruiting_build;
    const rec = jd.filter((x) => x.j.bucket === "recruiting").filter((x) => x.d.date ? inWindow(x.d.date, meta.windowDays) : true);
    const ops = rec.filter((x) => /\b(operations|ops|technology|systems|analytics|enablement|programs?)\b/i.test(x.j.title));
    const dated = rec.filter((x) => x.d.date);
    if (dated.length >= 2 || (ops.some((x) => x.d.date) && rec.length >= 2)) {
      const facts = rec.sort((a, b) => (b.d.date || "") < (a.d.date || "") ? -1 : 1).slice(0, 4).map((x) => roleFact(x.j, x.d));
      if (rec.length > 4) facts.push({ date: null, text: `${rec.length} recruiting roles open in total`, url: null, kind: "role" });
      const headline = ops.length ? `${co.name} is building recruiting operations` : `${co.name} is building its recruiting team`;
      const openedAt = newest(facts);
      out.push({ key: "recruiting_build", headline, openedAt, windowEnds: openedAt ? addDays(openedAt, meta.windowDays) : null, confidence: conf(facts, asOf, meta.windowDays), facts, buyers: meta.buyers });
    }
  }
  // 4. Consolidation after acquisition
  {
    const meta = SITUATION_BY_KEY.consolidation;
    const done = (t: string) => /\b(acquires|acquired|completes|completed|closes|closed|buys|bought|finalizes|wraps up)\b/i.test(t) && !/\b(to acquire|considers|considering|proposed|in talks|plans to|agrees to|seeks|explores|exploring|could|may|might|reportedly)\b/i.test(t);
    const acq = signals.filter((s) => (s.type === "corp.acquisition" || (s.type === "news.acquisition" && done(s.title))) && inWindow(s.observed_at.slice(0, 10), meta.windowDays));
    const maRoles = jd.filter((x) => maTitles.has(x.j.title));
    if (acq.length || maRoles.length) {
      const facts: Fact[] = [...acq.map((s) => ({ date: s.observed_at.slice(0, 10), text: s.type === "corp.acquisition" ? "Completed an acquisition or disposition (8-K item 2.01)" : `In the news: ${s.title}`, url: s.source_url, kind: "filing" as const })), ...maRoles.map((x) => roleFact(x.j, x.d))].slice(0, 4);
      const openedAt = newest(facts);
      out.push({ key: "consolidation", headline: `${co.name} is consolidating after an acquisition`, openedAt, windowEnds: openedAt ? addDays(openedAt, meta.windowDays) : null, confidence: conf(facts, asOf, meta.windowDays), facts, buyers: meta.buyers });
    }
  }
  // 5. Cost cutting after layoffs / restructuring
  {
    const meta = SITUATION_BY_KEY.cost_cutting;
    const risk = signals.filter((s) => (s.type.startsWith("risk.") || s.type === "news.layoffs") && inWindow(s.observed_at.slice(0, 10), meta.windowDays + 30)).filter((s) => { if (s.type !== "risk.warn_notice") return true; const p = s.payload_json ? JSON.parse(s.payload_json) : {}; return Number(p.employees || 0) >= 50; });
    if (risk.length) {
      const facts: Fact[] = risk.map((s) => { const p = s.payload_json ? JSON.parse(s.payload_json) : {}; return { date: s.observed_at.slice(0, 10), text: s.type === "risk.warn_notice" ? `Filed a layoff notice in ${p.state} covering ${p.employees} people` : s.type === "news.layoffs" ? `In the news: ${s.title}` : "Disclosed restructuring and exit costs (8-K item 2.05)", url: s.source_url, kind: s.type === "risk.warn_notice" ? "warn" as const : "filing" as const }; }).slice(0, 4);
      const hrOps = jd.filter((x) => x.j.bucket === "hr_generalist" && /\b(employee relations|offboarding|shared services|operations)\b/i.test(x.j.title)).slice(0, 2);
      for (const x of hrOps) facts.push(roleFact(x.j, x.d));
      const openedAt = newest(facts);
      out.push({ key: "cost_cutting", headline: `${co.name} is cutting costs after ${risk.some((s) => s.type === "risk.warn_notice") ? "layoffs" : "a restructuring"}`, openedAt, windowEnds: openedAt ? addDays(openedAt, meta.windowDays) : null, confidence: conf(facts, asOf, meta.windowDays), facts, buyers: meta.buyers });
    }
  }
  // 6. Expansion: first postings in a new country or state (from snapshot diffs)
  {
    const meta = SITUATION_BY_KEY.expansion;
    const locs = signals.filter((s) => s.type === "hiring.new_location" && inWindow(s.observed_at.slice(0, 10), meta.windowDays));
    if (locs.length) {
      const facts: Fact[] = locs.map((s) => ({ date: s.observed_at.slice(0, 10), text: s.title, url: s.source_url, kind: "role" as const }));
      const p = locs[0].payload_json ? JSON.parse(locs[0].payload_json) : {};
      const where = [...(p.countries || []).map((c: string) => COUNTRY_NAMES[c] || c), ...(p.states || []).map((c: string) => stateName(c))].slice(0, 3).join(", ");
      const openedAt = newest(facts);
      out.push({ key: "expansion", headline: `${co.name} started hiring in ${where}`, openedAt, windowEnds: openedAt ? addDays(openedAt, meta.windowDays) : null, confidence: (p.countries || []).length ? "high" : "medium", facts, buyers: meta.buyers });
    }
  }
  // Order: priority, then confidence, then recency
  const rank = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) => SITUATION_BY_KEY[a.key].priority - SITUATION_BY_KEY[b.key].priority || rank[a.confidence] - rank[b.confidence] || ((b.openedAt || "") < (a.openedAt || "") ? -1 : 1));
  return out;
}

/** Plain-English story for a situation, written for the reader's offer. */
export function situationStory(sit: Situation, co: CompanyIn, profile: Profile): { means: string; who: string[]; angle: string | null; firstLine: string; window: string } {
  const meta = SITUATION_BY_KEY[sit.key];
  const means = meta.means[profile.family] || "";
  const who = [...meta.buyers, ...buyerTitles(profile).filter((b) => !meta.buyers.includes(b))].slice(0, 4);
  const angle = incumbentAngle(co.ats_vendor || co.hris_vendor || null, profile);
  const first = sit.facts.find((f) => f.date) || sit.facts[0];
  const window = sit.windowEnds ? `Window open until ${sit.windowEnds}` : "Window unknown (undated facts)";
  const sells = profile.sells.split(",")[0].trim();
  let firstLine: string;
  switch (sit.key) {
    case "new_leader": { const dom = first ? (DOMAIN_WORD[execDomain(factTitle(first))] || "HR") : "HR"; firstLine = `Hi {{first_name}}, saw ${co.name} is hiring a ${first ? factTitle(first) : "new HR leader"}. New ${dom} leaders usually review their tools in the first quarter, and ${sells} tends to be on that list. Happy to share what peers changed first, before the seat is filled.`; break; }
    case "systems_project": firstLine = sit.system ? `Hi {{first_name}}, noticed ${co.name} is hiring for ${sit.system} work (${first ? factTitle(first) : "HR systems roles"}). While that project is live, ${sells} decisions get made alongside it. Worth 15 minutes to see where we fit?` : `Hi {{first_name}}, noticed ${co.name} is hiring for HR systems work. That is usually when ${sells} gets evaluated. Worth 15 minutes?`; break;
    case "recruiting_build": firstLine = `Hi {{first_name}}, ${co.name} has ${sit.facts.length >= 4 ? "several" : sit.facts.length} recruiting roles open, including a ${first ? factTitle(first) : "recruiter"}. Growing teams usually hit throughput limits first. We help with ${sells}. Open to a short call?`; break;
    case "consolidation": firstLine = `Hi {{first_name}}, congratulations on the acquisition. Bringing two workforces together usually forces a decision on ${sells}. Worth a conversation before the integration plan is locked?`; break;
    case "cost_cutting": firstLine = `Hi {{first_name}}, read about the changes at ${co.name}. Not a growth pitch: we help teams do more with fewer vendors and fewer people (${sells}). If consolidation is on the table, happy to help scope it.`; break;
    default: firstLine = `Hi {{first_name}}, quick note on ${co.name}. We help with ${sells}. Worth a conversation?`;
  }
  return { means, who, angle, firstLine, window };
}

export function fnCap(s: string): string { return fn(s); }
function factTitle(f: Fact): string { return f.text.replace(/^Posted /, "").split(" · ")[0]; }
