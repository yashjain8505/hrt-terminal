import Link from "next/link";
import { cookies } from "next/headers";
import { Header, Ticker, Panel } from "@/components/Chrome";
import { getProfile, getStats, tickerItems } from "@/lib/queries";
import { SIGNAL_LABEL } from "@/lib/profiles";
import { VENDOR_BY_KEY } from "@/lib/vendors";

export const dynamic = "force-dynamic";
const STATUS_HELP: Record<string, string> = { pullable: "Board found and its JSON API answered. Full hiring data.", detected: "ATS identified from links/assets, but no open API in v0 (iCIMS, SuccessFactors, Oracle, Taleo...).", careers_only: "Careers page found, ATS hidden behind a custom front-end. Next: Radancy/Eightfold adapters, deeper crawl.", unreachable: "Homepage blocked the crawler (bot protection). Next: headless browser or careers-domain guessing.", none: "Reached the site, found no careers link. Next: search-engine assisted discovery.", no_domain: "No domain resolved." };

export default async function Run() {
  const profile = getProfile((await cookies()).get("hrt_profile")?.value);
  const s = getStats();
  const total = s.companies || 1;
  return (
    <div className="flex flex-col min-h-screen pb-[22px]">
      <Header profile={profile} stats={s} />
      <main className="flex-1 p-[6px] grid grid-cols-12 gap-[6px]">
        <Panel k="4" title="Run report · what v0 found and where it is blind" className="col-span-12 lg:col-span-6">
          <div className="p-3 text-[11.5px] space-y-3">
            <div>
              <div className="label mb-1">Careers / ATS detection across {s.companies} companies</div>
              {s.detect.map((r) => (
                <div key={r.detect_status} className="grid grid-cols-[110px_1fr_60px] items-center gap-2 mb-[3px]">
                  <Link href={`/u?status=${r.detect_status}`} className={`link ${r.detect_status === "pullable" ? "text-green" : r.detect_status === "detected" ? "text-cyan" : r.detect_status === "careers_only" ? "text-yellow" : "text-muted"}`}>{r.detect_status}</Link>
                  <span className="bar"><i style={{ width: `${(100 * r.n) / total}%` }} /></span>
                  <span className="num text-fg">{r.n} · {Math.round((100 * r.n) / total)}%</span>
                  <div className="col-span-3 text-dim text-[10.5px] -mt-[2px] mb-1">{STATUS_HELP[r.detect_status] || ""}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="label mb-1">Coverage</div>
              <ul className="list-disc pl-4 text-muted space-y-[2px]">
                <li><span className="text-fg">{s.withRoles}</span> boards pulled live · <span className="text-fg">{s.openRoles.toLocaleString()}</span> open roles counted · <span className="text-fg">{s.hrJobs.toLocaleString()}</span> HR-function postings classified.</li>
                <li><span className="text-fg">{s.filings.toLocaleString()}</span> 8-K filings (365d) from the SEC submissions API for every registrant we could match.</li>
                <li><span className="text-fg">{s.warn}</span> WARN notices matched (California EDD workbook only in v0).</li>
                <li>Last board snapshot: <span className="text-fg">{s.lastSnapshot || "never"}</span>. One snapshot only, so no change-over-time signals yet.</li>
              </ul>
            </div>
            <div>
              <div className="label mb-1">Known blind spots (v0)</div>
              <ul className="list-disc pl-4 text-muted space-y-[2px]">
                <li>Big custom career sites (Apple, Microsoft, Google, Walmart) expose no open API; Amazon has a hand-written adapter.</li>
                <li>iCIMS / SuccessFactors / Oracle / Taleo boards are detected but not pulled. Each needs its own adapter.</li>
                <li>Workday keyword search matches descriptions, so bucket counts are a floor, not a census. The HR job-family facet (where present) is exact.</li>
                <li>8-K Item 5.02 covers any officer change, not only HR leaders. Reading the filing text to spot CHRO/CPO changes is the next step.</li>
                <li>WARN: only California. TX, NY, WA, IL, FL publish dashboards or PDFs and need scrapers.</li>
                <li>Form 5500 (benefits) and H-1B LCA (immigration) feeds are not built; BENEFIT and GLOBAL profiles run on partial data.</li>
              </ul>
            </div>
          </div>
        </Panel>
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-[6px]">
          <Panel k="6" title="ATS vendors detected">
            <table className="tbl"><thead><tr><th>Vendor</th><th>Category</th><th className="num">Companies</th><th>Pull</th></tr></thead>
              <tbody>{s.ats.map((r) => { const v = VENDOR_BY_KEY[r.ats_vendor]; return (<tr key={r.ats_vendor} className="row-hover"><td><Link href={`/u?vendor=${r.ats_vendor}`} className="link text-cyan">{v?.name || r.ats_vendor}</Link></td><td className="text-muted">{v?.category || "custom"}</td><td className="num text-fg">{r.n}</td><td className={v?.pull ? "text-green" : "text-dim"}>{v?.pull ? "yes" : r.ats_vendor === "custom" ? "adapter" : "no"}</td></tr>); })}</tbody></table>
          </Panel>
          <Panel k="7" title="Signals by type">
            <table className="tbl"><thead><tr><th>Type</th><th>Label</th><th className="num">Count</th></tr></thead>
              <tbody>{s.byType.map((t) => (<tr key={t.type} className="row-hover"><td className="text-muted">{t.type}</td><td><Link href={`/?t=${t.type}`} className="link">{SIGNAL_LABEL[t.type] || t.type}</Link></td><td className="num text-fg">{t.n}</td></tr>))}</tbody></table>
          </Panel>
          <Panel k="8" title="Pipeline log">
            <table className="tbl"><thead><tr><th>Step</th><th>Finished</th><th>OK</th><th>Note</th></tr></thead>
              <tbody>{s.runs.map((r, i) => (<tr key={i} className="row-hover"><td className="text-amber">{r.step}</td><td className="text-muted whitespace-nowrap">{r.finished_at}</td><td className={r.ok ? "text-green" : "text-red"}>{r.ok ? "ok" : "fail"}</td><td className="text-muted text-[10.5px]">{r.note}</td></tr>))}</tbody></table>
          </Panel>
        </div>
      </main>
      <Ticker items={tickerItems(profile, 30)} />
    </div>
  );
}
