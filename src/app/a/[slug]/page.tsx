import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Header, Ticker, Panel, Strength, GroupBadge, fmtMoney, fmtNum } from "@/components/Chrome";
import Copy from "@/components/Copy";
import { getProfile, getCompany, getCompanySignals, getCompanyJobs, getSnapshot, getFilings, getWarn, getStats, tickerItems } from "@/lib/queries";
import { whyNow } from "@/lib/whynow";
import { draftOutreach } from "@/lib/outreach";
import { VENDOR_BY_KEY, JD_TOOLS } from "@/lib/vendors";
import { BUCKET_LABEL, stateName, type Bucket } from "@/lib/classify";


export const dynamic = "force-dynamic";

const ITEM_LABEL: Record<string, string> = { "1.01": "Material agreement", "1.02": "Termination of agreement", "2.01": "Acquisition/disposition completed", "2.02": "Results of operations", "2.03": "Direct financial obligation", "2.05": "Exit / disposal costs", "2.06": "Material impairments", "3.01": "Delisting notice", "3.03": "Modification of security rights", "5.01": "Change in control", "5.02": "Officer/director departure or appointment", "5.03": "Bylaw amendments", "5.07": "Shareholder vote", "7.01": "Reg FD disclosure", "8.01": "Other events", "9.01": "Exhibits" };

