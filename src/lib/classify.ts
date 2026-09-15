/**
 * Rules-based job-title classifier. Buckets are the HR-function roles a seller cares about.
 * Order matters: first match wins. Returns null for non-HR roles.
 */
export type Bucket =
  | "people_exec"      // Chief People Officer, CHRO, VP/SVP/Head of People/HR/Talent
  | "hr_leader"        // Director-level HR / TA / Total Rewards
  | "recruiting"       // Recruiters, sourcers, TA partners
  | "hris"             // HRIS / Workday / people-systems analysts
  | "payroll"
  | "comp_benefits"    // compensation, benefits, total rewards
  | "learning"         // L&D, talent development, org development
  | "hr_generalist"    // HRBP, HR generalist, people ops, employee relations
  | "engagement"       // culture, DEI, employee experience
  | "wfm";             // workforce management / scheduling / timekeeping

export const BUCKET_LABEL: Record<Bucket, string> = {
  people_exec: "People exec",
  hr_leader: "HR leader",
  recruiting: "Recruiting",
  hris: "HRIS / people systems",
  payroll: "Payroll",
  comp_benefits: "Comp & benefits",
  learning: "Learning & development",
  hr_generalist: "HR generalist / HRBP",
  engagement: "Culture / DEI / EX",
  wfm: "Workforce mgmt",
};

const HR_DOMAIN = /\b(people|human resources|human capital|\bhr\b|talent acquisition|talent management|talent development|head of talent|chief talent|total rewards|compensation|benefits|recruit\w*|workforce (management|planning)|employee (relations|experience)|hrbp|hris|payroll|learning (and|&) development|organi[sz]ational development|dei|diversity|inclusion|culture)\b/i;
const EXEC = /\b(chief|chro|svp|evp|vp|vice president|head of|global head|president of)\b/i;
const NOT_EXEC = /\b(assistant vice president|avp|associate vice president|assistant to|office of the|executive assistant|chief product|chief procurement|chief privacy|cpo - (product|procurement))\b/i;
const NOT_HR = /\b(sales|engineering|software|product|security|finance|accounting|marketing|supply chain|authentication|optimization|analytics engineer|customer|business risk|resiliency|underwriting|claims|actuar)\b/i;
const DIRECTOR = /\b(director|sr\.? director|senior director|group lead|leader)\b/i;

const RULES: { bucket: Bucket; test: (t: string) => boolean }[] = [
  {
    bucket: "people_exec",
    test: (t) =>
      !NOT_EXEC.test(t) && !NOT_HR.test(t) &&
      (/\b(chief (people|human resources|human resource|talent|hr|diversity|learning) officer|\bchro\b|chief people|chief human)/i.test(t) ||
        (EXEC.test(t) && HR_DOMAIN.test(t))),
  },
  {
    bucket: "hr_leader",
    test: (t) => (DIRECTOR.test(t) || (NOT_EXEC.test(t) && /\b(vice president|avp)\b/i.test(t))) && HR_DOMAIN.test(t) && !NOT_HR.test(t),
  },
  {
    bucket: "hris",
    test: (t) => /\b(hris|hcm|people (systems|technology|tech|analytics|data)|hr (systems|technology|tech|analytics|data|reporting)|workday (analyst|consultant|administrator|admin|lead|engineer|architect|specialist|manager)|successfactors|peoplesoft hcm|oracle hcm|hr digital)\b/i.test(t),
  },
  {
    bucket: "recruiting",
    test: (t) =>
      /\b(recruit(er|ing|ment)|talent acquisition|talent partner|sourcer|sourcing (specialist|partner|lead|manager)|staffing (specialist|coordinator|partner|manager)|campus (recruit|program manager)|university (recruit|relations)|early careers? (recruit|program manager|programs? lead|talent)|talent scout|\bta (partner|specialist|coordinator|manager|lead)\b|technical recruiter|executive search)\b/i.test(t) && !/\b(program|programme) [–-]/i.test(t),
  },
  { bucket: "payroll", test: (t) => /\bpayroll\b/i.test(t) },
  {
    bucket: "comp_benefits",
    test: (t) => /\b(compensation|total rewards|benefits (analyst|manager|specialist|coordinator|administrator|lead|partner|consultant)|comp (&|and) ben|equity (administration|plan)|stock plan|retirement plan|leave (of absence|administration|specialist)|absence management)\b/i.test(t) && !/\bsales compensation\b/i.test(t),
  },
  {
    bucket: "learning",
    test: (t) => !/\b(development program|program participant|rotational|graduate program|leadership program|commercial learning|commercialization learning|sales (training|enablement|learning)|clinical (education|training)|customer (training|education))\b/i.test(t) && /\b(learning (and|&) development|l&d|talent development|organi[sz]ational (development|effectiveness)|leadership development|training (manager|specialist|coordinator|lead|program)|instructional design|learning (specialist|manager|partner|consultant|lead|designer|experience)|lms)\b/i.test(t),
  },
  {
    bucket: "engagement",
    test: (t) => /\b(employee (engagement|experience|communications)|culture (manager|partner|lead|specialist)|dei\b|diversity|inclusion|belonging)\b/i.test(t),
  },
  {
    bucket: "wfm",
    test: (t) => /\b(workforce (management|planning|scheduling|analyst)|scheduling (analyst|manager|coordinator)|timekeeping|time (and|&) attendance|labor (planning|analyst))\b/i.test(t),
  },
  {
    bucket: "hr_generalist",
    test: (t) => /\b(human resources|human resource|\bhr\b|people (operations|ops|partner|business partner|team|generalist|advisor|specialist|coordinator|manager|associate|analyst)|hrbp|employee relations|labor relations|hr (generalist|manager|coordinator|specialist|assistant|associate|advisor|consultant|partner|representative|administrator|intern)|onboarding (specialist|coordinator))\b/i.test(t),
  },
];

