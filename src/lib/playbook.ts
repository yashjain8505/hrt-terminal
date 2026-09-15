/**
 * Sales playbook layer: turns facts into who / what to say / against whom.
 * Deterministic and editable. Every string here is a starting point for a rep, not a script.
 */
import type { Profile, Family } from "./profiles";

/** Titles a rep should look for at the account, by offer profile. Order = priority. */
export const BUYER_TITLES: Record<string, string[]> = {
  ats: ["VP Talent Acquisition", "Head of Talent Acquisition", "Director, Talent Acquisition", "Director, Recruiting Operations", "HR Technology Lead", "CHRO"],
  sourcing: ["Head of Sourcing", "Director, Talent Acquisition", "Recruiting Manager", "Talent Acquisition Operations", "VP Talent Acquisition"],
  assessment: ["Director, Talent Acquisition", "Head of Assessment / Selection", "Recruiting Operations Manager", "I-O Psychologist / Talent Science", "VP Talent"],
  screening: ["Director, HR Operations", "Head of Onboarding", "Talent Acquisition Operations Lead", "Compliance / Employment Practices", "HR Shared Services Lead"],
  hris: ["CHRO", "VP People Operations", "Head of HR Technology / HRIS", "Director, HR Shared Services", "CIO / VP Enterprise Applications", "VP Total Rewards"],
  payroll: ["Director, Payroll", "VP Global Payroll", "Head of HR Shared Services", "Controller / VP Finance Operations", "HRIS Lead"],
  benefits: ["VP Total Rewards", "Director, Benefits", "Benefits Manager", "CHRO", "CFO (self-funded plans)"],
  compliance: ["VP Employee Relations", "Director, HR Compliance", "Employment Counsel", "Head of HR Operations", "CHRO"],
  performance: ["VP Talent Management", "Head of Learning & Development", "Director, Organizational Development", "Chief Learning Officer", "VP People"],
  compensation: ["VP Total Rewards", "Director, Compensation", "Head of Executive Compensation", "People Analytics Lead", "CHRO"],
  wfm: ["VP Operations", "Director, Workforce Management", "Head of Store / Plant Operations", "Director, Labor Planning", "HRIS Lead"],
  global: ["VP Global Mobility", "Head of Global Payroll", "Director, International HR", "Immigration Program Manager", "General Counsel (employment)"],
};