export default async function Account({ params }: PageProps<"/a/[slug]">) {
  const { slug } = await params;
  const co = getCompany(slug);
  if (!co) notFound();
  const profile = getProfile((await cookies()).get("hrt_profile")?.value);
  const stats = getStats();
  const signals = getCompanySignals(co.id, profile);
  const jobs = getCompanyJobs(co.id);
  const snap = getSnapshot(co.id);
  const filings = getFilings(co.id);
  const warns = getWarn(co.id);
  const stack: string[] = co.stack_json ? JSON.parse(co.stack_json) : [];
  const counts: Record<string, number> = snap ? JSON.parse(snap.counts_json || "{}") : {};
  const states: Record<string, number> = snap ? JSON.parse(snap.states_json || "{}") : {};
  const countries: Record<string, number> = snap ? JSON.parse(snap.countries_json || "{}") : {};
  const tools: Record<string, number> = snap ? JSON.parse(snap.tools_json || "{}") : {};
  const facets: Record<string, { label: string; count: number }[]> = snap ? JSON.parse(snap.facets_json || "{}") : {};
  const hrJobs = jobs.filter((j) => j.bucket);
  const otherJobs = jobs.filter((j) => !j.bucket);
  const draft = draftOutreach(co, signals, profile);
  const total = signals.reduce((a, s) => a + s.score, 0);
  const topStates = Object.entries(states).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topCountries = Object.entries(countries).filter(([k]) => k.length === 2).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="flex flex-col min-h-screen pb-[22px]">
      <Header profile={profile} stats={stats} />
      <main className="flex-1 p-[6px] grid grid-cols-12 gap-[6px]">
        {/* HEADER STRIP */}
        <div className="col-span-12 panel">
          <div className="flex flex-wrap items-stretch divide-x divide-line">
            <div className="px-3 py-2 min-w-[260px]">
              <div className="text-dim text-[10px] tracking-widest">FORTUNE 500 #{co.rank}{co.rank_change ? <span className={co.rank_change > 0 ? "text-green" : "text-red"}> {co.rank_change > 0 ? "▲" : "▼"}{Math.abs(co.rank_change)}</span> : null}{co.ticker && <span className="text-cyan ml-2">{co.ticker}</span>}</div>
              <h1 className="text-amber text-[20px] font-bold glow leading-tight">{co.name}</h1>
              <div className="text-muted">{co.sector} · {co.industry}</div>
              <div className="text-muted">{co.hq_city}{co.hq_city && co.hq_state ? ", " : ""}{co.hq_state} · {co.domain && <a href={co.website || `https://${co.domain}`} target="_blank" className="link text-cyan">{co.domain}</a>}</div>
            </div>
            <Cell label="Employees" value={fmtNum(co.employees)} sub={co.jobs_growth ? "grew YoY" : undefined} subClass="text-green" />
            <Cell label="Revenue" value={fmtMoney(co.revenue_m)} sub={co.revenue_change_pct != null ? `${co.revenue_change_pct > 0 ? "+" : ""}${co.revenue_change_pct}%` : undefined} subClass={co.revenue_change_pct != null && co.revenue_change_pct < 0 ? "text-red" : "text-green"} />
            <Cell label="Profit" value={fmtMoney(co.profit_m)} />
            <Cell label="Mkt value" value={fmtMoney(co.market_value_m)} />
            <Cell label="ATS" value={co.ats_vendor ? (VENDOR_BY_KEY[co.ats_vendor]?.name || co.ats_vendor) : "unknown"} sub={co.detect_status || undefined} />
            <Cell label="HRIS" value={co.hris_vendor ? (VENDOR_BY_KEY[co.hris_vendor]?.name || co.hris_vendor) : "–"} />
            <Cell label="Open roles" value={co.open_roles != null ? fmtNum(co.open_roles) : "–"} sub={snap ? "snapshot " + snap.taken_at.slice(0, 10) : "board not pulled"} />
            <Cell label={`Score · ${profile.short}`} value={total.toFixed(1)} sub={`${signals.length} signals`} valClass="text-amber glow" />
            <div className="px-3 py-2 flex flex-col gap-1 justify-center text-[11px]">
              <Link href={`/cards?slug=${co.slug}`} className="kbd text-amber hover:bg-amber hover:text-black w-fit">BATTLECARD →</Link>
              {co.careers_url && <a href={co.careers_url} target="_blank" className="link text-cyan">careers site ↗</a>}
              {co.ats_board_url && <a href={co.ats_board_url} target="_blank" className="link text-cyan">job board ↗</a>}
              {co.fortune_url && <a href={co.fortune_url} target="_blank" className="link text-cyan">fortune profile ↗</a>}
              {co.cik && <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${co.cik}&type=8-K&dateb=&owner=include&count=40`} target="_blank" className="link text-cyan">EDGAR 8-Ks ↗</a>}
            </div>
          </div>
        </div>

        {/* SIGNALS */}
        <Panel k="1" title={`Signals · ranked for ${profile.name}`} className="col-span-12 lg:col-span-7" right={<span>{signals.length} rows</span>}>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Group</th><th>Signal · why now</th><th>Str</th><th className="num">Score</th><th>Src</th></tr></thead>
            <tbody>
              {signals.map((s) => (
                <tr key={s.id} id={`s${s.id}`} className="row-hover">
                  <td className="text-muted whitespace-nowrap">{s.observed_at.slice(0, 10)}</td>
                  <td><Link href={`/?t=${s.type}`}><GroupBadge type={s.type} /></Link></td>
                  <td className="w-full max-w-0">
                    <div className="text-amber2 font-semibold">{s.title}</div>
                    <div className="text-fg/90 text-[11.5px]">{whyNow(s, profile, co)}</div>
                    {s.summary && <div className="text-dim text-[10.5px]">{s.summary}</div>}
                  </td>
                  <td className="whitespace-nowrap"><Strength n={s.strength} /></td>
                  <td className="num text-amber font-semibold">{s.score.toFixed(1)}</td>
                  <td className="text-muted text-[10.5px] whitespace-nowrap">{s.source_url ? <a href={s.source_url} target="_blank" className="link text-cyan">{s.source} ↗</a> : s.source}</td>
                </tr>
              ))}
              {signals.length === 0 && <tr><td colSpan={6} className="p-3 text-muted">No signals yet for this company.</td></tr>}
            </tbody>
          </table>
        </Panel>

        {/* RIGHT COLUMN */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-[6px]">
          <Panel k="2" title="Draft outreach" right={<Copy text={draft} />}>
            <pre className="mono-pre p-3 text-[11.5px] text-fg/90 leading-relaxed">{draft}</pre>
          </Panel>
          <Panel k="3" title="HR stack evidence">
            <div className="p-2 grid grid-cols-1 gap-2 text-[11.5px]">
              <div>
                <div className="label mb-1">Detected on careers site</div>
                <div className="flex flex-wrap gap-1">
                  {stack.length === 0 && <span className="text-dim">nothing detected{co.detect_note ? ` (${co.detect_note.slice(0, 80)})` : ""}</span>}
                  {stack.map((k) => { const v = VENDOR_BY_KEY[k]; return <span key={k} className={`badge ${v?.category === "hris" ? "b-filings" : v?.category === "ats" ? "b-stack" : "b-list"}`}>{v?.name || k} · {v?.category || "?"}</span>; })}
                </div>
              </div>
              <div>
                <div className="label mb-1">Named in job descriptions {snap?.ats_vendor === "workday" || snap?.ats_vendor === "phenom" || snap?.ats_vendor === "custom" ? "(search hits)" : "(regex over JD text)"}</div>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(tools).length === 0 && <span className="text-dim">none found</span>}
                  {Object.entries(tools).sort((a, b) => b[1] - a[1]).map(([k, n]) => { const t = JD_TOOLS.find((x) => x.key === k); return <span key={k} className="badge b-hiring">{t?.name || k} <span className="text-dim">{t?.category}</span> · {n}</span>; })}
                </div>
              </div>
            </div>
          </Panel>
          <Panel k="4" title="Hiring footprint" right={snap ? <span>{snap.ats_vendor}</span> : undefined}>
            {!snap && <div className="p-3 text-muted">Board not pulled ({co.detect_status}). {co.careers_url && <a href={co.careers_url} target="_blank" className="link text-cyan">careers ↗</a>}</div>}
            {snap && (
              <div className="p-2 grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <div className="label mb-1">HR-function roles open</div>
                  {Object.keys(counts).length === 0 && <div className="text-dim">none in sample</div>}
                  {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([b, n]) => (<div key={b} className="flex justify-between"><span className="text-muted">{BUCKET_LABEL[b as Bucket] || b}</span><span className="text-fg num">{n}</span></div>))}
                  {facets.hrFamily && <div className="mt-2 text-dim">HR job family on board: {facets.hrFamily.map((f) => `${f.label} ${f.count}`).join(", ")}</div>}
                </div>
                <div>
                  <div className="label mb-1">Top US states</div>
                  {topStates.length === 0 && <div className="text-dim">n/a</div>}
                  {topStates.map(([s, n]) => (<div key={s} className="flex justify-between"><span className="text-muted">{stateName(s)}</span><span className="text-fg num">{n}</span></div>))}
                </div>
                <div>
                  <div className="label mb-1">Countries</div>
                  {topCountries.length === 0 && <div className="text-dim">n/a</div>}
                  {topCountries.map(([s, n]) => (<div key={s} className="flex justify-between"><span className="text-muted">{s}</span><span className="text-fg num">{n}</span></div>))}
                </div>
                <div>
                  {facets.workerSubType && (<><div className="label mb-1">Worker types</div>{facets.workerSubType.slice(0, 6).map((f) => (<div key={f.label} className="flex justify-between"><span className="text-muted truncate">{f.label}</span><span className="text-fg num">{f.count}</span></div>))}</>)}
                  {facets.timeType && (<><div className="label mt-2 mb-1">Time type</div>{facets.timeType.slice(0, 4).map((f) => (<div key={f.label} className="flex justify-between"><span className="text-muted truncate">{f.label}</span><span className="text-fg num">{f.count}</span></div>))}</>)}
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* OPEN HR ROLES */}
        <Panel k="5" title="Open HR-function roles" className="col-span-12 lg:col-span-7" right={<span>{hrJobs.length} found · {otherJobs.length} other sampled</span>}>
          <table className="tbl">
            <thead><tr><th>Bucket</th><th>Title</th><th>Location</th><th>Posted</th></tr></thead>
            <tbody>
              {hrJobs.map((j) => (
                <tr key={j.id} className="row-hover">
                  <td className="whitespace-nowrap"><span className="badge b-hiring">{BUCKET_LABEL[j.bucket as Bucket] || j.bucket}</span></td>
                  <td className="w-full max-w-0">{j.url ? <a href={j.url} target="_blank" className="link text-fg">{j.title} ↗</a> : j.title}</td>
                  <td className="text-muted">{j.location}{j.remote ? " · remote" : ""}</td>
                  <td className="text-dim whitespace-nowrap">{j.posted_at || j.posted_text || ""}</td>
                </tr>
              ))}
              {hrJobs.length === 0 && <tr><td colSpan={4} className="p-3 text-muted">{snap ? "No HR-function titles matched in the pulled sample." : "Board not pulled."}</td></tr>}
            </tbody>
          </table>
        </Panel>

        {/* FILINGS + WARN */}
        <Panel k="6" title="SEC 8-K filings · 365d" className="col-span-12 lg:col-span-5" right={<span>{filings.length}</span>}>
          {warns.length > 0 && (
            <div className="p-2 border-b border-line">
              <div className="label mb-1 text-red">WARN notices (CA)</div>
              {warns.map((w, i) => (<div key={i} className="flex justify-between gap-2 text-[11px]"><span className="text-muted truncate">{w.notice_date} · {w.company_name_raw} · {w.location.split("|")[0]}</span><span className="text-red num">{w.employees}</span></div>))}
            </div>
          )}
          <table className="tbl">
            <thead><tr><th>Filed</th><th>Form</th><th>Items</th></tr></thead>
            <tbody>
              {filings.map((f, i) => (
                <tr key={i} className="row-hover">
                  <td className="text-muted whitespace-nowrap">{f.filed_at}</td>
                  <td><a href={f.url} target="_blank" className="link text-cyan">{f.form} ↗</a></td>
                  <td className="text-[11px]">{f.items.split(",").filter(Boolean).map((it) => <span key={it} className={`mr-2 ${/5\.02|2\.05|2\.01/.test(it) ? "text-amber" : "text-muted"}`} title={ITEM_LABEL[it.trim()] || ""}>{it.trim()}{ITEM_LABEL[it.trim()] && /5\.02|2\.05|2\.01/.test(it) ? ` ${ITEM_LABEL[it.trim()]}` : ""}</span>)}</td>
                </tr>
              ))}
              {filings.length === 0 && <tr><td colSpan={3} className="p-3 text-muted">{co.cik ? "No 8-Ks in window." : "No SEC registrant matched (private or mutual company)."}</td></tr>}
            </tbody>
          </table>
        </Panel>

        {otherJobs.length > 0 && (
          <Panel k="7" title="Other sampled postings" className="col-span-12">
            <div className="p-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">{otherJobs.map((j) => <span key={j.id}>{j.url ? <a href={j.url} target="_blank" className="link">{j.title}</a> : j.title}<span className="text-dim"> · {j.location}</span></span>)}</div>
          </Panel>
        )}
      </main>
      <Ticker items={tickerItems(profile, 30)} />
    </div>
  );
}

function Cell({ label, value, sub, subClass = "text-dim", valClass = "text-fg" }: { label: string; value: string; sub?: string; subClass?: string; valClass?: string }) {
  return (
    <div className="px-3 py-2 min-w-[110px]">
      <div className="label">{label}</div>
      <div className={`text-[15px] font-semibold leading-tight ${valClass}`}>{value}</div>
      {sub && <div className={`text-[10px] ${subClass}`}>{sub}</div>}
    </div>
  );
}

