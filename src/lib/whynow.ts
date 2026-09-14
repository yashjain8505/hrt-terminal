import type { Profile } from "./profiles";

export interface SignalRow {
  id: number;
  company_id: number;
  type: string;
  strength: number;
  observed_at: string;
  source: string | null;
  source_url: string | null;
  title: string;
  summary: string | null;
  payload_json: string | null;
}

type P = Record<string, unknown>;

function n(v: unknown): number { return typeof v === "number" ? v : Number(v || 0); }
function s(v: unknown): string { return v == null ? "" : String(v); }
function list(v: unknown, max = 3): string {
  if (!Array.isArray(v)) return "";
  return v.slice(0, max).map(String).join(", ");
}

/**
 * Deterministic "why now" for a signal given the reader's offer profile.
 * Templates keyed by signal type, branched by profile family. No LLM needed for v0.
 */
export function whyNow(sig: SignalRow, profile: Profile, company: { name: string }): string {
  const p: P = sig.payload_json ? JSON.parse(sig.payload_json) : {};
  const fam = profile.family;
  const co = company.name;
  switch (sig.type) {
    case "hiring.people_exec_open": {
      const t = s(p.title);
      return `${co} is hiring a ${t}. A new people leader typically re-evaluates the ${profile.sells.split(",")[0]} stack in their first 90 days. Get in before the seat is filled, then again on day 30.`;
    }
    case "hiring.hr_leader_open":
      return `${co} is adding director-level HR leadership (${s(p.title)}). New leaders bring budgets and vendor preferences; a warm intro now beats a cold one after they land.`;
    case "hiring.recruiting_open": {
      const c = n(p.count);
      if (fam === "ta") return `${c} open recruiting role${c === 1 ? "" : "s"} at ${co} (${list(p.titles)}). A TA team that is growing is a TA team feeling capacity pain: the pitch is throughput per recruiter.`;
      if (fam === "corehr") return `${co} is scaling its recruiting team (${c} open). Recruiting growth usually precedes headcount growth, which strains core HR and payroll processes next.`;
      return `${co} is expanding recruiting (${c} open roles). More hires means more onboarding, more programs, more need for ${profile.sells.split(",")[0]}.`;
    }
    case "hiring.hr_generalist_open": {
      const c = n(p.count);
      return `${c} HR / HRBP role${c === 1 ? "" : "s"} open at ${co} (${list(p.titles)}). HR teams adding generalists are absorbing process load; that is the moment ${profile.sells.split(",")[0]} gets budget.`;
    }
    case "hiring.hris_open": {
      const c = n(p.count);
      if (fam === "corehr") return `${co} is hiring HR-systems talent (${list(p.titles)}). HRIS hiring means an implementation, migration or clean-up is underway. That is the narrow window where a core HR or payroll vendor can get evaluated.`;
      return `${co} is hiring HRIS / people-systems roles (${c}). HR technology is in motion; integrations and new tools get approved during this window.`;
    }
    case "hiring.payroll_open": {
      const c = n(p.count);
      if (profile.key === "payroll") return `${c} payroll role${c === 1 ? "" : "s"} open at ${co}. Payroll teams hire when volume or complexity outgrows the current system. Lead with error reduction and multi-state or multi-country coverage.`;
      return `${co} is adding payroll staff (${c}). Payroll pain often surfaces adjacent needs: time, scheduling, benefits and HRIS integrations.`;
    }
    case "hiring.comp_benefits_open": {
      const c = n(p.count);
      return `${c} comp & benefits role${c === 1 ? "" : "s"} open at ${co} (${list(p.titles)}). Total-rewards hiring usually precedes a plan redesign or a cycle change; that is when new tooling gets bought.`;
    }
    case "hiring.learning_open":
      return `${co} is hiring in L&D / talent development (${list(p.titles)}). Program build-outs need platforms; ask what they are running today.`;
    case "hiring.engagement_open":
      return `${co} is staffing culture / engagement / DEI (${list(p.titles)}). Someone will own a listening or engagement program soon; be the vendor they inherit.`;
    case "hiring.wfm_open":
      return `${co} is hiring workforce-management and scheduling roles (${list(p.titles)}). Frontline scheduling pain is explicit here.`;
    case "hiring.volume": {
      const c = n(p.open_roles);
      if (fam === "ta") return `${co} has ${c.toLocaleString()} open roles on its board. At that volume every point of funnel efficiency is worth headcount.`;
      return `${co} is running ${c.toLocaleString()} open roles. High-volume hiring stresses onboarding, screening and HR ops.`;
    }
    case "hiring.intl_footprint": {
      const c = n(p.countries);
      if (fam === "global") return `${co} is hiring in ${c} countries (${list(p.top, 5)}). Multi-country hiring is the entire EOR / global payroll conversation.`;
      return `${co} hires across ${c} countries. Multi-country footprints complicate payroll, compliance and systems.`;
    }
    case "hiring.contingent_share":
      return `${co} runs a large contingent / intern share of postings (${s(p.pct)}%). Contingent workforces need different screening, onboarding and scheduling.`;
    case "stack.ats_detected": {
      const v = s(p.vendor);
      if (fam === "ta") return `${co} runs ${v} for applicant tracking. Competitive displacement or integration play; check the contract cycle.`;
      return `${co}'s careers site runs on ${v}. Useful context for integration and stack conversations.`;
    }
    case "stack.hris_detected": {
      const v = s(p.vendor);
      if (fam === "corehr") return `${co}'s job board is hosted by ${v}, which means ${v} is the HRIS / payroll of record. Position against ${v}'s gaps or integrate with it.`;
      return `${co} runs ${v} as its HR system. Lead with a native ${v} integration.`;
    }
    case "stack.tool_detected":
      return `${co}'s careers site loads ${s(p.vendor)}. They already buy point tools in this category; a swap or add-on is a shorter sale than a first purchase.`;
    case "stack.tool_mentioned": {
      const tools = list(p.tools, 4);
      return `Job posts at ${co} name ${tools}. Incumbent tools in job descriptions are the most reliable public stack evidence there is.`;
    }
    case "exec.officer_change":
      return `${co} filed an 8-K (Item 5.02) reporting an officer departure or appointment on ${s(p.filed_at)}. Leadership changes reopen vendor decisions; check whether the HR function is affected.`;
    case "corp.acquisition":
      return `${co} closed an acquisition or disposition (8-K Item 2.01, ${s(p.filed_at)}). Integrating an acquired workforce forces HR-system, payroll and benefits consolidation.`;
    case "risk.restructuring":
      return `${co} disclosed restructuring costs (8-K Item 2.05, ${s(p.filed_at)}). Pause growth pitches; lead with cost, consolidation and compliance.`;
    case "risk.warn_notice":
      return `${co} filed a WARN layoff notice in ${s(p.state)} (${n(p.employees)} employees, ${s(p.notice_date)}). Offboarding, compliance and consolidation are the relevant conversations now.`;
    case "fortune.newcomer":
      return `${co} is new to the Fortune 500 this year. Fast growers outgrow their HR stack; they are used to buying.`;
    case "fortune.jobs_growth":
      return `Fortune reports ${co} grew headcount last year. Growing companies buy HR tooling to keep up.`;
    case "fortune.rank_gain":
      return `${co} climbed ${n(p.change)} places on the Fortune 500. Momentum companies have budget.`;
    default:
      return sig.summary || sig.title;
  }
}