/** Displacement / integration angle against an incumbent vendor, by offer family. */
export const INCUMBENT_ANGLES: Record<string, Partial<Record<Family, string>> & { any?: string }> = {
  workday: {
    ta: "Workday Recruiting is the module most often supplemented: candidate experience, sourcing/CRM, scheduling and screening are where point tools win. Look for Phenom, Paradox, Eightfold or HireVue already bolted on: that is proof they buy around Workday.",
    corehr: "Workday is the system of record and rarely rips out. Sell as a certified integration, or on modules Workday does poorly for this account (global payroll, benefits admin for hourly populations, learning).",
    programs: "Workday Talent/Learning are checkbox modules; engagement, performance and learning platforms displace them regularly. Lead with adoption and manager experience, and a Workday integration.",
    global: "Workday has no native EOR and thin global payroll (partners only). Multi-country hiring means a payroll aggregator or EOR conversation is open.",
  },
  successfactors: {
    ta: "SuccessFactors Recruiting is dated and frequently supplemented (Phenom, Eightfold, Paradox). Candidate experience and recruiter productivity are the wedge.",
    corehr: "SAP shops are consolidating onto SuccessFactors Employee Central or migrating off. Ask where they are in the roadmap; migrations open every adjacent decision.",
    programs: "SuccessFactors Learning / Performance are the most-replaced modules in the suite. Lead with usability and analytics.",
    global: "SAP has payroll depth in some countries and partners elsewhere. Map their countries against SAP coverage.",
  },
  oraclehcm: {
    ta: "Oracle Recruiting Cloud is young; many accounts moved from Taleo and kept point tools. Candidate CRM, scheduling and assessments are open.",
    corehr: "Oracle HCM Cloud accounts are usually mid-migration from PeopleSoft or EBS. Timing is everything: get in before the next module is scoped.",
    programs: "Oracle Learning / Performance are commonly replaced by specialist platforms.",
    global: "Oracle payroll covers a handful of countries natively; the rest is partners. Multi-country accounts are open for global payroll.",
  },
  taleo: {
    ta: "Taleo is end-of-life in practice; every Taleo account is evaluating or should be. Ask about the migration timeline and who owns it.",
    corehr: "Taleo on the front end usually means an older core (PeopleSoft, EBS, legacy). Ask what the HRIS roadmap is.",
  },
  icims: {
    ta: "iCIMS is a strong mid/large-market ATS; displacement is hard, but CRM, texting, scheduling and analytics are common add-ons. Ask about contract renewal dates.",
    corehr: "iCIMS is recruiting-only, so the HRIS is separate. Find out which (often ADP, UKG or Workday).",
  },
  phenom: { any: "Phenom means they already invest in candidate experience on top of the ATS. Sell what Phenom does not do (assessment, screening, scheduling depth, analytics) or a better CRM." },
  eightfold: { any: "Eightfold is an AI talent-intelligence layer. Accounts running it are early adopters; pitch depth in a niche Eightfold treats generically." },
  paradox: { ta: "Paradox (Olivia) handles conversational scheduling and screening for hourly hiring. Adjacent openings: assessments, background checks, onboarding." },
  avature: { ta: "Avature is a heavy, configurable CRM. Recruiters often hate the UI; sourcing and engagement tools win on usability." },
  brassring: { ta: "BrassRing accounts are on borrowed time after the Infinite acquisition. Ask about the replacement timeline." },
  ukg: { corehr: "UKG Pro is common in hourly-heavy industries. Displacement is rare; integration and adjacent modules (benefits, comp, learning) are the play.", programs: "UKG's talent modules are thin; performance, learning and engagement are open." },
  adp: { corehr: "ADP-hosted boards mean ADP Workforce Now or Vantage is payroll of record. Sell around ADP's weak spots: talent, analytics, employee experience.", global: "ADP GlobalView / Celergo compete here; know the countries." },
  paycom: { corehr: "Paycom is a single-database suite. Displacement is all-or-nothing; adjacent point tools have to integrate cleanly." },
  paylocity: { corehr: "Paylocity is mid-market payroll; a Fortune 500 division on it is unusual and likely an acquired unit. Consolidation opportunity." },
  dayforce: { corehr: "Dayforce is strong in payroll and WFM for hourly workforces. Sell adjacent (talent, learning, engagement) or global." },
  smartrecruiters: { ta: "SmartRecruiters is a modern ATS with a marketplace; add-ons are expected. Lead with a marketplace integration." },
  greenhouse: { ta: "Greenhouse is well liked; displacement is hard. Sourcing, assessments and scheduling integrate via its marketplace." },
  lever: { ta: "Lever accounts are often re-evaluating after the Employ merger. Ask about renewal." },
  ashby: { ta: "Ashby is the modern choice for tech-forward teams; sell adjacent (assessment, screening) with a native integration." },
  radancy: { any: "Radancy runs the career site and programmatic ads. The ATS is separate; find it on a job detail page." },
  hirevue: { ta: "HireVue is already in for video/assessment. Position on a different assessment type or on scheduling / screening." },
  beamery: { ta: "Beamery is the CRM layer; sourcing data and assessments are adjacent." },
  cornerstone: { programs: "Cornerstone LMS is the classic replacement target for modern learning platforms. Lead with learner experience and content." },
  custom: { any: "In-house career site. These companies have engineering budget for HR; sell APIs and data, not UI." },
};

