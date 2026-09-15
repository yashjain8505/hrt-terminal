import type { Profile } from "./profiles";
import type { SignalRow } from "./whynow";
import { whyNow } from "./whynow";
import { buyerTitles, incumbentAngle, DISCOVERY_QUESTIONS, FAMILY_PITCH } from "./playbook";
import { VENDOR_BY_KEY } from "./vendors";
import { SIGNAL_LABEL } from "./profiles";

export interface CardInput {
  company: { name: string; rank: number; domain: string | null; sector: string | null; industry: string | null; hq_city: string | null; hq_state: string | null; employees: number | null; ats_vendor: string | null; hris_vendor: string | null; stack_json: string | null; open_roles: number | null; careers_url: string | null; ats_board_url: string | null };
  signals: (SignalRow & { score: number })[];
  counts: Record<string, number>;
  states: Record<string, number>;
  countries: Record<string, number>;
  tools: Record<string, number>;
}

export interface Battlecard {
  headline: string;
  triggers: { title: string; why: string; url: string | null; group: string; score: number; type: string; date: string }[];
  stack: { label: string; angle: string | null }[];
  buyers: string[];
  opening: string;
  questions: string[];
  risks: string[];
  footprint: string;
  pitch: string;
}

function pl(n: number, w: string) { return `${n} ${w}${n === 1 ? "" : "s"}`; }

export function buildBattlecard(inp: CardInput, profile: Profile): Battlecard {
  const { company: c } = inp;
  const ranked = inp.signals.filter((s) => s.score > 0);
  const triggers = ranked.slice(0, 5).map((s) => ({ title: s.title, why: whyNow(s, profile, c), url: s.source_url, group: s.type.split(".")[0].toUpperCase(), score: s.score, type: s.type, date: s.observed_at.slice(0, 10) }));
  const stackKeys = new Set<string>();
  if (c.ats_vendor) stackKeys.add(c.ats_vendor);
  if (c.hris_vendor) stackKeys.add(c.hris_vendor);
  for (const k of (c.stack_json ? JSON.parse(c.stack_json) as string[] : [])) stackKeys.add(k);
  const stack = [...stackKeys].map((k) => ({ label: `${VENDOR_BY_KEY[k]?.name || k}${VENDOR_BY_KEY[k] ? " · " + VENDOR_BY_KEY[k].category : ""}`, angle: incumbentAngle(k, profile) }));
  const toolNames = Object.entries(inp.tools).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k);
  const lead = ranked[0];
  const headline = lead ? (lead.title.toLowerCase().startsWith((SIGNAL_LABEL[lead.type] || "").toLowerCase().split(" ")[0]) ? lead.title : `${SIGNAL_LABEL[lead.type] || "Trigger"}: ${lead.title}`) : "No ranked trigger for this profile yet";
  const risks = ranked.filter((s) => s.type.startsWith("risk.")).map((s) => `${s.observed_at.slice(0, 10)} · ${s.title}`);
  const hrRoles = Object.values(inp.counts).reduce((a, b) => a + b, 0);
  const topStates = Object.entries(inp.states).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(", ");
  const intl = Object.keys(inp.countries).filter((k) => k.length === 2 && k !== "US").length;
  const footprint = c.open_roles != null
    ? `${c.open_roles.toLocaleString()} open roles · ${pl(hrRoles, "HR-function role")} found${topStates ? ` · top states ${topStates}` : ""}${intl ? ` · hiring in ${intl} other countries` : ""}${toolNames.length ? ` · JDs name ${toolNames.join(", ")}` : ""}`
    : "Job board not pulled in v0 (ATS without an open API or custom site).";
  const qs: string[] = [];
  for (const t of triggers.slice(0, 3)) for (const q of DISCOVERY_QUESTIONS[t.type] || []) { if (qs.length < 5 && !qs.includes(q)) qs.push(q.replace("{tools}", toolNames.join(", ") || "tools")); }
  const opening = lead ? openingLine(lead, c.name, profile) : `Hi {{first_name}}, quick note on ${c.name} and ${FAMILY_PITCH[profile.family]}.`;
  return { headline, triggers, stack, buyers: buyerTitles(profile), opening, questions: qs, risks, footprint, pitch: FAMILY_PITCH[profile.family] };
}

