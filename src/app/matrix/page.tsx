import Link from "next/link";
import { cookies } from "next/headers";
import { Header } from "@/components/Chrome";
import { getProfile, getStats, getMatrix } from "@/lib/queries";
import { VENDOR_BY_KEY } from "@/lib/vendors";

export const dynamic = "force-dynamic";

export default async function Matrix({ searchParams }: PageProps<"/matrix">) {
  const sp = await searchParams;
  const axis = sp.axis === "hris" ? "hris_vendor" : "ats_vendor";
  const metric = sp.m === "roles" ? "roles" : sp.m === "score" ? "score" : "n";
  const profile = getProfile((await cookies()).get("hrt_profile")?.value);
  const stats = getStats();
  const { cells, vendors, sectors } = getMatrix(profile, axis);
  let max = 0; for (const v of vendors) for (const s of sectors) max = Math.max(max, cells[v]?.[s]?.[metric] || 0);
  const totalsV: Record<string, number> = {}; const totalsS: Record<string, number> = {};
  for (const v of vendors) for (const s of sectors) { const x = cells[v]?.[s]?.[metric] || 0; totalsV[v] = (totalsV[v] || 0) + x; totalsS[s] = (totalsS[s] || 0) + x; }
  const fmt = (x: number) => metric === "roles" ? (x >= 1000 ? (x / 1000).toFixed(1) + "k" : String(x)) : metric === "score" ? x.toFixed(0) : String(x);
  return (
    <div className="flex flex-col min-h-screen">
      <Header profile={profile} stats={stats} />
      <main className="flex-1 p-[6px]">
        <section className="panel">
          <div className="panel-title"><span><span className="k">4</span>Stack matrix · who runs what, by sector · click a cell to build the campaign</span><span className="normal-case tracking-normal flex gap-1">
            <Link href={`/matrix?axis=ats&m=${metric}`} className={`badge ${axis === "ats_vendor" ? "bg-amber text-black border-amber" : "text-muted border-line2"}`}>ATS</Link>
            <Link href={`/matrix?axis=hris&m=${metric}`} className={`badge ${axis === "hris_vendor" ? "bg-amber text-black border-amber" : "text-muted border-line2"}`}>HRIS</Link>
            <span className="text-dim mx-1">|</span>
            {[["n", "accounts"], ["roles", "open roles"], ["score", `score · ${profile.short}`]].map(([k, l]) => (<Link key={k} href={`/matrix?axis=${axis === "ats_vendor" ? "ats" : "hris"}&m=${k}`} className={`badge ${metric === k ? "bg-amber text-black border-amber" : "text-muted border-line2"}`}>{l}</Link>))}
          </span></div>
          <div className="overflow-auto">
            <table className="tbl text-[11px]">
              <thead><tr><th className="sticky left-0 bg-panel z-[2]">Vendor</th>{sectors.map((s) => <th key={s} className="num" title={s}><span className="block max-w-[92px] truncate">{s}</span></th>)}<th className="num">Total</th></tr></thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v} className="row-hover">
                    <td className="sticky left-0 bg-panel z-[1] whitespace-nowrap"><Link href={`/campaign?vendor=${v}`} className="link text-cyan">{VENDOR_BY_KEY[v]?.name || v}</Link></td>
                    {sectors.map((s) => {
                      const c = cells[v]?.[s]; const x = c?.[metric] || 0; const a = max ? x / max : 0;
                      return (
                        <td key={s} className="num p-0">
                          {c ? (
                            <Link href={`/campaign?vendor=${v}&sector=${encodeURIComponent(s)}`} className="block px-2 py-1 hover:outline hover:outline-1 hover:outline-amber" style={{ background: `rgba(255,158,27,${0.06 + a * 0.75})`, color: a > 0.55 ? "#000" : "#e8e6e3" }} title={`${VENDOR_BY_KEY[v]?.name || v} × ${s}: ${c.n} accounts, ${c.roles.toLocaleString()} open roles. Top: ${c.cos.slice(0, 3).map((x) => x.name).join(", ")}`}>{fmt(x)}</Link>
                          ) : <span className="block px-2 py-1 text-[#222]">·</span>}
                        </td>
                      );
                    })}
                    <td className="num text-amber font-semibold">{fmt(totalsV[v] || 0)}</td>
                  </tr>
                ))}
                <tr><td className="sticky left-0 bg-panel text-muted">Total</td>{sectors.map((s) => <td key={s} className="num text-muted">{fmt(totalsS[s] || 0)}</td>)}<td className="num text-amber font-semibold">{fmt(Object.values(totalsV).reduce((a, b) => a + b, 0))}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 text-[11px] text-muted border-t border-line">Read it as displacement territory. A dense cell on a legacy vendor (Taleo, BrassRing, SuccessFactors Recruiting) is a campaign: pick the cell, export the CSV, run the sequence. Hover a cell for the top accounts in it.</div>
        </section>
      </main>
    </div>
  );
}
