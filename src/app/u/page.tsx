import Link from "next/link";
import { cookies } from "next/headers";
import { Header, Ticker, Panel, fmtNum, fmtMoney } from "@/components/Chrome";
import { getProfile, getUniverse, getStats, tickerItems } from "@/lib/queries";
import { SIGNAL_LABEL } from "@/lib/profiles";
import { VENDOR_BY_KEY } from "@/lib/vendors";
import { stateCode } from "@/lib/classify";

export const dynamic = "force-dynamic";

const COLS: { key: string; label: string; num?: boolean }[] = [
  { key: "rank", label: "#", num: true }, { key: "name", label: "Company" }, { key: "sector", label: "Sector" }, { key: "hq_state", label: "HQ" }, { key: "employees", label: "Employees", num: true }, { key: "revenue_m", label: "Revenue", num: true },
  { key: "ats_vendor", label: "ATS" }, { key: "hris_vendor", label: "HRIS" }, { key: "detect_status", label: "Detect" }, { key: "open_roles", label: "Open roles", num: true }, { key: "hr_roles", label: "HR roles", num: true }, { key: "signals", label: "Signals", num: true }, { key: "score", label: "Score", num: true },
];

export default async function Universe({ searchParams }: PageProps<"/u">) {
  const sp = await searchParams;
  const sort = typeof sp.sort === "string" ? sp.sort : "score";
  const dir = typeof sp.dir === "string" ? sp.dir : "desc";
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const vendor = typeof sp.vendor === "string" ? sp.vendor : "";
  const profile = getProfile((await cookies()).get("hrt_profile")?.value);
  const stats = getStats();
  const rows = getUniverse(profile, { sort, dir, q, status, vendor });
  const link = (over: Record<string, string>) => { const p = new URLSearchParams({ sort, dir, q, status, vendor, ...over }); for (const [k, v] of [...p.entries()]) if (!v) p.delete(k); return `/u?${p.toString()}`; };
  return (
    <div className="flex flex-col min-h-screen pb-[22px]">
      <Header profile={profile} stats={stats} />
      <main className="flex-1 p-[6px] min-h-0" style={{ height: "calc(100vh - 62px - 22px)" }}>
        <Panel k="3" title={`Universe · Fortune 500 (2026) · ranked for ${profile.name}`} className="h-full" right={<span>{rows.length} companies</span>}>
          <div className="flex flex-wrap items-center gap-1 px-2 py-1 border-b border-line bg-[#070707] sticky top-0 z-[2] text-[11px]">
            <span className="label mr-1">Detect</span>
            {["", "pullable", "detected", "careers_only", "unreachable", "none"].map((s) => (<Link key={s || "all"} href={link({ status: s })} className={`badge cursor-pointer ${status === s ? "bg-amber text-black border-amber" : "text-muted border-line2 hover:text-amber"}`}>{s || "ALL"}</Link>))}
            {vendor && <span className="badge text-amber border-amber ml-2">{VENDOR_BY_KEY[vendor]?.name || vendor} <Link href={link({ vendor: "" })} className="ml-1">✕</Link></span>}
            <form className="ml-auto flex items-center gap-1" action="/u" method="get">
              <input type="hidden" name="sort" value={sort} /><input type="hidden" name="dir" value={dir} />{status && <input type="hidden" name="status" value={status} />}{vendor && <input type="hidden" name="vendor" value={vendor} />}
              <input name="q" defaultValue={q} placeholder="filter name / domain / sector / state" className="bg-black border border-line px-2 py-0.5 outline-none focus:border-amber w-[240px]" />
            </form>
          </div>
          <table className="tbl">
            <thead>
              <tr>{COLS.map((c) => (<th key={c.key} className={c.num ? "num" : ""}><Link href={link({ sort: c.key, dir: sort === c.key && dir === "desc" ? "asc" : "desc" })} className={`link ${sort === c.key ? "text-amber" : ""}`}>{c.label}{sort === c.key ? (dir === "desc" ? " ▼" : " ▲") : ""}</Link></th>))}<th>Top signal</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="row-hover">
                  <td className="num text-dim">{r.rank}</td>
                  <td className="whitespace-nowrap"><Link href={`/a/${r.slug}`} className="link text-fg font-semibold">{r.name}</Link>{r.newcomer ? <span className="badge b-list ml-1">NEW</span> : null}</td>
                  <td className="text-muted whitespace-nowrap">{r.sector}</td>
                  <td className="text-muted" title={r.hq_state || ""}>{stateCode(r.hq_state)}</td>
                  <td className="num text-muted">{fmtNum(r.employees)}</td>
                  <td className="num text-muted">{fmtMoney(r.revenue_m)}</td>
                  <td className="whitespace-nowrap">{r.ats_vendor ? <Link href={link({ vendor: r.ats_vendor })} className="link text-cyan">{VENDOR_BY_KEY[r.ats_vendor]?.name || r.ats_vendor}</Link> : <span className="text-dim">–</span>}</td>
                  <td className="whitespace-nowrap text-magenta">{r.hris_vendor ? (VENDOR_BY_KEY[r.hris_vendor]?.name || r.hris_vendor) : <span className="text-dim">–</span>}</td>
                  <td><span className={`text-[10.5px] ${r.detect_status === "pullable" ? "text-green" : r.detect_status === "detected" ? "text-cyan" : r.detect_status === "careers_only" ? "text-yellow" : "text-dim"}`}>{r.detect_status}</span></td>
                  <td className="num text-fg">{r.open_roles != null ? fmtNum(r.open_roles) : <span className="text-dim">–</span>}</td>
                  <td className="num text-fg">{r.hr_roles || <span className="text-dim">–</span>}</td>
                  <td className="num text-muted">{r.signals}</td>
                  <td className="num text-amber font-semibold">{r.score.toFixed(1)}</td>
                  <td className="text-muted text-[11px] whitespace-nowrap">{r.top_type ? SIGNAL_LABEL[r.top_type] : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </main>
      <Ticker items={tickerItems(profile, 30)} />
    </div>
  );
}
