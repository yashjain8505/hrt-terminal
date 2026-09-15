import { buildBundle } from "@/lib/bundle";
import { detectSituations, situationStory, SITUATION_BY_KEY, type JobIn, type SignalIn } from "@/lib/situations";
import { PROFILE_BY_KEY, PROFILES } from "@/lib/profiles";
import { VENDOR_BY_KEY } from "@/lib/vendors";
import { stateCode } from "@/lib/classify";

export const dynamic = "force-dynamic";

/** CSV of every account in a situation (or all), ranked newest first, with proof and first line. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const profile = PROFILE_BY_KEY[u.searchParams.get("profile") || ""] || PROFILES[0];
  const sit = u.searchParams.get("situation") || "all";
  const book = (u.searchParams.get("book") || "").split(/[\s,;]+/).map((x) => x.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "")).filter(Boolean);
  const b = buildBundle();
  const asOf = String(b.meta.generated);
  const jobsByCo = new Map<number, JobIn[]>(); for (const j of b.jobs as unknown as (JobIn & { company_id: number })[]) { if (!jobsByCo.has(j.company_id)) jobsByCo.set(j.company_id, []); jobsByCo.get(j.company_id)!.push(j); }
  const sigsByCo = new Map<number, SignalIn[]>(); for (const s of b.signals as unknown as (SignalIn & { company_id: number })[]) { if (!sigsByCo.has(s.company_id)) sigsByCo.set(s.company_id, []); sigsByCo.get(s.company_id)!.push(s); }
  const rows: string[] = [];
  const e = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  type Co = { id: number; name: string; slug: string; domain: string | null; sector: string | null; hq_city: string | null; hq_state: string | null; employees: number | null; ats_vendor: string | null; hris_vendor: string | null; open_roles: number | null; careers_url: string | null };
  const out: { co: Co; s: ReturnType<typeof detectSituations>[number] }[] = [];
  for (const co of b.companies as unknown as Co[]) {
    if (book.length && !(co.domain && book.includes(co.domain.toLowerCase()))) continue;
    const sn = (b.snapshots as Record<number, { tools?: Record<string, number>; countries?: Record<string, number> }>)[co.id] || null;
    for (const s of detectSituations(co, jobsByCo.get(co.id) || [], sigsByCo.get(co.id) || [], sn, asOf)) {
      if (s.confidence === "low" || !s.openedAt) continue;
      if (sit !== "all" && s.key !== sit) continue;
      out.push({ co, s });
    }
  }
  out.sort((a, b2) => (b2.s.openedAt! > a.s.openedAt! ? 1 : -1));
  rows.push(["company", "domain", "sector", "hq_city", "hq_state", "employees", "runs", "open_roles", "situation", "headline", "trigger_date", "window_ends", "confidence", "fact_1", "fact_1_date", "fact_1_url", "fact_2", "fact_2_date", "fact_2_url", "contact_title_1", "contact_title_2", "contact_title_3", "what_it_means", "first_line", "careers_url"].join(","));
  const vname = (k: string | null) => (k ? VENDOR_BY_KEY[k]?.name || k : "");
  for (const { co, s } of out) {
    const st = situationStory(s, co, profile);
    const f = s.facts;
    rows.push([co.name, co.domain, co.sector, co.hq_city, stateCode(co.hq_state), co.employees, vname(co.ats_vendor || co.hris_vendor), co.open_roles, SITUATION_BY_KEY[s.key].name, s.headline, s.openedAt, s.windowEnds, s.confidence, f[0]?.text, f[0]?.date, f[0]?.url, f[1]?.text, f[1]?.date, f[1]?.url, st.who[0], st.who[1], st.who[2], st.means, st.firstLine, co.careers_url].map(e).join(","));
  }
  const name = `hrt-${sit}-${profile.key}-${asOf}.csv`;
  return new Response(rows.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` } });
}