/** Questions a rep can ask on the first call, keyed by signal type. */
export const DISCOVERY_QUESTIONS: Record<string, string[]> = {
  "hiring.people_exec_open": ["Who is running the function until the role is filled, and what is on their 90-day list?", "Is the new leader expected to review the HR tech stack?", "Which vendor contracts renew in the next two quarters?"],
  "hiring.hr_leader_open": ["What is the new director inheriting: team, tools, backlog?", "Is this a backfill or a new seat?"],
  "hiring.recruiting_open": ["How many requisitions per recruiter today, and what is the target?", "Where does time go in the funnel: sourcing, scheduling, screening?", "What did the last ATS or CRM evaluation conclude?"],
  "hiring.hr_generalist_open": ["Which HR processes are still manual or spreadsheet-driven?", "How is the HR team measured this year?"],
  "hiring.hris_open": ["Which HR system project is this hire for: implementation, migration, optimisation?", "What integrations are on the roadmap?", "Who owns HR technology: HR or IT?"],
  "hiring.payroll_open": ["How many payroll runs, countries and pay groups?", "What is the current error or off-cycle rate?", "Is time and attendance integrated with payroll?"],
  "hiring.comp_benefits_open": ["When is the next comp cycle or open enrolment?", "Which tools support planning today: spreadsheets or a platform?"],
  "hiring.learning_open": ["What is the learning platform, and what is its adoption?", "Which programmes are being built this year?"],
  "hiring.engagement_open": ["How is engagement measured today, and how often?", "What happened to the last survey's action plans?"],
  "hiring.wfm_open": ["How are frontline schedules built today?", "What is the overtime or fill-rate problem you are solving?"],
  "hiring.volume": ["Which roles are hardest to fill at this volume?", "What is the cost per hire trend?"],
  "hiring.intl_footprint": ["Which countries do you hire in without an entity?", "How is multi-country payroll run today: one provider or many?"],
  "hiring.contingent_share": ["Who manages contingent onboarding and screening?", "Is there a VMS, and does it talk to HR systems?"],
  "stack.ats_detected": ["When does the current ATS contract renew?", "What is working and not working with it?"],
  "stack.hris_detected": ["Which modules of the HRIS are live, and which were bought but not deployed?", "What is the integration policy for new tools?"],
  "stack.tool_detected": ["What did the last point-tool purchase solve, and what is still open?"],
  "stack.tool_mentioned": ["Job posts mention {tools}: is that the standard across the company or one division?"],
  "exec.officer_change": ["Does the leadership change touch HR or the functions HR serves?", "Are vendor decisions frozen or accelerated during the transition?"],
  "corp.acquisition": ["How many HR systems and payrolls does the acquired unit bring?", "What is the integration timeline for people systems?"],
  "risk.restructuring": ["Which HR processes are affected: offboarding, redeployment, retention?", "Is consolidation of vendors part of the savings plan?"],
  "risk.warn_notice": ["How is offboarding being handled at the affected sites?", "Are there retention or redeployment programmes running?"],
  "fortune.newcomer": ["Which systems were built for a smaller company and are straining now?"],
  "fortune.jobs_growth": ["Which functions grew fastest, and did HR capacity keep up?"],
  "fortune.rank_gain": ["What changed operationally to drive the growth, and what did it break in HR?"],
};

/** Family-level value proposition used in opening lines and sequences. */
export const FAMILY_PITCH: Record<Family, string> = {
  ta: "faster, cheaper hiring at volume",
  corehr: "a cleaner system of record and fewer manual HR processes",
  programs: "programmes that managers actually use",
  global: "hiring and paying people in more countries without entities or spreadsheets",
};

export function incumbentAngle(vendorKey: string | null | undefined, profile: Profile): string | null {
  if (!vendorKey) return null;
  const a = INCUMBENT_ANGLES[vendorKey];
  if (!a) return null;
  return a[profile.family] || a.any || null;
}

export function buyerTitles(profile: Profile): string[] {
  return BUYER_TITLES[profile.key] || BUYER_TITLES.hris;
}

/** Parse Workday-style relative dates ("Posted 18 Days Ago", "Posted Today", "Posted 30+ Days Ago") into ISO dates. */
export function parsePostedText(text: string | null | undefined, asOf: Date = new Date()): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  const day = (n: number) => new Date(asOf.getTime() - n * 86400000).toISOString().slice(0, 10);
  if (/today/.test(t)) return day(0);
  if (/yesterday/.test(t)) return day(1);
  const m = t.match(/(\d+)\+?\s*days?/);
  if (m) return day(Number(m[1]));
  const iso = text.match(/\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : null;
}