function openingLine(s: SignalRow, co: string, profile: Profile): string {
  const p = s.payload_json ? JSON.parse(s.payload_json) as Record<string, unknown> : {};
  const titles = (p.titles as string[] | undefined)?.slice(0, 2).join(" and ");
  const pitch = FAMILY_PITCH[profile.family];
  switch (s.type) {
    case "hiring.people_exec_open": return `Hi {{first_name}}, saw ${co} is hiring a ${p.title}. New people leaders usually re-look at ${profile.sells.split(",")[0]} in their first quarter. Happy to share what peers changed first, before the seat is filled.`;
    case "hiring.hr_leader_open": return `Hi {{first_name}}, noticed the ${p.title} opening at ${co}. Whoever lands there inherits the ${profile.sells.split(",")[0]} decision. Worth a short conversation now so the option is on the table on day one?`;
    case "hiring.recruiting_open": return `Hi {{first_name}}, ${co} has ${p.count} recruiting roles open (${titles}). Teams that are growing recruiters are usually also fighting throughput. We help with ${pitch}. Open to 15 minutes?`;
    case "hiring.hris_open": return `Hi {{first_name}}, ${co} is hiring ${titles}, which normally means HR systems work is underway. If integrations or a ${profile.sells.split(",")[0]} decision are on that roadmap, I can show what similar rollouts did in the first 90 days.`;
    case "hiring.payroll_open": return `Hi {{first_name}}, ${co} has ${p.count} payroll roles open. Payroll teams add people when volume or complexity outruns the system. We help with ${pitch}. Worth comparing notes?`;
    case "hiring.comp_benefits_open": return `Hi {{first_name}}, saw ${co} hiring in total rewards (${titles}). If a cycle or plan redesign is coming, we help with ${pitch}. Open to a quick call?`;
    case "hiring.hr_generalist_open": return `Hi {{first_name}}, ${co} is adding HR capacity (${p.count} open HR roles). That is usually when manual process load gets budget. We help with ${pitch}.`;
    case "hiring.learning_open": return `Hi {{first_name}}, ${co} is building out L&D (${titles}). We help with ${pitch}. Curious what platform the new programmes will run on?`;
    case "hiring.volume": return `Hi {{first_name}}, ${co} is carrying ${Number(p.open_roles).toLocaleString()} open roles. At that volume, ${pitch} is worth real money. Can I show you the maths for a team your size?`;
    case "hiring.intl_footprint": return `Hi {{first_name}}, ${co} is hiring across ${p.countries} countries. We help with ${pitch}. Which countries are hardest right now?`;
    case "exec.officer_change": return `Hi {{first_name}}, saw the 8-K on the leadership change at ${co}. Transitions tend to reopen vendor decisions. If ${profile.sells.split(",")[0]} is one of them, I can share how peers handled the switch.`;
    case "corp.acquisition": return `Hi {{first_name}}, congratulations on closing the acquisition. Integrating the acquired workforce usually forces HR-system and payroll consolidation. We help with ${pitch}. Worth a conversation before the integration plan is locked?`;
    case "risk.restructuring": return `Hi {{first_name}}, read the 8-K on the restructuring at ${co}. Not a growth pitch: we help teams do more with fewer people and fewer vendors (${pitch}). If consolidation is on the table, happy to help scope it.`;
    case "risk.warn_notice": return `Hi {{first_name}}, saw the WARN filing in ${p.state}. Offboarding and compliance load spikes around these. We help with ${pitch}. If useful, I can share what others did in the first 30 days.`;
    case "stack.hris_detected": return `Hi {{first_name}}, ${co} runs ${p.vendor} for HR. We integrate natively and cover what ${p.vendor} leaves open (${pitch}). Worth 15 minutes to compare?`;
    case "stack.ats_detected": return `Hi {{first_name}}, ${co} recruits on ${p.vendor}. We sit alongside it and add ${pitch}. When does the contract next come up?`;
    case "stack.tool_mentioned": return `Hi {{first_name}}, your job posts mention ${(p.tools as string[] | undefined)?.slice(0, 2).join(" and ")}. We complement that stack with ${pitch}. Open to a short comparison?`;
    default: return `Hi {{first_name}}, quick note on ${co}: ${s.title.toLowerCase()}. We help with ${pitch}. Worth a conversation?`;
  }
}
