import Link from "next/link";
import { cookies } from "next/headers";
import { Header, fmtNum } from "@/components/Chrome";
import Copy from "@/components/Copy";
import { getProfile, getStats, getSectors, getStates } from "@/lib/queries";
import { buildCampaign, parseFilters } from "@/lib/campaign";
import { sequenceTemplate } from "@/lib/sequence";
import { SIGNAL_LABEL } from "@/lib/profiles";
import { VENDOR_BY_KEY, VENDORS } from "@/lib/vendors";
import { stateCode } from "@/lib/classify";

export const dynamic = "force-dynamic";

const TYPES = ["", "hiring.people_exec_open", "hiring.hr_leader_open", "hiring.recruiting_open", "hiring.hris_open", "hiring.payroll_open", "hiring.comp_benefits_open", "hiring.learning_open", "hiring.intl_footprint", "exec.officer_change", "corp.acquisition", "risk.restructuring", "risk.warn_notice", "fortune.newcomer"];

export default async function Campaign({ searchParams }: PageProps<"/campaign">) {
  const sp = await searchParams;
  const profile = getProfile((await cookies()).get("hrt_profile")?.value);
  const stats = getStats();
  const f = parseFilters(sp);
  const lines = buildCampaign(profile, f);
  const sectors = getSectors(); const states = getStates();
  const qs = new URLSearchParams(); for (const [k, v] of Object.entries(f)) if (v) qs.set(k, String(v));
  const seq = sequenceTemplate(profile);
  const vendorOpts = VENDORS.filter((v) => v.category === "ats" || v.category === "hris").map((v) => v.key);
  const segment = [f.vendor ? (VENDOR_BY_KEY[f.vendor]?.name || f.vendor) : "any vendor", f.sector || "any sector", f.state || "any state", f.minRoles ? `≥${f.minRoles} open roles` : "", f.type ? SIGNAL_LABEL[f.type] : ""].filter(Boolean).join(" · ");
  return (
    <div className="flex flex-col min-h-screen">
      <Header profile={profile} stats={stats} />
      <main className="flex-1 p-[6px] grid grid-cols-12 gap-[6px]">
        <section className="panel col-span-12">
          <div className="panel-title"><span><span className="k">3</span>Campaign builder · segment → list → sequence → CSV</span><span className="normal-case tracking-normal text-muted">{lines.length} accounts · {segment}</span></div>
          <form action="/campaign" method="get" className="flex flex-wrap items-end gap-3 px-3 py-2 text-[11px]">
            <label className="flex flex-col gap-0.5"><span className="label">Incumbent vendor</span><select name="vendor" defaultValue={f.vendor || ""} className="bg-black border border-line px-1 py-0.5"><option value="">any</option>{vendorOpts.map((v) => <option key={v} value={v}>{VENDOR_BY_KEY[v].name}</option>)}</select></label>
            <label className="flex flex-col gap-0.5"><span className="label">Sector</span><select name="sector" defaultValue={f.sector || ""} className="bg-black border border-line px-1 py-0.5"><option value="">any</option>{sectors.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            <label className="flex flex-col gap-0.5"><span className="label">HQ state</span><select name="state" defaultValue={f.state || ""} className="bg-black border border-line px-1 py-0.5"><option value="">any</option>{states.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            <label className="flex flex-col gap-0.5"><span className="label">Min open roles</span><input name="minRoles" defaultValue={f.minRoles || ""} placeholder="e.g. 500" className="bg-black border border-line px-1 py-0.5 w-[90px]" /></label>
            <label className="flex flex-col gap-0.5"><span className="label">Must have trigger</span><select name="type" defaultValue={f.type || ""} className="bg-black border border-line px-1 py-0.5"><option value="">any</option>{TYPES.filter(Boolean).map((t) => <option key={t} value={t}>{SIGNAL_LABEL[t]}</option>)}</select></label>
            <label className="flex flex-col gap-0.5"><span className="label">Max accounts</span><input name="limit" defaultValue={f.limit || 100} className="bg-black border border-line px-1 py-0.5 w-[70px]" /></label>
            <button className="kbd hover:text-amber h-[22px] px-3">BUILD</button>
            <a href={`/api/export?${qs.toString()}`} className="kbd text-amber hover:bg-amber hover:text-black h-[22px] px-3 flex items-center">⬇ EXPORT CSV ({lines.length})</a>
            <Link href={`/cards?${new URLSearchParams({ n: String(Math.min(48, lines.length)), vendor: f.vendor || "", sector: f.sector || "" }).toString()}`} className="kbd hover:text-amber h-[22px] px-3 flex items-center">BATTLECARDS →</Link>
            <span className="text-dim ml-auto">CSV columns: triggers with proof URLs, buyer titles, opening line, incumbent angle. Add emails in your sequencer.</span>
          </form>
        </section>

        <section className="panel col-span-12 lg:col-span-8 min-h-0">
          <div className="panel-title"><span>Account list</span><span className="normal-case tracking-normal text-muted">ranked for {profile.name}</span></div>
          <div className="overflow-auto max-h-[70vh]">
            <table className="tbl">
              <thead><tr><th>#</th><th>Company</th><th>HQ</th><th className="num">Roles</th><th>Runs</th><th>Lead trigger · opening line</th><th>Find</th><th className="num">Score</th></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.row.id} className="row-hover align-top">
                    <td className="text-dim num">{l.row.rank}</td>
                    <td className="whitespace-nowrap"><Link href={`/a/${l.row.slug}`} className="link text-fg font-semibold">{l.row.name}</Link><div className="text-dim text-[10.5px]">{l.row.sector}</div></td>
                    <td className="text-muted whitespace-nowrap">{stateCode(l.row.hq_state)}<div className="text-dim text-[10.5px]">{fmtNum(l.row.employees)}</div></td>
                    <td className="num text-muted">{l.row.open_roles != null ? fmtNum(l.row.open_roles) : "–"}</td>
                    <td className="text-cyan whitespace-nowrap">{l.incumbent}</td>
                    <td className="w-full max-w-0">
                      <div className="text-amber2 truncate" title={l.headline}>{l.headline}</div>
                      <div className="text-muted text-[11px] line-clamp-2" title={l.opening}>{l.opening}</div>
                      <div className="flex gap-2 mt-0.5 text-[10.5px]">{l.proof && <a href={l.proof} target="_blank" className="text-cyan link">proof ↗</a>}<Copy text={l.opening} label="COPY LINE" /><Link href={`/cards?slug=${l.row.slug}`} className="kbd hover:text-amber">CARD</Link></div>
                    </td>
                    <td className="text-[10.5px] whitespace-nowrap"><a href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`"${l.buyer}" ${l.row.name}`)}`} target="_blank" className="badge b-list hover:text-amber">{l.buyer}</a></td>
                    <td className="num text-amber font-semibold">{l.row.score.toFixed(1)}</td>
                  </tr>
                ))}
                {lines.length === 0 && <tr><td colSpan={8} className="p-3 text-muted">No accounts match this segment.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel col-span-12 lg:col-span-4">
          <div className="panel-title"><span>Sequence template · {profile.short}</span><Copy text={seq.map((s) => `${s.step}\n${s.subject ? "Subject: " + s.subject + "\n" : ""}${s.body}`).join("\n\n---\n\n")} /></div>
          <div className="p-3 text-[11.5px] space-y-3">
            {seq.map((s) => (
              <div key={s.step}>
                <div className="text-amber tracking-widest text-[10.5px]">{s.step}</div>
                {s.subject && <div className="text-muted">Subject: {s.subject}</div>}
                <pre className="mono-pre text-fg/90 border border-line bg-[#070707] p-2 mt-1">{s.body}</pre>
              </div>
            ))}
            <div className="text-dim">Merge fields map to CSV columns: opening_line, trigger_1 (trigger_subject / trigger_short), trigger_1_url (proof_url), buyer_title_1, incumbent, incumbent_angle.</div>
          </div>
        </section>
      </main>
    </div>
  );
}
