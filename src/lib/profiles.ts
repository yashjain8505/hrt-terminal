/**
 * Offer profiles: who the terminal user sells to. Same signals, different ranking and why-now.
 * weight is multiplied by signal strength (1-5). 0 hides the signal for that profile.
 */
export type Family = "ta" | "corehr" | "programs" | "global";

export interface Profile {
  key: string;
  family: Family;
  name: string;
  short: string;
  sells: string;
  buyer: string;
  weights: Record<string, number>;
  partial?: boolean;
}

const BASE: Record<string, number> = {
  "hiring.people_exec_open": 1.0,
  "hiring.hr_leader_open": 0.8,
  "hiring.recruiting_open": 0.5,
  "hiring.hr_generalist_open": 0.5,
  "hiring.hris_open": 0.7,
  "hiring.payroll_open": 0.4,
  "hiring.comp_benefits_open": 0.4,
  "hiring.learning_open": 0.4,
  "hiring.engagement_open": 0.3,
  "hiring.wfm_open": 0.3,
  "hiring.volume": 0.3,
  "hiring.intl_footprint": 0.3,
  "hiring.contingent_share": 0.2,
  "stack.ats_detected": 0.4,
  "stack.hris_detected": 0.4,
  "stack.tool_detected": 0.3,
  "stack.tool_mentioned": 0.4,
  "exec.officer_change": 0.8,
  "corp.acquisition": 0.6,
  "risk.restructuring": 0.6,
  "risk.warn_notice": 0.6,
  "fortune.newcomer": 0.4,
  "fortune.jobs_growth": 0.4,
  "fortune.rank_gain": 0.2,
};

function w(over: Record<string, number>): Record<string, number> {
  return { ...BASE, ...over };
}

export const PROFILES: Profile[] = [
  { key: "ats", family: "ta", name: "ATS / Recruiting CRM", short: "ATS", sells: "applicant tracking, recruiting CRM, career-site platform", buyer: "Head of Talent Acquisition", weights: w({ "hiring.recruiting_open": 1.2, "stack.ats_detected": 1.3, "stack.tool_detected": 0.9, "stack.tool_mentioned": 1.0, "hiring.volume": 0.8, "hiring.hris_open": 0.9, "exec.officer_change": 1.0, "corp.acquisition": 0.9 }) },
  { key: "sourcing", family: "ta", name: "Sourcing & candidate data", short: "SOURCE", sells: "sourcing tools, talent databases, outbound recruiting", buyer: "Recruiting lead / Sourcing manager", weights: w({ "hiring.recruiting_open": 1.4, "hiring.volume": 1.0, "hiring.intl_footprint": 0.5, "stack.ats_detected": 0.6 }) },
  { key: "assessment", family: "ta", name: "Assessment / interview intelligence", short: "ASSESS", sells: "skills assessments, video interviewing, interview intelligence", buyer: "TA leader / Recruiting ops", weights: w({ "hiring.recruiting_open": 1.1, "hiring.volume": 1.1, "stack.tool_detected": 1.0, "hiring.contingent_share": 0.5 }) },
  { key: "screening", family: "ta", name: "Background checks / onboarding", short: "SCREEN", sells: "background screening, I-9, onboarding workflows", buyer: "HR Ops / Recruiting ops", weights: w({ "hiring.volume": 1.3, "hiring.recruiting_open": 0.9, "hiring.hr_generalist_open": 0.8, "hiring.contingent_share": 0.7, "hiring.intl_footprint": 0.5 }) },
  { key: "hris", family: "corehr", name: "HRIS / core HR", short: "HRIS", sells: "core HR system of record, HCM suite", buyer: "CHRO / VP People / HR Ops", weights: w({ "hiring.hris_open": 1.5, "stack.hris_detected": 1.3, "stack.tool_mentioned": 1.0, "exec.officer_change": 1.1, "corp.acquisition": 1.3, "hiring.people_exec_open": 1.2, "hiring.intl_footprint": 0.6 }) },
  { key: "payroll", family: "corehr", name: "Payroll", short: "PAYROLL", sells: "payroll, tax, time and pay", buyer: "Payroll lead / HR Ops / Finance", weights: w({ "hiring.payroll_open": 1.6, "stack.hris_detected": 1.2, "stack.tool_mentioned": 0.9, "corp.acquisition": 1.1, "hiring.intl_footprint": 0.8, "hiring.wfm_open": 0.8 }) },
  { key: "benefits", family: "corehr", name: "Benefits / PEO / 401k", short: "BENEFIT", sells: "benefits administration, PEO, retirement plans", buyer: "Total Rewards / Benefits lead", partial: true, weights: w({ "hiring.comp_benefits_open": 1.6, "hiring.hr_generalist_open": 0.6, "corp.acquisition": 1.0, "risk.restructuring": 0.8 }) },
  { key: "compliance", family: "corehr", name: "Compliance / HR advisory", short: "COMPLY", sells: "HR compliance, employment law, policy tooling", buyer: "HR Ops / Employee Relations / Legal", weights: w({ "hiring.hr_generalist_open": 1.1, "risk.warn_notice": 1.3, "risk.restructuring": 1.2, "hiring.intl_footprint": 0.8, "corp.acquisition": 1.0 }) },
  { key: "performance", family: "programs", name: "Performance / engagement / L&D", short: "PERFORM", sells: "performance management, engagement surveys, learning platforms", buyer: "Head of People / L&D / Talent Management", weights: w({ "hiring.learning_open": 1.5, "hiring.engagement_open": 1.5, "hiring.people_exec_open": 1.2, "stack.tool_mentioned": 0.8, "exec.officer_change": 1.0 }) },
  { key: "compensation", family: "programs", name: "Compensation / equity", short: "COMP", sells: "compensation planning, pay equity, equity management", buyer: "Total Rewards / Compensation lead", weights: w({ "hiring.comp_benefits_open": 1.6, "hiring.people_exec_open": 1.0, "corp.acquisition": 1.0, "fortune.rank_gain": 0.4 }) },
  { key: "wfm", family: "programs", name: "Workforce management / scheduling", short: "WFM", sells: "scheduling, timekeeping, frontline workforce tools", buyer: "Operations / HR Ops / Store & plant leaders", weights: w({ "hiring.wfm_open": 1.6, "hiring.volume": 1.0, "hiring.contingent_share": 1.0, "hiring.payroll_open": 0.8, "stack.tool_mentioned": 0.8 }) },
  { key: "global", family: "global", name: "EOR / global payroll / immigration", short: "GLOBAL", sells: "employer of record, global payroll, immigration services", buyer: "People Ops / Legal / Global mobility", partial: true, weights: w({ "hiring.intl_footprint": 1.8, "hiring.payroll_open": 0.9, "corp.acquisition": 1.0, "hiring.hr_generalist_open": 0.5 }) },
];

