import type { Profile } from "./profiles";
import type { SignalRow } from "./whynow";
import { whyNow } from "./whynow";

/** Template-based first-touch draft seeded by the top signals for the reader's profile. */
export function draftOutreach(company: { name: string; hq_city: string | null; hq_state: string | null; ats_vendor: string | null }, signals: (SignalRow & { score: number })[], profile: Profile): string {
  const top = signals.filter((s) => s.score > 0).slice(0, 3);
  if (!top.length) return `No ranked signals for ${company.name} under the ${profile.name} profile yet.`;
  const lead = top[0];
  const hook = hookLine(lead, company.name);
  const why = whyNow(lead, profile, company).split(". ").slice(1, 3).join(". ").trim();
  const second = top[1] ? `Also noticed: ${top[1].title.toLowerCase()}.` : "";
  return [
    `Subject: ${subject(lead, company.name)}`,
    ``,
    `Hi {{first_name}},`,
    ``,
    hook,
    why ? `${why}${why.endsWith(".") ? "" : "."}` : "",
    second,
    ``,
    `We help ${profile.buyer.toLowerCase()}s with ${profile.sells}. Worth a 15-minute look at how that maps to what ${company.name} is doing right now?`,
    ``,
    `{{sender_name}}`,
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

function subject(s: SignalRow, co: string): string {
  switch (s.type) {
    case "hiring.people_exec_open": return `${co}'s next people leader`;
    case "hiring.hr_leader_open": return `New HR leadership at ${co}`;
    case "hiring.recruiting_open": return `${co}'s recruiting team is growing`;
    case "hiring.hris_open": return `HR systems work at ${co}`;
    case "hiring.payroll_open": return `Payroll hiring at ${co}`;
    case "hiring.comp_benefits_open": return `Total rewards at ${co}`;
    case "hiring.volume": return `${co}'s hiring volume`;
    case "hiring.intl_footprint": return `${co}'s multi-country hiring`;
    case "exec.officer_change": return `Leadership change at ${co}`;
    case "corp.acquisition": return `Post-acquisition HR at ${co}`;
    case "risk.restructuring": case "risk.warn_notice": return `Supporting ${co} through the restructuring`;
    case "stack.hris_detected": case "stack.ats_detected": return `Quick question about ${co}'s HR stack`;
    default: return `Quick note re ${co}`;
  }
}

function hookLine(s: SignalRow, co: string): string {
  const p = s.payload_json ? JSON.parse(s.payload_json) as Record<string, unknown> : {};
  switch (s.type) {
    case "hiring.people_exec_open": return `Saw ${co} is hiring a ${p.title}. That seat usually comes with a fresh look at the people-tech stack.`;
    case "hiring.hr_leader_open": return `Noticed the open ${p.title} role at ${co}.`;
    case "hiring.recruiting_open": return `${co} has ${p.count} recruiting roles open right now (${(p.titles as string[] | undefined)?.slice(0, 2).join(", ")}).`;
    case "hiring.hr_generalist_open": return `${co} is adding HR capacity: ${p.count} open HR / HRBP roles.`;
    case "hiring.hris_open": return `${co} is hiring HR-systems people (${(p.titles as string[] | undefined)?.slice(0, 2).join(", ")}), which usually means an implementation or clean-up is underway.`;
    case "hiring.payroll_open": return `${co} has ${p.count} payroll roles open.`;
    case "hiring.comp_benefits_open": return `${co} is hiring in total rewards (${(p.titles as string[] | undefined)?.slice(0, 2).join(", ")}).`;
    case "hiring.learning_open": return `${co} is building out L&D (${(p.titles as string[] | undefined)?.slice(0, 2).join(", ")}).`;
    case "hiring.volume": return `${co} is carrying ${Number(p.open_roles).toLocaleString()} open roles at the moment.`;
    case "hiring.intl_footprint": return `${co} is hiring across ${p.countries} countries.`;
    case "exec.officer_change": return `Saw the 8-K on the officer change at ${co} (${p.filed_at}).`;
    case "corp.acquisition": return `Congrats on closing the acquisition (8-K, ${p.filed_at}).`;
    case "risk.restructuring": return `Read the 8-K on the restructuring at ${co}.`;
    case "risk.warn_notice": return `Saw the WARN filing in ${p.state}.`;
    case "stack.hris_detected": return `Noticed ${co} runs ${p.vendor} for HR.`;
    case "stack.ats_detected": return `Noticed ${co} runs ${p.vendor} for recruiting.`;
    case "stack.tool_mentioned": return `Your job posts mention ${(p.tools as string[] | undefined)?.slice(0, 2).join(" and ")}.`;
    default: return s.summary || s.title;
  }
}
