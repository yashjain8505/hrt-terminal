/**
 * Dictionary of HR-tech vendors detectable from a careers site / job board host.
 * category: ats = applicant tracking; hris = core HR / payroll suite that also hosts a board;
 *           crm = candidate CRM / career-site layer; tool = point tool (assessment, chatbot, etc.)
 * pull: how we can read the board programmatically (null = not in v0).
 */
export type VendorCategory = "ats" | "hris" | "crm" | "tool";
export type PullKind = "workday" | "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "phenom" | "custom" | null;

export interface Vendor {
  key: string;
  name: string;
  category: VendorCategory;
  pull: PullKind;
  patterns: RegExp[];
}

export const VENDORS: Vendor[] = [
  { key: "workday", name: "Workday", category: "hris", pull: "workday", patterns: [/\.myworkdayjobs\.com/i, /\.myworkdaysite\.com/i] },
  { key: "greenhouse", name: "Greenhouse", category: "ats", pull: "greenhouse", patterns: [/boards\.greenhouse\.io/i, /job-boards\.greenhouse\.io/i, /boards-api\.greenhouse\.io/i, /greenhouse\.io\/embed/i, /grnh\.se/i] },
  { key: "lever", name: "Lever", category: "ats", pull: "lever", patterns: [/jobs\.lever\.co/i, /api\.lever\.co/i] },
  { key: "ashby", name: "Ashby", category: "ats", pull: "ashby", patterns: [/jobs\.ashbyhq\.com/i, /api\.ashbyhq\.com/i] },
  { key: "smartrecruiters", name: "SmartRecruiters", category: "ats", pull: "smartrecruiters", patterns: [/jobs\.smartrecruiters\.com/i, /api\.smartrecruiters\.com/i, /careers\.smartrecruiters\.com/i] },
  { key: "icims", name: "iCIMS", category: "ats", pull: null, patterns: [/\.icims\.com/i, /jibeapply\.com/i, /icims\.com/i] },
  { key: "successfactors", name: "SAP SuccessFactors", category: "hris", pull: null, patterns: [/successfactors\.(com|eu)/i, /jobs2web/i, /rmkcdn\.successfactors/i, /\.sapsf\./i] },
  { key: "taleo", name: "Oracle Taleo", category: "ats", pull: null, patterns: [/\.taleo\.net/i] },
  { key: "oraclehcm", name: "Oracle Recruiting Cloud", category: "hris", pull: null, patterns: [/oraclecloud\.com\/hcmUI/i, /\/CandidateExperience\//i, /oraclecloud\.com\/.*\/requisitions/i, /fa\.[a-z0-9]+\.oraclecloud\.com/i] },
  { key: "phenom", name: "Phenom", category: "crm", pull: "phenom", patterns: [/phenompeople\.com/i, /phenom\.com/i, /phenom-people/i, /"phenom"/i, /phenomPeople/i, /pp-static/i] },
  { key: "eightfold", name: "Eightfold", category: "crm", pull: null, patterns: [/eightfold\.ai/i] },
  { key: "avature", name: "Avature", category: "crm", pull: null, patterns: [/avature\.net/i] },
  { key: "jobvite", name: "Jobvite", category: "ats", pull: null, patterns: [/jobvite\.com/i] },
  { key: "brassring", name: "Infinite BrassRing", category: "ats", pull: null, patterns: [/brassring\.com/i, /kenexa/i] },
  { key: "ukg", name: "UKG Pro", category: "hris", pull: null, patterns: [/ultipro\.com/i, /recruiting\.ukg/i, /ukg\.com\/careers/i] },
  { key: "adp", name: "ADP", category: "hris", pull: null, patterns: [/workforcenow\.adp\.com/i, /recruiting\.adp\.com/i, /myjobs\.adp\.com/i, /jobs\.adp\.com/i] },
  { key: "paycom", name: "Paycom", category: "hris", pull: null, patterns: [/paycomonline\.net/i] },
  { key: "paylocity", name: "Paylocity", category: "hris", pull: null, patterns: [/recruiting\.paylocity\.com/i] },
  { key: "dayforce", name: "Dayforce", category: "hris", pull: null, patterns: [/dayforcehcm\.com/i, /jobs\.dayforcehcm/i] },
  { key: "bamboohr", name: "BambooHR", category: "hris", pull: null, patterns: [/\.bamboohr\.com/i] },
  { key: "rippling", name: "Rippling", category: "hris", pull: null, patterns: [/ats\.rippling\.com/i, /rippling\.com\/ats/i] },
  { key: "gusto", name: "Gusto", category: "hris", pull: null, patterns: [/jobs\.gusto\.com/i] },
  { key: "workable", name: "Workable", category: "ats", pull: null, patterns: [/apply\.workable\.com/i] },
  { key: "recruitee", name: "Recruitee", category: "ats", pull: null, patterns: [/\.recruitee\.com/i] },
  { key: "breezy", name: "Breezy HR", category: "ats", pull: null, patterns: [/\.breezy\.hr/i] },
  { key: "jazzhr", name: "JazzHR", category: "ats", pull: null, patterns: [/applytojob\.com/i, /jazzhr/i] },
  { key: "cornerstone", name: "Cornerstone", category: "ats", pull: null, patterns: [/csod\.com/i, /cornerstoneondemand/i] },
  { key: "radancy", name: "Radancy", category: "crm", pull: null, patterns: [/radancy/i, /tmpwebeng/i] },
  { key: "symphony", name: "Symphony Talent", category: "crm", pull: null, patterns: [/symphonytalent/i] },
  { key: "hirevue", name: "HireVue", category: "tool", pull: null, patterns: [/hirevue\.com/i] },
  { key: "paradox", name: "Paradox (Olivia)", category: "tool", pull: null, patterns: [/paradox\.ai/i, /olivia\.paradox/i] },
  { key: "beamery", name: "Beamery", category: "crm", pull: null, patterns: [/beamery\.com/i] },
  { key: "yello", name: "Yello", category: "crm", pull: null, patterns: [/yello\.co/i] },
  { key: "textio", name: "Textio", category: "tool", pull: null, patterns: [/textio\.com/i] },
  { key: "jobtarget", name: "JobTarget", category: "tool", pull: null, patterns: [/jobtarget\.com/i] },
  { key: "appcast", name: "Appcast", category: "tool", pull: null, patterns: [/appcast\.io/i] },
];

export const VENDOR_BY_KEY = Object.fromEntries(VENDORS.map((v) => [v.key, v]));

export function detectVendors(html: string, url: string): string[] {
  const hay = url + "\n" + html;
  const hits: string[] = [];
  for (const v of VENDORS) {
    if (v.patterns.some((p) => p.test(hay))) hits.push(v.key);
  }
  return hits;
}

/** Extract a pullable board config from HTML/links. */
export function extractBoardConfig(html: string, url: string): { vendor: string; config: Record<string, string>; boardUrl: string } | null {
  const hay = url + "\n" + html;
  // Workday: https://{tenant}.wd5.myworkdayjobs.com/{en-US/}{site}
  let m = hay.match(/https?:\/\/([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_-]+)/);
  if (m && !/^(wday|job|jobs|en|fr|es|de|ja|zh|login|error)$/i.test(m[3])) {
    return { vendor: "workday", config: { tenant: m[1], wd: m[2], site: m[3], host: `${m[1]}.${m[2]}.myworkdayjobs.com` }, boardUrl: `https://${m[1]}.${m[2]}.myworkdayjobs.com/${m[3]}` };
  }
  m = hay.match(/https?:\/\/([a-z0-9-]+)\.(wd\d+)\.myworkdaysite\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?recruiting\/([a-z0-9-]+)\/([A-Za-z0-9_-]+)/);
  if (m) {
    return { vendor: "workday", config: { tenant: m[3], wd: m[2], site: m[4], host: `${m[1]}.${m[2]}.myworkdaysite.com` }, boardUrl: `https://${m[1]}.${m[2]}.myworkdaysite.com/recruiting/${m[3]}/${m[4]}` };
  }
  m = hay.match(/https?:\/\/([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/?["'\s)]/);
  if (m) {
    return { vendor: "workday", config: { tenant: m[1], wd: m[2], site: "", host: `${m[1]}.${m[2]}.myworkdayjobs.com` }, boardUrl: `https://${m[1]}.${m[2]}.myworkdayjobs.com/` };
  }
  m = hay.match(/(?:boards|job-boards)\.greenhouse\.io\/([a-z0-9]+)/i) || hay.match(/boards-api\.greenhouse\.io\/v1\/boards\/([a-z0-9]+)/i) || hay.match(/greenhouse\.io\/embed\/job_board\?for=([a-z0-9]+)/i);
  if (m) return { vendor: "greenhouse", config: { token: m[1].toLowerCase() }, boardUrl: `https://boards.greenhouse.io/${m[1].toLowerCase()}` };
  m = hay.match(/jobs\.lever\.co\/([a-z0-9-]+)/i);
  if (m) return { vendor: "lever", config: { site: m[1].toLowerCase() }, boardUrl: `https://jobs.lever.co/${m[1].toLowerCase()}` };
  m = hay.match(/jobs\.ashbyhq\.com\/([a-z0-9-]+)/i);
  if (m) return { vendor: "ashby", config: { name: m[1] }, boardUrl: `https://jobs.ashbyhq.com/${m[1]}` };
  m = hay.match(/(?:jobs|careers)\.smartrecruiters\.com\/([A-Za-z0-9]+)/);
  if (m) return { vendor: "smartrecruiters", config: { company: m[1] }, boardUrl: `https://jobs.smartrecruiters.com/${m[1]}` };
  return null;
}

/** Tools we look for inside job descriptions (incumbent-stack evidence). */
export const JD_TOOLS: { key: string; name: string; category: string; pattern: RegExp }[] = [
  { key: "workday", name: "Workday", category: "HRIS", pattern: /\bWorkday\b/ },
  { key: "successfactors", name: "SuccessFactors", category: "HRIS", pattern: /\bSuccessFactors\b/i },
  { key: "oraclehcm", name: "Oracle HCM", category: "HRIS", pattern: /\bOracle (HCM|Fusion HCM|Cloud HCM)\b/i },
  { key: "peoplesoft", name: "PeopleSoft", category: "HRIS", pattern: /\bPeopleSoft\b/i },
  { key: "adp", name: "ADP", category: "Payroll", pattern: /\bADP\b/ },
  { key: "ukg", name: "UKG / Kronos", category: "WFM", pattern: /\b(UKG|Kronos|UltiPro)\b/ },
  { key: "paycom", name: "Paycom", category: "Payroll", pattern: /\bPaycom\b/i },
  { key: "paylocity", name: "Paylocity", category: "Payroll", pattern: /\bPaylocity\b/i },
  { key: "dayforce", name: "Dayforce / Ceridian", category: "Payroll", pattern: /\b(Dayforce|Ceridian)\b/i },
  { key: "greenhouse", name: "Greenhouse", category: "ATS", pattern: /\bGreenhouse\b(?! gas)/ },
  { key: "icims", name: "iCIMS", category: "ATS", pattern: /\biCIMS\b/i },
  { key: "taleo", name: "Taleo", category: "ATS", pattern: /\bTaleo\b/i },
  { key: "lever", name: "Lever (ATS)", category: "ATS", pattern: /\bLever\b(?= ATS| and Greenhouse| or Greenhouse)/ },
  { key: "phenom", name: "Phenom", category: "CRM", pattern: /\bPhenom\b/ },
  { key: "eightfold", name: "Eightfold", category: "CRM", pattern: /\bEightfold\b/i },
  { key: "avature", name: "Avature", category: "CRM", pattern: /\bAvature\b/i },
  { key: "beamery", name: "Beamery", category: "CRM", pattern: /\bBeamery\b/i },
  { key: "hirevue", name: "HireVue", category: "Assessment", pattern: /\bHireVue\b/i },
  { key: "cornerstone", name: "Cornerstone", category: "LMS", pattern: /\bCornerstone OnDemand\b|\bCornerstone (LMS|Learning)\b/i },
  { key: "docebo", name: "Docebo", category: "LMS", pattern: /\bDocebo\b/i },
  { key: "cultureamp", name: "Culture Amp", category: "Engagement", pattern: /\bCulture Amp\b/i },
  { key: "lattice", name: "Lattice", category: "Performance", pattern: /\bLattice\b(?! (structure|energy|boltzmann))/ },
  { key: "glint", name: "Glint / Viva", category: "Engagement", pattern: /\bGlint\b/ },
  { key: "qualtrics", name: "Qualtrics", category: "Engagement", pattern: /\bQualtrics\b/i },
  { key: "visier", name: "Visier", category: "People analytics", pattern: /\bVisier\b/i },
  { key: "servicenow_hr", name: "ServiceNow HRSD", category: "HR service delivery", pattern: /\bServiceNow\b.{0,40}\bHR\b|\bHRSD\b/i },
  { key: "linkedin_recruiter", name: "LinkedIn Recruiter", category: "Sourcing", pattern: /\bLinkedIn Recruiter\b/i },
  { key: "indeed", name: "Indeed", category: "Sourcing", pattern: /\bIndeed\b/ },
];

/** Search terms used against Workday boards to estimate JD tool mentions (search hits description text). */
export const WORKDAY_TOOL_SEARCHES: { key: string; term: string }[] = [
  { key: "successfactors", term: "SuccessFactors" },
  { key: "icims", term: "iCIMS" },
  { key: "taleo", term: "Taleo" },
  { key: "greenhouse", term: "Greenhouse" },
  { key: "adp", term: "ADP" },
  { key: "paycom", term: "Paycom" },
  { key: "ukg", term: "Kronos" },
  { key: "cornerstone", term: "Cornerstone OnDemand" },
  { key: "servicenow_hr", term: "ServiceNow HR" },
  { key: "visier", term: "Visier" },
];

/** Phenom career sites expose a JSON search API at {origin}/widgets. */
export function phenomBody(keywords: string, from = 0, size = 20) {
  return { lang: "en_us", deviceType: "desktop", country: "us", pageName: "search-results", ddoKey: "refineSearch", sortBy: "", subsearch: "", from, jobs: true, counts: true, all_fields: ["category", "country", "state", "city"], size, clearAll: false, jdsource: "facets", isSliderEnable: false, pageId: "page12", siteType: "external", keywords, global: true, selected_fields: {}, locationData: {} };
}

/** Hand-written adapters for big custom career sites. */
export const CUSTOM_ADAPTERS: Record<string, { key: string; name: string }> = {
  "amazon.com": { key: "amazon", name: "Amazon custom (amazon.jobs)" },
};