export const PROFILE_BY_KEY: Record<string, Profile> = Object.fromEntries(PROFILES.map((p) => [p.key, p]));
export const DEFAULT_PROFILE = "ats";

/** Which exec / leader functions each profile cares about (others score at 45%). */
const DOMAIN_FIT: Record<string, string[]> = {
  ats: ["ta", "hr", "hris"], sourcing: ["ta", "hr"], assessment: ["ta", "hr"], screening: ["ta", "hr"],
  hris: ["hris", "hr", "payroll"], payroll: ["payroll", "hr", "hris"], benefits: ["benefits", "comp", "hr"], compliance: ["hr", "payroll"],
  performance: ["learning", "dei", "hr"], compensation: ["comp", "benefits", "hr"], wfm: ["wfm", "payroll", "hr"], global: ["payroll", "hr", "hris"],
};

export function scoreSignal(profile: Profile, type: string, strength: number, payloadJson?: string | null): number {
  const wt = profile.weights[type] ?? 0.3;
  let mult = 1;
  if (payloadJson && (type === "hiring.people_exec_open" || type === "hiring.hr_leader_open")) {
    try { const p = JSON.parse(payloadJson) as { domain?: string }; if (p.domain && !(DOMAIN_FIT[profile.key] || ["hr"]).includes(p.domain)) mult = 0.45; } catch { /* ignore */ }
  }
  return Math.round(strength * wt * mult * 10) / 10;
}

export const SIGNAL_LABEL: Record<string, string> = {
  "hiring.people_exec_open": "People exec role open",
  "hiring.hr_leader_open": "HR leader role open",
  "hiring.recruiting_open": "Recruiting roles open",
  "hiring.hr_generalist_open": "HR / HRBP roles open",
  "hiring.hris_open": "HRIS roles open",
  "hiring.payroll_open": "Payroll roles open",
  "hiring.comp_benefits_open": "Comp & benefits roles open",
  "hiring.learning_open": "L&D roles open",
  "hiring.engagement_open": "Culture / DEI roles open",
  "hiring.wfm_open": "Workforce mgmt roles open",
  "hiring.volume": "Hiring volume",
  "hiring.intl_footprint": "International hiring",
  "hiring.contingent_share": "Contingent / intern share",
  "stack.ats_detected": "ATS detected",
  "stack.hris_detected": "HRIS / payroll detected",
  "stack.tool_detected": "HR tool on careers site",
  "stack.tool_mentioned": "Tool named in job posts",
  "exec.officer_change": "Officer change (8-K 5.02)",
  "corp.acquisition": "Acquisition closed (8-K 2.01)",
  "risk.restructuring": "Restructuring (8-K 2.05)",
  "risk.warn_notice": "WARN layoff notice",
  "fortune.newcomer": "New to Fortune 500",
  "fortune.jobs_growth": "Headcount grew",
  "fortune.rank_gain": "Rank gained",
};

export const SIGNAL_GROUP: Record<string, "HIRING" | "STACK" | "FILINGS" | "RISK" | "LIST"> = {
  "hiring.people_exec_open": "HIRING", "hiring.hr_leader_open": "HIRING", "hiring.recruiting_open": "HIRING", "hiring.hr_generalist_open": "HIRING", "hiring.hris_open": "HIRING", "hiring.payroll_open": "HIRING", "hiring.comp_benefits_open": "HIRING", "hiring.learning_open": "HIRING", "hiring.engagement_open": "HIRING", "hiring.wfm_open": "HIRING", "hiring.volume": "HIRING", "hiring.intl_footprint": "HIRING", "hiring.contingent_share": "HIRING",
  "stack.ats_detected": "STACK", "stack.hris_detected": "STACK", "stack.tool_detected": "STACK", "stack.tool_mentioned": "STACK",
  "exec.officer_change": "FILINGS", "corp.acquisition": "FILINGS", "risk.restructuring": "RISK", "risk.warn_notice": "RISK",
  "fortune.newcomer": "LIST", "fortune.jobs_growth": "LIST", "fortune.rank_gain": "LIST",
};
