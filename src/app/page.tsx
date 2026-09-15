import Link from "next/link";
import { cookies } from "next/headers";
import { Header, Ticker, Panel, Strength, GroupBadge } from "@/components/Chrome";
import { getProfile, getTape, getStats, topMovers, tickerItems } from "@/lib/queries";
import { SIGNAL_LABEL, PROFILES } from "@/lib/profiles";
import { whyNow } from "@/lib/whynow";
import { VENDOR_BY_KEY } from "@/lib/vendors";
import { stateCode } from "@/lib/classify";

export const dynamic = "force-dynamic";

const GROUPS = ["ALL", "HIRING", "STACK", "FILINGS", "RISK", "LIST"];

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const g = typeof sp.g === "string" ? sp.g.toUpperCase() : "ALL";
  const type = typeof sp.t === "string" ? sp.t : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const min = typeof sp.min === "string" ? Number(sp.min) : 0;
  const help = sp.help === "1";
  const profile = getProfile((await cookies()).get("hrt_profile")?.value);
  const stats = getStats();
  const tape = getTape(profile, { group: g === "ALL" ? undefined : g, type, q, minStrength: min || undefined, limit: 300 });
  const movers = topMovers(profile, 14);
  const ticker = tickerItems(profile, 40);
  const atsTotal = stats.ats.reduce((a, r) => a + r.n, 0);
  const typeCounts = stats.byType;

  return (
    <div className="flex flex-col min-h-screen pb-[22px]">
      <Header profile={profile} stats={stats} />
      <main className="flex-1 grid grid-cols-12 gap-[6px] p-[6px] min-h-0" style={{ height: "calc(100vh - 62px - 22px)" }}>
        <div className="col-span-12 grid grid-cols-2 md:grid-cols-5 gap-[6px]">
          {[
            { href: "/globe", k: "F6", t: "GLOBE", d: "Situation room: HQs, arcs to hiring countries, live replay" },
            { href: "/cards", k: "F7", t: "BATTLECARDS", d: "One page per account: triggers, proof, stack angle, who to find, opening line" },
            { href: "/campaign", k: "F8", t: "CAMPAIGN", d: "Segment → account list → sequence → CSV for your sequencer" },
            { href: "/matrix", k: "F9", t: "MATRIX", d: "Who runs what, by sector. Click a cell to attack it" },
            { href: "/timeline", k: "F10", t: "TIMELINE", d: "Dated triggers: what changed this week, what to follow up" },
          ].map((x) => (
            <Link key={x.href} href={x.href} className="panel px-3 py-1.5 hover:bg-panel2 hover:outline hover:outline-1 hover:outline-amber">
              <div className="flex items-center gap-2"><span className="kbd">{x.k}</span><span className="text-amber tracking-widest font-bold text-[11px]">{x.t}</span></div>
              <div className="text-muted text-[10.5px] leading-tight mt-0.5">{x.d}</div>
            </Link>
          ))}
        </div>
        {/* TAPE */}
        <Panel k="1" title={`Signal tape · ranked for ${profile.name}`} className="col-span-12 lg:col-span-8 h-full" right={<span>{tape.length} rows</span>}>
          <div className="flex flex-wrap items-center gap-1 px-2 py-1 border-b border-line bg-[#070707] sticky top-0 z-[2]">
            {GROUPS.map((x) => (<Link key={x} href={`/?g=${x}${q ? `&q=${encodeURIComponent(q)}` : ""}${min ? `&min=${min}` : ""}`} className={`badge cursor-pointer ${g === x && !type ? "bg-amber text-black border-amber" : "text-muted border-line2 hover:text-amber"}`}>{x}</Link>))}
            <span className="text-dim mx-1">|</span>
            {[3, 4, 5].map((m) => (<Link key={m} href={`/?g=${g}&min=${m}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`badge cursor-pointer ${min === m ? "bg-amber text-black border-amber" : "text-muted border-line2 hover:text-amber"}`}>≥{m}●</Link>))}
            {type && <span className="badge text-amber border-amber">{SIGNAL_LABEL[type] || type} <Link href={`/?g=${g}`} className="ml-1">✕</Link></span>}
            <form className="ml-auto flex items-center gap-1" action="/" method="get">
              <input type="hidden" name="g" value={g} />
              <input name="q" defaultValue={q || ""} placeholder="filter company / title" className="bg-black border border-line px-2 py-0.5 text-[11px] outline-none focus:border-amber w-[200px]" />
            </form>
          </div>
          {help && <Help />}
          <table className="tbl">
            <thead><tr><th>Date</th><th>#</th><th>Company</th><th>Group</th><th>Signal · why now</th><th>Str</th><th className="num">Score</th><th className="hidden xl:table-cell">ATS</th><th className="hidden xl:table-cell">HQ</th></tr></thead>
            <tbody>
              {tape.map((s) => (
                <tr key={s.id} className="row-hover">
                  <td className="text-muted whitespace-nowrap">{s.observed_at.slice(0, 10)}</td>
                  <td className="text-dim num">{s.rank}</td>
                  <td><Link href={`/a/${s.company_slug}`} className="text-fg font-semibold link block truncate max-w-[150px]" title={s.company_name}>{s.company_name}</Link></td>
                  <td><Link href={`/?t=${s.type}`}><GroupBadge type={s.type} /></Link></td>
                  <td className="w-full max-w-0">
                    <Link href={`/a/${s.company_slug}#s${s.id}`} className="link text-amber2 block truncate">{s.title}</Link>
                    <div className="text-muted text-[11px] truncate" title={whyNow(s, profile, { name: s.company_name })}>{whyNow(s, profile, { name: s.company_name })}</div>
                  </td>
                  <td className="whitespace-nowrap"><Strength n={s.strength} /></td>
                  <td className="num text-amber font-semibold">{s.score.toFixed(1)}</td>
                  <td className="text-muted hidden xl:table-cell"><span className="block truncate max-w-[110px]">{s.ats_vendor ? (VENDOR_BY_KEY[s.ats_vendor]?.name || s.ats_vendor) : "–"}</span></td>
                  <td className="text-muted whitespace-nowrap hidden xl:table-cell">{stateCode(s.hq_state)}</td>
                </tr>
              ))}
              {tape.length === 0 && <tr><td colSpan={9} className="text-muted p-4">No signals match. Run the pipeline (npm run pipeline) or clear filters.</td></tr>}
            </tbody>
          </table>
        </Panel>

        {/* RIGHT COLUMN */}
        <div className="col-span-12 lg:col-span-4 grid grid-rows-[auto_1fr_auto_auto] gap-[6px] min-h-0 h-full">
          <Panel k="2" title="Market overview" right={<span>Fortune 500 · 2026</span>}>
            <div className="grid grid-cols-3 gap-px bg-line">
              <Stat label="Companies" value={stats.companies} />
              <Stat label="ATS known" value={`${Math.round((100 * atsTotal) / stats.companies)}%`} sub={`${atsTotal}`} />
              <Stat label="Boards pulled" value={stats.withRoles} sub="live JSON" />
              <Stat label="Open roles" value={stats.openRoles.toLocaleString()} />
              <Stat label="HR roles found" value={stats.hrJobs.toLocaleString()} />
              <Stat label="Signals" value={stats.signals.toLocaleString()} />
              <Stat label="8-K filings" value={stats.filings.toLocaleString()} sub="365d" />
              <Stat label="WARN (CA)" value={stats.warn} sub="matched" />
              <Stat label="Profiles" value={PROFILES.length} sub="offer types" />
            </div>
          </Panel>
          <Panel k="3" title={`Top accounts · ${profile.short}`} right={<Link href="/u" className="link">UNIV →</Link>}>
            <table className="tbl">
              <thead><tr><th>#</th><th>Company</th><th>ATS</th><th className="num">Sig</th><th className="num">Score</th></tr></thead>
              <tbody>
                {movers.map((c) => (
                  <tr key={c.id} className="row-hover">
                    <td className="text-dim num">{c.rank}</td>
                    <td className="w-full max-w-0"><Link href={`/a/${c.slug}`} className="link text-fg font-semibold block truncate">{c.name}</Link><div className="text-dim text-[10.5px] truncate">{c.top_type ? SIGNAL_LABEL[c.top_type] : ""}</div></td>
                    <td className="text-muted"><span className="block truncate max-w-[90px]">{c.ats_vendor ? (VENDOR_BY_KEY[c.ats_vendor]?.name || c.ats_vendor) : "–"}</span></td>
                    <td className="num text-muted">{c.signals}</td>
                    <td className="num text-amber font-semibold">{c.score.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel k="4" title="ATS / HRIS share" right={<Link href="/u?sort=ats_vendor&dir=asc" className="link">by vendor →</Link>}>
            <div className="p-2 grid grid-cols-1 gap-[3px]">
              {stats.ats.slice(0, 8).map((r) => (
                <Link key={r.ats_vendor} href={`/u?vendor=${r.ats_vendor}`} className="grid grid-cols-[110px_1fr_40px] items-center gap-2 hover:text-amber">
                  <span className="truncate text-muted">{VENDOR_BY_KEY[r.ats_vendor]?.name || r.ats_vendor}</span>
                  <span className="bar"><i style={{ width: `${(100 * r.n) / (stats.ats[0]?.n || 1)}%` }} /></span>
                  <span className="num text-fg">{r.n}</span>
                </Link>
              ))}
            </div>
          </Panel>
          <Panel k="5" title="Signal mix" right={<Link href="/run" className="link">RUN →</Link>}>
            <div className="p-2 grid grid-cols-2 gap-x-4 gap-y-[2px] text-[11px]">
              {typeCounts.slice(0, 14).map((t) => (
                <Link key={t.type} href={`/?t=${t.type}`} className="flex justify-between gap-2 hover:text-amber"><span className="truncate text-muted">{SIGNAL_LABEL[t.type] || t.type}</span><span className="num text-fg">{t.n}</span></Link>
              ))}
            </div>
          </Panel>
        </div>
      </main>
      <Ticker items={ticker} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-panel px-2 py-1.5">
      <div className="label">{label}</div>
      <div className="text-amber text-[15px] font-semibold glow leading-tight">{value}</div>
      {sub && <div className="text-dim text-[10px]">{sub}</div>}
    </div>
  );
}

function Help() {
  return (
    <div className="p-3 border-b border-line bg-[#070707] text-[11.5px] grid md:grid-cols-2 gap-4 fade-in">
      <div>
        <div className="text-amber tracking-widest mb-1">KEYS</div>
        <div className="grid grid-cols-[60px_1fr] gap-y-[2px]"><span className="kbd w-fit">⌘K</span><span>command line: company, ticker, domain or command</span><span className="kbd w-fit">/</span><span>same</span><span className="kbd w-fit">F1</span><span>this help</span><span className="kbd w-fit">F2</span><span>tape</span><span className="kbd w-fit">F3</span><span>universe (all 500)</span><span className="kbd w-fit">F4</span><span>run report (what the pipeline found)</span><span className="kbd w-fit">F5</span><span>change offer profile</span><span className="kbd w-fit">F6-10</span><span>globe · battlecards · campaign · matrix · timeline</span></div>
        <div className="text-amber tracking-widest mt-3 mb-1">COMMANDS</div>
        <div className="text-muted">TAPE · UNIV · PROF · RUN · GLOBE · CARDS · CAMPAIGN · MATRIX · TIMELINE · HIRING · STACK · FILINGS · RISK · and any profile: ATS, SOURCE, ASSESS, SCREEN, HRIS, PAYROLL, BENEFIT, COMPLY, PERFORM, COMP, WFM, GLOBAL</div>
      </div>
      <div>
        <div className="text-amber tracking-widest mb-1">HOW TO READ THE TAPE</div>
        <p className="text-muted">Every row is one public fact about one Fortune 500 company. <b className="text-fg">Str</b> is how strong the fact is on its own (1-5). <b className="text-fg">Score</b> is strength × how much your offer profile cares about that kind of fact. Change the profile and the same facts re-rank.</p>
        <p className="text-muted mt-2"><span className="badge b-hiring">HIRING</span> open HR-function roles and board facts · <span className="badge b-stack">STACK</span> the ATS / HRIS / tools a company runs · <span className="badge b-filings">FILINGS</span> SEC 8-K items 5.02 / 2.01 · <span className="badge b-risk">RISK</span> 8-K 2.05 and WARN layoffs · <span className="badge b-list">LIST</span> facts from the Fortune list itself.</p>
        <p className="text-dim mt-2">v0 is a single snapshot. Change-over-time signals (velocity, new states, ATS switches) start on the second run. <Link href="/" className="link text-amber">close</Link></p>
      </div>
    </div>
  );
}