export function classifyTitle(title: string): Bucket | null {
  const t = (title || "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  for (const r of RULES) if (r.test(t)) return r.bucket;
  return null;
}

/** Search terms used against boards that support keyword search (Workday). Each maps to buckets we hope to find. */
export const HR_SEARCH_TERMS: string[] = [
  "recruiter",
  "talent acquisition",
  "human resources",
  "people operations",
  "HR business partner",
  "payroll",
  "compensation",
  "benefits analyst",
  "learning development",
  "HRIS",
  "chief people officer",
  "workforce management",
];

const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};
const STATE_BY_NAME: Record<string, string> = Object.fromEntries(Object.entries(US_STATES).map(([k, v]) => [v.toLowerCase(), k]));

export function parseLocation(loc: string): { state: string | null; country: string | null; remote: boolean } {
  const s = (loc || "").trim();
  const remote = /\bremote\b|\bvirtual\b|work from home/i.test(s);
  if (!s) return { state: null, country: null, remote };
  // Workday style: "US, CA, Santa Clara" | "USA - CA - Los Angeles" | "Bentonville, AR" | "New York, NY, United States"
  let state: string | null = null;
  const abbr = s.match(/(?:^|[\s,\-–(])([A-Z]{2})(?=$|[\s,\-–)])/g);
  if (abbr) {
    for (const a of abbr) {
      const code = a.replace(/[^A-Z]/g, "");
      if (US_STATES[code] && code !== "US") { state = code; break; }
    }
  }
  if (!state) {
    const low = s.toLowerCase();
    for (const [name, code] of Object.entries(STATE_BY_NAME)) {
      if (low.includes(name)) { state = code; break; }
    }
  }
  let country: string | null = null;
  if (state || /\b(usa?|united states|u\.s\.)\b/i.test(s)) country = "US";
  else {
    const known: [RegExp, string][] = [
      [/\b(india|bengaluru|bangalore|hyderabad|pune|chennai|mumbai|gurgaon|gurugram|noida)\b/i, "IN"],
      [/\b(canada|toronto|vancouver|montreal|calgary|ontario|quebec|british columbia|alberta)\b/i, "CA"],
      [/\b(united kingdom|uk\b|london|manchester|england|scotland)\b/i, "GB"],
      [/\b(mexico|méxico|monterrey|guadalajara|ciudad de)\b/i, "MX"],
      [/\b(germany|deutschland|berlin|munich|münchen|frankfurt)\b/i, "DE"],
      [/\b(ireland|dublin|cork)\b/i, "IE"],
      [/\b(poland|warsaw|krak[oó]w|wroc)\b/i, "PL"],
      [/\b(philippines|manila|cebu)\b/i, "PH"],
      [/\b(singapore)\b/i, "SG"],
      [/\b(china|shanghai|beijing|shenzhen)\b/i, "CN"],
      [/\b(japan|tokyo|osaka)\b/i, "JP"],
      [/\b(australia|sydney|melbourne)\b/i, "AU"],
      [/\b(brazil|brasil|s[aã]o paulo)\b/i, "BR"],
      [/\b(france|paris)\b/i, "FR"],
      [/\b(netherlands|amsterdam)\b/i, "NL"],
      [/\b(spain|madrid|barcelona)\b/i, "ES"],
      [/\b(costa rica|san jos[eé])\b/i, "CR"],
      [/\b(israel|tel aviv)\b/i, "IL"],
    ];
    for (const [re, c] of known) if (re.test(s)) { country = c; break; }
  }
  return { state, country, remote };
}

export function stateName(code: string): string {
  return US_STATES[code] || code;
}

/** "Washington" -> "WA"; passes through codes and unknowns. */
export function stateCode(name: string | null | undefined): string {
  if (!name) return "–";
  if (US_STATES[name]) return name;
  return STATE_BY_NAME[name.toLowerCase()] || name;
}

/** Which HR function an exec / leader title belongs to. */
export type ExecDomain = "ta" | "payroll" | "benefits" | "comp" | "learning" | "hris" | "wfm" | "dei" | "hr";
export function execDomain(title: string): ExecDomain {
  const t = title.toLowerCase();
  if (/talent acquisition|recruit|sourcing|staffing/.test(t)) return "ta";
  if (/payroll/.test(t)) return "payroll";
  if (/benefit|total rewards|rewards/.test(t)) return "benefits";
  if (/compensation|equity/.test(t)) return "comp";
  if (/learning|development|training|talent management|talent development|organi[sz]ational/.test(t)) return "learning";
  if (/hris|hr technology|people technology|hr systems|people systems|hr digital|hcm|workday|successfactors/.test(t)) return "hris";
  if (/workforce management|scheduling|labor/.test(t)) return "wfm";
  if (/diversity|inclusion|dei|culture|engagement/.test(t)) return "dei";
  return "hr";
}
